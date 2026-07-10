# Camera Cloudflare Tunnel

Cam 1 and Cam 2 are exposed through a named Cloudflare Tunnel so browser
media/control traffic can bypass Vercel's serverless request path.

Public gateways:

```text
https://cam1.andysottiaux.com
https://cam2.andysottiaux.com
```

Tunnel:

```text
Name: andysottiaux-cam2
Connector host: cayley-relay
Public hostnames: cam1.andysottiaux.com, cam2.andysottiaux.com
Service URL: http://localhost:18083
```

The local nginx gateway on `cayley-relay` listens at `127.0.0.1:18083` and
routes:

```text
/api/camera/*  -> http://127.0.0.1:8091
/api/camera2/* -> http://127.0.0.1:18082
/api/health    -> http://127.0.0.1:8091
/api/detections -> http://127.0.0.1:8091
/api/training/* -> http://127.0.0.1:8091
/api/webrtc    -> http://127.0.0.1:1985
```

The Vercel production build must include:

```text
NEXT_PUBLIC_V3_CAMERA_GATEWAY_HOST=https://cam1.andysottiaux.com
NEXT_PUBLIC_V3_CAMERA_2_GATEWAY_HOST=https://cam2.andysottiaux.com
```

Do not point either gateway host at the `.ts.net` hostname. Production browsers
can block direct tailnet/private targets with Local/Private Network Access
checks.

## Live Relay Requirements

`cayley-relay` runs the local origin services behind the Cloudflare Tunnel:

```text
hatchingpoint-cam2-relay.service -> 127.0.0.1:18082
cayley-relay.service             -> go2rtc on 127.0.0.1:1985
```

Cam 2 control expects `/api/camera2/control/ws` to accept vector movement
payloads for smooth pan/tilt:

```json
{"action":"move","x":0.25,"y":-0.1,"speed":0.35,"step":"fine"}
```

The relay should emit short motor steps at roughly 55 ms, keep movement alive
for roughly 750 ms, and ramp over roughly 120 ms. The browser sends joystick
heartbeats over WebSocket and falls back to HTTP when WebSocket is unavailable.
The tuned relay should also apply separate axis gains so the Thingino legacy
motor endpoint receives useful deltas from normal joystick movement:

```text
CAM2_RELAY_MOTION_MIN_STEP=18
CAM2_RELAY_MOTION_PAN_GAIN=3.0
CAM2_RELAY_MOTION_TILT_GAIN=4.5
CAM2_RELAY_MOTION_DEADZONE=0.04
CAM2_RELAY_MOTION_RAMP_SECONDS=0.12
```

Cam 2 quality presets must be supported by the relay with browser-compatible
H.264 settings. Current high-quality target:

```text
2304x1296, 30 fps, 12 Mbps, CBR, GOP 30
```

go2rtc must advertise public WebRTC candidates for off-tailnet browsers. Keep
the WebRTC config aligned with this shape:

```yaml
webrtc:
  listen: ":8555"
  candidates:
    - stun:8555
  ice_servers:
    - urls: [stun:stun.cloudflare.com:3478]
    - urls: [stun:stun.l.google.com:19302]
```

Validate after relay changes with:

```sh
CAMERA_TRANSPORT_AUDIT_URL=https://andysottiaux.com \
CAMERA_TRANSPORT_STREAM=cam2 \
CAMERA_TRANSPORT_OFFER_URL=https://cam2.andysottiaux.com/api/webrtc \
CAMERA_TRANSPORT_SOURCE_PARAM=src \
node scripts/audit-camera-transport.mjs
```

## Cam 2 DHCP Recovery

Cam 2 is served through `cayley-relay`, but the Thingino camera itself still
receives a LAN DHCP address. If that address changes, update both files
together:

```text
/etc/hatchingpoint/cam2-relay.env
/opt/cayley-relay/go2rtc.yaml
```

`services/cam2/cam2-recover.py` in the separate `cayley-relay` repository is
the versioned recovery utility for that failure mode.
It first probes the currently configured host. Only if that host is broken does
it scan `192.168.4.0/22` for a Thingino device, verify login, motor metadata,
snapshot JPEG, and RTSP, then update both config files and restart the affected
services.

Installed on `cayley-relay`:

```text
/opt/hatchingpoint/cam2-recover.py
/etc/systemd/system/hatchingpoint-cam2-recover.service
/etc/systemd/system/hatchingpoint-cam2-recover.timer
```

Useful commands:

```sh
sudo systemctl start hatchingpoint-cam2-recover.service
sudo systemctl status hatchingpoint-cam2-recover.timer
sudo journalctl -u hatchingpoint-cam2-recover.service -n 80 --no-pager
sudo python3 /opt/hatchingpoint/cam2-recover.py --check-only
```

Do not add a second recovery-script copy to this website repository. Relay
deployment and verification changes must be committed in `cayley-relay`.

The website also exposes same-origin diagnostics endpoints:

```text
/api/v3/camera/diagnostics
/api/v3/camera2/diagnostics
/api/v3/camera2/diagnostics?active=1
```

The default diagnostics endpoints are read-mostly. Cam 1 checks health, stream
config, sanitized snapshot, training, and detections. Passing `active=1` to Cam
2 also sends a safe `stop` command through the public control path to verify
control writes.

For a single production readiness pass across the homepage, cameras, solar, and
fundraising surfaces:

```sh
npm run monitor:production
```

## Cam 1 Runtime Notes

Cam 1 is a Thingino-style field camera behind the same `cayley-relay` tunnel.
The public browser/API path goes through Cloudflare to the relay nginx gateway,
but the camera board should not call the public gateway or the relay API port
for RKNN input frames.

The stable RKNN frame source on the Cam 1 board is the go2rtc frame endpoint on
the relay tailnet address:

```text
CAYLEY_RKNN_FRAME_SOURCE=relay
CAYLEY_RKNN_FRAME_URL=http://100.88.101.23:1984/api/frame.jpeg?src=cayley-sub
CAYLEY_RKNN_RELAY_FIELD_API=http://100.88.101.23:1984
```

This matters because `cayley-relay` binds the Python camera API at
`127.0.0.1:8091` and the Cloudflare nginx gateway at `127.0.0.1:18083`. From
the camera board, `100.88.101.23:8091` and `100.88.101.23:18083` are not valid
fresh-frame sources.

Cam 1's vendor `rkipc` process can rewrite `/userdata/rkipc.ini` from factory
defaults during restart. Keep all three profile sources aligned for the current
stream target:

```text
/tmp/rkipc-factory-config.ini
/oem/usr/share/rkipc-mis5001-500w.ini
/userdata/rkipc.ini

Target: 1280x960, 30 fps, 5 Mbps, GOP 30
```

Useful Cam 1 verification commands:

```sh
ssh root@cayley-relay 'ffprobe -v error -rtsp_transport tcp -select_streams v:0 -show_entries stream=avg_frame_rate,r_frame_rate,width,height,codec_name,profile -of json rtsp://127.0.0.1:8554/cayley-sub'
curl -s https://andysottiaux.com/api/v3/camera/diagnostics | jq '.summary'
npm run monitor:production
```
