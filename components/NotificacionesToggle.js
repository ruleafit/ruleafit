'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Convierte la clave VAPID publica de base64url a Uint8Array (formato que exige pushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function NotificacionesToggle({ usuarioActual, onCambioEstado }) {
  const [soportado, setSoportado] = useState(true)
  const [activado, setActivado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (onCambioEstado) onCambioEstado(activado)
  }, [activado])

  // Al cargar: comprobar soporte del navegador y si ya hay una suscripcion activa.
  useEffect(() => {
    let activo = true
    async function comprobar() {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (activo) { setSoportado(false); setCargando(false) }
        return
      }
      try {
        const registration = await navigator.serviceWorker.ready
        const sub = await registration.pushManager.getSubscription()
        if (activo) setActivado(!!sub)
      } catch (e) {
        // si algo falla, dejamos activado en false
      }
      if (activo) setCargando(false)
    }
    comprobar()
    return () => { activo = false }
  }, [])

  async function activar() {
    if (procesando) return
    setProcesando(true)
    setError(null)
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setError('Permiso denegado. Actívalo en los ajustes del navegador.')
        setProcesando(false)
        return
      }
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })
      const subJson = sub.toJSON()
      const { error: errInsert } = await supabase.from('push_subscriptions').insert({
        usuario_id: usuarioActual.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        user_agent: navigator.userAgent,
      })
      if (errInsert) {
        // si falla el guardado, deshacemos la suscripcion del navegador para no dejar estado inconsistente
        await sub.unsubscribe()
        setError('No se pudo guardar la suscripción. Inténtalo de nuevo.')
      } else {
        setActivado(true)
      }
    } catch (e) {
      setError('No se pudo activar. Inténtalo de nuevo.')
    }
    setProcesando(false)
  }

  async function desactivar() {
    if (procesando) return
    setProcesando(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setActivado(false)
    } catch (e) {
      setError('No se pudo desactivar. Inténtalo de nuevo.')
    }
    setProcesando(false)
  }

  if (!soportado) {
    return (
      <p className="text-sm text-[#162318]/60">
        Tu navegador no admite notificaciones push.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={activado ? desactivar : activar}
        disabled={procesando || cargando}
        className={
          activado
            ? 'rounded-full border-2 border-[#162318] px-6 py-2 font-semibold text-[#162318] transition hover:bg-[#162318] hover:text-white disabled:opacity-60'
            : 'rounded-full bg-[#B5E600] px-6 py-2 font-semibold text-[#3D4A00] transition hover:brightness-95 disabled:opacity-60'
        }
      >
        {cargando ? '...' : procesando ? '...' : activado ? 'Desactivar notificaciones' : 'Activar notificaciones'}
      </button>
      {error && <p className="text-sm text-[#B85E60]">{error}</p>}
    </div>
  )
}
