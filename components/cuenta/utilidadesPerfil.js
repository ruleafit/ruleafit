export function contarPalabras(texto) {
  return texto.trim().split(/\s+/).filter(Boolean).length
}

export function comprimirImagen(archivo) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const urlOrigen = URL.createObjectURL(archivo)

    img.onload = () => {
      URL.revokeObjectURL(urlOrigen)

      const ladoMaximo = 800
      let { width, height } = img

      if (width > height && width > ladoMaximo) {
        height = Math.round((height * ladoMaximo) / width)
        width = ladoMaximo
      } else if (height > ladoMaximo) {
        width = Math.round((width * ladoMaximo) / height)
        height = ladoMaximo
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('No se pudo procesar la imagen.'))
        },
        'image/jpeg',
        0.8
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(urlOrigen)
      reject(new Error('No se pudo cargar la imagen.'))
    }

    img.src = urlOrigen
  })
}
