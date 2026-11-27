import { supabase } from './supabaseClient'

// Pide al servidor el formulario firmado y envía el navegador a la pasarela del banco.
// Devuelve un mensaje de error, o null si ya se está redirigiendo.
export async function iniciarPago(ruta, cuerpo) {
  const { data: sesion } = await supabase.auth.getSession()
  const respuesta = await fetch(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.session?.access_token || ''}` },
    body: JSON.stringify(cuerpo),
  }).catch(() => null)
  const datos = respuesta ? await respuesta.json().catch(() => ({})) : {}
  if (!respuesta || !respuesta.ok || !datos.url || !datos.campos) {
    return datos.error || 'No se ha podido iniciar el pago. Inténtalo de nuevo.'
  }
  const formulario = document.createElement('form')
  formulario.method = 'POST'
  formulario.action = datos.url
  for (const [nombre, valor] of Object.entries(datos.campos)) {
    const campo = document.createElement('input')
    campo.type = 'hidden'
    campo.name = nombre
    campo.value = valor
    formulario.appendChild(campo)
  }
  document.body.appendChild(formulario)
  formulario.submit()
  return null
}
