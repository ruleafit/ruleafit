'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatearEuros } from '../../lib/pagos/dinero.ts'
import usePanelAdmin from './usePanelAdmin'
import BotonConfirmar from './BotonConfirmar'

const BOTON = 'corte-tag border border-[#E2E6CF] px-3 py-1.5 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600] disabled:opacity-60'
const ESTADOS = { generado: 'Sin confirmar', enviado: 'Enviado al banco', descartado: 'Descartado' }

function guardar(nombre, xml) {
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}

// Un fichero SEPA con todas las transferencias pendientes: se descarga, se firma en el banco y se confirma de una vez.
// onCambio() recarga la lista de transferencias de la página.
export default function BloqueFicheroBanco({ onCambio }) {
  const { estadoCarga, datos, cambiar, cargar } = usePanelAdmin('/api/admin/liquidaciones/fichero')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  if (estadoCarga === 'cargando') return null
  if (estadoCarga !== 'ok') return <p className="mt-6 text-sm text-red-600">No se ha podido leer la parte de ficheros.</p>

  async function descargar(cuerpo) {
    setTrabajando(true)
    setError('')
    const { data } = await supabase.auth.getSession()
    const respuesta = await fetch('/api/admin/liquidaciones/fichero', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }).catch(() => null)
    const json = respuesta ? await respuesta.json().catch(() => ({})) : {}
    if (!respuesta?.ok) setError(json.error || 'No se ha podido generar el fichero.')
    else guardar(json.nombre, json.xml)
    await Promise.all([cargar(), onCambio()])
    setTrabajando(false)
  }

  async function cerrar(accion, fichero) {
    const fallo = await cambiar({ accion, fichero })
    if (!fallo) await onCambio()
    return fallo
  }

  return (
    <section className="mt-8 corte-card border border-[#B5E600] bg-white p-4">
      <h2 className="text-base font-bold text-[#1F2400]">Fichero para el banco</h2>
      <p className="mt-1 text-xs text-[#6B7355]">
        1) Descarga el fichero. 2) Súbelo a tu banca de empresa y fírmalo. 3) Pulsa «Marcar todas como enviadas». ⚠ Formato
        sin validar todavía por el banco.
      </p>
      {datos.faltan.length > 0 && (
        <p className="mt-2 text-sm font-medium text-red-700">Faltan datos del ordenante en la web: {datos.faltan.join(', ')}</p>
      )}
      <p className="mt-2 text-sm text-[#1F2400]">
        {datos.nuevas === 0
          ? 'No hay transferencias nuevas.'
          : `${datos.nuevas} ${datos.nuevas === 1 ? 'transferencia nueva' : 'transferencias nuevas'} · ${formatearEuros(datos.nuevas_centimos)}`}
      </p>
      {datos.bloqueadas > 0 && (
        <p className="text-xs font-medium text-red-700">
          {datos.bloqueadas} no se pueden incluir: sus datos bancarios han cambiado o ya no están aprobados.
        </p>
      )}
      {datos.nuevas > 0 && datos.faltan.length === 0 && (
        <button type="button" disabled={trabajando} onClick={() => descargar({ accion: 'generar' })} className="mt-2 corte-btn bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#1F2400] disabled:opacity-60">
          {trabajando ? 'Generando...' : 'Descargar fichero para el banco'}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {datos.ficheros.map((f) => (
          <li key={f.id} className="border-t border-[#E2E6CF] pt-2 text-sm text-[#1F2400]">
            <p className="break-all font-semibold">{f.referencia}</p>
            <p className="text-xs text-[#6B7355]">
              {ESTADOS[f.estado]} · {f.transferencias} · {formatearEuros(f.total_centimos)} ·{' '}
              {new Date(f.creado_en).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
            </p>
            {f.estado === 'generado' && (
              <div className="mt-2 flex flex-wrap items-start gap-2">
                <button type="button" disabled={trabajando} onClick={() => descargar({ accion: 'descargar', fichero: f.id })} className={BOTON}>
                  Descargar de nuevo
                </button>
                <BotonConfirmar
                  principal
                  texto="Marcar todas como enviadas"
                  pregunta={`¿Has subido y firmado este fichero en el banco? Se marcarán como transferidas (${formatearEuros(f.total_centimos)}) y se avisará a cada organizador.`}
                  onConfirmar={() => cerrar('enviado', f.id)}
                />
                <BotonConfirmar
                  texto="Descartar fichero"
                  pregunta="¿Seguro que NO lo has subido al banco? Sus transferencias podrán ir en un fichero nuevo. Si ya lo subiste, descartarlo puede provocar un pago doble."
                  onConfirmar={() => cerrar('descartado', f.id)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
