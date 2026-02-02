const projects = [
  {
    title: 'Hatching Point',
    description: 'Co-founded and developed a suite of iOS applications focused on wellness and productivity tools.',
    tech: ['iOS', 'Swift', 'Product Design'],
    link: 'https://www.hatchingpoint.com/',
  },
  {
    title: 'Project Name 2',
    description: 'Description of your project, what problem it solves, and the impact it had.',
    tech: ['React', 'Node.js', 'PostgreSQL'],
    link: '#',
  },
  {
    title: 'Project Name 3',
    description: 'Another significant project showcasing your skills and accomplishments.',
    tech: ['Python', 'Machine Learning', 'Docker'],
    link: '#',
  },
]

export default function Projects() {
  return (
    <section id="projects" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold mb-12 text-foreground">Featured Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {projects.map((project, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-lg transition-shadow"
            >
              <h3 className="text-2xl font-bold mb-3 text-foreground">{project.title}</h3>
              <p className="text-gray-600 mb-4">{project.description}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {project.tech.map((tech, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {tech}
                  </span>
                ))}
              </div>
              {project.link !== '#' && (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:opacity-70 transition-opacity"
                >
                  View Project →
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
