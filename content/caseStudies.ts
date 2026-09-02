type ProjectDecision = {
  title: string
  detail: string
}

type ProjectTourStop = {
  title: string
  detail: string
  marker?: { x: number; y: number }
  accent?: 'red' | 'yellow' | 'black'
}

type ProjectTour = {
  title: string
  intro: string
  image: string
  imageAlt: string
  stops: ProjectTourStop[]
}

export type ProjectCaseStudy = {
  title: string
  slug?: 'field-camera' | 'travel-agent-ai' | 'wyzecar' | 'epaper-dashboard'
  eyebrow?: string
  subtitle?: string
  role?: string
  problem: string
  built: string
  outcome: string
  proof: string
  metrics: string[]
  architecture: string[]
  validation: string[]
  constraints?: string[]
  decisions?: ProjectDecision[]
  tour?: ProjectTour
  tech: string[]
  link: string
  linkLabel?: string
  icon: string
  iconContain?: boolean
  heroImage?: string
  heroImageAlt?: string
  heroGallery?: string[]
  heroMode?: 'cover' | 'contain' | 'gallery' | 'system' | 'epaper'
}

export const PROJECT_CASE_STUDIES: ProjectCaseStudy[] = [
  {
    title: "Runner's E-Paper Dashboard",
    slug: 'epaper-dashboard',
    eyebrow: 'Custom embedded system',
    subtitle: 'A four-color, always-ready training command center built for one useful glance—not another screen demanding attention.',
    role: 'Product design, interface architecture, Raspberry Pi integration, display-driver engineering, data integrations, and reliability testing.',
    problem: 'Put the training plan, current conditions, race motivation, and daily context in view without opening a phone or accepting the visual noise of a conventional monitor.',
    built: 'Designed a native 1360 × 480 interface around Runna, Strava, the New York City Marathon, weather, time progress, and Claude Code usage, then built a safe partial-refresh driver for the panel\'s two-controller architecture.',
    outcome: 'A calm, runner-first surface that stays useful throughout the day, updates only the regions that changed, and powers the display hardware down overnight while the last image remains visible.',
    proof: 'The finished system combines a physical product, a purpose-built interface, live service integrations, custom display control, and verified on-glass behavior.',
    metrics: ['1360 × 480 canvas', 'Native four-color UI', 'Dual-controller partial refresh', '7 AM–10:30 PM active window'],
    architecture: [
      'Raspberry Pi Zero 2 W service with isolated collectors for training, weather, fundraising, and developer-tool data',
      'Zone-local Pillow renderer constrained to the panel\'s black, white, yellow, and red palette',
      'Seam-aware JD79665AA driver coordinating independent master and slave controller windows',
      'Persistent refresh ledger, health endpoint, startup checks, and USB recovery path',
    ],
    validation: [
      '14-stage hardware probe passed on the physical four-color panel',
      '171 hardware-free runtime and driver tests',
      'Palette, clipping, controller-seam, and refresh-policy assertions',
      'Three-hour de-ghosting refresh plus deterministic quiet-hours behavior',
    ],
    constraints: [
      'The 10.85-inch glass is one visual canvas driven by two controller dies split exactly at x=680.',
      'Four-color particles need a deliberate waveform; localized updates reduce disruption but do not turn e-paper into an LCD.',
      'Personal API credentials must stay off the display, out of the repository, and recover cleanly when a service is unavailable.',
    ],
    decisions: [
      {
        title: 'Runner first',
        detail: 'Runna owns the largest region, with the next prescription and Monday–Sunday mileage visible before secondary system information.',
      },
      {
        title: 'Design to the silicon',
        detail: 'Every widget is clipped to a controller-safe zone, so frequent updates never straddle the physical x=680 seam.',
      },
      {
        title: 'Conserve the panel',
        detail: 'Localized updates handle the day, a full refresh clears accumulated ghosting every three hours, and one static night summary precedes hardware power-off.',
      },
    ],
    tour: {
      title: 'One screen, six purposeful layers',
      intro: 'The hierarchy follows the decisions a training day actually asks you to make—from the next workout to the conditions outside, then the quieter signals that keep the day on track.',
      image: '/images/epaper-dashboard-frame.png',
      imageAlt: 'The complete four-color runner dashboard with Runna, Strava, marathon, weather, time, and Claude Code widgets',
      stops: [
        {
          title: 'Next workout',
          detail: 'Runna surfaces the prescription, duration, best or scheduled weather window, and actual-versus-planned weekly mileage.',
          marker: { x: 25, y: 25 },
          accent: 'red',
        },
        {
          title: 'Training load',
          detail: 'Monday–Sunday Strava progress shows completed runs, sessions still ahead, and current-year running mileage—all in miles.',
          marker: { x: 12.5, y: 79 },
          accent: 'yellow',
        },
        {
          title: 'Race-day motivation',
          detail: 'The TCS New York City Marathon countdown sits beside live Team for Kids fundraising progress.',
          marker: { x: 37.5, y: 79 },
          accent: 'red',
        },
        {
          title: 'Conditions now',
          detail: 'A large 12-hour clock and current weather cover temperature, rain, wind, humidity, UV, and air quality.',
          marker: { x: 75, y: 28 },
          accent: 'black',
        },
        {
          title: 'Time and tools',
          detail: 'Day, month, and year progress share the lower rail with Claude Code\'s five-hour and seven-day usage windows.',
          marker: { x: 82, y: 82 },
          accent: 'yellow',
        },
        {
          title: 'E-paper lifecycle',
          detail: 'Seam-safe partial updates, three-hour de-ghosting, offline fallbacks, and a 10:30 PM–7:00 AM powered-down quiet period keep it dependable.',
          accent: 'black',
        },
      ],
    },
    tech: ['Python', 'Raspberry Pi', 'Pillow', 'SPI', 'E-Paper', 'systemd', 'REST APIs'],
    link: '#capability-tour',
    linkLabel: 'Tour the interface',
    icon: '/images/epaper-dashboard-frame.png',
    iconContain: true,
    heroImage: '/images/epaper-dashboard-frame.png',
    heroImageAlt: 'Runner-focused interface rendered for a 10.85-inch four-color e-paper display',
    heroMode: 'epaper',
  },
  {
    title: 'Travel Agent AI',
    slug: 'travel-agent-ai',
    eyebrow: 'Shipped iOS product',
    subtitle: 'Booking capture, structured itineraries, collaboration, and practical trip operations.',
    role: 'Product design, iOS engineering, data modeling, AI workflow design, and release operations.',
    problem: 'Make travel planning useful after the booking confirmation, not just during destination search.',
    built: 'Built an iOS trip assistant for booking capture, flight tracking, packing lists, calendar sync, itinerary sharing, and trip cost tracking.',
    outcome: 'A production consumer app that turns scattered travel details into one practical mobile planning surface.',
    proof: 'Shows end-to-end mobile product execution across AI-assisted extraction, App Store delivery, subscriptions, cloud sync, and everyday utility.',
    metrics: ['App Store shipped', 'Native SwiftUI', 'Cloud collaboration', 'AI booking extraction'],
    architecture: ['SwiftUI product shell', 'Structured trip and booking model', 'AI document extraction', 'Calendar, weather, and sharing flows'],
    validation: ['Public App Store release', 'Real booking workflows', 'Shared-trip consistency', 'Release and maintenance pipeline'],
    constraints: [
      'Booking details arrive as screenshots, pasted text, email fragments, and manual notes.',
      'Displayed itinerary times must remain stable for every collaborator rather than shifting by viewer timezone.',
      'AI extraction must remain editable and understandable when source details are incomplete.',
    ],
    decisions: [
      {
        title: 'Structured after extraction',
        detail: 'AI proposes typed booking fields, but the durable product model remains inspectable and editable by the traveler.',
      },
      {
        title: 'Wall-clock itinerary time',
        detail: 'Stored local date and time are the shared schedule truth, preventing collaborators from seeing different itinerary times.',
      },
      {
        title: 'Utility over chat',
        detail: 'The primary experience is a daily operational timeline, not an open-ended assistant transcript.',
      },
    ],
    tech: ['iOS', 'SwiftUI', 'AI', 'Cloud sync', 'StoreKit', 'Calendar APIs'],
    link: 'https://apps.apple.com/us/app/travel-agent-ai/id6758284691',
    linkLabel: 'View on the App Store',
    icon: '/images/travelagentai-icon.png',
    heroImage: '/images/travel-agent-ai-itinerary.webp',
    heroImageAlt: 'Travel Agent AI itinerary screen',
    heroGallery: [
      '/images/travel-agent-ai-itinerary.webp',
      '/images/travel-agent-ai-import.webp',
      '/images/travel-agent-ai-bookings.webp',
    ],
    heroMode: 'gallery',
  },
  {
    title: 'Edge-AI Field Camera',
    slug: 'field-camera',
    eyebrow: 'Live hardware system',
    subtitle: 'Solar power, embedded inference, resilient camera transport, and protected operational proof.',
    role: 'Hardware integration, embedded services, relay architecture, telemetry UI, security boundary, and operations.',
    problem: 'Expose a real solar-powered edge system publicly without leaking private infrastructure or letting live hardware failures become invisible.',
    built: 'Integrated camera streaming, on-device RKNN inference, solar telemetry, thermal and fan health, Cloudflare relay routing, and production diagnostics.',
    outcome: 'A live hardware system that behaves like a maintained product: opt-in streams, health fallbacks, quality checks, recovery paths, and deploy-time regression gates.',
    proof: 'Demonstrates embedded Linux services, power telemetry, camera transport, edge inference, and full-stack operational visibility in one public system.',
    metrics: ['1280x960 at 30 FPS', 'On-device RKNN', 'Six monitored services', 'Password-protected stream'],
    architecture: ['Linux camera and inference node', 'go2rtc media and recovery services', 'Authenticated Cloudflare media boundary', 'Next.js diagnostics and telemetry UI'],
    validation: ['FPS and bitrate budgets', 'RKNN state and latency checks', 'Solar freshness monitoring', 'No-idle-stream policy'],
    constraints: [
      'The field node must tolerate intermittent power, address changes, and upstream service restarts.',
      'Public visitors need useful proof without receiving camera credentials or infrastructure tokens.',
      'Media transport must degrade through WebRTC, HLS, MJPEG, and snapshot fallbacks without hiding failure state.',
    ],
    decisions: [
      {
        title: 'Private media edge',
        detail: 'Camera media and physical writes require signed access sessions; server-held relay credentials never reach the browser.',
      },
      {
        title: 'Always-on relay ownership',
        detail: 'The camera path terminates on a dedicated relay host instead of depending on a personal laptop.',
      },
      {
        title: 'Observable failure modes',
        detail: 'The interface distinguishes stale telemetry, media failure, service failure, and training readiness instead of showing one generic offline state.',
      },
    ],
    tech: ['Embedded Linux', 'RKNN', 'WebRTC', 'Cloudflare', 'Tailscale', 'Next.js', 'Victron'],
    link: '/lab',
    linkLabel: 'Open the live lab',
    icon: '/images/hatchingpoint-mark.png',
    iconContain: true,
    heroMode: 'system',
  },
  {
    title: 'WYZECAR',
    slug: 'wyzecar',
    eyebrow: 'Robotics testbed',
    subtitle: 'A browser-operated perception-to-control platform for vision autonomy experiments.',
    role: 'System architecture, ROS2 nodes, perception integration, browser controls, embedded motor interface, and tuning.',
    problem: 'Turn a small RC platform into a controllable autonomy testbed with live video and person-following behavior.',
    built: 'Integrated YOLOv8 perception, ROS2 control plumbing, browser-based WASD control, live video, an ESP32 motor interface, and PID motion.',
    outcome: 'A robotics platform that makes the full perception-to-control loop inspectable and tunable from a browser.',
    proof: 'Shows the robotics loop end-to-end: perception, control, hardware interface, operator UI, and field iteration.',
    metrics: ['YOLOv8 perception', 'ROS2 control graph', 'ESP32 motor bridge', 'Browser operator UI'],
    architecture: ['Camera and YOLOv8 perception node', 'Follower and PID control node', 'Browser video and command surface', 'I2C bridge to ESP32 motor control'],
    validation: ['Manual drive fallback', 'Tunable PID response', 'Inspectable public source', 'Emergency-stop command path'],
    constraints: [
      'Perception, video, and controls share limited edge-compute resources.',
      'Loss of detection or browser connectivity must not leave stale drive commands active.',
      'The platform needs a manual mode for safe tuning before autonomous behavior is enabled.',
    ],
    decisions: [
      {
        title: 'Manual control first',
        detail: 'Browser WASD control provides a safe commissioning path before closing the person-following loop.',
      },
      {
        title: 'Separated ROS2 responsibilities',
        detail: 'Perception, following, motor control, and web presentation remain independent nodes with inspectable boundaries.',
      },
      {
        title: 'Embedded bridge',
        detail: 'The Linux compute module owns autonomy while the ESP32 handles deterministic motor and steering commands.',
      },
    ],
    tech: ['Python', 'YOLOv8', 'ROS2', 'DART-MX95', 'ESP32', 'OpenCV'],
    link: 'https://github.com/Andy-Sottiaux/WYZECAR',
    linkLabel: 'Inspect the source',
    icon: '/images/wyzecar.png',
    iconContain: true,
    heroImage: '/images/wyzecar.png',
    heroImageAlt: 'WYZECAR robotic vehicle platform',
    heroMode: 'contain',
  },
  {
    title: 'Rot Dot',
    problem: 'Create real physical friction for phone distraction without making the app feel like a punishment tool.',
    built: 'Used NFC stickers, SwiftUI, FamilyControls, and the Screen Time API to bind lock and unlock behavior to places.',
    outcome: 'A shipped iOS product built around a physical-world interaction instead of another timer screen.',
    proof: 'Combines product judgment with a restricted Apple API surface and real-world interaction design.',
    metrics: ['App Store shipped', 'NFC workflow', 'Screen Time API', 'Physical UX'],
    architecture: ['SwiftUI app', 'NFC trigger model', 'Screen Time API controls', 'Place-based unlock flow'],
    validation: ['Shipped App Store product', 'Restricted API integration', 'Physical interaction testing', 'Clear behavior boundary'],
    tech: ['iOS', 'Swift', 'SwiftUI', 'NFC', 'FamilyControls'],
    link: 'https://apps.apple.com/us/app/rot-dot/id6758902103',
    icon: '/images/rotdot-icon.png',
  },
  {
    title: 'Record + Transcribe',
    problem: 'Make long voice notes and meetings useful immediately after capture.',
    built: 'Built recording, live transcription, and AI summary flows that extract decisions, key points, and action items.',
    outcome: 'A production AI utility that turns raw audio capture into immediately usable notes.',
    proof: 'Demonstrates a production mobile AI workflow: capture, streaming text, summary UX, and shipped App Store release.',
    metrics: ['App Store shipped', 'Audio capture', 'AI summaries', 'Action extraction'],
    architecture: ['iOS recording flow', 'Speech recognition', 'AI summarization', 'Action-item extraction'],
    validation: ['Shipped mobile utility', 'Long-form capture path', 'Structured summary output', 'Useful post-meeting workflow'],
    tech: ['iOS', 'Swift', 'SwiftUI', 'Speech Recognition', 'OpenAI'],
    link: 'https://apps.apple.com/app/record-transcribe/id6758643630',
    icon: '/images/recordtranscribe-icon.png',
  },
  {
    title: 'AirMD+',
    problem: 'Expose HVAC behavior as live telemetry instead of intermittent technician observations.',
    built: 'Built the custom monitoring hardware path plus iOS and web surfaces for temperature tracking and system visibility.',
    outcome: 'An embedded-to-app monitoring path for operational visibility outside the lab.',
    proof: 'Bridges embedded data collection, full-stack product work, and a practical operational monitoring use case.',
    metrics: ['Embedded telemetry', 'Mobile dashboard', 'Web visibility', 'HVAC domain'],
    architecture: ['Custom sensor path', 'Device telemetry', 'Mobile dashboard', 'Web reporting surface'],
    validation: ['Real HVAC domain problem', 'Field-style monitoring UX', 'Hardware-to-app data path', 'Operational visibility goal'],
    tech: ['iOS', 'Swift', 'Hardware', 'IoT', 'Embedded'],
    link: 'https://www.hatchingpoint.com/airmd',
    icon: '/images/airmd-icon.jpg',
  },
]

export const FEATURED_CASE_STUDIES = PROJECT_CASE_STUDIES.filter(
  (project): project is ProjectCaseStudy & { slug: NonNullable<ProjectCaseStudy['slug']> } => Boolean(project.slug)
)

export const SECONDARY_PROJECTS = [
  { name: 'LevelUp+', description: 'Habit and goal tracker with streaks and reminders.', tech: ['iOS', 'SwiftUI'] },
  { name: 'Caffeine Rhythm', description: 'Caffeine half-life tracking to time your day better.', tech: ['iOS', 'SwiftUI', 'HealthKit'] },
  { name: 'AirPods Pro 3 Tesla Mount', description: 'Custom 3D-printed holder positioning AirPods Pro 3 at the right height for Tesla wireless chargers.', tech: ['SOLIDWORKS', '3D Printing'] },
]

export function caseStudyPath(project: ProjectCaseStudy) {
  return project.slug ? `/work/${project.slug}` : project.link
}

export function getCaseStudy(slug: string) {
  return FEATURED_CASE_STUDIES.find((project) => project.slug === slug)
}
