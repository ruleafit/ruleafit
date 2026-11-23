import test from 'node:test'
import assert from 'node:assert/strict'
import {
  generarSesiones, validarSerie, diaSemanaIso, existeHoraEnMadrid, sumarDias, textoDias, horariosPorSemana, MAX_SESIONES_SERIE,
} from './seriesSesiones.js'

const AHORA = '2026-11-23 09:00' // lunes

test('día de la semana ISO y suma de días sin depender del huso', () => {
  assert.equal(diaSemanaIso('2026-11-23'), 1) // lunes
  assert.equal(diaSemanaIso('2026-11-29'), 7) // domingo
  assert.equal(sumarDias('2026-02-28', 1), '2026-03-01')
  assert.equal(sumarDias('2028-02-28', 1), '2028-02-29')
})

test('mismas horas todos los días: martes y jueves × 4 horas', () => {
  const p = { dias: [2, 4], personalizado: false, horas: ['17:00', '18:00', '19:00', '20:00'] }
  const s = generarSesiones(p, '2026-11-24', '2026-12-03') // mar 24 … jue 3
  // martes 24/11 y 1/12; jueves 26/11 y 3/12 → 4 días × 4 horas
  assert.equal(s.length, 16)
  assert.deepEqual(s.slice(0, 4).map((x) => x.hora), ['17:00', '18:00', '19:00', '20:00'])
  assert.equal(s[0].fecha, '2026-11-24')
  assert.equal(s.at(-1).fecha, '2026-12-03')
})

test('horas distintas por día (ejemplo del gimnasio) y fecha final inclusive', () => {
  const p = { dias: [1, 3, 5], personalizado: true, horasPorDia: { 1: ['18:00', '17:00'], 3: ['19:00', '20:00'], 5: ['21:00', '17:00', '19:00'] } }
  const s = generarSesiones(p, '2026-11-23', '2027-02-04')
  // cuenta independiente: recorre cada día
  let esperado = 0
  const porDia = { 1: 2, 3: 2, 5: 3 }
  for (let f = '2026-11-23'; f <= '2027-02-04'; f = sumarDias(f, 1)) esperado += porDia[diaSemanaIso(f)] || 0
  assert.equal(s.length, esperado)
  assert.equal(horariosPorSemana(p), 7)
  assert.deepEqual(s.slice(0, 2).map((x) => `${x.fecha} ${x.hora}`), ['2026-11-23 17:00', '2026-11-23 18:00']) // ordenadas
  const hastaViernes = generarSesiones(p, '2026-11-23', '2027-02-05') // viernes inclusive
  assert.deepEqual(hastaViernes.slice(-3).map((x) => x.hora), ['17:00', '19:00', '21:00'])
  assert.equal(hastaViernes.at(-1).fecha, '2027-02-05')
})

test('la fecha final cuenta si es un día elegido, y no si no lo es', () => {
  const p = { dias: [4], personalizado: false, horas: ['10:00'] } // jueves
  assert.equal(diaSemanaIso('2027-02-04'), 4)
  assert.equal(generarSesiones(p, '2027-01-28', '2027-02-04').length, 2) // 28/1 y 4/2
  assert.equal(generarSesiones(p, '2027-01-28', '2027-02-03').length, 1)
})

test('cambio de horario: marzo y octubre mantienen la hora de reloj y el día', () => {
  const p = { dias: [1, 7], personalizado: false, horas: ['10:00'] }
  const mar = generarSesiones(p, '2026-03-23', '2026-04-06')
  assert.deepEqual(mar.map((x) => x.fecha), ['2026-03-23', '2026-03-29', '2026-03-30', '2026-04-05', '2026-04-06'])
  const oct = generarSesiones(p, '2026-10-19', '2026-11-02')
  assert.deepEqual(oct.map((x) => x.fecha), ['2026-10-19', '2026-10-25', '2026-10-26', '2026-11-01', '2026-11-02'])
  assert.ok(mar.every((x) => x.hora === '10:00') && oct.every((x) => x.hora === '10:00'))
})

test('hora inexistente en el cambio a verano (02:30 del 29/3/2026) y existente el resto', () => {
  assert.equal(existeHoraEnMadrid('2026-03-29', '02:30'), false)
  assert.equal(existeHoraEnMadrid('2026-03-29', '03:00'), true)
  assert.equal(existeHoraEnMadrid('2026-03-29', '01:59'), true)
  assert.equal(existeHoraEnMadrid('2026-03-28', '02:30'), true)
  assert.equal(existeHoraEnMadrid('2026-10-25', '02:30'), true) // en otoño existe (dos veces)
  const v = validarSerie({ patron: { dias: [7], horas: ['02:30'] }, inicio: '2026-03-23', fin: '2026-04-05', ahora: '2026-03-01 09:00' })
  assert.ok(v.errores.some((e) => e.includes('no existe')))
})

