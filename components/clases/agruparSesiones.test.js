import test from 'node:test'
import assert from 'node:assert/strict'
import { agruparSesiones, firmaGrupo, textoVerMas } from './agruparSesiones.js'
import { coincideConPrecio, coincideConDuracion, tienePlazasLibres, franjaDeHora } from './filtros.js'

let n = 0
const s = (trainer_id, fecha, hora, extra = {}) => ({ id: `s${++n}`, trainer_id, fecha, hora, precio: 10, duracion: 60, plazas_max: 10, plazas_ocupadas: 0, ...extra })
const ids = (l) => l.map((c) => c.id)

test('1. organizador con una sola sesión ese día: grupo sin resto (sin botón)', () => {
  const g = agruparSesiones([s('A', '2026-12-02', '17:00')])
  assert.equal(g.length, 1); assert.equal(g[0].resto.length, 0); assert.equal(g[0].total, 1)
})

test('2. varias sesiones el mismo día: principal la primera y resto ordenado por hora', () => {
  const a19 = s('A', '2026-12-02', '19:00'), a17 = s('A', '2026-12-02', '17:00:00'), a18 = s('A', '2026-12-02', '18:00')
  const g = agruparSesiones([a19, a17, a18])
  assert.equal(g.length, 1)
  assert.equal(g[0].principal.id, a17.id)
  assert.deepEqual(ids(g[0].resto), [a18.id, a19.id])
  assert.equal(textoVerMas(g[0].resto.length), 'Ver 2 sesiones más de este día')
  assert.equal(textoVerMas(1), 'Ver 1 sesión más de este día')
})

test('3. organizador en varios días: una tarjeta por día, sin mezclar fechas', () => {
  const g = agruparSesiones([s('A', '2026-12-02', '17:00'), s('A', '2026-12-03', '17:00'), s('A', '2026-12-02', '18:00')])
  assert.equal(g.length, 2)
  assert.deepEqual(g.map((x) => [x.principal.fecha, x.total]), [['2026-12-02', 2], ['2026-12-03', 1]])
})

test('4-6. varios organizadores el mismo día: orden por hora de su primera sesión; sin mezclarlos', () => {
  const lista = [
    s('C', '2026-12-02', '18:30'), s('A', '2026-12-02', '19:00'), s('B', '2026-12-02', '17:30'),
    s('A', '2026-12-02', '17:00'), s('A', '2026-12-03', '17:00'),
  ]
  const g = agruparSesiones(lista)
  assert.deepEqual(g.map((x) => `${x.principal.trainer_id}${x.principal.fecha.slice(-2)}${x.principal.hora}`), ['A0217:00', 'B0217:30', 'C0218:30', 'A0317:00'])
  assert.deepEqual(g[0].resto.map((c) => c.hora), ['19:00'])
  for (const x of g) for (const c of [x.principal, ...x.resto]) assert.equal(c.trainer_id, x.principal.trainer_id)
})

test('7. el filtro horario se aplica ANTES: la sesión excluida no aparece ni en la tarjeta ni en el desplegable', () => {
  const a17 = s('A', '2026-12-02', '17:00'), a18 = s('A', '2026-12-02', '18:00'), a19 = s('A', '2026-12-02', '19:00')
  const todas = [a17, a18, a19]
  assert.equal(agruparSesiones(todas)[0].principal.id, a17.id)
  const filtradas = todas.filter((c) => c.hora >= '18:00' && c.hora <= '20:00')
  const g = agruparSesiones(filtradas)[0]
  assert.equal(g.principal.id, a18.id)
  assert.deepEqual(ids(g.resto), [a19.id])
  assert.ok(![g.principal, ...g.resto].some((c) => c.id === a17.id))
  assert.equal(textoVerMas(g.resto.length), 'Ver 1 sesión más de este día')
})

