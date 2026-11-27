import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluarPerfilFiscal, motivoIban } from './evaluarPerfilFiscal.ts'

const HOY = new Date('2026-11-27T12:00:00Z')
const PERSONA = {
  tipo: 'persona_fisica_profesional',
  nombreFiscal: 'Ana Pérez López',
  nif: '12345678Z',
  direccion: 'Calle Sierpes 1',
  codigoPostal: '41001',
  municipio: 'Sevilla',
  provincia: 'Sevilla',
  email: 'ana@ejemplo.es',
  titularIban: 'Ana Pérez López',
  iban: 'ES91 2100 0418 4502 0005 1332',
  fechaNacimiento: '1990-05-20',
  declaraIngresos: true,
  responsableDatos: true,
  aceptaAutofactura: true,
}
const SOCIEDAD = { ...PERSONA, tipo: 'sociedad', nombreFiscal: 'Gimnasio', titularIban: 'Gimnasio', nif: 'B00000000', fechaNacimiento: '' }

const evaluar = (extra: object, base: object = PERSONA, opciones: object = {}) =>
  evaluarPerfilFiscal({ ...base, ...extra }, { hoy: HOY, ...opciones })
const motivos = (extra: object, base: object = PERSONA) => {
  const r = evaluar(extra, base)
  return r.aprobado ? [] : r.motivos
}
const rechaza = (extra: object, patron: RegExp, base: object = PERSONA) => {
  const m = motivos(extra, base)
  assert.ok(m.some((x) => patron.test(x)), `${JSON.stringify(extra)} -> ${JSON.stringify(m)}`)
}

test('datos correctos: se aprueban y se normalizan', () => {
  const r = evaluar({ nif: ' 12.345.678-z ', nombreFiscal: '  Ana   Pérez ', codigoPostal: ' 41001 ' })
  assert.ok(r.aprobado)
  assert.equal(r.perfil.nif, '12345678Z')
  assert.equal(r.perfil.tipoDocumento, 'DNI')
  assert.equal(r.perfil.nombreFiscal, 'Ana Pérez')
  assert.equal(r.perfil.codigoPostal, '41001')
  assert.equal(r.perfil.zonaFiscal, 'peninsula_baleares')
  assert.ok(evaluar({}, SOCIEDAD).aprobado)
})

test('NIF, NIE y CIF: letra o dígito de control', () => {
  assert.ok(evaluar({ nif: 'X1234567L' }).aprobado)
  for (const malo of ['12345678A', 'X1234567A', '1234567Z', '', 'ABC']) rechaza({ nif: malo }, /NIF\/NIE\/CIF no es válido/)
  rechaza({ nif: 'B00000001' }, /no es válido/, SOCIEDAD)
  rechaza({ nif: 'B00000000' }, /DNI o NIE/)
  rechaza({ nif: '12345678Z' }, /su CIF/, SOCIEDAD)
})

test('IBAN: país, longitud, caracteres y módulo 97', () => {
  assert.equal(motivoIban('ES9121000418450200051332'), null)
  assert.equal(motivoIban('es91 2100 0418 4502 0005 1332'), null)
  assert.match(motivoIban('FR1420041010050500013M02606')!, /española/)
  assert.match(motivoIban('ES912100041845020005133')!, /24 caracteres y has escrito 23/)
  assert.match(motivoIban('ES91210004184502000513321')!, /escrito 25/)
  assert.match(motivoIban('ES91210004184502000513A2')!, /solo puede llevar cifras/)
  assert.match(motivoIban('ES9121000418450200051333')!, /dígitos de control/)
  assert.match(motivoIban('ES9221000418450200051332')!, /dígitos de control/)
  rechaza({ iban: 'ES9121000418450200051333' }, /dígitos de control/)
})

test('IBAN: obligatorio salvo que ya haya uno guardado', () => {
  rechaza({ iban: '' }, /Escribe el IBAN/)
  const r = evaluar({ iban: '' }, PERSONA, { hayIbanGuardado: true })
  assert.ok(r.aprobado)
  assert.equal(r.perfil.iban, null)
})

test('titular y razón social', () => {
  rechaza({ nombreFiscal: 'Ana' }, /nombre y apellidos faltan los apellidos/)
  rechaza({ titularIban: 'Ana' }, /titular de la cuenta faltan los apellidos/)
  rechaza({ nombreFiscal: 'Ana 123' }, /apellidos/)
  rechaza({ nombreFiscal: '   ' }, /Escribe el nombre/)
  rechaza({ nombreFiscal: '' }, /razón social/, SOCIEDAD)
  rechaza({ nombreFiscal: '1234' }, /razón social/, SOCIEDAD)
  assert.ok(evaluar({ nombreFiscal: 'Gimnasio' }, SOCIEDAD).aprobado) // una sociedad puede llamarse con una palabra
})

test('código postal y dirección', () => {
  for (const [codigoPostal, provincia] of [['01001', 'Álava'], ['52001', 'Melilla'], ['08001', 'Barcelona']]) {
    assert.ok(evaluar({ codigoPostal, provincia }).aprobado, codigoPostal)
  }
  for (const malo of ['00001', '53000', '4100', '410011', '41A01', '']) rechaza({ codigoPostal: malo }, /5 cifras/)
  rechaza({ provincia: 'Madrid' }, /no coincide/)
  rechaza({ direccion: ' ' }, /dirección fiscal/)
  rechaza({ municipio: '' }, /municipio/)
})

test('correo, edad y casillas', () => {
  rechaza({ email: 'ana@' }, /correo/)
  rechaza({ fechaNacimiento: '2009-11-28' }, /mayor de edad/)
  assert.ok(evaluar({ fechaNacimiento: '2008-11-27' }).aprobado) // cumple 18 hoy
  rechaza({ fechaNacimiento: '2008-11-28' }, /mayor de edad/)
  rechaza({ fechaNacimiento: '1990-02-31' }, /fecha de nacimiento/)
  rechaza({ declaraIngresos: false }, /casillas/)
  rechaza({ aceptaAutofactura: 'true' }, /casillas/)
})

test('se devuelven todos los motivos a la vez y nunca falla con entradas raras', () => {
  assert.ok(motivos({ nif: 'x', iban: 'y', codigoPostal: 'z' }).length >= 3)
  for (const basura of [null, undefined, 'texto', 42, [], { tipo: {} }]) {
    assert.equal(evaluarPerfilFiscal(basura).aprobado, false)
  }
})
