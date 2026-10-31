import Link from 'next/link'

export const metadata = {
  title: 'Eliminar mi cuenta · Ruleafit',
  description: 'Cómo borrar tu cuenta de Ruleafit y qué datos se eliminan.',
}

const h2Class = 'mt-8 mb-3 text-xl font-bold text-black'
const pClass = 'mb-4 leading-relaxed text-zinc-800'
const ulClass = 'mb-4 list-disc space-y-2 pl-6 leading-relaxed text-zinc-800'

// Página pública: Google Play exige una dirección web que explique cómo borrar
// la cuenta, accesible sin haber iniciado sesión.
export default function EliminarCuentaInfoPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-bold text-black">Eliminar mi cuenta de Ruleafit</h1>

      <p className={pClass}>
        Puedes borrar tu cuenta y tus datos en cualquier momento, tú mismo y sin tener que escribirnos.
      </p>

      <h2 className={h2Class}>Cómo hacerlo</h2>
      <ol className="mb-4 list-decimal space-y-2 pl-6 leading-relaxed text-zinc-800">
        <li>
          Inicia sesión en la app o en <strong>www.ruleafit.com</strong>.
        </li>
        <li>
          Abre <Link href="/cuenta" className="font-semibold text-[#5c7300] underline">Mi cuenta</Link> desde el menú.
        </li>
        <li>Baja hasta el apartado «Eliminar mi cuenta» y pulsa el botón.</li>
        <li>Escribe la palabra ELIMINAR para confirmar.</li>
      </ol>

      <h2 className={h2Class}>Qué se borra</h2>
      <ul className={ulClass}>
        <li>Tu perfil, tu nombre de usuario y tu foto.</li>
        <li>Tus reservas, las sesiones que hayas publicado y tus valoraciones.</li>
        <li>Tus seguidores, Rulos, bonos y notificaciones.</li>
      </ul>
      <p className={pClass}>
        El borrado es definitivo y no se puede deshacer. Si tienes sesiones próximas con reservas de otras personas,
        cancélalas antes: no se puede borrar la cuenta mientras haya reservas pendientes.
      </p>

      <h2 className={h2Class}>Datos que podemos conservar</h2>
      <p className={pClass}>
        Si has realizado o recibido pagos, la ley puede obligarnos a conservar durante un tiempo los datos fiscales y
        las facturas correspondientes. Se guardan bloqueados y solo para ese fin.
      </p>

      <h2 className={h2Class}>¿No puedes entrar en tu cuenta?</h2>
      <p className={pClass}>
        Escríbenos a <strong>rfp99trabajo@gmail.com</strong> desde el correo con el que te registraste y la
        eliminaremos por ti. Más información en nuestra{' '}
        <Link href="/privacidad" className="font-semibold text-[#5c7300] underline">Política de privacidad</Link>.
      </p>
    </main>
  )
}
