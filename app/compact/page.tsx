import type { Metadata } from 'next'
import CompactPortfolio from '@/components/CompactPortfolio'

// Single-viewport, bento-style alternative to the home page. Lives at
// /compact while the user evaluates it side-by-side with `/`. Home page
// (`/`) is intentionally untouched.
export const metadata: Metadata = {
  title: 'Andy Sottiaux - Compact',
  description:
    'Single-viewport portfolio for Andy Sottiaux. Aerospace hardware and production software, with a live edge-AI field deployment.',
  alternates: {
    canonical: 'https://andysottiaux.com/compact',
  },
  // Keep /compact out of search indexes while it's an evaluation surface.
  // Flip to indexable if/when this becomes the canonical home.
  robots: {
    index: false,
    follow: true,
  },
}

export default function CompactPage() {
  return <CompactPortfolio />
}
