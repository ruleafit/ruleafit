import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from './imagenesCategoria'
import { formatearFechaParaMostrar } from './formatoFecha'

// Imagen vertical (1080x1920, formato de historia de Instagram) con los datos
// de una sesión, para compartirla o descargarla. Se dibuja en un canvas con la
// foto de la categoría de fondo; las imágenes están en el mismo dominio, así
// que no hay problemas de CORS al exportar el canvas.
const ANCHO = 1080
const ALTO = 1920
const LIMA = '#B5E600'
const FUENTE = '"Geist", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Dibuja la imagen cubriendo todo el lienzo (como object-fit: cover).
function dibujarCubriendo(ctx, img) {
  const escala = Math.max(ANCHO / img.width, ALTO / img.height)
  const w = img.width * escala
  const h = img.height * escala
  ctx.drawImage(img, (ANCHO - w) / 2, (ALTO - h) / 2, w, h)
}

// Parte un texto en líneas que quepan en el ancho dado (máximo maxLineas; si
// sobra texto, la última línea acaba en "…").
function partirEnLineas(ctx, texto, anchoMax, maxLineas) {
  const palabras = texto.split(/\s+/).filter(Boolean)
  const lineas = []
  let actual = ''

  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra
    if (ctx.measureText(prueba).width <= anchoMax || !actual) {
      actual = prueba
    } else {
      lineas.push(actual)
      actual = palabra
    }
  }
  if (actual) lineas.push(actual)

  if (lineas.length > maxLineas) {
    const recortadas = lineas.slice(0, maxLineas)
    let ultima = recortadas[maxLineas - 1]
    while (ultima.length > 1 && ctx.measureText(`${ultima}…`).width > anchoMax) {
      ultima = ultima.slice(0, -1)
    }
    recortadas[maxLineas - 1] = `${ultima}…`
    return recortadas
  }
  return lineas
}

export async function generarImagenHistoria(clase) {
  const canvas = document.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = ALTO
  const ctx = canvas.getContext('2d')

  // Fondo: foto de la categoría + degradado oscuro para que el texto se lea.
  try {
    const foto = await cargarImagen(IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO)
    dibujarCubriendo(ctx, foto)
  } catch {
    ctx.fillStyle = '#1F2400'
    ctx.fillRect(0, 0, ANCHO, ALTO)
  }
  const degradado = ctx.createLinearGradient(0, 0, 0, ALTO)
  degradado.addColorStop(0, 'rgba(0,0,0,0.45)')
  degradado.addColorStop(0.4, 'rgba(0,0,0,0.2)')
  degradado.addColorStop(0.75, 'rgba(0,0,0,0.78)')
  degradado.addColorStop(1, 'rgba(0,0,0,0.92)')
  ctx.fillStyle = degradado
  ctx.fillRect(0, 0, ANCHO, ALTO)

  const margen = 90
  const anchoTexto = ANCHO - margen * 2
  ctx.textBaseline = 'alphabetic'

  // Marca arriba, con el "fit" en lima como en la web.
  ctx.font = `800 72px ${FUENTE}`
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('Rulea', margen, 190)
  const anchoRulea = ctx.measureText('Rulea').width
  ctx.fillStyle = LIMA
  ctx.fillText('fit', margen + anchoRulea, 190)

  // Bloque inferior: categoría, título, datos y enlace. Se mide antes de dibujar
  // para que acabe siempre por encima de la línea del pie, aunque el título sea
  // largo.
  const hora = clase.hora ? String(clase.hora).slice(0, 5) : ''
  const datos = [
    [clase.ciudad, clase.direccion ? `Zona: ${clase.direccion}` : ''].filter(Boolean).join(' · '),
    [formatearFechaParaMostrar(clase.fecha), hora && `${hora} h`].filter(Boolean).join(' · '),
    clase.precio != null ? (Number(clase.precio) === 0 ? 'Gratis' : `${clase.precio} €`) : '',
  ].filter(Boolean)

  ctx.font = `800 104px ${FUENTE}`
  const lineasTitulo = partirEnLineas(ctx, clase.titulo || '', anchoTexto, 4)
  ctx.font = `600 54px ${FUENTE}`
  const lineasDatos = datos.flatMap((dato) => partirEnLineas(ctx, dato, anchoTexto, 2))

  const altoBloque = (clase.categoria ? 144 : 0) + lineasTitulo.length * 118 + 20 + lineasDatos.length * 70
  let y = Math.min(1000, 1560 - altoBloque)

  if (clase.categoria) {
    ctx.font = `700 40px ${FUENTE}`
    const textoCat = clase.categoria.toUpperCase()
    const anchoCat = ctx.measureText(textoCat).width + 60
    ctx.fillStyle = LIMA
    ctx.fillRect(margen, y, anchoCat, 74)
    ctx.fillStyle = '#1F2400'
    ctx.fillText(textoCat, margen + 30, y + 52)
    y += 74 + 70
  }

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `800 104px ${FUENTE}`
  for (const linea of lineasTitulo) {
    ctx.fillText(linea, margen, y)
    y += 118
  }
  y += 20

  ctx.font = `600 54px ${FUENTE}`
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  for (const linea of lineasDatos) {
    ctx.fillText(linea, margen, y)
    y += 70
  }

  // Pie: llamada a la acción.
  ctx.fillStyle = LIMA
  ctx.fillRect(margen, ALTO - 260, anchoTexto, 8)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `700 52px ${FUENTE}`
  ctx.fillText('Pulsa el enlace y reserva tu plaza', margen, ALTO - 170)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = `600 42px ${FUENTE}`
  ctx.fillText('ruleafit.com', margen, ALTO - 100)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen'))), 'image/png')
  })
}
