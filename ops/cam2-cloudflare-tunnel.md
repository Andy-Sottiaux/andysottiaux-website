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
