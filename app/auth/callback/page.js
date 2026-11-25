'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import { destinoTrasLogin } from '../../../lib/retorno'
import { reclamarInvitacionPendiente } from '../../../lib/invitacion'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    let activo = true
    async function procesar() {
      // El cliente de Supabase detecta la sesion del hash de la URL automaticamente.
      // Esperamos a que este disponible.
      const { data } = await supabase.auth.getSession()
      if (!activo) return

      const user = data?.session?.user
      if (!user) {
        // Sin sesion: algo fallo, volver al login.
        router.replace('/login')
        return
      }

      // C25: si venía de una invitación, se reclama ahora (Google o confirmación de correo). El servidor decide: solo
      // cuentas nuevas, una vez, y sin duplicar. Un fallo aquí nunca impide entrar.
      await reclamarInvitacionPendiente(supabase)

      // C03: sesión pendiente (ruta interna validada) o portada. La ficha limpia el recuerdo al mostrar el aviso.
      router.replace(destinoTrasLogin())
    }
    procesar()
    return () => { activo = false }
  }, [router])

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm text-[#162318]/60">Iniciando sesión...</p>
    </div>
  )
}
