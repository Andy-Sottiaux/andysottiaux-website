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
                I build things. <span className="font-semibold text-foreground">Drones, apps, robots, rotor systems</span> — if it
                needs to go from idea to something real, that's where I live. I don't really draw a line between
                hardware and software. It's all just building.
              </p>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                By day, I'm a senior engineer at <span className="font-semibold text-foreground">AVX Aircraft</span> — designing
                rotor systems, wiring up flight controllers, writing test stand software, and getting UAVs off
                the ground. Before that, I was at <span className="font-semibold text-foreground">Bell Flight</span> working
                on helicopter rotor design.
              </p>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                On the side, I run <span className="font-semibold text-foreground">HatchingPoint</span> — a portfolio
                of iOS apps I've designed, built, and shipped to the App Store. NFC-powered focus tools,
                AI travel planners, voice transcription, caffeine trackers — whatever scratches the itch.
                I handle everything: design, code, backend, deployment.
              </p>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                I'm most useful when something needs to actually work — not just look good in a slide deck.
              </p>

              {/* Key Stats */}
              <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-4 sm:pt-6 mt-4 sm:mt-6 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">10+</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Apps Shipped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">9+</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Years Building</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">Full Stack</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Hardware to App Store</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
