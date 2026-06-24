#!/usr/bin/env python3
"""Recover the Cam 2 relay when Thingino moves to a new DHCP address."""

from __future__ import annotations

import argparse
import base64
import concurrent.futures
import datetime as dt
import ipaddress
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


ENV_FILE = Path(os.environ.get("CAM2_RECOVER_ENV_FILE", "/etc/hatchingpoint/cam2-relay.env"))
GO2RTC_CONFIG = Path(os.environ.get("CAM2_RECOVER_GO2RTC_CONFIG", "/opt/cayley-relay/go2rtc.yaml"))
STATE_FILE = Path(os.environ.get("CAM2_RECOVER_STATE_FILE", "/var/lib/hatchingpoint/cam2-recover-state.json"))
RELAY_SERVICE = os.environ.get("CAM2_RECOVER_RELAY_SERVICE", "hatchingpoint-cam2-relay.service")
GO2RTC_CONTAINER = os.environ.get("CAM2_RECOVER_GO2RTC_CONTAINER", "cayley-go2rtc")
NETWORKS = os.environ.get("CAM2_RECOVER_NETWORKS", "192.168.4.0/22")
USERNAME = os.environ.get("CAM2_RELAY_USERNAME", "root")
PASSWORD = os.environ.get("CAM2_RELAY_PASSWORD", "root")
SCAN_WORKERS = int(os.environ.get("CAM2_RECOVER_SCAN_WORKERS", "160"))
CONNECT_TIMEOUT = float(os.environ.get("CAM2_RECOVER_CONNECT_TIMEOUT", "0.28"))


@dataclass
class Probe:
    host: str
    score: int = 0
    login_ok: bool = False
    motor_ok: bool = False
    snapshot_ok: bool = False
    rtsp_ok: bool = False
    http_status: int | None = None
    rtsp_status: str | None = None
    error: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.login_ok and self.snapshot_ok and self.rtsp_ok


def utc_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def host_from_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urllib.parse.urlsplit(value)
    if parsed.hostname:
        return parsed.hostname
    if re.match(r"^\d+\.\d+\.\d+\.\d+$", value):
        return value
    return None


def current_upstream_host() -> str | None:
    return host_from_url(read_env_file(ENV_FILE).get("CAM2_RELAY_UPSTREAM"))


def http_request(
    host: str,
    path: str,
    *,
    method: str = "GET",
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 2.5,
    read_limit: int = 512,
) -> tuple[int, dict[str, str], bytes]:
    request = urllib.request.Request(
        f"http://{host}{path}",
        data=body,
        headers=headers or {},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, dict(response.headers.items()), response.read(read_limit)
    except urllib.error.HTTPError as error:
        return error.code, dict(error.headers.items()), error.read(read_limit)


def login_cookie(host: str) -> tuple[bool, str | None, int | None, str | None]:
    payload = json.dumps({
        "username": USERNAME,
        "password": base64.b64encode(PASSWORD.encode("utf-8")).decode("ascii"),
        "encoding": "base64",
    }, separators=(",", ":")).encode("utf-8")
    try:
        status, headers, body = http_request(
            host,
            "/x/login.cgi",
            method="POST",
            body=payload,
            headers={"Content-Type": "application/json", "User-Agent": "cam2-recover"},
            timeout=2.5,
        )
    except Exception as error:
        return False, None, None, str(error)

    cookie = headers.get("Set-Cookie", "").split(";", 1)[0]
    if 200 <= status < 300 and cookie:
        return True, cookie, status, None
    return False, None, status, body.decode("utf-8", "replace")[:160]


def check_motor(host: str, cookie: str) -> bool:
    status, _, body = http_request(
        host,
        "/x/json-motor-params.cgi",
        headers={"Cookie": cookie, "User-Agent": "cam2-recover"},
        timeout=2.5,
        read_limit=4096,
    )
    if not (200 <= status < 300):
        return False
    try:
        parsed = json.loads(body.decode("utf-8", "replace"))
    except json.JSONDecodeError:
        return False
    return isinstance(parsed, dict) and ("steps_pan" in parsed or "steps_tilt" in parsed)


def check_snapshot(host: str, cookie: str) -> bool:
    status, headers, body = http_request(
        host,
        "/x/ch0.jpg",
        headers={"Cookie": cookie, "User-Agent": "cam2-recover"},
        timeout=3.0,
        read_limit=32,
    )
    content_type = headers.get("Content-Type", "").lower()
    return 200 <= status < 300 and (body.startswith(b"\xff\xd8") or "image/jpeg" in content_type)


def check_rtsp(host: str) -> tuple[bool, str]:
    ffprobe = shutil.which("ffprobe")
    if ffprobe:
        command = [
            ffprobe,
            "-v",
            "error",
            "-rtsp_transport",
            "tcp",
            "-timeout",
            "4000000",
            f"rtsp://thingino:thingino@{host}/ch0",
            "-show_streams",
            "-of",
            "compact=p=0:nk=1",
        ]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=6, check=False)
        except subprocess.TimeoutExpired:
            return False, "ffprobe_timeout"
        if result.returncode == 0 and "h264" in result.stdout.lower():
            return True, "ffprobe_h264"
        return False, (result.stderr or result.stdout or f"ffprobe_{result.returncode}")[:180]

    try:
        with socket.create_connection((host, 554), timeout=1.5) as sock:
            request = (
                f"DESCRIBE rtsp://thingino:thingino@{host}/ch0 RTSP/1.0\r\n"
                "CSeq: 1\r\n"
                "User-Agent: cam2-recover\r\n"
                "Accept: application/sdp\r\n\r\n"
            ).encode("ascii")
            sock.sendall(request)
            response = sock.recv(200).decode("latin1", "replace")
        return "RTSP/1.0 200" in response, response.splitlines()[0] if response else "empty_rtsp"
    except OSError as error:
        return False, str(error)


