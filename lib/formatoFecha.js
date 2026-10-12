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
