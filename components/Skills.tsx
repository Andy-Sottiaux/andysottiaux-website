const skillCategories = [
  {
    category: 'Aerospace & Robotics',
    skills: ['UAV Systems', 'ROS2', 'Rotor Design', 'Flight Control Systems', 'Autonomy', 'CubePilot', 'Computer Vision', 'YOLOv8'],
  },
  {
    category: 'Hardware & Debugging',
    skills: ['Oscilloscopes', 'Logic Analyzers', 'ESP32', 'I2C/SPI', 'RS485', 'CAN', 'RS232', 'Embedded Systems'],
  },
  {
    category: 'Mechanical Engineering',
    skills: ['SOLIDWORKS', 'CAD', 'GD&T', 'FEA', '3D Printing', 'Manufacturing'],
  },
  {
    category: 'Software Development',
    skills: ['Swift', 'SwiftUI', 'JavaScript/TypeScript', 'Python', 'React', 'iOS Development', 'NFC', 'StoreKit', 'FamilyControls'],
  },
  {
    category: 'Backend & Data',
    skills: ['MongoDB', 'Supabase', 'Node.js', 'OpenAI', 'Speech Recognition', 'Data Acquisition', 'Real-time Telemetry'],
  },
  {
    category: 'Leadership & Management',
    skills: ['Program Management', 'Cross-functional Teams', 'Microsoft Project', 'Product Design'],
  },
]

export default function Skills() {
  return (
    <section id="skills" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">Skills & Expertise</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
        </div>

        {/* Compact Skills */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 p-6 sm:p-8 md:p-10">
          <div className="space-y-5">
            {skillCategories.map((category, index) => (
              <div key={index} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                <span className="text-sm font-bold text-foreground whitespace-nowrap sm:w-48 sm:flex-shrink-0 sm:pt-1.5">
                  {category.category}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {category.skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-foreground hover:text-background transition-all duration-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
