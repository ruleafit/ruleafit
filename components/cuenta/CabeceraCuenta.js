'use client'

export default function CabeceraCuenta({ fotoUrl, username, email, inicial, infoNivel, rango }) {
  return (
    <section className="relative isolate flex h-[180px] items-center justify-center overflow-hidden sm:h-[220px]">
      <div className="absolute inset-0 -z-20 overflow-hidden">
        <img src="/imagenes/fuerza.jpg" alt="" className="h-full w-full scale-110 object-cover blur-md" />
      </div>
      <div className="absolute inset-0 -z-10 bg-black/60" />

      <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white/70 bg-[#B5E600] text-2xl font-extrabold text-[#1F2400] shadow-sm sm:h-20 sm:w-20 sm:text-3xl">
          {fotoUrl ? (
            <img src={fotoUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            inicial
          )}
        </div>
        <p className="text-lg font-bold text-white sm:text-xl">{username || email}</p>

        {/* Nivel de usuario (0-100) y rango (juego de palabras sobre
            "rulero"), calculados a partir del saldo de Rulos. Ver
            lib/niveles.js para la curva de costes y el reparto de
            rangos. */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center corte-tag bg-[#B5E600] px-3 py-1 text-xs font-bold text-[#1F2400]">
            Nivel {infoNivel.nivel}
          </span>
          <span className="inline-flex items-center gap-1 corte-tag bg-white px-3 py-1 text-xs font-bold text-[#3D4A00]">
            <span aria-hidden="true">{rango.icono}</span>
            {rango.nombre}
          </span>
        </div>
        <div className="flex w-40 flex-col items-center gap-1 sm:w-48">
          <div className="h-1.5 w-full overflow-hidden corte-barra bg-white/25">
            <div
              className="h-full corte-barra bg-[#B5E600]"
              style={{ width: `${Math.round(infoNivel.progreso * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-white/80">
            {infoNivel.esMaximo
              ? 'Nivel máximo alcanzado'
              : `${infoNivel.rulosParaSiguiente} rulos para el nivel ${infoNivel.nivel + 1}`}
          </p>
        </div>
      </div>
    </section>
  )
}
