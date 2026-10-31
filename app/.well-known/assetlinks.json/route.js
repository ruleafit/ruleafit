import { NextResponse } from 'next/server'

// Enlace de verificación entre la web y la app de Android (Digital Asset Links).
// Sin esto, la app abriría la web con una barra del navegador encima. Las
// huellas SHA-256 de los certificados de firma NO son secretas, pero dependen de
// la clave con la que se firme la app, así que se ponen en la variable de entorno
// ANDROID_SHA256_FINGERPRINTS (separadas por comas; la de Play App Signing y la
// de la clave de subida). Ver docs/app-android.md.
const PAQUETE_ANDROID = 'com.ruleafit.app'

export const dynamic = 'force-dynamic'

export async function GET() {
  const huellas = (process.env.ANDROID_SHA256_FINGERPRINTS || '')
    .split(',')
    .map((h) => h.trim().toUpperCase())
    .filter((h) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(h))

  const cuerpo = huellas.length
    ? [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: PAQUETE_ANDROID,
            sha256_cert_fingerprints: huellas,
          },
        },
      ]
    : []

  return NextResponse.json(cuerpo)
}
