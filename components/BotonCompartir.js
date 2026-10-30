'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Share2, Link2, Image as IconoImagen, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatearFechaParaMostrar } from '../lib/formatoFecha'
import { generarImagenHistoria } from '../lib/imagenHistoria'

// Botón "Compartir" de una sesión: abre un panel con
//  - "Compartir…" (menú nativo del móvil: Instagram, WhatsApp, Mensajes...),
//  - copiar el enlace,
//  - WhatsApp, Telegram, X, Facebook y correo,
//  - imagen vertical para historias (se comparte o se descarga).
// Instagram no tiene un enlace de "compartir" para webs: desde el móvil se usa
// el menú nativo, y en cualquier dispositivo se puede copiar el enlace o bajar
// la imagen para subirla a una historia.
export default function BotonCompartir({ clase: claseRecibida, variante = 'icono', className = '' }) {
  // Algunas listas (Mis sesiones publicadas) no traen todos los datos de la
  // sesión (ciudad, zona, precio...). Si faltan, se leen al abrir el panel.
  const [datosCompletos, setDatosCompletos] = useState(null)
  const clase = { ...claseRecibida, ...datosCompletos, id: claseRecibida.id ?? claseRecibida.clase_id }
  const faltanDatos = !claseRecibida.ciudad && !datosCompletos
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [puedeCompartirNativo, setPuedeCompartirNativo] = useState(false)
  const [esMovil, setEsMovil] = useState(false)
  const botonCerrarRef = useRef(null)

  useEffect(() => {
    setPuedeCompartirNativo(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
    setEsMovil(typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent))
  }, [])

  useEffect(() => {
    if (!abierto) return
    botonCerrarRef.current?.focus()
    function handleTecla(e) {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', handleTecla)
    return () => document.removeEventListener('keydown', handleTecla)
  }, [abierto])

  useEffect(() => {
    if (!abierto || !faltanDatos) return
    let cancelado = false
    supabase
      .from('clases')
      .select('titulo, ciudad, direccion, fecha, hora, categoria, tipo_actividad, precio')
      .eq('id', clase.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado && data) setDatosCompletos(data)
      })
    return () => {
      cancelado = true
    }
  }, [abierto, faltanDatos, clase.id])

  function cerrar() {
    setAbierto(false)
    setAviso('')
    setCopiado(false)
  }

  const url = typeof window !== 'undefined' ? `${window.location.origin}/clases/${clase.id}` : ''
  const hora = clase.hora ? String(clase.hora).slice(0, 5) : ''
  const cuando = [formatearFechaParaMostrar(clase.fecha), hora && `${hora} h`].filter(Boolean).join(' a las ')
  const texto = [clase.titulo, clase.ciudad, cuando].filter(Boolean).join(' · ')
  const textoConEnlace = `${texto} — Reserva tu plaza en Ruleafit: ${url}`

  async function compartirNativo() {
    try {
      await navigator.share({ title: clase.titulo, text: `${texto} — Reserva tu plaza en Ruleafit`, url })
      cerrar()
    } catch (err) {
      if (err?.name !== 'AbortError') setAviso('No se pudo abrir el menú de compartir. Prueba con otra opción.')
    }
  }

  // Copia el enlace de la sesión al portapapeles; devuelve true si lo logra.
  async function copiarAlPortapapeles() {
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      // Respaldo para navegadores sin acceso al portapapeles.
      const campo = document.createElement('textarea')
      campo.value = url
      document.body.appendChild(campo)
      campo.select()
      let copiadoOk = false
      try {
        copiadoOk = document.execCommand('copy')
      } catch {
        copiadoOk = false
      }
      document.body.removeChild(campo)
      return copiadoOk
    }
  }

  async function copiarEnlace() {
    if (await copiarAlPortapapeles()) {
      setCopiado(true)
      setAviso('')
      setTimeout(() => setCopiado(false), 2500)
    } else {
      setAviso('No se pudo copiar. Copia el enlace a mano desde la barra de direcciones.')
    }
  }

  // Instagram no permite crear una historia con un enlace desde una web: el
  // único enlace pulsable es el sticker "Enlace", que se añade dentro de la
  // app. Lo máximo que se puede hacer desde aquí es copiar el enlace y abrir la
  // cámara de historias de Instagram (esquema instagram://story-camera, no
  // documentado pero muy extendido), para que solo quede elegir la imagen y
  // pegar el enlace. Si Instagram no está instalado no ocurre nada.
  async function abrirInstagramHistoria() {
    const enlaceCopiado = await copiarAlPortapapeles()
    if (enlaceCopiado) setCopiado(true)
    setAviso(
      enlaceCopiado
        ? 'Enlace copiado. En Instagram: elige la imagen de tu galería, toca la pegatina "Enlace" y pégalo.'
        : 'En Instagram: elige la imagen, toca la pegatina "Enlace" y pega el enlace (usa "Copiar enlace" antes).'
    )
    const atajo = document.createElement('a')
    atajo.href = 'instagram://story-camera'
    document.body.appendChild(atajo)
    atajo.click()
    document.body.removeChild(atajo)
  }

  function abrirRed(enlace) {
    window.open(enlace, '_blank', 'noopener,noreferrer')
  }

  // La imagen para historia no se puede pulsar, así que a la vez se copia el
  // enlace de la sesión: solo queda subir la imagen y pegar el enlace con el
  // sticker "Enlace" de Instagram (el único modo de que quien vea la historia
  // pueda pulsar y llegar a la sesión). La copia va lo primero, mientras sigue
  // activo el toque del usuario, que algunos navegadores exigen.
  async function imagenParaHistoria() {
    setGenerando(true)
    setAviso('')
    const enlaceCopiado = await copiarAlPortapapeles()
    if (enlaceCopiado) setCopiado(true)
    const siguientePaso = enlaceCopiado
      ? 'Enlace copiado. Sube la imagen a tu historia y pégalo con el sticker "Enlace" para que se pueda pulsar.'
      : 'Sube la imagen a tu historia y añade el enlace de la sesión con el sticker "Enlace" (usa "Copiar enlace").'
    try {
      const blob = await generarImagenHistoria(clase)
      const archivo = new File([blob], 'ruleafit-sesion.png', { type: 'image/png' })

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: clase.titulo })
          setAviso(siguientePaso)
          return
        } catch (err) {
          if (err?.name === 'AbortError') {
            setAviso(siguientePaso)
            return
          }
        }
      }

      // Sin menú nativo con archivos (ordenador): se descarga la imagen.
      const enlaceDescarga = document.createElement('a')
      enlaceDescarga.href = URL.createObjectURL(blob)
      enlaceDescarga.download = 'ruleafit-sesion.png'
      document.body.appendChild(enlaceDescarga)
      enlaceDescarga.click()
      document.body.removeChild(enlaceDescarga)
      setTimeout(() => URL.revokeObjectURL(enlaceDescarga.href), 1000)
      setAviso(`Imagen descargada. ${siguientePaso}`)
    } catch {
      setAviso('No se pudo crear la imagen. Inténtalo de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  const opcionClass =
    'flex w-full items-center gap-3 corte-btn border border-[#E2E6CF] bg-white px-4 py-3 text-left text-sm font-medium text-[#1F2400] transition-colors hover:border-[#B5E600] hover:bg-[#F5F7E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] disabled:opacity-60'

  const redes = [
    { nombre: 'WhatsApp', enlace: `https://wa.me/?text=${encodeURIComponent(textoConEnlace)}` },
    {
      nombre: 'Telegram',
      enlace: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texto)}`,
    },
    {
      nombre: 'X (Twitter)',
      enlace: `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(url)}`,
    },
    { nombre: 'Facebook', enlace: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    {
      nombre: 'Correo electrónico',
      enlace: `mailto:?subject=${encodeURIComponent(clase.titulo)}&body=${encodeURIComponent(textoConEnlace)}`,
    },
  ]

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Compartir la sesión ${clase.titulo}`}
        className={
          className ||
          (variante === 'icono'
            ? 'inline-flex h-9 w-9 items-center justify-center corte-btn bg-white/90 text-[#1F2400] shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]'
            : 'inline-flex h-11 items-center justify-center gap-2 corte-btn border-2 border-[#B5E600] bg-white px-4 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#F5F7E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]')
        }
      >
        <Share2 className="h-4 w-4" strokeWidth={2} />
        {variante !== 'icono' && 'Compartir'}
      </button>

      {/* En un portal: dentro de la cabecera o de las tarjetas lo taparía el resto de la página. */}
      {abierto &&
        createPortal(
        <div
          className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={cerrar}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Compartir sesión"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto corte-card bg-[#FBFAF3] p-5 shadow-xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#1F2400]">Compartir sesión</h2>
                <p className="mt-0.5 text-sm text-[#6B7355]">{clase.titulo}</p>
              </div>
              <button
                ref={botonCerrarRef}
                type="button"
                onClick={cerrar}
                aria-label="Cerrar"
                className="shrink-0 text-[#6B7355] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {puedeCompartirNativo && (
                <button type="button" onClick={compartirNativo} className={`${opcionClass} border-[#B5E600] bg-[#EDF5C9]`}>
                  <Share2 className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  Compartir… (Instagram, WhatsApp y más)
                </button>
              )}

              <button type="button" onClick={copiarEnlace} className={opcionClass}>
                {copiado ? (
                  <Check className="h-5 w-5 shrink-0 text-[#3D4A00]" strokeWidth={2} />
                ) : (
                  <Link2 className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                )}
                {copiado ? 'Enlace copiado' : 'Copiar enlace'}
              </button>

              <button type="button" onClick={imagenParaHistoria} disabled={generando || faltanDatos} className={opcionClass}>
                <IconoImagen className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                {generando
                  ? 'Creando imagen…'
                  : puedeCompartirNativo
                    ? 'Imagen para historia de Instagram'
                    : 'Descargar imagen para historia'}
              </button>

              {esMovil && (
                <div className="mt-2 corte-card border border-[#B5E600]/60 bg-[#EDF5C9] p-3">
                  <p className="text-sm font-bold text-[#3D4A00]">Historia de Instagram con enlace</p>
                  <ol className="mt-1 list-decimal pl-5 text-xs text-[#3D4A00]">
                    <li>Pulsa "Imagen para historia" y guárdala en tu galería.</li>
                    <li>Pulsa el botón de abajo: se copia el enlace y se abre Instagram.</li>
                    <li>Elige la imagen, toca la pegatina "Enlace" y pégalo.</li>
                  </ol>
                  <button type="button" onClick={abrirInstagramHistoria} className={`${opcionClass} mt-2 border-[#B5E600]`}>
                    <Share2 className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                    Abrir Instagram con el enlace copiado
                  </button>
                </div>
              )}

              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#6B7355]">Compartir en</p>
              {redes.map((red) => (
                <button key={red.nombre} type="button" onClick={() => abrirRed(red.enlace)} className={opcionClass}>
                  {red.nombre}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-[#6B7355]" role="status">
              {aviso ||
                'Para una historia de Instagram: la imagen copia a la vez el enlace; súbela y pégalo con el sticker "Enlace" para que se pueda pulsar.'}
            </p>
          </div>
        </div>,
          document.body
        )}
    </>
  )
}
