const experiences = [
  {
    title: 'Senior Engineer-Program Manager I',
    company: 'AVX AIRCRAFT COMPANY',
    period: 'Sep 2023 - Present',
    description: 'Leading UAV and autonomy development efforts, coordinating mechanical, electrical, and software integration.',
    achievements: [
      'Designed, manufactured, and tested complete rotor systems—including blades, hubs, grips, and fixtures for subscale and coaxial UAV platforms',
      'Built and managed the CubePilot/CubeNode flight-control architecture, integrating sensors, actuators, ESCs, and communication networks',
      'Developed full-stack test stand software for data acquisition, controls, and real-time telemetry to validate rotor and subsystem performance',
      'Implemented ROS2-based autonomy scaffolding to support navigation, perception, and health-monitoring prototypes across multiple platforms',
      'Drove cross-functional execution - design, fabrication, integration, troubleshooting, and test, maintaining program schedule, risks, and deliverables',
    ],
  },
  {
    title: 'Founder / Engineer',
    company: 'HatchingPoint',
    period: 'Jan 2021 - Present',
    description: 'Founded and built a portfolio of mobile applications and web services focused on wellness and productivity.',
    achievements: [
      'Designed and developed 7+ production iPhone apps in Swift, managing full UI/UX and App Store deployment',
      'Built modern web applications using React, JavaScript/TypeScript, focusing on component-driven architectures',
      'Architected back-end systems with MongoDB and Supabase, ensuring robust data modeling and real-time data flows',
    ],
  },
  {
    title: 'Rotor Systems Design Engineer',
    company: 'Bell Flight',
    period: 'Feb 2020 - Sep 2023',
    description: 'Designed and developed rotor systems for helicopter platforms, supporting manufacturing and fleet operations.',
    achievements: [
      'Conducted thorough investigations into issues reported by supply chain, manufacturing centers, and fleet operations, ensuring robust resolutions',
      'Developed detailed technical data, including 2D and 3D CAD models and PLM software documentation, to support assembly and installation processes',
      'Enhanced product and process quality by supporting both upstream and downstream engineering activities, including manufacturing and testing',
      'Pioneered advancements in helicopter systems using CAD, GD&T, and 3D printing techniques, leading supplier meetings to define project specifications',
    ],
  },
  {
    title: 'Project Manager',
    company: 'Texas Air Systems',
    period: 'Aug 2016 - Feb 2020',
    description: 'Managed HVAC system design, installation, and maintenance projects for commercial clients.',
    achievements: [
      'Developed and grew relationships with customers, contractors, project engineers and manufacturers',
      'Determined project requirements, constraints, and sales team responsibilities to meet customer expectations',
      'Investigated concerns, implemented corrective action and communicated with customers to maximize satisfaction',
    ],
  },
]

export default function Experience() {
  return (
    <section id="experience" className="py-32 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-foreground mb-4">Experience</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
        </div>

        {/* Experience Timeline */}
        <div className="space-y-8">
          {experiences.map((exp, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 hover:border-gray-300"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground mb-2">{exp.title}</h3>
                  <p className="text-xl text-gray-600 font-medium">{exp.company}</p>
                </div>
                <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-4 py-2 rounded-full mt-2 md:mt-0">
                  {exp.period}
                </span>
              </div>
              <p className="text-gray-600 mb-6 text-lg">{exp.description}</p>
              <ul className="space-y-3">
                {exp.achievements.map((achievement, i) => (
                  <li key={i} className="text-gray-600 flex items-start">
                    <svg
                      className="w-6 h-6 text-foreground mr-3 flex-shrink-0 mt-0.5"
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
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
