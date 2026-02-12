'use client'

import dynamic from 'next/dynamic'

const STLViewer = dynamic(() => import('./STLViewer'), { ssr: false })

type Project = {
  title: string
  description: string
  tech: string[]
  link: string
  stlUrls?: string[]
  icon: string
  downloads?: { label: string; href: string }[]
  inProgress?: boolean
}

const projects: Project[] = [
  {
    title: 'Rot Dot',
    description: 'Block distracting apps with a physical tap. Place NFC stickers around your space and scan to instantly lock or unlock apps. Uses Apple Screen Time API for real-world friction against phone addiction.',
    tech: ['iOS', 'Swift', 'SwiftUI', 'NFC', 'FamilyControls', 'Screen Time'],
    link: 'https://apps.apple.com/us/app/rot-dot/id6758902103',
    icon: '/images/rotdot-icon.png',
  },
  {
    title: 'WYZECAR',
    description: 'Vision-based autonomous RC car using YOLOv8 for real-time human detection and following. Features web-based WASD remote control, live video streaming, and PID-controlled smooth motion.',
    tech: ['Python', 'YOLOv8', 'ROS2', 'DART-MX95', 'ESP32', 'Computer Vision'],
    link: 'https://github.com/Andy-Sottiaux/WYZECAR',
    icon: '/images/wyzecar.png',
  },
  {
    title: 'LevelUp+',
    description: 'Track your progress. Level up your life. A personal advancement tool enabling you to monitor improvements across various life areas.',
    tech: ['iOS', 'Swift', 'SwiftUI', 'Progress Tracking'],
    link: 'https://apps.apple.com/us/app/levelup/id6757681084',
    icon: '/images/levelup-icon.jpg',
  },
  {
    title: 'AirMD+',
    description: 'Monitor your HVAC system with real-time temperature tracking. Full-stack iOS + custom hardware solution providing comprehensive climate control oversight.',
    tech: ['iOS', 'Swift', 'Hardware Design', 'IoT', 'Embedded Systems'],
    link: 'https://www.hatchingpoint.com/airmd',
    icon: '/images/airmd-icon.jpg',
  },
  {
    title: 'Caffeine Rhythm',
    description: 'Optimize your caffeine timing for peak energy. Strategically plan your caffeine consumption for maximum alertness throughout the day.',
    tech: ['iOS', 'Swift', 'Data Visualization', 'Health Optimization'],
    link: 'https://apps.apple.com/us/app/caffeine-rhythm/id6756790180',
    icon: '/images/caffeine-icon.jpg',
  },
  {
    title: 'Record+Transcribe',
    description: 'Capture voice recordings with real-time live transcription. Features AI-powered summaries that extract key points, decisions, and action items from meetings, lectures, and conversations.',
    tech: ['iOS', 'Swift', 'SwiftUI', 'Speech Recognition', 'OpenAI'],
    link: 'https://www.hatchingpoint.com/',
    icon: '/images/recordtranscribe-icon.png',
  },
  {
    title: 'Travel Agent AI',
    description: 'Your personal AI travel planning assistant. Get personalized trip recommendations, detailed itineraries, local insights, and smart booking suggestions tailored to your preferences.',
    tech: ['iOS', 'Swift', 'SwiftUI', 'AI', 'Travel Planning'],
    link: 'https://apps.apple.com/us/app/travel-agent-ai/id6758284691',
    icon: '/images/travelagentai-icon.png',
  },
  {
    title: 'DoorDot',
    description: 'NFC-powered privacy doorbell for iPhone. Visitors tap a sticker at your door to ring, and you get a push notification. No cameras, no cloud video, just simple, private alerts via iCloud.',
    tech: ['iOS', 'Swift', 'SwiftUI', 'CloudKit', 'NFC', 'StoreKit'],
    link: '#',
    icon: '',
    inProgress: true,
  },
]

