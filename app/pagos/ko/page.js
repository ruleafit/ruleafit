import Link from 'next/link'

export const metadata = {
  title: 'Pago no completado · Ruleafit',
}

export default function PagoKoPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="mb-3 text-2xl font-bold text-black">El pago no se ha completado</h1>
      <p className="mb-8 leading-relaxed text-zinc-700">
        No se ha hecho ningún cargo y no se ha reservado ninguna plaza. Puedes intentarlo de nuevo cuando quieras.
      </p>
      <Link
        href="/clases"
        className="inline-block rounded-full bg-[#B5E600] px-6 py-3 font-semibold text-black"
      >
        Volver a las sesiones
      </Link>
    </main>
  )
}
