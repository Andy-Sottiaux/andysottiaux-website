const projects = [
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
]

export default function Projects() {
  return (
    <section id="projects" className="py-32 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-foreground mb-4">Featured Projects</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
          <p className="text-gray-600 mt-4 text-lg">iOS applications built for wellness and productivity</p>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <div
              key={index}
              className="group bg-white border-2 border-gray-200 p-8 rounded-2xl hover:shadow-2xl transition-all duration-300 hover:border-foreground hover:-translate-y-2"
            >
              <div className="flex items-center justify-center mb-6">
                <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg ring-4 ring-gray-100 group-hover:ring-foreground/20 transition-all">
                  <img
                    src={project.icon}
                    alt={`${project.title} icon`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <h3 className="text-2xl font-bold mb-3 text-foreground text-center">{project.title}</h3>
              <p className="text-gray-600 mb-6 leading-relaxed text-center">{project.description}</p>

              <div className="flex flex-wrap gap-2 mb-6 justify-center">
                {project.tech.map((tech, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium"
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
