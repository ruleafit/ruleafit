import Link from 'next/link'
import { CalendarClock, Users, BellRing, MapPinned, Repeat } from 'lucide-react'
import FormularioCentros from '../../components/centros/FormularioCentros'

export const metadata = {
  title: 'Para gimnasios y centros deportivos | RuleaFit',
  description:
    'Publica tus actividades, organiza tus horarios y facilita que nuevos usuarios encuentren y reserven tus clases en RuleaFit.',
  alternates: { canonical: '/centros' },
}

const VENTAJAS = [
  { Icono: CalendarClock, titulo: 'Horarios recurrentes', texto: 'Publica una actividad semanal una sola vez y se crean todas sus sesiones. Cada una se puede gestionar por separado.' },
  { Icono: Users, titulo: 'Control de plazas', texto: 'Tú fijas las plazas de cada sesión. Cuando se llenan, se cierran las reservas automáticamente.' },
  { Icono: BellRing, titulo: 'Avisos automáticos', texto: 'Tus usuarios reciben avisos de sus reservas y tú puedes enviar un aviso a quienes han reservado una sesión.' },
  { Icono: MapPinned, titulo: 'Mayor visibilidad', texto: 'Tus sesiones aparecen en Explora, en el mapa y en tu perfil público, donde nuevos usuarios las encuentran.' },
]

const botonPrimario =
  'inline-flex min-h-12 items-center justify-center py-2 text-center corte-btn bg-[#B5E600] px-8 text-base font-bold text-[#1F2400] shadow-sm transition hover:bg-[#a3d100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40'
const botonSecundario =
  'inline-flex min-h-12 items-center justify-center py-2 text-center corte-btn border-2 border-white px-8 text-base font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40'

export default function CentrosPage() {
  return (
    <main className="w-full bg-[#F7F9EC] text-[#1F2400]">
      <section className="bg-[#1A1F00] px-6 py-16 text-center sm:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          <p className="text-sm font-bold uppercase tracking-wide text-[#B5E600]">Gimnasios y centros deportivos</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Tu centro deportivo, más conectado</h1>
          <p className="max-w-2xl text-base text-white/85 sm:text-lg">
            Publica tus actividades, organiza tus horarios y facilita que nuevos usuarios encuentren y reserven tus clases.
          </p>
          <div className="mt-2 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/registro?tipo=organizador" className={botonPrimario}>Crear cuenta y empezar</Link>
            <a href="#solicitud" className={botonSecundario}>Solicitar información o demostración</a>
          </div>
        </div>
      </section>

      <section className="px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Lo que ganas con RuleaFit</h2>
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {VENTAJAS.map(({ Icono, titulo, texto }, i) => (
              <li key={titulo} className="flex gap-4 rounded-2xl border border-[#E2E6CF] bg-white p-5 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1A1F00]">
                  <Icono className="h-6 w-6 text-[#B5E600]" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold"><span className="text-[#5E7A00]">{i + 1}.</span> {titulo}</h3>
                  <p className="mt-1 text-sm text-[#3d4426]">{texto}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-dashed border-[#B5E600] bg-white/70 p-4 text-sm text-[#3d4426]">
            <Repeat className="mt-0.5 h-5 w-5 shrink-0 text-[#5E7A00]" aria-hidden="true" />
            <p>
              <span className="font-semibold">Ejemplo ilustrativo:</span> «Pilates – lunes y miércoles, 18:30», con 12 plazas por sesión. Lo publicas una vez
              y RuleaFit crea las sesiones de las próximas semanas.
            </p>
          </div>
        </div>
      </section>

      <section id="solicitud" className="scroll-mt-20 px-6 pb-20">
        <div className="mx-auto max-w-xl">
          <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Solicita información o una demostración</h2>
          <p className="mb-6 mt-2 text-center text-sm text-[#3d4426]">
            Cuéntanos cómo es tu centro. Registrarte en RuleaFit no requiere pedir una demostración.
          </p>
          <FormularioCentros />
        </div>
      </section>
    </main>
  )
}
