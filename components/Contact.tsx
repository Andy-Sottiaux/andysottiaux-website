export default function Contact() {
  return (
    <section id="contact" className="py-32 px-6 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-foreground mb-4">Get In Touch</h2>
          <div className="w-20 h-1 bg-foreground mx-auto mb-6"></div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            I'm always interested in hearing about new opportunities, collaborations, or just connecting
            with fellow tech enthusiasts. Feel free to reach out!
          </p>
        </div>

        {/* Contact Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-12 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <a
              href="mailto:andrewsottiaux@gmail.com"
              className="group flex flex-col items-center p-6 rounded-xl border-2 border-gray-200 hover:border-foreground hover:shadow-lg transition-all"
            >
              <div className="w-16 h-16 bg-foreground/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-foreground transition-all">
                <svg
                  className="w-8 h-8 text-foreground group-hover:text-white transition-all"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span className="font-semibold text-foreground">Email</span>
              <span className="text-sm text-gray-500 mt-1">Send a message</span>
            </a>

            <a
              href="https://www.linkedin.com/in/andy-sottiaux-593700100/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center p-6 rounded-xl border-2 border-gray-200 hover:border-foreground hover:shadow-lg transition-all"
            >
              <div className="w-16 h-16 bg-foreground/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-foreground transition-all">
                <svg
                  className="w-8 h-8 text-foreground group-hover:text-white transition-all"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </div>
              <span className="font-semibold text-foreground">LinkedIn</span>
              <span className="text-sm text-gray-500 mt-1">Let's connect</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