test('validaciones: sin días, sin horas, repetidas, fechas, pasado', () => {
  const base = { inicio: '2026-11-24', fin: '2026-12-30', ahora: AHORA }
  assert.ok(validarSerie({ ...base, patron: { dias: [], horas: ['10:00'] } }).errores.some((e) => e.includes('al menos un día')))
  assert.ok(validarSerie({ ...base, patron: { dias: [2], horas: [] } }).errores.some((e) => e.includes('al menos una hora')))
  assert.ok(validarSerie({ ...base, patron: { dias: [2], horas: ['10:00', '10:00'] } }).errores.some((e) => e.includes('repetidas')))
  assert.ok(validarSerie({ ...base, patron: { dias: [2, 4], personalizado: true, horasPorDia: { 2: ['10:00'], 4: [] } } }).errores.some((e) => e.includes('Jueves')))
  assert.ok(validarSerie({ ...base, patron: { dias: [2, 4], personalizado: true, horasPorDia: { 2: ['10:00'], 4: ['09:00', '09:00'] } } }).errores.some((e) => e.includes('Jueves: hay horas repetidas')))
  assert.ok(validarSerie({ patron: { dias: [2], horas: ['10:00'] }, inicio: '2026-12-10', fin: '2026-12-01', ahora: AHORA }).errores.some((e) => e.includes('anterior')))
  assert.ok(validarSerie({ patron: { dias: [2], horas: ['10:00'] }, inicio: '2026-11-20', fin: '2026-12-01', ahora: AHORA }).errores.some((e) => e.includes('pasado')))
})

test('hoy: se omiten las horas ya pasadas y se avisa', () => {
  const v = validarSerie({ patron: { dias: [1], horas: ['08:00', '10:00', '18:00'] }, inicio: '2026-11-23', fin: '2026-11-23', ahora: AHORA })
  assert.deepEqual(v.sesiones.map((s) => s.hora), ['10:00', '18:00'])
  assert.ok(v.avisos.some((a) => a.includes('1 sesión de hoy')))
})

test('solapes por duración entre sesiones de la serie', () => {
  const p = { dias: [2], horas: ['17:00', '18:00'] }
  const mal = validarSerie({ patron: p, inicio: '2026-11-24', fin: '2026-11-24', duracion: 90, ahora: AHORA })
  assert.ok(mal.errores.some((e) => e.includes('se solapan')))
  const bien = validarSerie({ patron: p, inicio: '2026-11-24', fin: '2026-11-24', duracion: 60, ahora: AHORA }) // 17:00-18:00 justo
  assert.equal(bien.errores.length, 0)
})

test('aviso de duplicados con sesiones ya publicadas (no bloquea)', () => {
  const v = validarSerie({ patron: { dias: [2], horas: ['17:00'] }, inicio: '2026-11-24', fin: '2026-12-08', ahora: AHORA, existentes: [{ fecha: '2026-12-01', hora: '17:00:00', duracion: 60, titulo: 'X' }] })
  assert.equal(v.errores.length, 0)
  assert.equal(v.sesiones.length, 3)
  assert.ok(v.avisos.some((a) => a.includes('exactamente')))
})

test('límite técnico de sesiones y textos', () => {
  const p = { dias: [1, 2, 3, 4, 5, 6, 7], horas: ['08:00', '09:00', '10:00', '11:00'] }
  const v = validarSerie({ patron: p, inicio: '2026-11-24', fin: '2027-12-31', ahora: AHORA })
  assert.ok(v.errores.some((e) => e.includes(String(MAX_SESIONES_SERIE))))
  assert.equal(v.sesiones.length, 0)
  assert.equal(textoDias([5, 1, 3]), 'Lunes, miércoles y viernes')
  assert.equal(textoDias([2]), 'Martes')
})

test('la vista previa y el número real coinciden: validarSerie usa el mismo generador', () => {
  const p = { dias: [1, 3, 5], personalizado: true, horasPorDia: { 1: ['17:00', '18:00'], 3: ['19:00', '20:00'], 5: ['17:00', '19:00', '21:00'] } }
  const v = validarSerie({ patron: p, inicio: '2026-11-24', fin: '2027-02-04', ahora: AHORA })
  assert.equal(v.errores.length, 0)
  assert.equal(v.sesiones.length, generarSesiones(p, '2026-11-24', '2027-02-04', AHORA).length)
  const claves = v.sesiones.map((s) => `${s.fecha} ${s.hora}`)
  assert.equal(new Set(claves).size, claves.length) // sin duplicados
})
