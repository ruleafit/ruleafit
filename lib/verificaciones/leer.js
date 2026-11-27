// Solo servidor. Lectura de los documentos de identidad y de centros.
import { createCanvas } from '@napi-rs/canvas'
import { conDocumento } from './renderizar.js'
import { conLector, CARACTERES_MRZ } from './ocr.js'
import { leerMrz } from './mrz.js'

// Recorta una franja, la pasa a gris con más contraste y la amplía.
function preparar(lienzo, desde = 0, giro = 0) {
  const alto = Math.round(lienzo.height * (1 - desde))
  const girado = giro % 180 !== 0
  const escala = Math.min(2, 1800 / (girado ? alto : lienzo.width))
  const w = Math.round(lienzo.width * escala)
  const h = Math.round(alto * escala)
  const salida = createCanvas(girado ? h : w, girado ? w : h)
  const c = salida.getContext('2d')
  c.translate(salida.width / 2, salida.height / 2)
  c.rotate((giro * Math.PI) / 180)
  c.drawImage(lienzo, 0, lienzo.height - alto, lienzo.width, alto, -w / 2, -h / 2, w, h)
  const imagen = c.getImageData(0, 0, salida.width, salida.height)
  const d = imagen.data
  for (let i = 0; i < d.length; i += 4) {
    const gris = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, (gris - 128) * 1.4 + 128))
  }
  c.putImageData(imagen, 0, 0)
  return salida.toBuffer('image/png')
}

const primeraPagina = (datos) => conDocumento(datos, async (doc) => (await doc.pagina(1)).lienzo)

// Devuelve { textoMrz, textoAnverso }. Prueba recortes y giros hasta dar con una MRZ válida.
export async function leerIdentidad({ caraMrz, anverso }) {
  const hojaMrz = await primeraPagina(caraMrz)
  const hojaAnverso = anverso ? await primeraPagina(anverso) : null
  return conLector(async (lector) => {
    const limite = Date.now() + 30_000
    let textoMrz = ''
    for (const [desde, giro] of [[0.5, 0], [0, 0], [0, 180], [0, 90], [0, 270]]) {
      const { texto } = await lector.leer(preparar(hojaMrz, desde, giro), { caracteres: CARACTERES_MRZ, bloque: true })
      textoMrz += texto + '\n'
      if (leerMrz(texto)) {
        textoMrz = texto
        break
      }
      if (Date.now() > limite) break
    }
    const textoAnverso = hojaAnverso ? (await lector.leer(preparar(hojaAnverso))).texto : ''
    return { textoMrz, textoAnverso }
  })
}

// Texto de un certificado: el propio del PDF y, si no trae, leído de la imagen.
export async function leerTexto(datos, maxPaginas = 3) {
  return conDocumento(datos, async (doc) => {
    const textos = []
    const porLeer = []
    for (let n = 1; n <= Math.min(doc.paginas, maxPaginas); n++) {
      const { lienzo, fragmentos } = await doc.pagina(n)
      const propio = fragmentos.map((f) => f.texto).join(' ')
      if (propio.length >= 150) textos.push(propio)
      else porLeer.push(lienzo)
    }
    if (porLeer.length) {
      await conLector(async (lector) => {
        for (const lienzo of porLeer) textos.push((await lector.leer(preparar(lienzo))).texto)
      })
    }
    return textos.join('\n')
  })
}

