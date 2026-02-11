export default function Footer() {
  return (
    <footer id="contact" className="py-12 sm:py-16 px-4 sm:px-6 bg-foreground text-white">
      <div className="max-w-6xl mx-auto">
        {/* Contact + Info */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8 sm:mb-10">
          <div className="text-center md:text-left">
            <h3 className="text-2xl sm:text-3xl font-bold mb-2">Get In Touch</h3>
            <p className="text-gray-300 text-sm sm:text-base max-w-md">
              Interested in collaborating or just want to connect? Feel free to reach out.
            </p>
          </div>

          <div className="flex gap-4">
            <a
              href="mailto:andrewsottiaux@gmail.com"
              className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">Email</span>
            </a>
            <a
              href="https://www.linkedin.com/in/andy-sottiaux-593700100/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <span className="text-sm font-medium">LinkedIn</span>
            </a>
            <a
              href="https://www.hatchingpoint.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span className="text-sm font-medium">Website</span>
            </a>
          </div>
        </div>

        {/* Divider + Bottom */}
        <div className="pt-6 sm:pt-8 border-t border-white/20 text-center">
          <div className="flex items-center justify-center gap-2">
            <p className="text-xs sm:text-sm text-gray-300">
              © {new Date().getFullYear()} Andy Sottiaux. All rights reserved.
            </p>
            <img
              src="/images/chinchilla-white.png"
              alt=""
              className="w-8 h-8 sm:w-10 sm:h-10 opacity-80 hover:opacity-100 hover:scale-110 transition-all duration-300"
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
