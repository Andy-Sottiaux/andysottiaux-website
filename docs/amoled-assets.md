The seven images in `public/images/amoled` are 480 × 480 captures from the exact current AMOLED firmware UI compiled against its LVGL dependency on macOS. They are software-rendered firmware previews, not device photographs.

All widget readings use the curated fictional example payload in `docs/amoled-example-payload.json`. This includes training, Runna, Claude usage, weather, and fundraising figures. No private source caches, authentication data, calendar subscriptions, or account records were used. The example source states demonstrate a connected display; the website must identify the readings as example data. The clock and calendar tiles use the renderer's local clock at capture time. The renderer pauses the carousel while capturing each frame, so `HOLD` appears in the native footer.

The frames are `clock.webp`, `weather.webp`, `runna.webp`, `training.webp`, `nyc-marathon.webp`, `time-progress.webp`, and `claude-usage.webp`. Every WebP uses lossless encoding, preserves the renderer's RGB pixels exactly, and was reopened to verify both pixel equality and 480 × 480 dimensions. File sizes and hashes are recorded in `docs/amoled-asset-manifest.json`.

The native UI includes the current plain Strava wordmark, official Runna app icon, official TCS NYC Marathon artwork, and Claude wordmark. Logo provenance and conversion are retained in the separate hardware project's `assets/source`, `assets/brand_manifest.json`, and `scripts/build_brand_assets.py`.

To reproduce the native frames with the hardware workspace installed:

```sh
sh /Users/andysottiaux/Dev/playground/amoled-dashboard-216/scripts/render_local.sh \
  /Users/andysottiaux/Dev/playground/andysottiaux-website/docs/amoled-example-payload.json \
  /Users/andysottiaux/Dev/playground/amoled-dashboard-216/runtime/website-example-renders
```

Refresh only the example payload's `ts` when regenerating so its demonstrated source freshness does not become stale relative to the simulator's local clock. Convert the resulting RGB PNGs with Pillow's `save(..., format='WEBP', lossless=True, method=6)` and verify decoded RGB equality. Website device frames and interaction controls are CSS supplied by the portfolio UI, independent of the firmware capture pixels.
