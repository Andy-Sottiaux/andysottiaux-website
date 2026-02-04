export default function CurrentProject() {
  return (
    <section id="now" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Currently Building
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">What I&apos;m Working On</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
        </div>

        {/* Project Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 border-2 border-gray-100">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
            {/* Icon/Visual */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 text-center md:text-left">
                Solar-Powered Smart Camera System
              </h3>
              <p className="text-gray-600 leading-relaxed mb-4 text-sm sm:text-base">
                Designing a compact, pole-mounted surveillance system capable of true 24/7 recording using
                modular off-the-shelf components. By combining edge compute hardware with cellular connectivity
                and solar power, we can deliver always-on monitoring at a fraction of commercial system costs.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6 text-sm sm:text-base">
                This approach eliminates vendor lock-in, reduces size and complexity compared to bulky
                trailer-based solutions, and provides full flexibility for AI analytics and cloud integration.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-4 border-t border-gray-200">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">24/7</div>
                  <div className="text-xs sm:text-sm text-gray-500">Recording</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-green-600">~10%</div>
                  <div className="text-xs sm:text-sm text-gray-500">Cost of commercial</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">Zero</div>
                  <div className="text-xs sm:text-sm text-gray-500">Vendor lock-in</div>
                </div>
              </div>

              {/* Tech Tags */}
              <div className="flex flex-wrap gap-2 mt-6">
                {['24/7 Recording', 'Solar Power', 'Edge Computing', 'Cellular', 'Computer Vision'].map((tech, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
