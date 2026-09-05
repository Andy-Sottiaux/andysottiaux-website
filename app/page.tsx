import ControlAuthProvider from '@/components/ControlAuthProvider'
import CompactPortfolio from '@/components/CompactPortfolio'
import { probeInitialHealth } from '@/lib/initialBoardHealth'

export const revalidate = 15

export default async function Home() {
  const initialHealthPoll = await probeInitialHealth()
  return (
    <ControlAuthProvider>
      <CompactPortfolio initialHealthPoll={initialHealthPoll} />
    </ControlAuthProvider>
  )
}
