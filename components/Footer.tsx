export default function Footer() {
  return (
    <footer className="py-8 sm:py-12 px-4 sm:px-6 bg-foreground text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Andy Sottiaux</h3>
            <p className="text-gray-300 text-xs sm:text-sm">
              Building the future of UAV systems and mobile applications
            </p>
          </div>

          <div className="flex gap-6">
            <a
              href="https://www.linkedin.com/in/andy-sottiaux-593700100/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70 transition-opacity"
              aria-label="LinkedIn"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a
              href="https://www.hatchingpoint.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70 transition-opacity"
              aria-label="HatchingPoint"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </a>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/20 text-center">
          <div className="flex items-center justify-center gap-2">
            <p className="text-xs sm:text-sm text-gray-300">
              © {new Date().getFullYear()} Andy Sottiaux. All rights reserved.
            </p>
            <img
              src="/images/chinchilla-white.png"
              alt=""
              className="w-6 h-6 sm:w-8 sm:h-8 opacity-60 hover:opacity-100 transition-opacity"
              title="🐭"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1 sm:mt-2">
            Built with Next.js, TypeScript & Tailwind CSS
          </p>
        </div>
      </div>
    </footer>
  )
}
