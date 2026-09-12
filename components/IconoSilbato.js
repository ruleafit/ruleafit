// Icono de silbato "a mano", en silueta rellena (no de trazo como los de
// lucide-react): lucide no tiene ningún icono de silbato, y un dibujo solo
// de contorno resultaba poco reconocible a tamaño pequeño. Silueta clásica
// de silbato de árbitro: boquilla + cámara redonda + rejilla de sonido
// arriba. Usa currentColor, así que hereda el color de texto de quien lo
// use, igual que un icono de lucide. Pedido por el usuario el 12 de
// septiembre de 2026 para la tarjeta de "Publicar sesión" en la portada.

export default function IconoSilbato({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M2 14L9 10.5V17.5Z" />
      <circle cx="15" cy="14" r="6" />
      <rect x="12" y="5" width="4" height="4" rx="1" />
    </svg>
  )
}
