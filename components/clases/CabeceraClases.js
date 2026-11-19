export default function CabeceraClases() {
  return (
    <section className="relative isolate flex h-[160px] items-end overflow-hidden sm:h-[200px]">
      <img src="/imagenes/running.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-6 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Sesiones disponibles</h1>
        <p className="mt-1 text-sm text-white/85 sm:text-base">
          Sesiones sin cuota ni permanencia.
        </p>
      </div>
    </section>
  )
}
