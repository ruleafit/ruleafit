/** @type {import('next').NextConfig} */

// Cabeceras de seguridad en todas las páginas.
// - X-Frame-Options / frame-ancestors: nadie puede meter Ruleafit dentro de otra web
//   (evita el "clickjacking").
// - X-Content-Type-Options: el navegador no adivina el tipo de los archivos.
// - Referrer-Policy: no se envía la dirección completa a otras webs.
// - Permissions-Policy: solo la propia web puede pedir la ubicación; cámara,
//   micrófono y pagos del navegador, desactivados.
// - object-src y base-uri: cierran dos vías clásicas de inyección. No se limita
//   script-src a propósito (Next, Leaflet y el pago de Redsys lo necesitarían y
//   habría que probarlo a fondo): queda como mejora futura.
const cabecerasSeguridad = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
];

const nextConfig = {
  // `next dev` escribía solo un bloque de instrucciones para asistentes de IA en
  // AGENTS.md y CLAUDE.md. Ya está en CLAUDE.md, así que se desactiva para que no
  // reaparezcan archivos sin subir cada vez que se arranca el servidor.
  agentRules: false,
  // Comprobación de documentos (sql/112): estas librerías se cargan tal cual
  // desde node_modules y la función necesita además sus datos y su lector.
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas', 'tesseract.js'],
  outputFileTracingIncludes: {
    '/api/verificaciones/analizar': [
      './node_modules/pdfjs-dist/standard_fonts/**/*',
      './node_modules/pdfjs-dist/cmaps/**/*',
      './node_modules/pdfjs-dist/wasm/**/*',
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      './node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*',
      // El lector corre en un hilo aparte: sus dependencias no se detectan solas.
      './node_modules/tesseract.js/src/**/*',
      './node_modules/tesseract.js-core/{*lstm*,package.json,index.js}',
      './node_modules/{bmp-js,idb-keyval,is-url,node-fetch,regenerator-runtime,wasm-feature-detect,zlibjs,whatwg-url,tr46,webidl-conversions}/**/*',
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: cabecerasSeguridad }];
  },
};

export default nextConfig;
