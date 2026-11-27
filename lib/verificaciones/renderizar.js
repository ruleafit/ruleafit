// Solo servidor. Convierte las páginas de un documento (PDF o imagen) en
// lienzos para poder leer su texto. No se envían a ningún navegador.
import path from 'node:path'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { tipoDeArchivo, dimensionesImagen } from './archivo.js'

export const MAX_PAGINAS = 10
const ANCHO_MAXIMO = 1400
const ALTO_MAXIMO = 2000
const PIXELES_MAXIMOS = 50_000_000

const carpetaPdfjs = path.join(/* turbopackIgnore: true */ process.cwd(), 'node_modules', 'pdfjs-dist')

export class DocumentoNoValido extends Error {}

function lienzoDe(ancho, alto) {
  const escala = Math.min(1, ANCHO_MAXIMO / ancho, ALTO_MAXIMO / alto)
  const lienzo = createCanvas(Math.max(1, Math.round(ancho * escala)), Math.max(1, Math.round(alto * escala)))
  const contexto = lienzo.getContext('2d')
  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, lienzo.width, lienzo.height)
  return { lienzo, contexto }
}

async function dibujarImagen(datos) {
  const medidas = dimensionesImagen(datos)
  if (!medidas || medidas.ancho * medidas.alto > PIXELES_MAXIMOS) {
    throw new DocumentoNoValido('La imagen es demasiado grande o está dañada.')
  }
  const imagen = await loadImage(datos)
  const { lienzo, contexto } = lienzoDe(imagen.width, imagen.height)
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  return { lienzo, contexto, fragmentos: [] }
}

// Texto que ya trae la página, con su caja en píxeles del lienzo.
async function textoDeHoja(hoja, vista) {
  const { items } = await hoja.getTextContent()
  return items
    .filter((i) => i.str?.trim())
    .map((i) => {
      const [x0, y0] = vista.convertToViewportPoint(i.transform[4], i.transform[5])
      const alto = (i.height || Math.hypot(i.transform[2], i.transform[3])) * vista.scale
      return { texto: i.str, x: x0, y: y0 - alto, ancho: i.width * vista.scale, alto: alto * 1.25 }
    })
}

// Abre el documento y llama a `usar({ paginas, pagina(n) })`.
export async function conDocumento(datos, usar) {
  const tipo = tipoDeArchivo(datos)
  if (!tipo) throw new DocumentoNoValido('El archivo no es un PDF ni una imagen válida.')
  if (tipo !== 'pdf') {
    return usar({
      paginas: 1,
      async pagina(n) {
        if (n !== 1) throw new DocumentoNoValido('Esa página no existe.')
        return dibujarImagen(datos)
      },
    })
  }

  // El «worker» se importa a mano para que Vercel lo incluya en la función.
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const tarea = getDocument({
    data: new Uint8Array(datos),
    standardFontDataUrl: path.join(carpetaPdfjs, 'standard_fonts') + '/',
    cMapUrl: path.join(carpetaPdfjs, 'cmaps') + '/',
    wasmUrl: path.join(carpetaPdfjs, 'wasm') + '/',
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
    maxImageSize: PIXELES_MAXIMOS,
    verbosity: 0,
  })
  try {
    const documento = await tarea.promise.catch(() => {
      throw new DocumentoNoValido('El PDF está dañado o protegido con contraseña.')
    })
    const paginas = Math.min(documento.numPages, MAX_PAGINAS)
    return await usar({
      paginas,
      async pagina(n) {
        if (n < 1 || n > paginas) throw new DocumentoNoValido('Esa página no existe.')
        const hoja = await documento.getPage(n)
        const base = hoja.getViewport({ scale: 1 })
        const vista = hoja.getViewport({ scale: Math.min(ANCHO_MAXIMO / base.width, ALTO_MAXIMO / base.height) })
        const { lienzo, contexto } = lienzoDe(vista.width, vista.height)
        await hoja.render({ canvas: null, canvasContext: contexto, viewport: vista }).promise
        return { lienzo, contexto, fragmentos: await textoDeHoja(hoja, vista) }
      },
    })
  } finally {
    await tarea.destroy()
  }
}

