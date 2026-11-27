import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import path from 'node:path'
import { dniNieValido, cifValido } from './documentos.js'
import { leerMrz, digitoControl } from './mrz.js'
import { decidirIdentidad, decidirCentro, nombreCoincide } from './decidir.js'
import { leerIdentidad, leerTexto } from './leer.js'
import { conDocumento, DocumentoNoValido } from './renderizar.js'
import { tipoDeArchivo, dimensionesImagen } from './archivo.js'

const HOY = new Date('2026-11-27T12:00:00Z')
const rellena = (t, n) => (t + '<'.repeat(n)).slice(0, n)

// Documento ficticio con sus dígitos de control correctos.
function td1({ dni = '12345678Z', nacimiento = '900514', caducidad = '310620', nombre = 'GARCIA<PRUEBA<<ANA' } = {}) {
  const soporte = 'BAA000589'
  const l1 = rellena(`IDESP${soporte}${digitoControl(soporte)}${dni}`, 30)
  const b = `${nacimiento}${digitoControl(nacimiento)}F${caducidad}${digitoControl(caducidad)}ESP${'<'.repeat(11)}`
  const compuesto = l1.slice(5, 30) + b.slice(0, 7) + b.slice(8, 15) + b.slice(18, 29)
  return [l1, b + digitoControl(compuesto), rellena(nombre, 30)]
}

function td3({ numero = 'PAA123456', dni = '12345678Z', caducidad = '310620' } = {}) {
  const l1 = rellena('P<ESPGARCIA<PRUEBA<<ANA', 44)
  const nacimiento = '900514'
  const opcional = rellena(dni, 14)
  const sin = `${numero}${digitoControl(numero)}ESP${nacimiento}${digitoControl(nacimiento)}F${caducidad}${digitoControl(caducidad)}${opcional}${digitoControl(opcional)}`
  const compuesto = sin.slice(0, 10) + sin.slice(13, 20) + sin.slice(21, 43)
  return [l1, sin + digitoControl(compuesto)]
}

test('letra del DNI/NIE y control del CIF', () => {
  assert.ok(dniNieValido('12345678-z'))
  assert.ok(dniNieValido('X1234567L'))
  assert.ok(!dniNieValido('12345678A'))
  assert.ok(cifValido('B58378431'))
  assert.ok(cifValido('Q2826000H'))
  assert.ok(!cifValido('B58378432'))
  assert.ok(!cifValido('12345678Z'))
})

test('MRZ: se lee aunque confunda O/0 y se rechaza si no cuadra', () => {
  const bueno = td1().join('\n')
  assert.equal(leerMrz(bueno, HOY).personal, '12345678Z')
  assert.equal(leerMrz(bueno.replace('BAA000589', 'BAAOOO589').replace('900514', '9OO514'), HOY)?.personal, '12345678Z')
  assert.equal(leerMrz(bueno.replace('900514', '900515'), HOY), null)
  assert.equal(leerMrz(td3().join('\n'), HOY).personal, '12345678Z')
  assert.equal(leerMrz('texto cualquiera', HOY), null)
})

test('nombre: tildes, partículas y cortes', () => {
  assert.ok(nombreCoincide('Ana María de la Peña García', 'PENA GARCIA ANA MARIA'))
  assert.ok(nombreCoincide('Francisco Rodríguez Fernández', 'RODRIGUEZ FERNANDEZ FRANC'))
  assert.ok(!nombreCoincide('Luis Pérez', 'GARCIA PRUEBA ANA'))
  assert.ok(!nombreCoincide('Ana', 'GARCIA PRUEBA ANA'))
})

test('identidad: aprobar, rechazar y manual', () => {
  const base = { tipo: 'DNI', textoMrz: td1().join('\n'), textoAnverso: 'ESPAÑA 12345678Z', nombre: 'Ana García Prueba', numero: '12345678Z' }
  const d = (cambios) => decidirIdentidad({ ...base, ...cambios }, HOY).decision
  assert.equal(d({}), 'aprobar')
  assert.equal(d({ numero: '00000000T' }), 'rechazar')
  assert.equal(d({ textoMrz: td1({ caducidad: '250101' }).join('\n') }), 'rechazar')
  assert.equal(d({ textoMrz: 'borroso' }), 'manual')
  assert.equal(d({ nombre: 'Luis Pérez Soto' }), 'manual')
  assert.equal(d({ textoAnverso: 'otra cosa' }), 'manual')
  assert.equal(d({ textoMrz: td1({ nacimiento: '150101' }).join('\n') }), 'manual')
  assert.equal(d({ tipo: 'PASAPORTE', textoMrz: td3().join('\n'), textoAnverso: '' }), 'aprobar')
  assert.equal(d({ tipo: 'PASAPORTE', textoMrz: td3().join('\n'), numero: 'PAA123456' }), 'aprobar')
})

