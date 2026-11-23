// Series de sesiones recurrentes (C07): generación, validación y textos. Funciones puras (sin React
// ni Supabase) para poder probarlas. Las fechas son 'YYYY-MM-DD' y las horas 'HH:MM' en hora local
// de España (Europe/Madrid), igual que las guarda la base de datos (sin zona horaria): el cambio de
// horario de verano/invierno no desplaza nada porque se trabaja siempre con la fecha y hora «de reloj».
// El calendario se calcula en UTC a partir de las partes de la fecha para que el huso horario del
// navegador no pueda mover un día.

// Límite técnico de sesiones en una sola publicación (protección contra publicaciones masivas
// accidentales). Debe coincidir con el de la función SQL publicar_serie (sql/088).
export const MAX_SESIONES_SERIE = 250

// Días de la semana. `n` sigue la numeración ISO (1 = lunes … 7 = domingo).
export const DIAS_SEMANA = [
  { n: 1, corta: 'L', nombre: 'Lunes', plural: 'lunes' },
  { n: 2, corta: 'M', nombre: 'Martes', plural: 'martes' },
  { n: 3, corta: 'X', nombre: 'Miércoles', plural: 'miércoles' },
  { n: 4, corta: 'J', nombre: 'Jueves', plural: 'jueves' },
  { n: 5, corta: 'V', nombre: 'Viernes', plural: 'viernes' },
  { n: 6, corta: 'S', nombre: 'Sábado', plural: 'sábados' },
  { n: 7, corta: 'D', nombre: 'Domingo', plural: 'domingos' },
]

const reFecha = /^(\d{4})-(\d{2})-(\d{2})$/
const reHora = /^([01]\d|2[0-3]):([0-5]\d)$/

function partesFecha(f) {
  const m = reFecha.exec(String(f || ''))
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  // Rechaza fechas imposibles (31 de febrero…).
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null
  return d
}

export function fechaValida(f) {
  return partesFecha(f) !== null
}

export function horaValida(h) {
  return reHora.test(String(h || ''))
}

function aIso(d) {
  return d.toISOString().slice(0, 10)
}

export function sumarDias(fechaIso, n) {
  const d = partesFecha(fechaIso)
  if (!d) return ''
  d.setUTCDate(d.getUTCDate() + n)
  return aIso(d)
}

// Día de la semana ISO (1 = lunes … 7 = domingo) de una fecha 'YYYY-MM-DD'.
export function diaSemanaIso(fechaIso) {
  const d = partesFecha(fechaIso)
  if (!d) return 0
  const js = d.getUTCDay() // 0 = domingo
  return js === 0 ? 7 : js
}

// Hora local de Madrid «ahora» como 'YYYY-MM-DD HH:MM' (se compara como texto con fecha + hora).
export function ahoraMadridTexto(ahora = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(ahora)
  const g = (t) => p.find((x) => x.type === t)?.value
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`
}

// ¿Existe esa hora de reloj en Madrid? La noche del cambio a horario de verano (último domingo de
// marzo) las 02:00–02:59 no existen. Se comprueba probando los dos desfases posibles (+1 y +2 h).
export function existeHoraEnMadrid(fechaIso, hora) {
  const d = partesFecha(fechaIso)
  const m = reHora.exec(String(hora || ''))
  if (!d || !m) return false
  const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(m[1]), Number(m[2]))
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  const objetivo = `${fechaIso} ${hora}`
  return [1, 2].some((off) => {
    const p = fmt.formatToParts(new Date(base - off * 3600000))
    const g = (t) => p.find((x) => x.type === t)?.value
    return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}` === objetivo
  })
}

// 'HH:MM' únicas y ordenadas.
export function normalizarHoras(horas) {
  return [...new Set((horas || []).filter(horaValida))].sort()
}

