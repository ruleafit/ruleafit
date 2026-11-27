'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PAGOS_VISIBLES } from '../lib/pagosVisibles'
import { vibrar } from '../lib/nativo'
import { plazoCancelacion } from '../lib/plazoCancelacion'
import AvisoPlazoCancelacion from './AvisoPlazoCancelacion'
import BotonCalendario from './BotonCalendario'
import { Bell } from 'lucide-react'
import BotonAvisoPlaza from './reserva/BotonAvisoPlaza'
import PanelIdentificacion from './reserva/PanelIdentificacion'
import AvisoUltimaHora from './reserva/AvisoUltimaHora'
import DesglosePago from './reserva/DesglosePago'
import { calcularDesglose, formatearEuros } from '../lib/pagos/dinero.ts'
import { esReservaDeUltimaHora } from '../lib/ultimaHora'
import { leerRetorno, borrarRetorno } from '../lib/retorno'

const TAMANOS_BOTON = {
  normal: 'px-4 py-2 text-sm',
  grande: 'px-6 py-3 text-base',
}

function botonReservarClass(tamaño) {
  return (
    `inline-flex items-center justify-center corte-btn bg-[#B5E600] font-bold text-black ${TAMANOS_BOTON[tamaño]} ` +
    'hover:bg-[#a3d100] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.03] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ' +
    'disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100'
  )
}

function botonCompletaClass(tamaño) {
  return `inline-flex cursor-not-allowed items-center justify-center corte-btn bg-zinc-200 font-bold text-zinc-500 ${TAMANOS_BOTON[tamaño]}`
}

function obtenerAhoraMadridComoTexto() {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const partes = formateador.formatToParts(new Date())
  const obtener = (tipo) => partes.find((p) => p.type === tipo)?.value
  return `${obtener('year')}-${obtener('month')}-${obtener('day')} ${obtener('hour')}:${obtener('minute')}`
}

function claseYaPaso(clase) {
  if (!clase.fecha || !clase.hora) return false
  const horaCorta = String(clase.hora).slice(0, 5)
  const inicioClase = `${clase.fecha} ${horaCorta}`
  return inicioClase < obtenerAhoraMadridComoTexto()
}

