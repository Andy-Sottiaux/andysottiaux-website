const experiences = [
  {
    title: 'Your Title Here',
    company: 'Company Name',
    period: '2020 - Present',
    description: 'Led development of innovative solutions, managed cross-functional teams, and delivered high-impact projects.',
    achievements: [
      'Achievement 1: Impact and results',
      'Achievement 2: Technical leadership',
      'Achievement 3: Team collaboration',
    ],
  },
  {
    title: 'Previous Role',
    company: 'Previous Company',
    period: '2018 - 2020',
    description: 'Developed scalable applications and contributed to architectural decisions.',
    achievements: [
      'Built and deployed multiple production applications',
      'Improved system performance by X%',
      'Mentored junior developers',
    ],
  },
]

export default function Experience() {
  return (
    <section id="experience" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold mb-12 text-foreground">Experience</h2>
        <div className="space-y-12">
          {experiences.map((exp, index) => (
            <div key={index} className="border-l-2 border-gray-200 pl-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                <h3 className="text-2xl font-bold text-foreground">{exp.title}</h3>
                <span className="text-sm text-gray-500">{exp.period}</span>
              </div>
              <p className="text-lg text-gray-600 mb-4">{exp.company}</p>
              <p className="text-gray-600 mb-4">{exp.description}</p>
              <ul className="space-y-2">
                {exp.achievements.map((achievement, i) => (
                  <li key={i} className="text-gray-600 flex items-start">
                    <span className="mr-2">•</span>
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
