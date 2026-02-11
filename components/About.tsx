import Marathon from './Marathon'

export default function About() {
  return (
    <section id="about" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">About Me</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-2xl overflow-hidden shadow-xl ring-4 ring-gray-100">
                  <img
                    src="/images/profile.jpg"
                    alt="Andy Sottiaux"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Decorative element with chinchilla */}
                <div className="absolute -bottom-4 -right-4 w-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 bg-foreground/10 rounded-2xl -z-10">
                  <img
                    src="/images/chinchilla-black.png"
                    alt=""
                    className="absolute -bottom-2 -right-2 w-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 opacity-40 hover:opacity-70 hover:scale-110 transition-all duration-300"
                    title="Hi there! 🐭"
                  />
                </div>
              </div>
            </div>

            {/* About Text */}
            <div className="flex-1 space-y-4 sm:space-y-6">
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                I'm a <span className="font-semibold text-foreground">senior engineer</span> who likes to build complete UAV systems, from the rotor blades and hardware
                to the software and autonomy that fly them. At AVX, I've designed and manufactured full rotor
                systems and led our subscale UAV and early autonomy work, including CubePilot/CubeNode integration
                and ROS2-based test and control software.
              </p>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                I enjoy bridging mechanical design, embedded systems, and hands-on testing, and I bring a
                practical, <span className="font-semibold text-foreground">fail fast mentality</span> to moving ideas into real, working aerospace capabilities.
              </p>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                Beyond aerospace, I founded <span className="font-semibold text-foreground">HatchingPoint</span> where I've designed and developed 10+ production iPhone
                apps, built modern web applications, and architected robust back-end systems. I thrive at the
                intersection of hardware and software, always driven by making things that work.
              </p>

              {/* Key Stats */}
              <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-4 sm:pt-6 mt-4 sm:mt-6 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">10+</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Apps Published</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">9+</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Years Experience</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">2</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Industries</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Marathon Banner */}
        <Marathon />
      </div>
    </section>
  )
}
