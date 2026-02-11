import Image from 'next/image'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 pt-16 sm:pt-20 overflow-hidden">
      {/* Background Image */}
      <Image
        src="/images/hero-bg.jpg"
        alt=""
        fill
        priority
        className="object-cover z-0 animate-ken-burns"
        sizes="100vw"
      />
      {/* Gradient Overlay for better text readability */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50"></div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl text-center">
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 text-white drop-shadow-lg">
          Andy Sottiaux
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-white/90 mb-6 sm:mb-8 drop-shadow-md">
          UAV Systems | Rotorcraft Design | Autonomy
        </p>
        <p className="text-base sm:text-lg text-white/80 max-w-2xl mx-auto mb-8 sm:mb-12 drop-shadow-md px-2">
          Senior Engineer building complete UAV systems, from rotor blades and hardware to software and autonomy.
          Bridging mechanical design, embedded systems, and hands-on testing with a practical, fail fast mentality.
        </p>
        <div className="flex gap-3 sm:gap-4 justify-center flex-wrap">
          <a
            href="#contact"
            className="px-6 sm:px-8 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-all font-medium shadow-lg text-sm sm:text-base"
          >
            Get in Touch
          </a>
          <a
            href="#projects"
            className="px-6 sm:px-8 py-3 border-2 border-white text-white rounded-lg hover:bg-white hover:text-gray-900 transition-all font-medium shadow-lg backdrop-blur-sm text-sm sm:text-base"
          >
            View Projects
          </a>
        </div>
      </div>
    </section>
  )
}
