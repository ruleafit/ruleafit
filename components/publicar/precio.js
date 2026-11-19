import { eurosACentimos } from '../../lib/pagos/dinero.ts'

// Céntimos de lo escrito en el campo de precio, o null si está vacío o no es un
// importe válido (más de 2 decimales, notación científica, negativo...).
export function centimosDePrecio(texto) {
  if (texto === '') return null
  // El campo numérico admite ".5" y "12.", que Number() acepta: se normalizan.
  const normal = texto.replace(/^\./, '0.').replace(/\.$/, '')
  try {
    return eurosACentimos(normal)
  } catch {
    return null
  }
}

// El campo vacío es válido (sesión sin precio); si hay algo escrito, debe ser
// un importe con como máximo 2 decimales. Evita que el redondeo de
// crear_cobro (round(precio * 100)) altere en silencio un precio de 3 decimales.
export function precioValido(texto) {
  return texto === '' || centimosDePrecio(texto) !== null
}
