import { NextResponse } from 'next/server'

// Enlaces universales de iPhone: con este archivo, un enlace de ruleafit.com a
// una sesión o a un perfil de entrenador se abre directamente en la app
// instalada en vez de en Safari. Solo funciona con la cuenta de pago de Apple
// Developer y la capacidad "Associated Domains" en Xcode (applinks:www.ruleafit.com).
// El identificador de equipo de Apple (10 caracteres, no es secreto) se pone en la
// variable de entorno APPLE_TEAM_ID. Mientras no esté, se sirve vacío. Ver docs/app-ios.md.
const BUNDLE_IOS = 'com.ruleafit.app'

export const dynamic = 'force-dynamic'

export async function GET() {
  const equipo = (process.env.APPLE_TEAM_ID || '').trim().toUpperCase()
  const valido = /^[A-Z0-9]{10}$/.test(equipo)

  const cuerpo = {
    applinks: {
      details: valido
        ? [
            {
              appIDs: [`${equipo}.${BUNDLE_IOS}`],
              components: [{ '/': '/clases/*' }, { '/': '/entrenador/*' }],
            },
          ]
        : [],
    },
  }

  return NextResponse.json(cuerpo)
}
