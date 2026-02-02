export default function About() {
  return (
    <section id="about" className="py-32 px-6 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-foreground mb-4">About Me</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-80 h-80 rounded-2xl overflow-hidden shadow-xl ring-4 ring-gray-100">
                  <img
                    src="/images/profile.jpg"
                    alt="Andy Sottiaux"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Decorative element */}
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-foreground/10 rounded-2xl -z-10"></div>
              </div>
            </div>

            {/* About Text */}
            <div className="flex-1 space-y-6">
              <p className="text-lg text-gray-700 leading-relaxed">
                I'm a <span className="font-semibold text-foreground">senior engineer</span> who likes to build complete UAV systems—from the rotor blades and hardware
                to the software and autonomy that fly them. At AVX, I've designed and manufactured full rotor
                systems and led our subscale UAV and early autonomy work, including CubePilot/CubeNode integration
                and ROS2-based test and control software.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                I enjoy bridging mechanical design, embedded systems, and hands-on testing, and I bring a
                practical, <span className="font-semibold text-foreground">let's-get-it-flying approach</span> to moving ideas into real, working aerospace capabilities.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Beyond aerospace, I founded <span className="font-semibold text-foreground">HatchingPoint</span> where I've designed and developed 7+ production iPhone
                apps, built modern web applications, and architected robust back-end systems. I thrive at the
                intersection of hardware and software, always driven by making things that work.
              </p>

              {/* Key Stats */}
              <div className="grid grid-cols-3 gap-6 pt-6 mt-6 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">7+</div>
                  <div className="text-sm text-gray-500 mt-1">Apps Published</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">8+</div>
                  <div className="text-sm text-gray-500 mt-1">Years Experience</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">2</div>
                  <div className="text-sm text-gray-500 mt-1">Industries</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
