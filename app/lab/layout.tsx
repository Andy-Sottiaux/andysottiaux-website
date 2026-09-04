import ControlAuthProvider from '@/components/ControlAuthProvider'

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <ControlAuthProvider>{children}</ControlAuthProvider>
}
