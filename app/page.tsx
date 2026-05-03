import Header from '@/components/Header'
import Hero from '@/components/Hero'
import CurrentProject from '@/components/CurrentProject'
import About from '@/components/About'
import Experience from '@/components/Experience'
import Projects from '@/components/Projects'
import Footer from '@/components/Footer'
import ScrollChinchilla from '@/components/ScrollChinchilla'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <CurrentProject />
      <About />
      <Experience />
      <Projects />
      <Footer />
      <ScrollChinchilla />
    </main>
  )
}
