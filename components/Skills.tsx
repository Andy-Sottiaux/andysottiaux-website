const skillCategories = [
  {
    category: 'Programming Languages',
    skills: ['JavaScript/TypeScript', 'Python', 'Java', 'Swift', 'Go'],
  },
  {
    category: 'Frontend',
    skills: ['React', 'Next.js', 'Vue.js', 'Tailwind CSS', 'HTML/CSS'],
  },
  {
    category: 'Backend',
    skills: ['Node.js', 'Express', 'Django', 'PostgreSQL', 'MongoDB'],
  },
  {
    category: 'Tools & Platforms',
    skills: ['Git', 'Docker', 'AWS', 'Vercel', 'CI/CD'],
  },
  {
    category: 'Other',
    skills: ['Product Management', 'Team Leadership', 'Agile/Scrum', 'System Design'],
  },
]

export default function Skills() {
  return (
    <section id="skills" className="py-24 px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold mb-12 text-foreground">Skills & Expertise</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {skillCategories.map((category, index) => (
            <div key={index} className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-4 text-foreground">{category.category}</h3>
              <div className="flex flex-wrap gap-2">
                {category.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-white text-gray-700 rounded-full text-sm border border-gray-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
