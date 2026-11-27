import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validarArchivo,
  validarTitulacion,
  rutaArchivo,
  compararDocumento,
  textoMarcaDeAgua,
  MAX_BYTES,
} from './reglas.js'
import { purgarArchivos } from './purga.js'

test('archivos: formato y tamaño', () => {
  assert.equal(validarArchivo({ type: 'application/pdf', size: 1000 }), '')
  assert.ok(validarArchivo(null))
  assert.ok(validarArchivo({ type: 'image/svg+xml', size: 10 }))
  assert.ok(validarArchivo({ type: 'image/png', size: 0 }))
  assert.ok(validarArchivo({ type: 'image/png', size: MAX_BYTES + 1 }))
})

test('la ruta cumple el formato que exige el SQL', () => {
  const ruta = rutaArchivo('11111111-1111-1111-1111-111111111111', 'image/jpeg', '22222222-2222-2222-2222-222222222222')
  assert.match(ruta, /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/)
})

test('titulación', () => {
  const buena = { nombre: 'TSEAS', entidad: 'IES', anio: '2020' }
  assert.equal(validarTitulacion(buena, 2026), '')
  assert.ok(validarTitulacion({ ...buena, nombre: ' a ' }, 2026))
  assert.ok(validarTitulacion({ ...buena, entidad: '' }, 2026))
  assert.ok(validarTitulacion({ ...buena, anio: 2027 }, 2026))
  assert.ok(validarTitulacion({ ...buena, anio: '2020.5' }, 2026))
})

test('comparación con el NIF fiscal', () => {
  assert.equal(compararDocumento(' 12345678-z ', '12345678Z'), 'coincide')
  assert.equal(compararDocumento('12345678A', '12345678Z'), 'no_coincide')
  assert.equal(compararDocumento('', '12345678Z'), 'no_coincide')
  assert.equal(compararDocumento('X', null), 'sin_perfil_fiscal')
})

test('marca de agua: quién, cuándo (hora de Madrid) y aviso', () => {
  const lineas = textoMarcaDeAgua({ username: 'ana', email: 'ana@ejemplo.test', fecha: new Date('2026-01-15T23:30:00Z') })
  assert.equal(lineas[0], '@ana · ana@ejemplo.test')
  assert.match(lineas[1], /16\/01\/2026/)
  assert.match(lineas[2], /verificación profesional/)
})

function adminFalso({ cola, falla = [] }) {
  const registro = { borradosStorage: [], borradosCola: [] }
  return {
    registro,
    rpc: async () => ({ error: null }),
    storage: {
      from: (bucket) => ({
        remove: async (rutas) => {
          if (falla.includes(bucket)) return { error: { message: 'caído' } }
          registro.borradosStorage.push(...rutas)
          return { error: null }
        },
      }),
    },
    from: () => ({
      select: () => ({ order: () => ({ limit: async () => ({ data: cola, error: null }) }) }),
      delete: () => ({
        eq: () => ({
          in: async (_c, rutas) => {
            registro.borradosCola.push(...rutas)
            return { error: null }
          },
        }),
      }),
    }),
  }
}

test('purga: si Storage falla, el archivo se queda en la cola', async () => {
  const admin = adminFalso({
    cola: [
      { bucket: 'verificaciones-identidad', ruta: 'a' },
      { bucket: 'titulaciones', ruta: 'b' },
    ],
    falla: ['titulaciones'],
  })
  const original = console.error
  console.error = () => {}
  const resultado = await purgarArchivos(admin)
  console.error = original
  assert.deepEqual(resultado, { borrados: 1, pendientes: 1 })
  assert.deepEqual(admin.registro.borradosCola, ['a'])
})
