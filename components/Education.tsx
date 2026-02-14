export default function Education() {
  return (
    <section id="education" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">Education</h2>
          <div className="w-20 h-1 bg-foreground mx-auto"></div>
        </div>

        {/* Education Card */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 md:p-8 hover:shadow-xl dark:hover:shadow-gray-900/50 transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
            {/* Logo */}
            <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-xl p-3 h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0">
              <img
                src="/images/texas-tech-logo.png"
                alt="Texas Tech University logo"
                className="max-h-full max-w-full object-contain"
                loading="lazy"
              />
            </div>

            {/* Details */}
            <div className="text-center sm:text-left">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Texas Tech University</h3>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                August 2012 - May 2016 &middot; Lubbock, TX
              </p>
              <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                <span className="font-semibold text-foreground">B.S., Mechanical Engineering</span>
                <span className="hidden sm:inline text-gray-400 mx-2">|</span>
                <br className="sm:hidden" />
                <span className="italic">Minor in Mathematics</span>
              </p>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
                Engineering Study Abroad Semester, Seville, Spain
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
