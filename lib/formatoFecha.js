// Formatea una fecha guardada en Supabase (texto 'YYYY-MM-DD', formato que
// hay que conservar tal cual para que seguir comparando fechas como texto
// ordenable en el resto del código - filtros de /clases, claseYaPaso(),
// etc. - siga funcionando) a 'DD/MM/YYYY' para mostrarla al usuario, que es
// como se lee normalmente en España (pedido por el usuario el 12 de octubre
// de 2026, mismo formato con barras que ya usaban las fechas de caducidad
// de bono y las de las opiniones, vía toLocaleDateString('es-ES')).
//
// Deliberadamente no usa Date/toLocaleDateString: fechaIso es un texto sin
// hora ('2026-10-13'), y `new Date('2026-10-13')` lo interpreta como
// medianoche UTC - al mostrarlo con la hora local del navegador puede
// aparecer el día anterior según la zona horaria. Partir el texto a mano
// evita ese problema por completo.
export function formatearFechaParaMostrar(fechaIso) {
  if (!fechaIso) return ''

  const [anio, mes, dia] = String(fechaIso).split('-')
  if (!anio || !mes || !dia) return fechaIso

  return `${dia}/${mes}/${anio}`
}

// Hora 'HH:MM' (las horas se guardan como 'HH:MM' o 'HH:MM:SS' en hora local
// de España, Europe/Madrid, sin zona horaria: se muestran tal cual).
export function formatearHoraParaMostrar(hora) {
  return hora ? String(hora).slice(0, 5) : ''
}

// Día de la semana en español ('viernes') de una fecha 'YYYY-MM-DD'. Se
// calcula en UTC a partir de las partes del texto, igual que arriba, para que
// el huso horario del navegador no pueda mover el día.
export function diaSemanaParaMostrar(fechaIso) {
  const [anio, mes, dia] = String(fechaIso || '').split('-').map(Number)
  if (!anio || !mes || !dia) return ''
  return new Date(Date.UTC(anio, mes - 1, dia)).toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'UTC' })
}
