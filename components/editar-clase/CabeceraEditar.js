export default function CabeceraEditar() {
  return (
    <section className="relative isolate flex h-[180px] items-end overflow-hidden sm:h-[220px]">
      <img
        src="/imagenes/running.jpg"
        alt=""
        className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-6 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Editar sesión</h1>
        <p className="mt-1 text-sm text-white/85 sm:text-base">
          Solo puedes cambiar lo que no afecta a quienes ya han reservado.
        </p>
      </div>
    </section>
  )
}
