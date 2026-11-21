// «Avisos de sesiones en mi zona» se muestra en Mi cuenta solo cuando
// NEXT_PUBLIC_AVISOS_ZONA_VISIBLES es "true" (mismo patrón que pagosVisibles.js).
// Mientras los envíos no estén implementados, el valor por defecto es ocultarlo:
// la variable solo se define en el entorno de pruebas (Vercel "Preview" o un
// .env.local de desarrollo), nunca en Producción. Este interruptor solo decide qué se
// enseña en pantalla; los avisos tienen su propio interruptor en la base de datos
// (public.config_avisos_zona).
export const AVISOS_ZONA_VISIBLES = process.env.NEXT_PUBLIC_AVISOS_ZONA_VISIBLES === 'true'
