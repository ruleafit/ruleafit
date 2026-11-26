'use client'

const fecha = (iso) => new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })

export default function ListaAlertas({ alertas, onCambiar }) {
  const abiertas = alertas.filter((a) => !a.resuelta_en)
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-bold text-[#1F2400]">Abiertas ({abiertas.length})</h2>
      {abiertas.length === 0 && <p className="text-sm text-[#6B7355]">No hay alertas abiertas.</p>}
      <ul className="flex flex-col gap-3">
        {abiertas.map((a) => (
          <li
            key={a.id}
            className={`corte-card border bg-white p-4 ${a.gravedad === 'critica' ? 'border-red-300' : 'border-amber-300'}`}
          >
            <p className="text-xs font-bold uppercase text-[#6B7355]">
              {a.gravedad === 'critica' ? 'Crítica' : 'Aviso'} · {a.tipo} · {a.veces} {a.veces === 1 ? 'vez' : 'veces'}
            </p>
            <p className="mt-1 text-sm text-[#1F2400]">{a.detalle}</p>
            <p className="mt-1 text-xs text-[#6B7355]">
              Desde {fecha(a.primera_en)} · última {fecha(a.ultima_en)}
            </p>
            <button
              type="button"
              onClick={() => onCambiar({ accion: 'resolver', id: a.id })}
              className="mt-2 corte-tag border border-[#E2E6CF] px-3 py-1 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600]"
            >
              Marcar resuelta
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
