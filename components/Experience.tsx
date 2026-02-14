const experiences: { title: string; company: string; companyUrl?: string; period: string; description: string; achievements: string[]; logo?: string; focus?: string[] }[] = [
  {
    title: 'Senior Engineer-Program Manager I',
    company: 'AVX AIRCRAFT COMPANY',
    companyUrl: 'https://www.avxaircraft.com/',
    period: 'Sep 2023 - Present',
    description: 'Leading UAV and autonomy development efforts, coordinating mechanical, electrical, and software integration.',
    achievements: [
      'Designed, manufactured, and tested complete rotor systems\u2014including blades, hubs, grips, and fixtures for subscale and coaxial UAV platforms',
      'Built and managed the CubePilot/CubeNode flight-control architecture, integrating sensors, actuators, ESCs, and communication networks',
      'Developed full-stack test stand software for data acquisition, controls, and real-time telemetry to validate rotor and subsystem performance',
      'Implemented ROS2-based autonomy scaffolding to support navigation, perception, and health-monitoring prototypes across multiple platforms',
      'Drove cross-functional execution - design, fabrication, integration, troubleshooting, and test, maintaining program schedule, risks, and deliverables',
    ],
    logo: '/images/avx.png',
    focus: ['UAV Systems', 'Autonomy', 'Rotor Design'],
  },
  {
    title: 'Founder / Engineer',
    company: 'HatchingPoint',
    companyUrl: 'https://www.hatchingpoint.com',
    period: 'Jan 2021 - Present',
    description: 'Founded and built a portfolio of mobile applications and web services focused on wellness and productivity.',
    achievements: [
      'Designed and developed 10+ production iPhone apps in Swift, managing full UI/UX and App Store deployment',
      'Built modern web applications using React, JavaScript/TypeScript, focusing on component-driven architectures',
      'Architected back-end systems with MongoDB and Supabase, ensuring robust data modeling and real-time data flows',
    ],
    logo: '/images/hatchingpoint-logo.jpeg',
  },
  {
    title: 'Rotor Systems Design Engineer',
    company: 'Bell Flight',
    companyUrl: 'https://www.bellflight.com',
    period: 'Feb 2020 - Sep 2023',
    description: 'Designed and developed rotor systems for helicopter platforms, supporting manufacturing and fleet operations.',
    achievements: [
      'Conducted thorough investigations into issues reported by supply chain, manufacturing centers, and fleet operations, ensuring robust resolutions',
      'Developed detailed technical data, including 2D and 3D CAD models and PLM software documentation, to support assembly and installation processes',
      'Enhanced product and process quality by supporting both upstream and downstream engineering activities, including manufacturing and testing',
      'Pioneered advancements in helicopter systems using CAD, GD&T, and 3D printing techniques, leading supplier meetings to define project specifications',
    ],
    logo: '/images/bell.svg',
    focus: ['Rotorcraft Engineering', 'Manufacturing', 'Design'],
  },
  {
    title: 'Project Manager',
    company: 'Texas Air Systems',
    companyUrl: 'https://www.texasairsystems.com/',
    period: 'Aug 2016 - Feb 2020',
    description: 'Managed HVAC system design, installation, and maintenance projects for commercial clients.',
    achievements: [
      'Developed and grew relationships with customers, contractors, project engineers and manufacturers',
      'Determined project requirements, constraints, and sales team responsibilities to meet customer expectations',
      'Investigated concerns, implemented corrective action and communicated with customers to maximize satisfaction',
    ],
    logo: '/images/texasairsystems-logo.jpeg',
  },
]

export default function Experience() {
  return (
    <section id="experience" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">Experience</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
        </div>

        {/* Experience Timeline */}
        <div className="space-y-6 sm:space-y-8">
          {experiences.map((exp, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 md:p-8 hover:shadow-xl dark:hover:shadow-gray-900/50 transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  {exp.logo && (
                    <div className="hidden sm:flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-xl p-3 h-16 w-24 flex-shrink-0">
                      <img
                        src={exp.logo}
                        alt={`${exp.company} logo`}
                        className="max-h-full max-w-full object-contain dark:brightness-110"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">{exp.title}</h3>
                    <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 font-medium">
                      {exp.companyUrl ? (
                        <a href={exp.companyUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline transition-colors">
                          {exp.company}
                        </a>
                      ) : (
                        exp.company
                      )}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 sm:px-4 py-2 rounded-full mt-2 md:mt-0 self-start">
                  {exp.period}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 text-base sm:text-lg">{exp.description}</p>
              <ul className="space-y-2 sm:space-y-3">
                {exp.achievements.map((achievement, i) => (
                  <li key={i} className="text-gray-600 dark:text-gray-300 flex items-start text-sm sm:text-base">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6 text-foreground mr-2 sm:mr-3 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>{achievement}</span>
                  </li>
                ))}
              </ul>
              {exp.focus && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  {exp.focus.map((item, i) => (
                    <span
                      key={i}
                      className="px-2 sm:px-3 py-1 bg-foreground/5 text-foreground text-xs sm:text-sm rounded-lg font-medium"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Proprietary Disclaimer */}
        <p className="text-center text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-6 sm:mt-8 italic">
          Due to the proprietary nature of aerospace programs, specific project details cannot be publicly disclosed. Happy to discuss my experience in appropriate contexts.
        </p>
      </div>
    </section>
  )
}
