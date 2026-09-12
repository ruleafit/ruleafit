// Icono de silbato "a mano", en el mismo estilo trazado (stroke, currentColor)
// que los iconos de lucide-react usados en el resto de la web: lucide no
// tiene ningún icono de silbato, así que se dibuja aquí para usarlo como
// cualquier otro icono de lucide (acepta className y strokeWidth igual que
// ellos). Pedido por el usuario el 12 de septiembre de 2026 para la tarjeta
// de "Publicar una sesión" en la portada.

export default function IconoSilbato({ className, strokeWidth = 1.75 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* boquilla */}
      <path d="M2 12h4" />
      {/* cámara de resonancia */}
      <rect x="6" y="8" width="12" height="8" rx="4" />
      {/* orificio de sonido, arriba */}
      <circle cx="12" cy="9" r="0.8" fill="currentColor" stroke="none" />
      {/* ranura de la bolita, abajo */}
      <path d="M9.5 15.3h5" />
      {/* anilla del cordón */}
      <circle cx="20.3" cy="6.7" r="1.4" />
      <path d="M18.2 9.3l1.4-1.7" />
    </svg>
  )
}
