export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1519904981063-b0cf448d479e?q=80&w=2070&auto=format&fit=crop)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Gradient Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl text-center">
        <h1 className="text-6xl md:text-7xl font-bold mb-6 text-white drop-shadow-lg">
          Andy Sottiaux
        </h1>
        <p className="text-xl md:text-2xl text-white/90 mb-8 drop-shadow-md">
          UAV Systems | Rotorcraft Design | Autonomy
        </p>
        <p className="text-lg text-white/80 max-w-2xl mx-auto mb-12 drop-shadow-md">
          Senior Engineer building complete UAV systems—from rotor blades and hardware to software and autonomy.
          Bridging mechanical design, embedded systems, and hands-on testing with a practical, let's-get-it-flying approach.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <a
            href="#contact"
            className="px-8 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-all font-medium shadow-lg"
          >
            Get in Touch
          </a>
          <a
            href="#projects"
            className="px-8 py-3 border-2 border-white text-white rounded-lg hover:bg-white hover:text-gray-900 transition-all font-medium shadow-lg backdrop-blur-sm"
          >
            View Projects
          </a>
        </div>
      </div>
    </section>
  )
}
