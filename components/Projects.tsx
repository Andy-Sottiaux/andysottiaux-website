const projects = [
  {
    title: 'Rot Dot',
    description: 'Block distracting apps with a physical tap. Place NFC stickers around your space and scan to instantly lock or unlock apps. Uses Apple Screen Time API for real-world friction against phone addiction.',
    tech: ['iOS', 'Swift', 'SwiftUI', 'NFC', 'FamilyControls', 'Screen Time'],
    link: 'https://www.hatchingpoint.com/',
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
    link: 'https://www.hatchingpoint.com/',
    icon: '/images/levelup-icon.jpg',
  },
  {
    title: 'AirMD+',
    description: 'Monitor your HVAC system with real-time temperature tracking. iOS + hardware solution providing comprehensive climate control oversight.',
    tech: ['iOS', 'Swift', 'Hardware Integration', 'IoT'],
    link: 'https://www.hatchingpoint.com/',
    icon: '/images/airmd-icon.jpg',
  },
  {
    title: 'Caffeine Rhythm',
    description: 'Optimize your caffeine timing for peak energy. Strategically plan your caffeine consumption for maximum alertness throughout the day.',
    tech: ['iOS', 'Swift', 'Data Visualization', 'Health Optimization'],
    link: 'https://www.hatchingpoint.com/',
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
    link: 'https://www.hatchingpoint.com/',
    icon: '/images/travelagentai-icon.png',
  },
]

export default function Projects() {
  return (
    <section id="projects" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">Featured Projects</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
          <p className="text-gray-600 mt-4 text-base sm:text-lg">Robotics, computer vision, and mobile applications</p>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {projects.map((project, index) => (
            <div
              key={index}
              className="group bg-white border-2 border-gray-200 p-5 sm:p-6 md:p-8 rounded-2xl hover:shadow-2xl transition-all duration-300 hover:border-foreground hover:-translate-y-2"
            >
              <div className="flex items-center justify-center mb-4 sm:mb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-lg ring-4 ring-gray-100 group-hover:ring-foreground/20 transition-all bg-white">
                  <img
                    src={project.icon}
                    alt={`${project.title} icon`}
                    className={`w-full h-full ${project.title === 'WYZECAR' ? 'object-contain p-1' : 'object-cover'}`}
                  />
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 text-foreground text-center">{project.title}</h3>
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
      </div>
    </section>
  )
}
