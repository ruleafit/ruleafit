import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { tipoDeArchivo, dimensionesImagen } from './archivo.js'
import { renderizarPagina, DocumentoNoValido } from './renderizar.js'

const LINEAS = ['@ana · ana@ejemplo.test', '27/11/2026, 20:00', 'Uso exclusivo para verificación profesional']

async function imagenBlanca(formato, ancho = 600, alto = 400) {
  const lienzo = createCanvas(ancho, alto)
  const c = lienzo.getContext('2d')
  c.fillStyle = '#fff'
  c.fillRect(0, 0, ancho, alto)
  return lienzo.encode(formato)
}

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

async function pixelesMarcados(jpeg) {
  const imagen = await loadImage(jpeg)
  const lienzo = createCanvas(imagen.width, imagen.height)
  const c = lienzo.getContext('2d')
  c.drawImage(imagen, 0, 0)
  // Solo la mitad superior: la franja inferior no cuenta para la marca diagonal.
  const { data } = c.getImageData(0, 0, imagen.width, Math.floor(imagen.height / 2))
  let n = 0
  for (let i = 0; i < data.length; i += 4) if (data[i] < 235) n++
  return n
}

test('se reconoce el tipo y el tamaño por la cabecera', async () => {
  for (const formato of ['png', 'jpeg', 'webp']) {
    const datos = await imagenBlanca(formato, 321, 123)
    assert.equal(tipoDeArchivo(datos), formato === 'jpeg' ? 'jpg' : formato)
    assert.deepEqual(dimensionesImagen(datos), { ancho: 321, alto: 123 })
  }
  assert.equal(tipoDeArchivo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null)
})

test('imagen: sale un JPEG con la marca de agua incrustada', async () => {
  const { jpeg, paginas } = await renderizarPagina(await imagenBlanca('png'), 1, LINEAS)
  assert.equal(paginas, 1)
  assert.equal(tipoDeArchivo(jpeg), 'jpg')
  assert.ok((await pixelesMarcados(jpeg)) > 500)
})

test('PDF: pagina, marca y limita a 10 páginas', async () => {
  const { jpeg, paginas } = await renderizarPagina(pdf(12), 10, LINEAS)
  assert.equal(paginas, 10)
  assert.ok((await pixelesMarcados(jpeg)) > 500)
  await assert.rejects(renderizarPagina(pdf(2), 3, LINEAS), DocumentoNoValido)
})

test('rechaza archivos falsos, dañados o gigantes', async () => {
  await assert.rejects(renderizarPagina(Buffer.from('esto no es un diploma'), 1, LINEAS), DocumentoNoValido)
  await assert.rejects(renderizarPagina(Buffer.from('%PDF-1.4 roto'), 1, LINEAS), DocumentoNoValido)
  const bomba = Buffer.from(await imagenBlanca('png'))
  bomba.writeUInt32BE(100000, 16)
  bomba.writeUInt32BE(100000, 20)
  await assert.rejects(renderizarPagina(bomba, 1, LINEAS), DocumentoNoValido)
})
