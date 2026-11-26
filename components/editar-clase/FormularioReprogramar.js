'use client'

import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { HORAS_CON_RESERVAS, errorDeReprogramacion } from '../../lib/reprogramacion'
import { prepararUbicacionParaPublicar } from '../publicar/ubicacionPublicar'
import UbicacionReprogramar from './UbicacionReprogramar'
import { inputClass, labelClass, ayudaClass, tarjetaClass, botonPrimarioClass, botonSecundarioClass } from './constantes'

// Cambio de fecha, hora o lugar de UNA sesión (sql/100). Quien tenga reserva recibe un aviso y decide si lo acepta.
export default function FormularioReprogramar({ id, clase }) {
  const [fecha, setFecha] = useState(clase.fecha)
  const [hora, setHora] = useState(String(clase.hora).slice(0, 5))
  const [motivo, setMotivo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [confirmando, setConfirmando] = useState(null) // campos listos para enviar
  const [enviando, setEnviando] = useState(false)
  const [hecho, setHecho] = useState(null)
  const ubicacionRef = useRef(null)
  const conReservas = (clase.plazas_ocupadas ?? 0) > 0

  async function revisar(e) {
    e.preventDefault()
    setMensaje('')
    const bloque = ubicacionRef.current
    const fallo = errorDeReprogramacion({
      actual: clase,
      nueva: { fecha, hora },
      hayCambioDeLugar: !!bloque?.modificada,
      conReservas,
    })
    if (fallo) {
      setMensaje(fallo)
      return
    }
    const campos = { fecha, hora, motivo: motivo.trim() }
    if (bloque?.modificada) {
      setEnviando(true)
      const prep = await prepararUbicacionParaPublicar(bloque.gestor, setMensaje)
      setEnviando(false)
      if (!prep.ok) {
        setMensaje(prep.mensaje)
        return
      }
      setMensaje('')
      campos.ubicacion = { ...prep.ubicacion, direccion: bloque.zona }
    }
    setConfirmando(campos)
  }

  async function enviar() {
    setEnviando(true)
    const { data, error } = await supabase.rpc('reprogramar_sesion', { p_clase_id: id, p_campos: confirmando })
    setEnviando(false)
    setConfirmando(null)
    if (error) {
      setMensaje(error.message)
      return
    }
    setHecho(data)
  }

  if (hecho) {
    return (
      <p role="status" className="mt-4 corte-card border border-[#B5E600] bg-[#EDF5C9] p-4 text-sm font-medium text-[#1F2400]">
        Sesión reprogramada.{' '}
        {hecho.avisados > 0
          ? `Hemos avisado a ${hecho.avisados} ${hecho.avisados === 1 ? 'participante' : 'participantes'}: cada uno puede aceptar el cambio o cancelar sin coste.`
          : 'No había reservas.'}
      </p>
    )
  }

  return (
    <form onSubmit={revisar} className="mt-4 flex flex-col gap-6">
      <p className="text-sm text-[#6B7355]">
        «{clase.titulo}». Cambia solo esta sesión. Con reservas hace falta avisar con al menos {HORAS_CON_RESERVAS} horas, y
        quien no quiera el cambio puede cancelar sin coste hasta que empiece.
      </p>
      <fieldset disabled={!!confirmando} className="flex flex-col gap-6">
        <div className={`${tarjetaClass} flex flex-col gap-4`}>
          <div>
            <label htmlFor="r-fecha" className={labelClass}>Fecha</label>
            <input id="r-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="r-hora" className={labelClass}>Hora</label>
            <input id="r-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="r-motivo" className={labelClass}>Motivo<span className="font-normal text-[#6B7355]"> (Opcional)</span></label>
            <input id="r-motivo" type="text" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputClass} />
            <p className={ayudaClass}>Lo verán quienes tengan reserva.</p>
          </div>
        </div>
        <UbicacionReprogramar clase={clase} estadoRef={ubicacionRef} />
      </fieldset>

      {confirmando ? (
        <div role="alertdialog" aria-label="Confirmar reprogramación" className="corte-card border-2 border-[#B5E600] bg-[#EDF5C9] p-4 text-sm text-[#3D4A00]">
          <p className="font-bold">¿Confirmas el cambio?</p>
          <p className="mt-1">
            {conReservas
              ? 'Se avisará a quienes tienen reserva y podrán cancelar sin coste (con devolución o recuperando su bono).'
              : 'Esta sesión no tiene reservas.'}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={enviando} onClick={enviar} className={botonPrimarioClass}>
              {enviando ? 'Guardando...' : 'Confirmar'}
            </button>
            <button type="button" disabled={enviando} onClick={() => setConfirmando(null)} className={botonSecundarioClass}>
              Volver
            </button>
          </div>
        </div>
      ) : (
        <button type="submit" disabled={enviando} className={botonPrimarioClass}>
          Revisar cambio
        </button>
      )}
      {mensaje && <p role="status" className="text-sm font-medium text-red-700">{mensaje}</p>}
    </form>
  )
}
