'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Esta pantalla ya no se usa: pedía el rol (cliente/entrenador) a quien se
// registraba con Google, y el concepto de rol ha desaparecido (Fase 2 de la
// unificación de roles, ver claude/plan-unificacion-cliente-entrenador.md).
// Se deja como simple redirección a inicio por si queda algún enlace o
// marcador antiguo apuntando aquí. Nada más en la app enlaza ya a esta ruta.
export default function CompletarPerfilPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return null
}
