const skillCategories = [
  {
    category: 'Aerospace & Robotics',
    skills: ['UAV Systems', 'ROS2', 'Rotor Design', 'Flight Control Systems', 'Autonomy', 'CubePilot'],
  },
  {
    category: 'Mechanical Engineering',
    skills: ['SOLIDWORKS', 'CAD', 'GD&T', 'FEA', '3D Printing', 'Manufacturing'],
  },
  {
    category: 'Software Development',
    skills: ['Swift', 'JavaScript/TypeScript', 'Python', 'React', 'iOS Development'],
  },
  {
    category: 'Backend & Data',
    skills: ['MongoDB', 'Supabase', 'Node.js', 'Data Acquisition', 'Real-time Telemetry'],
  },
  {
    category: 'Leadership & Management',
    skills: ['Program Management', 'Cross-functional Teams', 'Microsoft Project', 'Product Design'],
  },
]

export default function Skills() {
  return (
    <section id="skills" className="py-32 px-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-foreground mb-4">Skills & Expertise</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
        </div>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skillCategories.map((category, index) => (
            <div
              key={index}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100"
            >
              <h3 className="text-xl font-bold mb-6 text-foreground border-b border-gray-200 pb-3">
                {category.category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {category.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-foreground hover:text-white transition-all duration-200"
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
