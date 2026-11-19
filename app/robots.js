// Lo público se puede rastrear; las zonas privadas y las rutas internas, no.
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/auth',
        '/cuenta',
        '/completar-perfil',
        '/eliminar-cuenta',
        '/mis-clases',
        '/mis-reservas',
        '/nueva-contrasena',
        '/pagos',
        '/publicar',
      ],
    },
    sitemap: 'https://www.ruleafit.com/sitemap.xml',
  }
}
