const companies = [
  {
    name: 'AVX AIRCRAFT COMPANY',
    role: 'Senior Engineer-Program Manager I',
    period: 'Sep 2023 - Present',
    website: 'https://www.avxaircraft.com/',
    description: 'Leading aerospace company specializing in advanced vertical lift technology and coaxial rotor UAV systems. Pioneering innovative solutions for next-generation unmanned aircraft.',
    focus: 'UAV Systems, Autonomy, Rotor Design',
    logo: '/images/avx.png',
  },
  {
    name: 'Bell Flight',
    role: 'Rotor Systems Design Engineer',
    period: 'Feb 2020 - Sep 2023',
    website: 'https://www.bellflight.com/',
    description: 'Global leader in vertical lift aircraft manufacturing with a legacy of innovation spanning over 85 years. Subsidiary of Textron, designing and producing advanced helicopters and tiltrotor aircraft.',
    focus: 'Rotorcraft Engineering, Manufacturing, Design',
    logo: '/images/bell.svg',
  },
]

export default function Aerospace() {
  return (
    <section id="aerospace" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">Aerospace Experience</h2>
          <div className="w-20 h-1 bg-foreground mx-auto mb-4 sm:mb-6"></div>
          <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto">
            Contributing to advanced aerospace programs in autonomy, rotorcraft design, and UAV systems development
          </p>
        </div>

        {/* Companies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {companies.map((company, index) => (
            <a
              key={index}
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white border-2 border-gray-200 rounded-2xl p-5 sm:p-6 md:p-8 hover:shadow-2xl hover:border-foreground transition-all duration-300"
            >
              {/* Company Logo */}
              <div className="mb-4 sm:mb-6 flex items-center justify-center bg-gray-50 rounded-xl p-4 sm:p-6 h-24 sm:h-32">
                <img
                  src={company.logo}
                  alt={`${company.name} logo`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              {/* Company Name */}
              <div className="mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2 group-hover:text-foreground/80 transition-colors">
                  {company.name}
                </h3>
                <p className="text-sm font-semibold text-gray-500 bg-gray-100 px-3 sm:px-4 py-2 rounded-full inline-block">
                  {company.period}
                </p>
              </div>

              {/* Role */}
              <div className="mb-3 sm:mb-4">
                <p className="text-lg sm:text-xl font-semibold text-gray-700">{company.role}</p>
              </div>

              {/* Description */}
              <p className="text-gray-600 mb-3 sm:mb-4 leading-relaxed text-sm sm:text-base">{company.description}</p>

              {/* Focus Areas */}
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                {company.focus.split(', ').map((item, i) => (
                  <span
                    key={i}
                    className="px-2 sm:px-3 py-1 bg-foreground/5 text-foreground text-xs sm:text-sm rounded-lg font-medium"
                  >
                    {item}
                  </span>
                ))}
              </div>

              {/* Visit Website Link */}
              <div className="flex items-center text-sm font-semibold text-foreground mt-3 sm:mt-4">
                <span>Visit Website</span>
                <svg
                  className="w-4 h-4 ml-1 group-hover:ml-2 transition-all"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </div>
            </a>
          ))}
        </div>

        {/* Professional Disclaimer */}
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 sm:p-6 md:p-8 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="flex justify-center mb-3 sm:mb-4">
              <svg
                className="w-10 h-10 sm:w-12 sm:h-12 text-foreground/20"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-3">Proprietary Work</h4>
            <p className="text-gray-600 leading-relaxed mb-3 sm:mb-4 text-sm sm:text-base">
              Due to the confidential and proprietary nature of aerospace programs, specific project details cannot be publicly disclosed.
              I'm happy to discuss my experience, technical capabilities, and approach to problem-solving in appropriate contexts.
            </p>
            <p className="text-xs sm:text-sm text-gray-500 italic">
              For inquiries regarding my aerospace experience, please feel free to reach out via the contact section below.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