// mostrarPlazo: solo en el detalle de la sesión (/clases/[id]); las tarjetas de Explorar no lo llevan.
// mostrarCalendario: solo en el detalle (/clases/[id]): «Añadir al calendario» cuando la reserva está confirmada.
export default function BotonReservar({ clase, onReservado, tamaño = 'normal', mostrarPlazo = false, mostrarCalendario = false }) {
  const [usuario, setUsuario] = useState(null)
  const [yaReservada, setYaReservada] = useState(false)
  const [comprobandoReserva, setComprobandoReserva] = useState(true)
  const [reservando, setReservando] = useState(false)
  const [errorReserva, setErrorReserva] = useState('')
  const [usadoBono, setUsadoBono] = useState(false)
  // true solo cuando el servidor acaba de confirmar la reserva desde esta pantalla (para la pregunta del calendario).
  const [acabaDeReservar, setAcabaDeReservar] = useState(false)
  const [tieneBono, setTieneBono] = useState(null) // null = aún sin comprobar
  const [pagando, setPagando] = useState(false)
  // Desglose del precio final: se muestra SIEMPRE antes de ir al banco.
  const [desgloseAbierto, setDesgloseAbierto] = useState(false)
  // Con menos de 2 h para empezar, la reserva se podrá cancelar pero sin derecho a devolución: se pide una confirmación expresa.
  const [confirmandoTarde, setConfirmandoTarde] = useState(false)
  const [, setTic] = useState(0)
  // C03: panel para visitantes sin sesión y aviso al volver tras identificarse.
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [avisoRetorno, setAvisoRetorno] = useState(false)
  const [intencionRetorno, setIntencionRetorno] = useState('reservar')
  // C15: el visitante pulsó «Avísame…» (panel con intención «avisar») y, si al reservar alguien se adelanta, la sesión pasa a completa.
  const [panelAvisoAbierto, setPanelAvisoAbierto] = useState(false)
  const [completaSobrevenida, setCompletaSobrevenida] = useState(false)
  // Última hora (<30 min): segunda confirmación previa al procedimiento habitual.
  const [avisoUltimaHora, setAvisoUltimaHora] = useState(false)
  const [ultimaHoraAceptada, setUltimaHoraAceptada] = useState(false)

  const precioClase = Number(clase.precio)
  const requierePago = PAGOS_VISIBLES && precioClase > 0 && tieneBono === false

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user || null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user || null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // Al volver desde el TPV con «atrás», el navegador puede restaurar la página tal como estaba («Abriendo el
  // pago…»): se desbloquea el botón. Pulsarlo de nuevo no duplica el cobro (el servidor reutiliza el pedido).
  useEffect(() => {
    const desbloquear = () => {
      if (document.visibilityState === 'visible') setPagando(false)
    }
    window.addEventListener('pageshow', desbloquear)
    document.addEventListener('visibilitychange', desbloquear)
    return () => {
      window.removeEventListener('pageshow', desbloquear)
      document.removeEventListener('visibilitychange', desbloquear)
    }
  }, [])

  // C03: si el usuario acaba de identificarse para reservar ESTA sesión, se avisa (una vez) y se limpia el recuerdo.
  // No se reserva nada: la confirmación sigue siendo suya.
  useEffect(() => {
    if (!usuario || !mostrarPlazo) return
    const pendiente = leerRetorno()
    if (pendiente?.ruta === `/clases/${clase.id}`) {
      setAvisoRetorno(true)
      setIntencionRetorno(pendiente.intencion) // «reservar» o «avisar» (C15): no se confunden
      borrarRetorno()
    }
  }, [usuario, mostrarPlazo, clase.id])

  // Ya no depende del rol guardado (Fase 5 de la unificación de roles, 11
  // sept 2026): cualquier usuario puede organizar unas sesiones y
  // participar en otras, así que lo relevante es si ESTA sesión concreta
  // es suya como organizador, no un rol fijo en su perfil.
  const esMiPropiaSesion = !!(usuario && clase.trainer_id === usuario.id)

  useEffect(() => {
    let cancelado = false

    async function comprobarReservaActiva() {
      if (!usuario || esMiPropiaSesion) {
        setYaReservada(false)
        setComprobandoReserva(false)
        return
      }

      setComprobandoReserva(true)

      const { data } = await supabase
        .from('reservas')
        .select('id')
        .eq('clase_id', clase.id)
        .eq('cliente_id', usuario.id)
        .eq('estado', 'activa')
        .maybeSingle()

      if (!cancelado) {
        setYaReservada(!!data)
        setComprobandoReserva(false)
      }
    }

    comprobarReservaActiva()

    return () => {
      cancelado = true
    }
  }, [usuario, esMiPropiaSesion, clase.id])

  // Con los pagos activos, si el alumno tiene un bono vigente con este
  // entrenador la reserva sigue el camino de siempre (descuenta del bono); si
  // no, tiene que pagar la sesión.
  useEffect(() => {
    if (!PAGOS_VISIBLES || !usuario || esMiPropiaSesion || !(precioClase > 0)) {
      setTieneBono(null)
      return
    }
    let cancelado = false
    supabase.rpc('mis_bonos_comprados').then(({ data, error }) => {
      if (cancelado) return
      if (error) {
        setTieneBono(false) // sin saberlo, se pide pago (lo más seguro)
        return
      }
      const ahora = Date.now()
      setTieneBono(
        (data || []).some(
          (b) =>
            b.trainer_id === clase.trainer_id &&
            new Date(b.fecha_fin).getTime() >= ahora &&
            (b.numero_sesiones == null || Number(b.sesiones_usadas) < b.numero_sesiones)
        )
      )
    })
    return () => {
      cancelado = true
    }
  }, [usuario, esMiPropiaSesion, precioClase, clase.trainer_id])

  // Pide al servidor el formulario firmado y lleva al alumno a la página de
  // pago del banco. La plaza se concede cuando el banco confirma el pago.
  useEffect(() => {
    if (!mostrarPlazo) return
    const id = setInterval(() => setTic((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [mostrarPlazo])

  // Devuelve true si hay que pedir confirmación antes de reservar/pagar (faltan menos de 2 h).
  function requiereConfirmarTarde() {
    return mostrarPlazo && !confirmandoTarde && plazoCancelacion(clase).estado === 'cerrado'
  }

  // Devuelve true si hay que mostrar antes el aviso de última hora (falta menos de 30 min y aún no se ha aceptado).
  function requiereAvisoUltimaHora() {
    if (ultimaHoraAceptada || !esReservaDeUltimaHora(clase)) return false
    setAvisoUltimaHora(true)
    return true
  }

  // «Sí, continuar»: NO reserva. Deja el botón en su paso de confirmación habitual («Entiendo, …»), que es el que reserva.
  function continuarTrasAvisoUltimaHora() {
    setAvisoUltimaHora(false)
    setUltimaHoraAceptada(true)
    setConfirmandoTarde(true)
    if (requierePago) setDesgloseAbierto(true)
  }

  // «Volver»: no se hace nada (ni reserva, ni pago, ni bono).
  function volverDeAvisoUltimaHora() {
    setAvisoUltimaHora(false)
    setUltimaHoraAceptada(false)
    setConfirmandoTarde(false)
  }

  // Primer paso: enseñar el desglose (precio, política de cancelación y total). No cobra nada.
  function abrirDesglose() {
    if (requiereAvisoUltimaHora()) return
    setErrorReserva('')
    setDesgloseAbierto(true)
  }

  // Segundo paso, solo desde el desglose. El total que ha visto el alumno viaja al servidor, que lo compara con el suyo.
  async function handlePagar() {
    const desglose = calcularDesglose(clase.precio)
    if (!desglose) return
    setConfirmandoTarde(false)
    setPagando(true)
    setErrorReserva('')
    const { data: sesion } = await supabase.auth.getSession()
    const respuesta = await fetch('/api/payments/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.session?.access_token || ''}` },
      body: JSON.stringify({ claseId: clase.id, totalCentimos: desglose.totalCentimos }),
    }).catch(() => null)
    const datos = respuesta ? await respuesta.json().catch(() => ({})) : {}
    if (!respuesta || !respuesta.ok || !datos.url || !datos.campos) {
      setErrorReserva(datos.error || 'No se ha podido iniciar el pago. Inténtalo de nuevo.')
      setPagando(false)
      return
    }
    const formulario = document.createElement('form')
    formulario.method = 'POST'
    formulario.action = datos.url
    for (const [nombre, valor] of Object.entries(datos.campos)) {
      const campo = document.createElement('input')
      campo.type = 'hidden'
      campo.name = nombre
      campo.value = valor
      formulario.appendChild(campo)
    }
    document.body.appendChild(formulario)
    formulario.submit()
  }

  async function handleReservar() {
    if (requiereAvisoUltimaHora()) return
    if (requiereConfirmarTarde()) {
      setConfirmandoTarde(true)
      return
    }
    setConfirmandoTarde(false)
    setReservando(true)
    setErrorReserva('')

    const { data, error } = await supabase.rpc('reservar_clase', { p_clase_id: clase.id })

    if (error) {
      // C15: si otra persona se ha adelantado, se explica y se ofrece el aviso de plaza.
      if (/completa/i.test(error.message || '')) {
        setCompletaSobrevenida(true)
        setErrorReserva('Otra persona se ha adelantado y la sesión se ha completado. Puedes pedir que te avisemos si queda una plaza.')
      } else {
        setErrorReserva(error.message)
      }
      setReservando(false)
      return
    }

    setYaReservada(true)
    setAcabaDeReservar(true)
    setUsadoBono(!!data?.usado_bono)
    setReservando(false)
    vibrar('exito')

    if (onReservado) {
      const nuevasPlazasOcupadas = data?.plazas_ocupadas ?? (clase.plazas_ocupadas ?? 0) + 1
      onReservado(nuevasPlazasOcupadas)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('primera-accion'))
    }
  }

  if (!usuario) {
    if (clase.estado !== 'activa' || claseYaPaso(clase)) {
      return <p className="text-sm text-zinc-500">Esta sesión ya no está disponible</p>
    }
    // C15: sesión completa → el visitante no puede reservar, pero sí pedir un aviso (reutiliza el panel de C03).
    if ((clase.plazas_ocupadas ?? 0) >= (clase.plazas_max ?? 0)) {
      return (
        <div>
          <button type="button" disabled className={botonCompletaClass(tamaño)}>
            Completa
          </button>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setPanelAvisoAbierto(true)}
              className="inline-flex items-center justify-center gap-2 corte-btn border-2 border-[#1F2400] bg-white px-4 py-2 text-sm font-bold text-[#1F2400] hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              Avísame si queda una plaza
            </button>
          </div>
          {panelAvisoAbierto && <PanelIdentificacion clase={clase} intencion="avisar" onCerrar={() => setPanelAvisoAbierto(false)} />}
        </div>
      )
    }
    return (
      <div>
        <button type="button" onClick={() => setPanelAbierto(true)} className={botonReservarClass(tamaño)}>
          Reservar
        </button>
        {panelAbierto && <PanelIdentificacion clase={clase} onCerrar={() => setPanelAbierto(false)} />}
      </div>
    )
  }

  if (esMiPropiaSesion) {
    return <p className="text-sm text-zinc-500">Esta es tu propia sesión</p>
  }

  if (clase.estado !== 'activa' || claseYaPaso(clase)) {
    return <p className="text-sm text-zinc-500">Esta sesión ya no está disponible</p>
  }

  // Sesión completa (o completada por otra persona mientras reservabas). Quien YA tiene reserva sigue al bloque
  // «Ya tienes esta sesión reservada» de más abajo y no ve el aviso.
  if (((clase.plazas_ocupadas ?? 0) >= (clase.plazas_max ?? 0) || completaSobrevenida) && !yaReservada) {
    return (
      <div>
        {avisoRetorno && intencionRetorno === 'reservar' && (
          <p className="mb-2 text-sm text-amber-800">Mientras te identificabas, la sesión se ha completado.</p>
        )}
        {errorReserva && <p className="mb-2 text-sm text-red-600">{errorReserva}</p>}
        <button type="button" disabled className={botonCompletaClass(tamaño)}>
          Completa
        </button>
        {!comprobandoReserva && (
          <BotonAvisoPlaza
            clase={clase}
            usuario={usuario}
            retornoAviso={avisoRetorno && intencionRetorno === 'avisar'}
            compacto={!mostrarPlazo}
          />
        )}
      </div>
    )
  }

  if (comprobandoReserva || (PAGOS_VISIBLES && precioClase > 0 && tieneBono === null && !yaReservada)) {
    return <p className="text-sm text-zinc-400">Comprobando disponibilidad...</p>
  }

  if (yaReservada) {
    return (
      <div>
        <div
          className={`inline-flex items-center gap-2 font-semibold text-[#7a9900] ${
            tamaño === 'grande' ? 'text-base' : 'text-sm'
          }`}
        >
          <svg
            className={tamaño === 'grande' ? 'h-5 w-5' : 'h-4 w-4'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Ya tienes esta sesión reservada
        </div>
        {usadoBono && (
          <p className="mt-1 text-xs text-[#6B7355]">Se ha descontado 1 sesión de tu bono con este rulero.</p>
        )}
        {mostrarCalendario && <BotonCalendario clase={clase} pregunta={acabaDeReservar} className="mt-2" />}
      </div>
    )
  }

  const ventanaUltimaHora = avisoUltimaHora && (
    <AvisoUltimaHora clase={clase} onVolver={volverDeAvisoUltimaHora} onContinuar={continuarTrasAvisoUltimaHora} />
  )

  const avisoListo = avisoRetorno && (
    <p role="status" className="mb-2 corte-tag border border-[#B5E600]/60 bg-[#EDF5C9] px-3 py-1.5 text-sm font-medium text-[#3D4A00]">
      {intencionRetorno === 'avisar'
        ? '¡Buenas noticias! Ahora hay plazas libres: ya puedes reservar.'
        : '¡Ya puedes reservar! Tu sesión sigue seleccionada.'}
    </p>
  )

  if (requierePago) {
    const desglose = calcularDesglose(clase.precio)
    if (!desglose) {
      return <p className="text-sm text-red-600">No podemos calcular el precio de esta sesión. Escríbenos desde Ayuda.</p>
    }
    return (
      <div>
        {avisoListo}
        {ventanaUltimaHora}
        {desgloseAbierto ? (
          <DesglosePago
            clase={clase}
            desglose={desglose}
            pagando={pagando}
            onConfirmar={handlePagar}
            onVolver={() => {
              setDesgloseAbierto(false)
              setConfirmandoTarde(false)
            }}
          />
        ) : (
          <>
            <button type="button" onClick={abrirDesglose} className={botonReservarClass(tamaño)}>
              {`Reservar por ${formatearEuros(desglose.totalCentimos)}`}
            </button>
            <p className="mt-1 text-xs text-[#6B7355]">Verás el desglose antes de pagar. Pago con tarjeta o Bizum.</p>
            {mostrarPlazo && <AvisoPlazoCancelacion clase={clase} condicionesPago className="mt-1.5" />}
          </>
        )}
        {errorReserva && <p className="mt-2 text-sm text-red-600">{errorReserva}</p>}
      </div>
    )
  }

  return (
    <div>
      {avisoListo}
      {ventanaUltimaHora}
      <button type="button" onClick={handleReservar} disabled={reservando} className={botonReservarClass(tamaño)}>
        {reservando ? 'Reservando...' : confirmandoTarde ? 'Entiendo, reservar' : 'Reservar'}
      </button>
      {PAGOS_VISIBLES && precioClase > 0 && tieneBono && (
        <p className="mt-1 text-xs font-medium text-[#3D4A00]">Total a pagar ahora: 0,00 € (se descuenta 1 sesión de tu bono).</p>
      )}
      {mostrarPlazo && <AvisoPlazoCancelacion clase={clase} className="mt-1.5" />}
      {errorReserva && <p className="mt-2 text-sm text-red-600">{errorReserva}</p>}
    </div>
  )
}