test('centro: aprobar, rechazar y manual', () => {
  const texto = `AGENCIA TRIBUTARIA. Certificado de situación censal. Se certifica que la entidad GIMNASIO EL PARQUE S.L.
    con número de identificación fiscal B58378431 figura de alta en el censo de empresarios, profesionales y retenedores.`
  const d = (c) => decidirCentro({ texto, razonSocial: 'Gimnasio El Parque, S.L.', cif: 'B58378431', ...c }).decision
  assert.equal(d({}), 'aprobar')
  assert.equal(d({ cif: 'Q2826000H' }), 'rechazar')
  assert.equal(d({ cif: 'B00000000' }), 'rechazar')
  assert.equal(d({ razonSocial: 'Otro Centro SL' }), 'manual')
  assert.equal(d({ texto: 'B58378431 Gimnasio El Parque' }), 'manual')
  assert.equal(d({ texto: texto.replace(/AGENCIA TRIBUTARIA|censal|identificación fiscal|censo/g, '') }), 'manual')
})

// Imagen sintética: comprueba el recorrido completo con el lector real. La
// precisión con fotografías de documentos auténticos hay que probarla aparte.
function foto(lineas, { fuente = 34, y = 100, giro = false } = {}) {
  GlobalFonts.registerFromPath(path.resolve('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf'), 'Prueba')
  const l = createCanvas(1200, 750)
  const c = l.getContext('2d')
  if (giro) {
    c.translate(1200, 750)
    c.rotate(Math.PI)
  }
  c.fillStyle = '#f4f4f0'
  c.fillRect(0, 0, 1200, 750)
  c.fillStyle = '#111'
  c.font = `${fuente}px Prueba`
  lineas.forEach((t, i) => {
    c.fillText(t, 60, y + i * 70)
  })
  return l.encode('png')
}

test('lector real: DNI sintético leído y aprobado', async () => {
  const caraMrz = await foto(td1(), { y: 520 })
  const anverso = await foto(['ESPANA', 'DOCUMENTO NACIONAL DE IDENTIDAD', 'GARCIA PRUEBA', 'ANA', '12345678Z'], { fuente: 44 })
  const { textoMrz, textoAnverso } = await leerIdentidad({ caraMrz, anverso })
  const r = decidirIdentidad({ tipo: 'DNI', textoMrz, textoAnverso, nombre: 'Ana García Prueba', numero: '12345678Z' }, HOY)
  assert.equal(r.decision, 'aprobar', `${r.motivo}\n${textoMrz}`)
})

test('lector real: DNI girado 180 grados', async () => {
  const caraMrz = await foto(td1(), { y: 520, giro: true })
  const { textoMrz } = await leerIdentidad({ caraMrz })
  assert.equal(leerMrz(textoMrz, HOY)?.personal, '12345678Z', textoMrz)
})

test('lector real: certificado de centro escaneado', async () => {
  const imagen = await foto([
    'AGENCIA TRIBUTARIA',
    'Certificado de situacion censal',
    'Se certifica que la entidad',
    'GIMNASIO EL PARQUE S.L.',
    'con numero de identificacion fiscal B58378431',
    'figura de alta en el censo de empresarios',
  ], { fuente: 40 })
  const texto = await leerTexto(imagen)
  const r = decidirCentro({ texto, razonSocial: 'Gimnasio El Parque SL', cif: 'B58378431' })
  assert.equal(r.decision, 'aprobar', `${r.motivo}\n${texto}`)
})

// PDF mínimo válido con las páginas pedidas (en blanco).
function pdf(paginas) {
  const objetos = ['<< /Type /Catalog /Pages 2 0 R >>']
  const hijos = Array.from({ length: paginas }, (_, i) => `${i + 3} 0 R`).join(' ')
  objetos.push(`<< /Type /Pages /Kids [${hijos}] /Count ${paginas} >>`)
  for (let i = 0; i < paginas; i++) objetos.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>')
  let cuerpo = '%PDF-1.4\n'
  const posiciones = objetos.map((o, i) => {
    const p = cuerpo.length
    cuerpo += `${i + 1} 0 obj\n${o}\nendobj\n`
    return p
  })
  const xref = cuerpo.length
  cuerpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  cuerpo += posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')
  cuerpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(cuerpo, 'latin1')
}

test('documentos: tipo por cabecera, páginas y rechazo de archivos falsos o gigantes', async () => {
  const png = await foto(['x'])
  assert.equal(tipoDeArchivo(png), 'png')
  assert.deepEqual(dimensionesImagen(png), { ancho: 1200, alto: 750 })
  assert.equal(await conDocumento(pdf(12), async (d) => d.paginas), 10)
  const abre = (b) => conDocumento(b, (d) => d.pagina(1))
  await assert.rejects(abre(Buffer.from('esto no es un documento')), DocumentoNoValido)
  await assert.rejects(abre(Buffer.from('%PDF-1.4 roto')), DocumentoNoValido)
  const bomba = Buffer.from(png)
  bomba.writeUInt32BE(100000, 16)
  bomba.writeUInt32BE(100000, 20)
  await assert.rejects(abre(bomba), DocumentoNoValido)
})
