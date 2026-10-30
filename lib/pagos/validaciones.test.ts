import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  coincideProvinciaConCodigoPostal,
  validarCIF,
  validarCodigoPostal,
  validarDNI,
  validarEmail,
  validarIBAN,
  validarNIE,
  validarNIF,
  zonaFiscalDeCodigoPostal,
} from './validaciones.ts'

test('DNI: letra de control', () => {
  assert.ok(validarDNI('12345678Z'))
  assert.ok(validarDNI('12345678-z'))
  assert.ok(validarDNI('00000000T'))
  assert.ok(!validarDNI('12345678A')) // letra errónea
  assert.ok(!validarDNI('1234567Z')) // pocas cifras
  assert.ok(!validarDNI('ABCDEFGHI'))
})

test('NIE: letra de control', () => {
  assert.ok(validarNIE('X1234567L'))
  assert.ok(validarNIE('x1234567l'))
  assert.ok(!validarNIE('X1234567A'))
  assert.ok(!validarNIE('W1234567L'))
})

test('CIF: dígito o letra de control según el tipo', () => {
  assert.ok(validarCIF('B12345674')) // tipo B: cifra
  assert.ok(!validarCIF('B12345675'))
  assert.ok(validarCIF('P1234567D')) // tipo P: letra (control 4 -> D)
  assert.ok(!validarCIF('P12345674')) // tipo P no admite cifra
  assert.ok(!validarCIF('B1234567D')) // tipo B no admite letra
})

test('validarNIF detecta el tipo', () => {
  assert.equal(validarNIF('12345678Z'), 'DNI')
  assert.equal(validarNIF('X1234567L'), 'NIE')
  assert.equal(validarNIF('B12345674'), 'CIF')
  assert.equal(validarNIF('12345678A'), null)
  assert.equal(validarNIF(''), null)
})

test('IBAN español: mod 97', () => {
  assert.ok(validarIBAN('ES9121000418450200051332'))
  assert.ok(validarIBAN('ES91 2100 0418 4502 0005 1332'))
  assert.ok(validarIBAN('es9121000418450200051332'))
  assert.ok(!validarIBAN('ES9121000418450200051333')) // un dígito cambiado
  assert.ok(!validarIBAN('ES912100041845020005133')) // corto
  assert.ok(!validarIBAN('DE89370400440532013000')) // no español
})

test('código postal y zonas fiscales', () => {
  assert.ok(validarCodigoPostal('41001'))
  assert.ok(validarCodigoPostal('01001'))
  assert.ok(validarCodigoPostal('52001'))
  assert.ok(!validarCodigoPostal('00123'))
  assert.ok(!validarCodigoPostal('53001'))
  assert.ok(!validarCodigoPostal('4100'))
  assert.equal(zonaFiscalDeCodigoPostal('41001'), 'peninsula_baleares')
  assert.equal(zonaFiscalDeCodigoPostal('07001'), 'peninsula_baleares') // Baleares
  assert.equal(zonaFiscalDeCodigoPostal('35001'), 'canarias')
  assert.equal(zonaFiscalDeCodigoPostal('38001'), 'canarias')
  assert.equal(zonaFiscalDeCodigoPostal('51001'), 'ceuta_melilla')
  assert.equal(zonaFiscalDeCodigoPostal('52001'), 'ceuta_melilla')
  assert.equal(zonaFiscalDeCodigoPostal('31001'), 'navarra_pais_vasco')
  assert.equal(zonaFiscalDeCodigoPostal('48001'), 'navarra_pais_vasco')
  assert.equal(zonaFiscalDeCodigoPostal('99999'), null)
})

test('provincia y código postal', () => {
  assert.ok(coincideProvinciaConCodigoPostal('41420', 'Sevilla'))
  assert.ok(coincideProvinciaConCodigoPostal('41420', 'SEVILLA'))
  assert.ok(coincideProvinciaConCodigoPostal('48001', 'Vizcaya'))
  assert.ok(coincideProvinciaConCodigoPostal('48001', 'Bizkaia'))
  assert.ok(coincideProvinciaConCodigoPostal('28001', 'Comunidad de Madrid'))
  assert.ok(coincideProvinciaConCodigoPostal('29001', 'málaga'))
  assert.ok(!coincideProvinciaConCodigoPostal('41420', 'Málaga'))
  assert.ok(!coincideProvinciaConCodigoPostal('00000', 'Sevilla'))
})

test('email', () => {
  assert.ok(validarEmail('a@b.es'))
  assert.ok(!validarEmail('a@b'))
  assert.ok(!validarEmail('a b@c.es'))
})