// Horas de un día concreto según el patrón: las mismas para todos o las personalizadas.
export function horasDelDia(patron, dia) {
  if (patron.personalizado) return normalizarHoras(patron.horasPorDia?.[dia])
  return normalizarHoras(patron.horas)
}

// Genera las sesiones {fecha, hora} desde `inicio` hasta `fin`, ambas inclusive, en los días
// elegidos. `ahora` (opcional, 'YYYY-MM-DD HH:MM' de Madrid) descarta las ya pasadas.
// patron = { dias: [1,3,5], personalizado: bool, horas: ['17:00'], horasPorDia: { 1: ['17:00'] } }
export function generarSesiones(patron, inicio, fin, ahora = null) {
  if (!fechaValida(inicio) || !fechaValida(fin) || fin < inicio) return []
  const dias = new Set((patron.dias || []).filter((n) => n >= 1 && n <= 7))
  const salida = []
  for (let f = inicio, guardia = 0; f <= fin && guardia < 4000; f = sumarDias(f, 1), guardia++) {
    const dia = diaSemanaIso(f)
    if (!dias.has(dia)) continue
    for (const h of horasDelDia(patron, dia)) {
      if (ahora && `${f} ${h}` < ahora) continue
      salida.push({ fecha: f, hora: h })
    }
  }
  return salida
}

function minutos(h) {
  const [a, b] = h.split(':').map(Number)
  return a * 60 + b
}

// Validación del formulario. Devuelve { errores: [...], avisos: [...], sesiones: [...] }.
//   duracion: minutos (número) o null; existentes: sesiones activas del organizador
//   [{ fecha, hora, duracion, titulo }] para avisar de duplicados y solapes.
export function validarSerie({ patron, inicio, fin, duracion, existentes = [], ahora = ahoraMadridTexto(), max = MAX_SESIONES_SERIE }) {
  const errores = []
  const avisos = []

  if (!fechaValida(inicio)) errores.push('Elige la fecha de inicio.')
  if (!fechaValida(fin)) errores.push('Elige hasta qué fecha quieres repetir la actividad.')
  if (fechaValida(inicio) && fechaValida(fin) && fin < inicio) errores.push('La fecha final no puede ser anterior a la de inicio.')
  if (fechaValida(inicio) && inicio < ahora.slice(0, 10)) errores.push('La fecha de inicio no puede estar en el pasado.')

  const dias = [...new Set(patron.dias || [])].sort((a, b) => a - b)
  if (dias.length === 0) errores.push('Selecciona al menos un día de la semana.')

  if (patron.personalizado) {
    for (const n of dias) {
      const crudas = (patron.horasPorDia?.[n] || []).filter(horaValida)
      const nombre = DIAS_SEMANA.find((d) => d.n === n)?.nombre
      if (crudas.length === 0) errores.push(`${nombre}: añade al menos una hora.`)
      else if (new Set(crudas).size !== crudas.length) errores.push(`${nombre}: hay horas repetidas.`)
    }
  } else if (dias.length > 0) {
    const crudas = (patron.horas || []).filter(horaValida)
    if (crudas.length === 0) errores.push('Añade al menos una hora.')
    else if (new Set(crudas).size !== crudas.length) errores.push('Hay horas repetidas.')
  }

  if (errores.length > 0) return { errores, avisos, sesiones: [] }

  const todas = generarSesiones({ ...patron, dias }, inicio, fin)
  const futuras = generarSesiones({ ...patron, dias }, inicio, fin, ahora)
  const pasadas = todas.length - futuras.length
  if (pasadas > 0) {
    avisos.push(`${pasadas === 1 ? 'Se omite 1 sesión de hoy' : `Se omiten ${pasadas} sesiones de hoy`} cuya hora ya ha pasado.`)
  }
  if (futuras.length === 0) errores.push('Con esas fechas y horas no se crearía ninguna sesión.')
  if (futuras.length > max) {
    errores.push(`Son ${futuras.length} sesiones y el máximo por publicación es ${max}. Acorta el periodo o divide la publicación en varias.`)
  }

  const noExisten = futuras.filter((s) => !existeHoraEnMadrid(s.fecha, s.hora))
  if (noExisten.length > 0) {
    const s = noExisten[0]
    errores.push(`El ${s.fecha.split('-').reverse().join('/')} a las ${s.hora} no existe (cambio de horario de verano). Cambia esa hora.`)
  }

  // Solapes entre las propias sesiones según su duración.
  const dur = Number(duracion)
  if (dur > 0) {
    const porDia = new Map()
    for (const s of futuras) {
      if (!porDia.has(s.fecha)) porDia.set(s.fecha, [])
      porDia.get(s.fecha).push(s.hora)
    }
    for (const [f, hs] of porDia) {
      const orden = [...hs].sort()
      for (let i = 1; i < orden.length; i++) {
        if (minutos(orden[i - 1]) + dur > minutos(orden[i])) {
          errores.push(`Las sesiones de las ${orden[i - 1]} y las ${orden[i]} se solapan (duración de ${dur} min). Separa las horas o reduce la duración.`)
          break
        }
      }
      if (errores.length > 20) break
    }
  }

  // Duplicados y solapes con sesiones ya publicadas (solo aviso: puede ser intencionado).
  const claves = new Set(futuras.map((s) => `${s.fecha} ${s.hora}`))
  const dup = existentes.filter((e) => claves.has(`${e.fecha} ${String(e.hora).slice(0, 5)}`))
  if (dup.length > 0) {
    avisos.push(`Ya tienes ${dup.length === 1 ? '1 sesión publicada' : `${dup.length} sesiones publicadas`} exactamente en alguno de esos días y horas (por ejemplo el ${dup[0].fecha.split('-').reverse().join('/')} a las ${String(dup[0].hora).slice(0, 5)}).`)
  } else if (dur > 0) {
    const solapadas = existentes.filter((e) => {
      const ed = Number(e.duracion)
      if (!(ed > 0)) return false
      return futuras.some((s) => s.fecha === e.fecha && minutos(s.hora) < minutos(String(e.hora).slice(0, 5)) + ed && minutos(String(e.hora).slice(0, 5)) < minutos(s.hora) + dur)
    })
    if (solapadas.length > 0) avisos.push(`Algunas sesiones se solapan con otras que ya tienes publicadas (${solapadas.length}).`)
  }

  return { errores, avisos, sesiones: errores.length === 0 ? futuras : [] }
}

