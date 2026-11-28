// Decisión automática de identidad y de centro a partir del texto leído.
// 'aprobar'  → todo coincide y se lee con claridad.
// 'rechazar' → se lee con claridad y NO coincide o está caducado (el usuario
//              puede pedir revisión manual).
// 'manual'   → cualquier duda: queda pendiente para el administrador.
import { normalizar, dniNieValido, cifValido, palabras, palabrasDeNombre } from './documentos.js'
import { leerMrz } from './mrz.js'

const manual = (motivo) => ({ decision: 'manual', motivo })
const rechazar = (motivo) => ({ decision: 'rechazar', motivo })

// Todas las palabras del nombre indicado deben aparecer en el del documento
// (se admiten rellenos mal leídos y nombres cortados por falta de espacio).
export function nombreCoincide(declarado, leido) {
  const buscadas = palabrasDeNombre(declarado)
  if (buscadas.length < 2) return false
  const delDocumento = palabrasDeNombre(leido)
  const junto = delDocumento.join('')
  const cortado = delDocumento[delDocumento.length - 1] || ''
  return buscadas.every((p) => junto.includes(p) || (cortado.length >= 3 && p.startsWith(cortado)))
}

// textoReverso: lectura de la cara con la MRZ (reverso, o página del pasaporte).
// textoAnverso: lectura de la otra cara ('' en pasaportes).
export function decidirIdentidad({ tipo, textoMrz, textoAnverso, nombre, numero }, hoy = new Date()) {
  const esperado = normalizar(numero)
  if (!esperado || palabrasDeNombre(nombre).length < 2) return manual('Faltan el nombre y apellidos o el número.')
  const mrz = leerMrz(textoMrz, hoy)
  if (!mrz) return manual('No se ha podido leer el documento con claridad.')

  if (mrz.caducidad < hoy) return rechazar('El documento está caducado.')

  let coincide
  if (tipo === 'PASAPORTE') {
    if (mrz.formato !== 'TD3') return manual('El documento no parece un pasaporte.')
    coincide = [mrz.numero, mrz.personal].includes(esperado)
    // Si se indicó un DNI y el pasaporte no lo trae, no se puede comparar.
    if (!coincide && dniNieValido(esperado) && !mrz.personal) return manual('El pasaporte no permite comprobar ese número.')
  } else {
    if (mrz.formato !== 'TD1') return manual('El documento no coincide con el tipo elegido.')
    if (!dniNieValido(mrz.personal)) return manual('No se ha podido leer el número con claridad.')
    coincide = mrz.personal === esperado
  }
  if (!coincide) return rechazar('El número del documento no coincide con el indicado.')

  const mayoriaDeEdad = new Date(Date.UTC(hoy.getUTCFullYear() - 18, hoy.getUTCMonth(), hoy.getUTCDate()))
  if (mrz.nacimiento > mayoriaDeEdad) return rechazar('Para publicar y cobrar tienes que haber cumplido 18 años.')
  if (!nombreCoincide(nombre, mrz.nombre)) return manual('El nombre no coincide con claridad.')

  if (tipo !== 'PASAPORTE') {
    // La otra cara tiene que ser del mismo documento.
    const frente = palabras(textoAnverso)
    const junto = frente.join('')
    const esMismo = junto.includes(esperado) || palabrasDeNombre(nombre).some((p) => p.length >= 4 && frente.includes(p))
    if (!esMismo) return manual('No se ha podido comprobar el anverso.')
  }
  return { decision: 'aprobar', numero: tipo === 'PASAPORTE' ? mrz.numero : mrz.personal }
}

const FORMAS = new Set(['SL', 'SLU', 'SA', 'SAU', 'SLL', 'SC', 'SCP', 'CB', 'SOCIEDAD', 'LIMITADA', 'ANONIMA', 'UNIPERSONAL'])
const OFICIAL = /AGENCIA TRIBUTARIA|AGENCIA ESTATAL|ADMINISTRACION TRIBUTARIA|NUMERO DE IDENTIFICACION FISCAL|IDENTIFICACION FISCAL|CENSAL|HACIENDA|FORAL|REGISTRO MERCANTIL/
const CIF_AEAT = 'Q2826000H'

// Nombre de la entidad sin la forma jurídica («S.L.», «Sociedad Limitada»…).
export function nucleoRazonSocial(razon) {
  const sinPuntos = String(razon || '').replace(/\b([A-Za-z])\.\s?/g, '$1')
  return palabrasDeNombre(sinPuntos).filter((p) => !FORMAS.has(p))
}

export function decidirCentro({ texto, razonSocial, cif }) {
  const esperado = normalizar(cif)
  if (!cifValido(esperado)) return rechazar('El CIF no es válido.')
  const plano = palabras(texto).join(' ')
  if (plano.length < 150) return manual('No se ha podido leer el documento con claridad.')

  const compacto = plano.replace(/ /g, '')
  if (!compacto.includes(esperado)) {
    const otros = (String(texto).toUpperCase().match(/\b[ABCDEFGHJNPQRSUVW][-. ]?\d{7}[-. ]?[0-9A-J]\b/g) || [])
      .map(normalizar)
      .filter((c) => c !== CIF_AEAT && cifValido(c))
    return otros.length
      ? rechazar('El CIF del documento no coincide con el indicado.')
      : manual('No se ha encontrado el CIF en el documento.')
  }
  const nombre = nucleoRazonSocial(razonSocial)
  if (!nombre.length || nombre.join('').length < 4 || !compacto.includes(nombre.join(''))) {
    return manual('La razón social no coincide con claridad.')
  }
  if (!OFICIAL.test(plano)) return manual('El documento no parece un certificado oficial.')
  return { decision: 'aprobar', numero: esperado }
}
