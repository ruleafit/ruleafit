// Fichero de transferencias SEPA (ISO 20022, pain.001.001.03). Solo da formato: los importes llegan en céntimos desde
// la base de datos (sql/115) y aquí no se calcula comisión ni reparto; la suma de control es la del propio fichero.
// ⚠ NO VALIDADO POR EL BANCO: confirmar con CaixaBank la versión, el identificador de ordenante y el BIC.
import { validarIBAN } from './validaciones.ts'

export interface Ordenante {
  nombre: string
  identificador: string // el que asigne el banco (habitualmente NIF + sufijo)
  iban: string
  bic?: string
}

export interface Transferencia {
  referencia: string
  titular: string
  iban: string
  importe_centimos: number
  concepto: string
  fecha_pago: string // AAAA-MM-DD
}

export interface FicheroSepa {
  referencia: string
  creado_en: string
  transferencias: Transferencia[]
}

const compacto = (v: string) => v.replace(/\s/g, '').toUpperCase()

/** Variables de entorno del ordenante. Devuelve los datos o la lista de lo que falta o está mal. */
export function ordenanteDesdeEntorno(env: Record<string, string | undefined> = process.env):
  | { ordenante: Ordenante }
  | { faltan: string[] } {
  const nombre = (env.SEPA_ORDENANTE_NOMBRE || '').trim()
  const identificador = compacto(env.SEPA_ORDENANTE_ID || '')
  const iban = compacto(env.SEPA_ORDENANTE_IBAN || '')
  const bic = compacto(env.SEPA_ORDENANTE_BIC || '')
  const faltan: string[] = []
  if (!textoSepa(nombre, 70)) faltan.push('SEPA_ORDENANTE_NOMBRE')
  if (!/^[A-Z0-9]{8,35}$/.test(identificador)) faltan.push('SEPA_ORDENANTE_ID')
  if (!validarIBAN(iban)) faltan.push('SEPA_ORDENANTE_IBAN')
  if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) faltan.push('SEPA_ORDENANTE_BIC')
  return faltan.length ? { faltan } : { ordenante: { nombre, identificador, iban, bic: bic || undefined } }
}

/** Juego de caracteres admitido en SEPA: sin acentos ni símbolos fuera de la lista. */
export function textoSepa(valor: string, maximo: number): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo)
    .trim()
}

export function importeSepa(centimos: number): string {
  if (!Number.isSafeInteger(centimos) || centimos <= 0) throw new Error('Importe no válido en el fichero')
  const texto = String(centimos).padStart(3, '0')
  return `${texto.slice(0, -2)}.${texto.slice(-2)}`
}

function fechaMadrid(momento: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(momento)
}

export function generarPain001(ordenante: Ordenante, fichero: FicheroSepa, ahora: Date = new Date()): string {
  const lista = fichero.transferencias
  if (lista.length === 0) throw new Error('El fichero no tiene transferencias')
  for (const t of lista) {
    if (!validarIBAN(t.iban)) throw new Error(`IBAN no válido en la transferencia de ${t.titular}`)
    if (!textoSepa(t.titular, 70)) throw new Error('Falta el titular de una cuenta')
  }
  const total = importeSepa(lista.reduce((suma, t) => suma + t.importe_centimos, 0))
  // El banco no admite fechas pasadas: se pide la mayor entre hoy y la fecha de pago más tardía incluida.
  const hoy = fechaMadrid(ahora)
  const ejecucion = lista.reduce((f, t) => (t.fecha_pago > f ? t.fecha_pago : f), hoy)
  const nombre = textoSepa(ordenante.nombre, 70)
  const id = `<Id><OrgId><Othr><Id>${ordenante.identificador}</Id></Othr></OrgId></Id>`
  const entidad = ordenante.bic ? `<BIC>${ordenante.bic}</BIC>` : '<Othr><Id>NOTPROVIDED</Id></Othr>'
  const operaciones = lista
    .map(
      (t) => `      <CdtTrfTxInf>
        <PmtId><EndToEndId>${textoSepa(t.referencia, 35)}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${importeSepa(t.importe_centimos)}</InstdAmt></Amt>
        <Cdtr><Nm>${textoSepa(t.titular, 70)}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${compacto(t.iban)}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${textoSepa(t.concepto, 140)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${textoSepa(fichero.referencia, 35)}</MsgId>
      <CreDtTm>${new Date(fichero.creado_en).toISOString().slice(0, 19)}</CreDtTm>
      <NbOfTxs>${lista.length}</NbOfTxs>
      <CtrlSum>${total}</CtrlSum>
      <InitgPty><Nm>${nombre}</Nm>${id}</InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${textoSepa(fichero.referencia, 35)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${lista.length}</NbOfTxs>
      <CtrlSum>${total}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${ejecucion}</ReqdExctnDt>
      <Dbtr><Nm>${nombre}</Nm>${id}</Dbtr>
      <DbtrAcct><Id><IBAN>${ordenante.iban}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId>${entidad}</FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
${operaciones}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`
}