// «Lunes, miércoles y viernes».
export function textoDias(dias) {
  const nombres = [...new Set(dias)].sort((a, b) => a - b).map((n) => DIAS_SEMANA.find((d) => d.n === n)?.nombre.toLowerCase()).filter(Boolean)
  if (nombres.length === 0) return ''
  const t = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Horarios por semana (suma de las horas de cada día seleccionado).
export function horariosPorSemana(patron) {
  return [...new Set(patron.dias || [])].reduce((acc, n) => acc + horasDelDia(patron, n).length, 0)
}

// Resumen compacto de lo que verá el organizador: [{ dia, nombre, horas }] por día elegido.
export function resumenPorDia(patron) {
  return [...new Set(patron.dias || [])].sort((a, b) => a - b).map((n) => ({
    dia: n,
    nombre: DIAS_SEMANA.find((d) => d.n === n)?.nombre,
    horas: horasDelDia(patron, n),
  }))
}

// Agrupa una lista de sesiones por fecha para la vista previa: [{ fecha, horas: [] }].
export function agruparPorFecha(sesiones) {
  const m = new Map()
  for (const s of sesiones) {
    if (!m.has(s.fecha)) m.set(s.fecha, [])
    m.get(s.fecha).push(s.hora)
  }
  return [...m.entries()].map(([fecha, horas]) => ({ fecha, horas }))
}
