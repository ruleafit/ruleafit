'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PAGOS_VISIBLES } from '../lib/pagosVisibles'

const TIPOS = [
  { valor: 'persona_fisica_profesional', texto: 'Persona física, actividad profesional (autónomo/a con IRPF)' },
  { valor: 'persona_fisica_empresarial', texto: 'Persona física, actividad empresarial' },
  { valor: 'sociedad', texto: 'Sociedad (empresa)' },
]

const ESTADOS = {
  pendiente_revision: 'Datos recibidos, pendientes de revisión',
  activo: 'Datos verificados',
  bloqueado: 'Bloqueado: escríbenos desde Ayuda',
  incompleto: 'Incompleto',
}

const input =
  'block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'
const etiqueta = 'mb-1 block text-sm font-medium text-[#1F2400]'

const VACIO = {
  tipo: 'persona_fisica_profesional',
  nombreFiscal: '',
  nif: '',
  direccion: '',
  codigoPostal: '',
  municipio: '',
  provincia: '',
  email: '',
  titularIban: '',
  iban: '',
  fechaNacimiento: '',
  retencionReducida: false,
  declaraIngresos: false,
  responsableDatos: false,
  aceptaAutofactura: false,
}

// Datos fiscales del entrenador: Ruleafit los necesita para emitir las
// autofacturas y pagarle. El IBAN completo no se vuelve a mostrar nunca.
export default function PerfilFiscal({ usuario }) {
  const [abierto, setAbierto] = useState(false)
  const [cargado, setCargado] = useState(false)
  const [guardado, setGuardado] = useState(null) // { estado, ibanUltimos4 }
  const [f, setF] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    if (!PAGOS_VISIBLES || !usuario) return
    let activo = true
    supabase
      .from('perfiles_fiscales')
      // Columnas explícitas: el IBAN cifrado no se puede leer desde el navegador.
      .select(
        'estado, iban_ultimos4, tipo, nombre_fiscal, nif, direccion, codigo_postal, municipio, provincia, email_facturas, titular_iban, fecha_nacimiento, retencion_reducida'
      )
      .eq('usuario_id', usuario.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo) return
        if (data) {
          setGuardado({ estado: data.estado, ibanUltimos4: data.iban_ultimos4 })
          setF({
            ...VACIO,
            tipo: data.tipo,
            nombreFiscal: data.nombre_fiscal,
            nif: data.nif,
            direccion: data.direccion,
            codigoPostal: data.codigo_postal,
            municipio: data.municipio,
            provincia: data.provincia,
            email: data.email_facturas,
            titularIban: data.titular_iban,
            fechaNacimiento: data.fecha_nacimiento || '',
            retencionReducida: data.retencion_reducida,
          })
        }
        setCargado(true)
      })
    return () => {
      activo = false
    }
  }, [usuario])

  if (!PAGOS_VISIBLES || !usuario) return null

  const cambia = (campo) => (e) =>
    setF((previo) => ({ ...previo, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const esSociedad = f.tipo === 'sociedad'
  const zonaEspecial = /^(35|38|51|52|01|20|31|48)/.test(f.codigoPostal)

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setOk('')
    setGuardando(true)
    const { data: sesion } = await supabase.auth.getSession()
    const respuesta = await fetch('/api/payments/perfil-fiscal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.session?.access_token || ''}` },
      body: JSON.stringify(f),
    }).catch(() => null)
    const datos = respuesta ? await respuesta.json().catch(() => ({})) : {}
    setGuardando(false)
    if (!respuesta || !respuesta.ok) {
      setError(datos.error || 'No se han podido guardar los datos. Inténtalo de nuevo.')
      return
    }
    setGuardado({ estado: datos.estado, ibanUltimos4: datos.ibanUltimos4 })
    setF((previo) => ({
      ...previo,
      iban: '',
      declaraIngresos: false,
      responsableDatos: false,
      aceptaAutofactura: false,
    }))
    setOk('Datos guardados.')
    setAbierto(false)
  }

  return (
    <div className="mb-8 corte-card border border-[#E2E6CF] bg-white p-6">
      <h2 className="mb-2 text-lg font-bold text-[#1F2400]">Datos fiscales y cobros</h2>
      <p className="mb-4 text-sm text-[#6B7355]">
        Si organizas sesiones de pago necesitamos estos datos para emitir las autofacturas en tu nombre y transferirte
        tus ingresos.
      </p>

      {cargado && guardado && (
        <p className="mb-4 text-sm text-[#1F2400]">
          <strong>{ESTADOS[guardado.estado] || guardado.estado}.</strong>
          {guardado.ibanUltimos4 && <> Cuenta terminada en {guardado.ibanUltimos4}.</>}
        </p>
      )}
      {ok && <p className="mb-4 text-sm text-[#3D4A00]">{ok}</p>}

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-5 text-sm font-bold text-[#1F2400]"
        >
          {guardado ? 'Editar mis datos' : 'Añadir mis datos'}
        </button>
      ) : (
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <div>
            <label className={etiqueta} htmlFor="pf-tipo">Tipo de titular</label>
            <select id="pf-tipo" value={f.tipo} onChange={cambia('tipo')} className={input}>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>{t.texto}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiqueta} htmlFor="pf-nombre">{esSociedad ? 'Razón social' : 'Nombre y apellidos'}</label>
            <input id="pf-nombre" className={input} value={f.nombreFiscal} onChange={cambia('nombreFiscal')} required maxLength={200} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="pf-nif">{esSociedad ? 'CIF' : 'DNI o NIE'}</label>
            <input id="pf-nif" className={input} value={f.nif} onChange={cambia('nif')} required maxLength={12} autoComplete="off" />
          </div>
          {!esSociedad && (
            <div>
              <label className={etiqueta} htmlFor="pf-nac">Fecha de nacimiento</label>
              <input id="pf-nac" type="date" className={input} value={f.fechaNacimiento} onChange={cambia('fechaNacimiento')} required />
            </div>
          )}
          <div>
            <label className={etiqueta} htmlFor="pf-dir">Dirección fiscal</label>
            <input id="pf-dir" className={input} value={f.direccion} onChange={cambia('direccion')} required maxLength={250} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={etiqueta} htmlFor="pf-cp">Código postal</label>
              <input id="pf-cp" className={input} value={f.codigoPostal} onChange={cambia('codigoPostal')} required inputMode="numeric" maxLength={5} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="pf-mun">Municipio</label>
              <input id="pf-mun" className={input} value={f.municipio} onChange={cambia('municipio')} required maxLength={120} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="pf-prov">Provincia</label>
              <input id="pf-prov" className={input} value={f.provincia} onChange={cambia('provincia')} required maxLength={80} />
            </div>
          </div>
          {zonaEspecial && (
            <p className="text-sm text-[#6B7355]">
              Tu zona (Canarias, Ceuta, Melilla, Navarra o País Vasco) tiene un régimen fiscal propio: revisaremos tus
              datos a mano antes de pagarte.
            </p>
          )}
          <div>
            <label className={etiqueta} htmlFor="pf-email">Correo para recibir tus facturas</label>
            <input id="pf-email" type="email" className={input} value={f.email} onChange={cambia('email')} required />
          </div>
          <div>
            <label className={etiqueta} htmlFor="pf-titular">Titular de la cuenta bancaria</label>
            <input id="pf-titular" className={input} value={f.titularIban} onChange={cambia('titularIban')} required maxLength={200} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="pf-iban">
              IBAN (cuenta española){guardado?.ibanUltimos4 ? ' · déjalo vacío para conservar el actual' : ''}
            </label>
            <input
              id="pf-iban"
              className={input}
              value={f.iban}
              onChange={cambia('iban')}
              required={!guardado?.ibanUltimos4}
              placeholder="ES00 0000 0000 0000 0000 0000"
              autoComplete="off"
              maxLength={34}
            />
          </div>
          {!esSociedad && (
            <label className="flex items-start gap-2 text-sm text-[#1F2400]">
              <input type="checkbox" checked={f.retencionReducida} onChange={cambia('retencionReducida')} className="mt-1" />
              <span>Tengo derecho al tipo reducido de retención de IRPF (inicio de actividad) y así lo declaro.</span>
            </label>
          )}
          <label className="flex items-start gap-2 text-sm text-[#1F2400]">
            <input type="checkbox" checked={f.declaraIngresos} onChange={cambia('declaraIngresos')} required className="mt-1" />
            <span>Declaro que los datos son ciertos y que soy responsable de declarar mis ingresos y de mis obligaciones fiscales.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[#1F2400]">
            <input type="checkbox" checked={f.responsableDatos} onChange={cambia('responsableDatos')} required className="mt-1" />
            <span>Soy responsable de mantener estos datos actualizados y de los que facilite de terceros.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[#1F2400]">
            <input type="checkbox" checked={f.aceptaAutofactura} onChange={cambia('aceptaAutofactura')} required className="mt-1" />
            <span>
              Autorizo a Ruleafit a emitir en mi nombre y por mi cuenta las facturas por mis servicios (autofacturación)
              y acepto las condiciones para entrenadores.
            </span>
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={guardando}
              className="inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-5 text-sm font-bold text-[#1F2400] disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false)
                setError('')
              }}
              disabled={guardando}
              className="inline-flex h-10 items-center justify-center corte-btn border border-[#E2E6CF] px-5 text-sm font-medium text-[#6B7355] hover:border-[#B5E600]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
