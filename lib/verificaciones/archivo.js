// Lectura de la cabecera de un archivo: no se fía de la extensión ni del tipo
// que declaró quien lo subió, y permite rechazar imágenes enormes sin decodificarlas.

const ascii = (b, desde, hasta) => b.toString('latin1', desde, hasta)

export function tipoDeArchivo(b) {
  if (b.length < 12) return null
  if (ascii(b, 0, 5) === '%PDF-') return 'pdf'
  if (b.readUInt32BE(0) === 0x89504e47) return 'png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp'
  return null
}

// { ancho, alto } o null si no se pueden leer.
export function dimensionesImagen(b) {
  const tipo = tipoDeArchivo(b)
  if (tipo === 'png' && b.length >= 24) return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) }
  if (tipo === 'jpg') {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marca = b[i + 1]
      if (marca === 0xff) {
        i += 1
        continue
      }
      // Marcadores SOF (inicio de imagen), salvo DHT, JPG y DAC.
      if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
        return { ancho: b.readUInt16BE(i + 7), alto: b.readUInt16BE(i + 5) }
      }
      i += 2 + b.readUInt16BE(i + 2)
    }
    return null
  }
  if (tipo === 'webp' && b.length >= 30) {
    const formato = ascii(b, 12, 16)
    if (formato === 'VP8X') return { ancho: b.readUIntLE(24, 3) + 1, alto: b.readUIntLE(27, 3) + 1 }
    if (formato === 'VP8 ') return { ancho: b.readUInt16LE(26) & 0x3fff, alto: b.readUInt16LE(28) & 0x3fff }
    if (formato === 'VP8L') {
      const bits = b.readUInt32LE(21)
      return { ancho: (bits & 0x3fff) + 1, alto: ((bits >>> 14) & 0x3fff) + 1 }
    }
  }
  return null
}
