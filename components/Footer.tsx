export default function Footer() {
  return (
    <footer className="py-8 px-6 border-t border-gray-200">
      <div className="max-w-4xl mx-auto text-center text-gray-500">
        <p className="text-sm">
          © {new Date().getFullYear()} Andy Sottiaux. All rights reserved.
        </p>
        <p className="text-xs mt-2">
          Built with Next.js and Tailwind CSS
        </p>
      </div>
    </footer>
  )
}
