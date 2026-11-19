export default function CabeceraMisClases() {
  return (
    <section className="relative isolate flex h-[180px] items-end overflow-hidden sm:h-[220px]">
      <img src="/imagenes/yoga.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Mis sesiones</h1>
        <p className="mt-1 text-sm text-white/85 sm:text-base">Tus sesiones publicadas y quién viene a cada una.</p>
      </div>
    </section>
  )
}
