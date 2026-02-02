export default function Hero() {
  return (
    <section className="min-h-screen flex items-center justify-center px-6 pt-20">
      <div className="max-w-4xl text-center">
        <h1 className="text-6xl md:text-7xl font-bold mb-6 text-foreground">
          Andy Sottiaux
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 mb-8">
          Software Engineer & Entrepreneur
        </p>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-12">
          Building innovative solutions and leading teams to create impactful products.
          Passionate about technology, entrepreneurship, and continuous learning.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="#contact"
            className="px-8 py-3 bg-foreground text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Get in Touch
          </a>
          <a
            href="#projects"
            className="px-8 py-3 border-2 border-foreground text-foreground rounded-lg hover:bg-foreground hover:text-white transition-all font-medium"
          >
            View Projects
          </a>
        </div>
      </div>
    </section>
  )
}
