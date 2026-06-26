import type { Page, Route } from '@playwright/test'

const pixelJpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z',
  'base64',
)

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })

export async function mockPortfolioNetwork(page: Page) {
  await page.route('**/api/v3/solar/history**', (route) => json(route, {
    points: Array.from({ length: 72 }, (_, index) => ({
      battery_voltage: 13.2 + Math.sin(index / 8) * 0.12,
      solar_power: Math.max(0, Math.round(Math.sin(index / 10) * 28 + 30)),
      timestamp: Date.now() / 1000 - (72 - index) * 1200,
    })),
  }))

  await page.route('**/api/v3/solar', (route) => json(route, {
    battery_voltage: 13.5,
    battery_soc: 99,
    charging_current: 0.2,
    solar_power: 3,
    yield_today: 50,
    charge_state: 'Float',
    load_current: 0.1,
    timestamp: Date.now() / 1000,
    live: true,
    stale: false,
  }))

  await page.route('**/api/v3/health', (route) => json(route, {
    ok: true,
    uptime_s: 172800,
    service_count: 6,
    services_down: [],
    services: [
      { name: 'camera', status: 'running', ok: true },
      { name: 'rknn', status: 'running', ok: true },
    ],
    system: {
      cpu_temp_c: 48,
      mem: { avail_kb: 51200, cma_free_kb: 26000, cma_total_kb: 100000 },
      performance: { cma_allocated_pct: 26 },
      media_graph: {
        state: 'running',
        working: true,
        visual_quality: 'clean',
        input_size: '1280x960',
        output_size: '1280x960',
        stream_profile: { width: 1280, height: 960, fps: 30 },
      },
      argon_fan: {
        available: true,
        ok: true,
        state: 'auto',
        speed: 25,
        rpm_estimate: 1250,
        max_rpm: 5000,
        mode: 'auto',
      },
      rknn_detector: {
        available: true,
        ok: true,
        state: 'running',
        actual_fps: 28,
        duration_ms: 35,
      },
    },
  }))

  await page.route('**/api/fundraising', (route) => json(route, { raised: 2756, goal: 3000 }))
  await page.route('**/api/v3/camera/quality**', (route) => json(route, { ok: true, sanitizer: { latest_clean_age_s: 1, hls_ok: true } }))
  await page.route('**/api/v3/training/status**', (route) => json(route, {
    ok: true,
    source: 'mock',
    state: 'waiting_for_labels',
    dataset_ready: false,
    training_ready: false,
    short_action: 'Review and promote labels before training.',
    collection_wait: {
      status: 'guided_stalled',
      guided_progress: {
        available: true,
        status: 'complete',
        attempts: 37,
        kept: 1,
        duplicates: 36,
        duplicate_ratio: 0.973,
        finish_reason: 'duplicate_streak',
        session_status: 'stalled',
      },
    },
    production_readiness: {
      ok: false,
      status: 'not_ready',
      short_action: 'Collect more valid frames with deliberate scene changes.',
      failures: ['images:20<50', 'classes:1<2', 'unique_images:1<20'],
      total_images: 20,
      labeled_images: 20,
      total_labels: 23,
      nonzero_classes: { package: 23 },
      image_diversity: { unique_images: 1, labeled_unique_images: 1 },
      collection_plan: {
        min_new_images: 30,
        min_new_labeled_images: 10,
        min_new_labels: 7,
        min_new_classes: 1,
        min_new_unique_images: 19,
        min_new_labeled_unique_images: 14,
        focus: ['Move visible target objects between captures.'],
        current_classes: { package: 23 },
      },
    },
  }))
  await page.route('**/api/v3/detections**', (route) => json(route, {
    ok: true,
    counts: { package: 3 },
    recent: [],
    window_sec: 900,
    relay: { stale: false, cache_age_s: 0.1, type: 'board_detections' },
  }))
  await page.route('**/api/v3/camera/diagnostics**', (route) => json(route, {
    ok: true,
    camera: 'cam1',
    relay_base: 'https://cam1.andysottiaux.com',
    summary: {
      resolution: '1280x960',
      fps: 30,
      visual_quality: 'calibrated',
      rknn_state: 'ok',
      rknn_fps: 0.2,
      rknn_latency_ms: 180,
      sanitizer_age_s: 1,
      sanitizer_hls_ok: true,
      training_state: 'waiting_for_labels',
      training_ready: false,
      training_images: 20,
      training_labeled_images: 20,
      training_labels: 23,
      training_classes: 1,
      training_unique_images: 1,
      services_down: [],
      services_total: 6,
    },
  }))
  await page.route('**/api/v3/camera/snapshot**', (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: pixelJpeg }))
  await page.route('**/api/v3/camera2/snapshot**', (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: pixelJpeg }))
  await page.route('**/api/v3/camera/webrtc/offer**', (route) => json(route, { error: 'mocked' }, 503))
  await page.route('**/api/v3/camera2/webrtc/offer**', (route) => json(route, { error: 'mocked' }, 503))
  await page.route('**/api/v3/camera2/settings**', (route) => json(route, {
    ok: true,
    stream0: { width: 2304, height: 1296, fps: 30, bitrate: 12000 },
    motor: { steps_pan: 32, steps_tilt: 16, preview_control_mode: 'vector' },
  }))
  await page.route('**/api/v3/camera2/status**', (route) => json(route, { ok: true }))
  await page.route('**/api/v3/camera2/control**', (route) => json(route, { ok: true }))
}
