# Cam 2 Cloudflare Tunnel

Cam 2 is exposed through a named Cloudflare Tunnel so browser media/control
traffic can bypass Vercel's serverless request path.

Public gateway:

```text
https://cam2.andysottiaux.com
```

Tunnel:

```text
Name: andysottiaux-cam2
Connector host: cayley-relay
Public hostname: cam2.andysottiaux.com
Service URL: http://localhost:18083
```

The local nginx gateway on `cayley-relay` listens at `127.0.0.1:18083` and
routes:

```text
/api/camera2/* -> http://127.0.0.1:18082
/api/webrtc    -> http://127.0.0.1:1985
```

The Vercel production build must include:

```text
NEXT_PUBLIC_V3_CAMERA_2_GATEWAY_HOST=https://cam2.andysottiaux.com
```

Do not point `NEXT_PUBLIC_V3_CAMERA_2_GATEWAY_HOST` at the `.ts.net` hostname.
Production browsers can block direct tailnet/private targets with Local/Private
Network Access checks.
