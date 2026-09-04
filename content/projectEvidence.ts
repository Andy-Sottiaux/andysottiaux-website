type Source = { title: string; url: string; detail: string }
type Evidence = {
  status: string
  reviewed: string
  basis: string
  result: string
  limitation: string
  tradeoff: { question: string; choice: string; cost: string }
  sources: Source[]
}

const wyzecar = 'https://github.com/Andy-Sottiaux/WYZECAR/blob/d669b8876eba341eb303227bde4e0a0e13adca70'

export const PROJECT_EVIDENCE: Record<string, Evidence> = {
  'epaper-dashboard': {
    status: 'Personal hardware build',
    reviewed: '2026-09-04',
    basis: 'Re-run software checks',
    result: '172 hardware-free checks passed: 127 across driver, framebuffer, refresh, and power-policy suites; 45 across runtime and scheduling. The checks were run on September 4, 2026.',
    limitation: 'These checks use simulated hardware. They do not establish physical refresh speed, image quality, power consumption, or long-term field reliability. The product view is a 3D visualization, not a photograph or a live display.',
    tradeoff: {
      question: 'Refresh the whole display, or only the part that changed?',
      choice: 'Map frequently updated widgets into controller-safe regions and update those regions independently.',
      cost: 'The layout and driver must respect two address spaces. Periodic full refreshes are still necessary; localized addressing does not make the pigment waveform instantaneous.',
    },
    sources: [],
  },
  'travel-agent-ai': {
    status: 'Shipped iOS product',
    reviewed: '2026-09-04',
    basis: 'Public release + implementation review',
    result: 'Apple’s public listing confirmed version 1.38, released August 30, 2026. The native booking review supports selecting and editing extracted entries before saving them into a trip.',
    limitation: 'This demonstrates a shipped workflow, not a measured extraction-accuracy or time-saving result. Live flight status is not currently enabled. Native-view captures use sample booking data; the confidence indicator is a fixture value, not an accuracy benchmark.',
    tradeoff: {
      question: 'Save AI output immediately, or ask the traveler to review it?',
      choice: 'Present structured, editable bookings with individual selection before committing them to the itinerary.',
      cost: 'Review adds a step. In exchange, uncertain titles, locations, and local times can be corrected before they become part of the shared plan.',
    },
    sources: [{ title: 'Apple App Store listing', url: 'https://apps.apple.com/us/app/travel-agent-ai/id6758284691', detail: 'Public distribution, current product information, and version history.' }],
  },
  'field-camera': {
    status: 'Operational lab / availability varies',
    reviewed: '2026-09-04',
    basis: 'Public interface + implementation review',
    result: 'The public lab separates service health, solar readings, inference state, and protected camera playback. The system guide remains available without credentials or a connection to the field hardware.',
    limitation: 'A reachable website does not prove the camera, inference engine, or power source is healthy. Use the dashboard’s individual states and reading ages. No uptime percentage or field reliability benchmark is claimed.',
    tradeoff: {
      question: 'Stream by default, or make media explicitly opt-in?',
      choice: 'Keep the public explanation available to everyone, with camera media behind the existing access boundary.',
      cost: 'Visitors cannot immediately see private footage. The guide and separate telemetry make the architecture understandable without opening that boundary.',
    },
    sources: [{ title: 'Explore the public lab', url: '/lab', detail: 'Read the guide, inspect current states, and distinguish fresh readings from stale or unavailable sources.' }],
  },
  wyzecar: {
    status: 'Experimental robotics testbed',
    reviewed: '2026-09-04',
    basis: 'Pinned public source review',
    result: 'Published commit d669b88 exposes the complete software path: person detection, visual servoing, motor-command translation, and firmware. Each boundary can be inspected independently.',
    limitation: 'No published field benchmark or automated test result is available. The firmware motor-stop flag is cleared by a subsequent drive command; it is not a latched safety interlock. The image is a CAD rendering, not proof of an autonomous run.',
    tradeoff: {
      question: 'One tightly coupled loop, or separate perception and control nodes?',
      choice: 'Use separate ROS2 responsibilities for detection, following, web controls, and the motor bridge.',
      cost: 'Independent nodes make the pipeline inspectable, but require explicit command freshness, loss-of-target handling, and careful end-to-end commissioning.',
    },
    sources: [
      { title: 'System architecture', url: `${wyzecar}/docs/architecture.md`, detail: 'The boundaries between perception, following, motor control, and firmware.' },
      { title: 'Visual-servoing controller', url: `${wyzecar}/ros2/follower.py`, detail: 'Proportional control, smoothing, and velocity feedforward—not a full PID controller.' },
      { title: 'Firmware command handling', url: `${wyzecar}/firmware/src/main.cpp`, detail: 'Watchdog and stop-command implementation, including its non-latching behavior.' },
    ],
  },
}
