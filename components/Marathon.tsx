export default function Marathon() {
  return (
    <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-12 border border-gray-100">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
            {/* Marathon Logo */}
            <div className="flex-shrink-0">
              <img
                src="/images/tcs-marathon-logo.png"
                alt="2026 TCS New York City Marathon"
                className="w-64 sm:w-72 md:w-80 object-contain"
              />
            </div>

            {/* Content */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                Running the 2026 NYC Marathon
              </h2>
              <p className="text-gray-600 leading-relaxed mb-2">
                I'm running the 2026 TCS New York City Marathon with
                {' '}<span className="font-semibold text-foreground">Team For Kids</span>,
                NYRR's charity team that funds free youth running programs across New York City.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                If you'd like to support, any donation goes directly to keeping these programs running for kids across all five boroughs.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center md:justify-start">
                <a
                  href="https://donations.nyrr.org/donations/new?fundraiser=624830c3c37aaaa441f8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-[#E8642C] text-white rounded-lg font-medium hover:bg-[#d15725] transition-all shadow-md"
                >
                  Donate to Team For Kids
                </a>
                <img
                  src="/images/nyrr-qr.png"
                  alt="Scan to donate"
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg shadow-md"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
