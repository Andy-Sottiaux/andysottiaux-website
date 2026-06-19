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