def probe_host(host: str) -> Probe:
    probe = Probe(host=host)
    try:
        login_ok, cookie, status, error = login_cookie(host)
        probe.login_ok = login_ok
        probe.http_status = status
        if error:
            probe.error = error
        if login_ok and cookie:
            probe.score += 4
            probe.motor_ok = check_motor(host, cookie)
            if probe.motor_ok:
                probe.score += 3
            probe.snapshot_ok = check_snapshot(host, cookie)
            if probe.snapshot_ok:
                probe.score += 3
            probe.rtsp_ok, probe.rtsp_status = check_rtsp(host)
            if probe.rtsp_ok:
                probe.score += 2
        return probe
    except Exception as error:
        probe.error = str(error)
        return probe


def port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(CONNECT_TIMEOUT)
        return sock.connect_ex((host, port)) == 0


def scan_hosts() -> list[str]:
    hosts: list[str] = []
    for raw_network in NETWORKS.split(","):
        raw_network = raw_network.strip()
        if raw_network:
            hosts.extend(str(host) for host in ipaddress.ip_network(raw_network, strict=False).hosts())

    def has_camera_ports(host: str) -> str | None:
        try:
            if port_open(host, 80) and port_open(host, 554):
                return host
        except OSError:
            return None
        return None

    found: list[str] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=SCAN_WORKERS) as executor:
        for result in executor.map(has_camera_ports, hosts):
            if result:
                found.append(result)
    return found


def arp_hosts() -> list[str]:
    try:
        result = subprocess.run(["ip", "neigh", "show"], capture_output=True, text=True, timeout=3, check=False)
    except Exception:
        return []
    hosts: list[str] = []
    for line in result.stdout.splitlines():
        match = re.match(r"^(\d+\.\d+\.\d+\.\d+)\s+", line)
        if match:
            hosts.append(match.group(1))
    return hosts


