import Link from 'next/link'

export default function PieDePagina() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-zinc-500">
        <p>
          © 2026 Open<span style={{ color: '#B5E600' }}>fit</span>
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/privacidad"
            className="rounded-sm transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2"
          >
            Política de privacidad
          </Link>
          <Link
            href="/aviso-legal"
            className="rounded-sm transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2"
          >
            Aviso legal
          </Link>
        </div>
      </div>
    </footer>
  )
}
