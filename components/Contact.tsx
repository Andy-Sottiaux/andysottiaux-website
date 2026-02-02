export default function Contact() {
  return (
    <section id="contact" className="py-24 px-6 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl font-bold mb-8 text-foreground">Get In Touch</h2>
        <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
          I'm always interested in hearing about new opportunities, collaborations, or just connecting
          with fellow tech enthusiasts. Feel free to reach out!
        </p>
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <a
            href="mailto:your.email@example.com"
            className="px-8 py-3 bg-foreground text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Send Email
          </a>
          <a
            href="https://www.linkedin.com/in/andy-sottiaux-593700100/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 border-2 border-foreground text-foreground rounded-lg hover:bg-foreground hover:text-white transition-all font-medium"
          >
            LinkedIn
          </a>
          <a
            href="https://github.com/yourusername"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 border-2 border-foreground text-foreground rounded-lg hover:bg-foreground hover:text-white transition-all font-medium"
          >
            GitHub
          </a>
        </div>
      </div>
    </section>
  )
}
