export const IMAGEN_POR_CATEGORIA = {
  'Fuerza / funcional': '/imagenes/fuerza.jpg',
  Cardio: '/imagenes/running.jpg',
  'Yoga / Pilates / movilidad': '/imagenes/yoga.jpg',
  Otros: '/imagenes/combate.jpg',
}

export const IMAGEN_POR_DEFECTO = '/imagenes/comunidad.jpg'

export const ESTILO_POR_CATEGORIA = {
  'Fuerza / funcional': { forma: 'circulo', color: '#F2C037' },
  Cardio: { forma: 'triangulo', color: '#E5533D' },
  'Yoga / Pilates / movilidad': { forma: 'cuadrado', color: '#3D8BFF' },
  Otros: { forma: 'rombo', color: '#9B5DE5' },
}

export const ESTILO_POR_DEFECTO = { forma: 'circulo', color: '#9AA0A6' }

const FORMAS_SVG = {
  circulo: (color) => `<circle cx="12" cy="12" r="9" fill="${color}" stroke="#fff" stroke-width="1.5" />`,
  triangulo: (color) =>
    `<polygon points="12,3 21,20 3,20" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" />`,
  cuadrado: (color) => `<rect x="4" y="4" width="16" height="16" rx="2" fill="${color}" stroke="#fff" stroke-width="1.5" />`,
  rombo: (color) =>
    `<rect x="5.5" y="5.5" width="13" height="13" rx="1" fill="${color}" stroke="#fff" stroke-width="1.5" transform="rotate(45 12 12)" />`,
}

export function formaSVG(forma, color, size = 20) {
  const dibujarForma = FORMAS_SVG[forma] || FORMAS_SVG.circulo
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${dibujarForma(color)}</svg>`
}