test('8-10. con filtros de categoría, precio, duración y plazas (N10) solo entran las que los cumplen', () => {
  const l = [
    s('A', '2026-12-02', '17:00', { categoria: 'Cardio', precio: 5, duracion: 30, plazas_ocupadas: 10 }),
    s('A', '2026-12-02', '18:00', { categoria: 'Yoga', precio: 20, duracion: 60 }),
    s('A', '2026-12-02', '19:00', { categoria: 'Yoga', precio: 12, duracion: 60 }),
    s('A', '2026-12-02', '20:00', { categoria: 'Yoga', precio: 12, duracion: 90 }),
  ]
  const f = l.filter((c) => c.categoria === 'Yoga' && coincideConPrecio(c, { min: 0, max: 15 }) && coincideConDuracion(c, 'Todas') && tienePlazasLibres(c))
  assert.deepEqual(agruparSesiones(f).map((g) => g.total), [2]) // 19:00 y 20:00
  const f2 = l.filter((c) => tienePlazasLibres(c))
  assert.equal(agruparSesiones(f2)[0].principal.hora, '18:00') // la de 17:00 está completa → no es la principal
  assert.equal(franjaDeHora('19:00') != null, true)
})

test('11. bloqueados y favoritos: lo que el filtro deja fuera nunca llega a un grupo', () => {
  const l = [s('A', '2026-12-02', '17:00'), s('B', '2026-12-02', '17:00'), s('B', '2026-12-02', '18:00')]
  const g = agruparSesiones(l.filter((c) => c.trainer_id !== 'B'))
  assert.equal(g.length, 1); assert.equal(g[0].total, 1)
})

test('12-13. series recurrentes y número real de sesiones: la suma de los grupos = sesiones recibidas', () => {
  const l = []
  for (let d = 1; d <= 20; d++) for (const h of ['17:00', '18:00', '19:00']) l.push(s('G', `2026-12-${String(d).padStart(2, '0')}`, h, { serie_id: 'x' }))
  const g = agruparSesiones(l)
  assert.equal(g.length, 20)
  assert.equal(g.reduce((t, x) => t + x.total, 0), 60)
  assert.deepEqual(new Set(g.flatMap((x) => ids([x.principal, ...x.resto]))), new Set(ids(l)))
})

test('sin duplicados ni pérdidas; no modifica la lista de entrada (el mapa recibe la original)', () => {
  const a = s('A', '2026-12-02', '17:00'), b = s('A', '2026-12-02', '18:00')
  const entrada = [b, a, a]
  const copia = [...entrada]
  const g = agruparSesiones(entrada)
  assert.equal(g[0].total, 2)
  assert.deepEqual(entrada, copia)
})

test('modo «más cercanas»: se respeta el orden de entrada entre grupos', () => {
  const l = [s('B', '2026-12-05', '10:00'), s('A', '2026-12-02', '10:00')]
  assert.deepEqual(agruparSesiones(l, { cronologico: false }).map((g) => g.principal.trainer_id), ['B', 'A'])
})

test('firma del grupo cambia si cambian sus sesiones (cierra desplegables obsoletos)', () => {
  const a = s('A', '2026-12-02', '17:00'), b = s('A', '2026-12-02', '18:00'), c = s('A', '2026-12-02', '19:00')
  const f1 = firmaGrupo(agruparSesiones([a, b, c])[0])
  const f2 = firmaGrupo(agruparSesiones([b, c])[0])
  assert.notEqual(f1, f2)
  assert.equal(f1, firmaGrupo(agruparSesiones([c, b, a])[0]))
})

test('18. rendimiento: 5000 sesiones se agrupan en pocos milisegundos', () => {
  const l = []
  for (let i = 0; i < 5000; i++) l.push(s(`O${i % 50}`, `2026-12-${String((i % 28) + 1).padStart(2, '0')}`, `${String(8 + (i % 12)).padStart(2, '0')}:00`))
  const t = Date.now()
  const g = agruparSesiones(l)
  assert.ok(Date.now() - t < 500)
  assert.equal(g.reduce((x, y) => x + y.total, 0), 5000)
})