const featuredDesign = {
  title: 'AirPods Pro 3 Tesla Charger Mount',
  description: 'Custom-designed holder that positions AirPods Pro 3 at the correct height for Tesla wireless chargers. Free to download, print, and modify.',
  tech: ['SOLIDWORKS', '3D Printing', 'CAD'],
  stlUrls: ['/files/assembly-mount.STL', '/files/assembly-airpods.STL'],
  downloads: [
    { label: 'STL', href: '/files/AirPods Pro 3_Teslav2.STL' },
    { label: 'SLDPRT', href: '/files/AirPods Pro 3_Teslav2.SLDPRT' },
  ],
}

export default function Projects() {
  return (
    <section id="projects" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">Featured Projects</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
          <p className="text-gray-600 mt-4 text-base sm:text-lg">Robotics, computer vision, mobile applications, 3D printing, and CAD</p>
          <p className="text-gray-400 mt-3 text-xs sm:text-sm italic max-w-2xl mx-auto">
            Due to the proprietary nature of aerospace programs, specific project details cannot be publicly disclosed. Happy to discuss my experience in appropriate contexts.
          </p>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {projects.map((project, index) => (
            <div
              key={index}
              className="group bg-white border-2 border-gray-200 p-5 sm:p-6 md:p-8 rounded-2xl hover:shadow-2xl transition-all duration-300 hover:border-foreground hover:-translate-y-2"
            >
              <div className="flex items-center justify-center mb-4 sm:mb-6">
                <div className={`rounded-2xl overflow-hidden shadow-lg ring-4 ring-gray-100 group-hover:ring-foreground/20 transition-all bg-white w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center`}>
                  {project.icon ? (
                    <img
                      src={project.icon}
                      alt={`${project.title} icon`}
                      className={`w-full h-full ${project.title === 'WYZECAR' ? 'object-contain p-1' : 'object-cover'}`}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 text-foreground text-center">
                {project.title}
                {project.inProgress && (
                  <span className="ml-2 inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full align-middle">
                    In Progress
                  </span>
                )}
              </h3>
              <p className="text-gray-600 mb-4 sm:mb-6 leading-relaxed text-center text-sm sm:text-base">{project.description}</p>

              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-6 justify-center">
                {project.tech.map((tech, i) => (
                  <span
                    key={i}
                    className="px-2 sm:px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>

              {project.link !== '#' && (
                <div className="text-center">
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-semibold text-foreground hover:gap-2 transition-all group-hover:underline"
                  >
                    Learn More
                    <svg
                      className="w-4 h-4 ml-1 group-hover:ml-2 transition-all"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Featured Design */}
        <div className="mt-8 sm:mt-12 bg-white border-2 border-gray-200 rounded-2xl p-6 sm:p-8 md:p-10 hover:shadow-2xl transition-all duration-300 hover:border-foreground">
          <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-center">
            <div className="w-full md:w-1/2 h-64 sm:h-80 rounded-2xl overflow-hidden shadow-lg ring-4 ring-gray-100 bg-white">
              <STLViewer urls={featuredDesign.stlUrls} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl sm:text-3xl font-bold mb-3 text-foreground">{featuredDesign.title}</h3>
              <p className="text-gray-600 mb-6 leading-relaxed text-sm sm:text-base">{featuredDesign.description}</p>

              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-6 justify-center md:justify-start">
                {featuredDesign.tech.map((tech, i) => (
                  <span
                    key={i}
                    className="px-2 sm:px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>

              <div className="flex gap-2 justify-center md:justify-start flex-wrap">
                {featuredDesign.downloads.map((dl, i) => (
                  <a
                    key={i}
                    href={dl.href}
                    download
                    className="px-4 py-2 bg-foreground text-white rounded-lg text-sm font-medium hover:bg-foreground/80 transition-all"
                  >
                    {dl.label}
                  </a>
                ))}
                <a
                  href="https://venmo.com/u/andysottiaux"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:border-foreground hover:text-foreground transition-all"
                >
                  Tip Designer
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
