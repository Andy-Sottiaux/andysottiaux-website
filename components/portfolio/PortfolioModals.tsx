'use client'

import dynamic from 'next/dynamic'
import type { ModalKey } from '../CompactModals'
import Modal from '../Modal'
import { useFieldTheme } from '../fieldTheme'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import type { HealthPollResult } from '@/lib/fieldHealth'

type LiveModalContentProps = {
  initialHealthPoll?: HealthPollResult
  selectedCamera?: FieldCameraSource
  onCameraChange?: (value: FieldCameraSource) => void
}

type PortfolioModalsProps = {
  initialHealthPoll?: HealthPollResult
  openModal: ModalKey | null
  selectedCamera: FieldCameraSource
  onCameraChange: (value: FieldCameraSource) => void
  onClose: () => void
}

const AboutModalContent = dynamic(() => import('../CompactModals').then((m) => m.AboutModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const LiveModalContent = dynamic<LiveModalContentProps>(() => import('../CompactModals').then((m) => m.LiveModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const ExperienceModalContent = dynamic(() => import('../CompactModals').then((m) => m.ExperienceModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const ProjectsModalContent = dynamic(() => import('../CompactModals').then((m) => m.ProjectsModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const MarathonModalContent = dynamic(() => import('../CompactModals').then((m) => m.MarathonModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const ContactModalContent = dynamic(() => import('../CompactModals').then((m) => m.ContactModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})
const AirpodsMountModalContent = dynamic(() => import('../CompactModals').then((m) => m.AirpodsMountModalContent), {
  ssr: false,
  loading: () => <ModalLoading />,
})

export default function PortfolioModals({
  initialHealthPoll,
  openModal,
  selectedCamera,
  onCameraChange,
  onClose,
}: PortfolioModalsProps) {
  return (
    <>
      <Modal
        open={openModal === 'about'}
        onClose={onClose}
        title="About Andy"
        eyebrow="Profile"
      >
        <AboutModalContent />
      </Modal>
      <Modal
        open={openModal === 'live'}
        onClose={onClose}
        title="Field Live"
        eyebrow="Edge-AI deployment"
        size="lg"
      >
        <LiveModalContent
          initialHealthPoll={initialHealthPoll}
          selectedCamera={selectedCamera}
          onCameraChange={onCameraChange}
        />
      </Modal>
      <Modal
        open={openModal === 'experience'}
        onClose={onClose}
        title="Experience"
        eyebrow="Career timeline"
        size="lg"
      >
        <ExperienceModalContent />
      </Modal>
      <Modal
        open={openModal === 'projects'}
        onClose={onClose}
        title="Projects"
        eyebrow="Things I've built"
        size="lg"
      >
        <ProjectsModalContent />
      </Modal>
      <Modal
        open={openModal === 'marathon'}
        onClose={onClose}
        title="2026 TCS NYC Marathon"
        eyebrow="Running for Team for Kids"
      >
        <MarathonModalContent />
      </Modal>
      <Modal
        open={openModal === 'contact'}
        onClose={onClose}
        title="Contact"
        eyebrow="Get in touch"
      >
        <ContactModalContent />
      </Modal>
      <Modal
        open={openModal === 'airpodsmount'}
        onClose={onClose}
        title="AirPods Tesla Mount"
        eyebrow="3D printed · CAD design"
      >
        <AirpodsMountModalContent />
      </Modal>
    </>
  )
}

function ModalLoading() {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  return (
    <div className="space-y-3" aria-label="Loading modal content">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 rounded-2xl"
          style={{
            background: isLight ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.045)',
            border: palette.cardBorder,
          }}
        />
      ))}
    </div>
  )
}
