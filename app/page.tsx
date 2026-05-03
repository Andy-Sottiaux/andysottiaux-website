import Header from '@/components/Header'
import Hero from '@/components/Hero'
import About from '@/components/About'
import CurrentProject from '@/components/CurrentProject'
import Experience from '@/components/Experience'
import Projects from '@/components/Projects'
import Education from '@/components/Education'
import Footer from '@/components/Footer'
import ScrollChinchilla from '@/components/ScrollChinchilla'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <About />
      <CurrentProject />
      <Experience />
      <Projects />
      <Education />
      <Footer />
      <ScrollChinchilla />
    </main>
  )
}