def unique_hosts(hosts: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for host in hosts:
        if host and host not in seen:
            seen.add(host)
            ordered.append(host)
    return ordered


def find_best_candidate(current_host: str | None) -> tuple[Probe | None, list[Probe]]:
    probes: list[Probe] = []
    initial = unique_hosts([host for host in [current_host] if host])

    for host in initial:
        probe = probe_host(host)
        probes.append(probe)
        if host == current_host and probe.ok:
            return probe, probes

    candidates = unique_hosts([*initial, *scan_hosts(), *arp_hosts()])
    for host in candidates:
        if any(existing.host == host for existing in probes):
            continue
        try:
            if not (port_open(host, 80) and port_open(host, 554)):
                continue
        except OSError:
            continue
        probes.append(probe_host(host))

    valid = [probe for probe in probes if probe.ok]
    if not valid:
        return None, sorted(probes, key=lambda item: item.score, reverse=True)
    valid.sort(key=lambda item: item.score, reverse=True)
    return valid[0], sorted(probes, key=lambda item: item.score, reverse=True)


def backup(path: Path) -> None:
    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")
    shutil.copy2(path, path.with_name(f"{path.name}.bak-{stamp}"))


def update_env_file(host: str) -> bool:
    text = ENV_FILE.read_text()
    next_text, count = re.subn(
        r"^CAM2_RELAY_UPSTREAM=.*$",
        f"CAM2_RELAY_UPSTREAM=http://{host}",
        text,
        flags=re.MULTILINE,
    )
    if count == 0:
        next_text = text.rstrip() + f"\nCAM2_RELAY_UPSTREAM=http://{host}\n"
    if next_text == text:
        return False
    backup(ENV_FILE)
    ENV_FILE.write_text(next_text)
    return True


def update_go2rtc_config(host: str) -> bool:
    text = GO2RTC_CONFIG.read_text()
    next_text, count = re.subn(
        r"rtsp://thingino:thingino@[^/\"\s]+/ch0",
        f"rtsp://thingino:thingino@{host}/ch0",
        text,
    )
    if count == 0:
        raise RuntimeError(f"could not find cam2 RTSP source in {GO2RTC_CONFIG}")
    if next_text == text:
        return False
    backup(GO2RTC_CONFIG)
    GO2RTC_CONFIG.write_text(next_text)
    return True


def restart_services(env_changed: bool, go2rtc_changed: bool) -> list[str]:
    actions: list[str] = []
    if env_changed:
        subprocess.run(["systemctl", "restart", RELAY_SERVICE], check=True, timeout=20)
        actions.append(f"restarted:{RELAY_SERVICE}")
    if go2rtc_changed:
        subprocess.run(["docker", "restart", GO2RTC_CONTAINER], check=True, timeout=30, stdout=subprocess.DEVNULL)
        actions.append(f"restarted:{GO2RTC_CONTAINER}")
    return actions


def relay_status_ok() -> bool:
    env = read_env_file(ENV_FILE)
    port = env.get("CAM2_RELAY_PORT", "18082")
    try:
        status, _, body = http_request("127.0.0.1", f":{port}/api/camera2/status", timeout=3.0, read_limit=4096)
    except Exception:
        return False
    if not (200 <= status < 300):
        return False
    try:
        payload = json.loads(body.decode("utf-8", "replace"))
    except json.JSONDecodeError:
        return False
    return payload.get("ok") is True


def write_state(payload: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def run(repair: bool) -> tuple[int, dict[str, Any]]:
    started = time.monotonic()
    previous_host = current_upstream_host()
    candidate, probes = find_best_candidate(previous_host)
    actions: list[str] = []
    errors: list[str] = []
    env_changed = False
    go2rtc_changed = False

    if not candidate:
        result = {
            "ok": False,
            "state": "unrecovered",
            "checked_at": utc_now(),
            "previous_host": previous_host,
            "selected_host": None,
            "repair_enabled": repair,
            "actions": actions,
            "errors": ["no valid Thingino candidate found"],
            "probes": [asdict(probe) for probe in probes[:12]],
            "duration_ms": round((time.monotonic() - started) * 1000),
        }
        write_state(result)
        return 2, result

    if repair:
        try:
            env_changed = update_env_file(candidate.host)
            go2rtc_changed = update_go2rtc_config(candidate.host)
            actions.extend(restart_services(env_changed, go2rtc_changed))
        except Exception as error:
            errors.append(str(error))

    result = {
        "ok": candidate.ok and not errors,
        "state": "repaired" if actions else "healthy" if candidate.ok else "degraded",
        "checked_at": utc_now(),
        "previous_host": previous_host,
        "selected_host": candidate.host,
        "repair_enabled": repair,
        "changed": {
            "relay_env": env_changed,
            "go2rtc": go2rtc_changed,
        },
        "actions": actions,
        "errors": errors,
        "relay_status_ok": relay_status_ok() if repair else None,
        "candidate": asdict(candidate),
        "probes": [asdict(probe) for probe in probes[:12]],
        "duration_ms": round((time.monotonic() - started) * 1000),
    }
    write_state(result)
    return (0 if result["ok"] else 1), result


def main() -> int:
    parser = argparse.ArgumentParser(description="Recover Cam 2 relay/go2rtc config after DHCP drift.")
    parser.add_argument("--check-only", action="store_true", help="probe only; do not edit config or restart services")
    parser.add_argument("--repair", action="store_true", help="repair config drift and restart affected services")
    parser.add_argument("--quiet", action="store_true", help="only print JSON when repair fails")
    args = parser.parse_args()

    repair = args.repair or not args.check_only
    code, result = run(repair)
    if not args.quiet or code != 0:
        print(json.dumps(result, indent=2, sort_keys=True))
    return code


if __name__ == "__main__":
    sys.exit(main())
