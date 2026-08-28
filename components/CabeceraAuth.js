import Link from 'next/link'

export default function CabeceraAuth({ frase }) {
  return (
    <section className="border-b border-[#E2E6CF] bg-white px-4 py-10 text-center sm:py-12">
      <Link
        href="/"
        className="rounded-sm text-2xl font-extrabold tracking-tight text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2"
      >
        Rulea<span style={{ color: '#B5E600' }}>fit</span>
      </Link>
      <p className="mx-auto mt-2 max-w-xs text-sm text-[#6B7355]">{frase}</p>
    </section>
  )
}
