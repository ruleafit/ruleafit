import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-8 py-32 px-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-black dark:text-zinc-50">
          Openfit
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Entrena al aire libre, sin gimnasio ni cuota
        </p>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-6 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a] sm:w-auto"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#B5E600] px-6 font-bold text-black transition-colors hover:bg-[#a3d100] sm:w-auto"
          >
            Crear cuenta
          </Link>
        </div>
      </main>
    </div>
  );
}
