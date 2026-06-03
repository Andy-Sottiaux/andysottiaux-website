import Image from 'next/image'
import Marathon from './Marathon'
import SectionHeader from './SectionHeader'

export default function About() {
  return (
    <section id="about" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto">
        <SectionHeader eyebrow="Section 01 · About" title="About Me" />

        {/* Content Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-gray-900/50 p-6 sm:p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-2xl overflow-hidden shadow-xl ring-4 ring-gray-100 dark:ring-gray-700">
                  <Image
                    src="/images/profile.jpg"
                    alt="Andy Sottiaux"
                    width={320}
                    height={320}
                    className="w-full h-full object-cover"
                    sizes="(max-width: 640px) 192px, (max-width: 768px) 256px, 320px"
                  />
                </div>
                {/* Decorative element with chinchilla */}
                <div className="absolute -bottom-4 -right-4 w-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 bg-foreground/10 rounded-2xl -z-10">
                  <Image
                    src="/images/chinchilla-black.png"
                    alt=""
                    aria-hidden="true"
                    width={96}
                    height={96}
                    className="absolute -bottom-2 -right-2 w-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 opacity-40 hover:opacity-70 hover:scale-110 transition-all duration-300 dark:invert"
                  />
                </div>
              </div>
            </div>

            {/* About Text — bio breathes. The previous "Key Stats" row
                (10+ apps / 9+ years / 2 industries) was double-counting
                what Projects + Experience already say in detail; removed
                so this section ends on the bio itself. */}
            <div className="flex-1 space-y-4 sm:space-y-6">
              <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                I&apos;m an <span className="font-semibold text-foreground">engineer and founder</span> who builds across hardware and software. At AVX Aircraft,
                I&apos;ve designed and manufactured full rotor systems and led our subscale UAV and early autonomy work,
                including CubePilot/CubeNode integration and ROS2-based test and control software.
              </p>
              <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                I enjoy bridging mechanical design, embedded systems, and hands-on testing, and I bring a
                practical, <span className="font-semibold text-foreground">fail fast mentality</span> to moving ideas into real, working aerospace capabilities.
              </p>
              <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                Beyond aerospace, I founded <span className="font-semibold text-foreground">HatchingPoint</span> where I&apos;ve designed and developed 10+ production iPhone
                apps, built modern web applications, and architected robust back-end systems. I thrive at the
                intersection of hardware and software, always driven by making things that work.
              </p>
            </div>
          </div>
        </div>

        {/* Marathon Banner */}
        <Marathon />
      </div>
    </section>
  )
}
