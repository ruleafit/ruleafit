import Link from 'next/link'

export const metadata = {
  title: 'Pago recibido · Ruleafit',
}

// El banco devuelve aquí al alumno tras pagar. No confirma nada por sí misma:
// la plaza se concede cuando el banco avisa al servidor (webhook).
export default function PagoOkPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="mb-3 text-2xl font-bold text-black">Pago recibido</h1>
      <p className="mb-8 leading-relaxed text-zinc-700">
        Estamos confirmando tu pago con el banco. En unos instantes verás tu plaza en Mis reservas.
      </p>
      <Link
        href="/mis-reservas"
        className="inline-block rounded-full bg-[#B5E600] px-6 py-3 font-semibold text-black"
      >
        Ir a Mis reservas
      </Link>
    </main>
  )
}
