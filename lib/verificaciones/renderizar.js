// Solo servidor. Convierte una página de un diploma (PDF o imagen) en un JPEG con
// la marca de agua incrustada. Es lo único que llega al navegador: el archivo
// original no sale nunca del servidor.
import path from 'node:path'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { tipoDeArchivo, dimensionesImagen } from './archivo.js'

export const MAX_PAGINAS = 10
const ANCHO_MAXIMO = 1400
const ALTO_MAXIMO = 2000
const PIXELES_MAXIMOS = 50_000_000
const FUENTE = 'MarcaAguaRuleafit'

const carpetaPdfjs = path.join(/* turbopackIgnore: true */ process.cwd(), 'node_modules', 'pdfjs-dist')

// En Vercel no hay fuentes del sistema: se usa la que trae pdfjs-dist.
let fuenteCargada = false
function cargarFuente() {
  if (fuenteCargada) return
  const ruta = path.join(carpetaPdfjs, 'standard_fonts', 'LiberationSans-Bold.ttf')
  if (!GlobalFonts.registerFromPath(ruta, FUENTE)) throw new Error('No se pudo cargar la fuente de la marca de agua.')
  fuenteCargada = true
}

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
  return { lienzo, contexto, paginas: 1 }
}

async function dibujarPdf(datos, pagina) {
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
    const documento = await tarea.promise
    const paginas = Math.min(documento.numPages, MAX_PAGINAS)
    if (pagina > paginas) throw new DocumentoNoValido('Esa página no existe.')
    const hoja = await documento.getPage(pagina)
    const base = hoja.getViewport({ scale: 1 })
    const vista = hoja.getViewport({ scale: Math.min(ANCHO_MAXIMO / base.width, ALTO_MAXIMO / base.height) })
    const { lienzo, contexto } = lienzoDe(vista.width, vista.height)
    await hoja.render({ canvas: null, canvasContext: contexto, viewport: vista }).promise
    return { lienzo, contexto, paginas }
  } catch (error) {
    if (error instanceof DocumentoNoValido) throw error
    throw new DocumentoNoValido('El PDF está dañado o protegido con contraseña.')
  } finally {
    await tarea.destroy()
  }
}

// Marca repetida en diagonal por toda la página y franja inferior legible.
function marcarAgua(contexto, ancho, alto, lineas) {
  const cuerpo = Math.max(12, Math.round(ancho / 48))
  const texto = lineas.join('  ·  ')
  contexto.save()
  contexto.translate(ancho / 2, alto / 2)
  contexto.rotate(-Math.PI / 6)
  contexto.font = `${cuerpo}px ${FUENTE}`
  contexto.textAlign = 'left'
  contexto.textBaseline = 'middle'
  contexto.lineWidth = Math.max(2, cuerpo / 8)
  contexto.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  contexto.fillStyle = 'rgba(20, 24, 0, 0.28)'
  const radio = Math.hypot(ancho, alto) / 2
  const paso = contexto.measureText(texto).width + cuerpo * 3
  let fila = 0
  for (let y = -radio; y <= radio; y += cuerpo * 5, fila++) {
    for (let x = -radio - ((fila * paso) / 3) % paso; x <= radio; x += paso) {
      contexto.strokeText(texto, x, y)
      contexto.fillText(texto, x, y)
    }
  }
  contexto.restore()

  const franja = Math.max(11, Math.round(ancho / 60))
  contexto.save()
  contexto.fillStyle = 'rgba(0, 0, 0, 0.72)'
  contexto.fillRect(0, alto - franja * 4.2, ancho, franja * 4.2)
  contexto.fillStyle = '#ffffff'
  contexto.font = `${franja}px ${FUENTE}`
  contexto.textAlign = 'center'
  contexto.textBaseline = 'top'
  lineas.forEach((linea, i) => contexto.fillText(linea, ancho / 2, alto - franja * (4 - i * 1.25), ancho - 16))
  contexto.restore()
}

// Devuelve { jpeg, paginas }. `lineas` es el texto de la marca de agua.
export async function renderizarPagina(datos, pagina, lineas) {
  cargarFuente()
  const tipo = tipoDeArchivo(datos)
  if (!tipo) throw new DocumentoNoValido('El archivo no es un PDF ni una imagen válida.')
  if (tipo !== 'pdf' && pagina > 1) throw new DocumentoNoValido('Esa página no existe.')
  const { lienzo, contexto, paginas } = tipo === 'pdf' ? await dibujarPdf(datos, pagina) : await dibujarImagen(datos)
  marcarAgua(contexto, lienzo.width, lienzo.height, lineas)
  return { jpeg: await lienzo.encode('jpeg', 82), paginas }
}
