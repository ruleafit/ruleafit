// Solo servidor. Lectura de texto con tesseract.js, sin servicios externos: el
// motor y el diccionario se cargan desde node_modules.
import path from 'node:path'
import { createWorker } from 'tesseract.js'

const IDIOMA = path.join(/* turbopackIgnore: true */ process.cwd(), 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int')

export const CARACTERES_MRZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'

// Crea un lector, ejecuta la tarea y lo cierra siempre.
export async function conLector(tarea) {
  const lector = await createWorker('eng', 1, {
    langPath: IDIOMA,
    cacheMethod: 'none',
    gzip: true,
    logger: () => {},
    errorHandler: () => {},
  })
  try {
    return await tarea({
      // { texto, palabras: [{ texto, x, y, ancho, alto }] }
      async leer(imagen, { caracteres = '', bloque = false, cajas = false } = {}) {
        await lector.setParameters({
          tessedit_char_whitelist: caracteres,
          tessedit_pageseg_mode: bloque ? '6' : '3',
        })
        const { data } = await lector.recognize(imagen, {}, { text: true, blocks: cajas })
        const leidas = []
        for (const b of data.blocks || []) {
          for (const p of b.paragraphs) {
            for (const l of p.lines) {
              for (const w of l.words) {
                leidas.push({ texto: w.text, x: w.bbox.x0, y: w.bbox.y0, ancho: w.bbox.x1 - w.bbox.x0, alto: w.bbox.y1 - w.bbox.y0 })
              }
            }
          }
        }
        return { texto: data.text || '', palabras: leidas }
      },
    })
  } finally {
    await lector.terminate()
  }
}
