'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import CambiarUsername from './CambiarUsername'
import { comprimirImagen, contarPalabras } from './utilidadesPerfil'

// Antes este formulario de foto/descripción solo se mostraba con rol
// "entrenador". Fase 7 de la unificación de roles (11 sept 2026): se abre a
// cualquier usuario, porque cualquiera puede publicar sesiones y tener un
// perfil público que otros visiten.
export default function PerfilCuenta({ usuario, username, setUsername, descripcionInicial, fotoUrl, setFotoUrl, inicial }) {
  const [descripcionPerfil, setDescripcionPerfil] = useState(descripcionInicial)
  const [archivoFoto, setArchivoFoto] = useState(null)
  const [previewFoto, setPreviewFoto] = useState(null)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')
  const [confirmacionPerfil, setConfirmacionPerfil] = useState('')

  function manejarSeleccionFoto(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    if (previewFoto) URL.revokeObjectURL(previewFoto)

    setArchivoFoto(archivo)
    setPreviewFoto(URL.createObjectURL(archivo))
    setErrorPerfil('')
    setConfirmacionPerfil('')
  }

  async function guardarPerfil(e) {
    e.preventDefault()
    setErrorPerfil('')
    setConfirmacionPerfil('')

    if (contarPalabras(descripcionPerfil) > 300) {
      setErrorPerfil('La descripción no puede superar 300 palabras.')
      return
    }

    setGuardandoPerfil(true)

    let nuevaFotoUrl = fotoUrl

    if (archivoFoto) {
      try {
        const blobComprimido = await comprimirImagen(archivoFoto)
        const ruta = `${usuario.id}/avatar.jpg`

        const { error: errorSubida } = await supabase.storage
          .from('avatares')
          .upload(ruta, blobComprimido, { upsert: true, contentType: 'image/jpeg' })

        if (errorSubida) {
          setGuardandoPerfil(false)
          setErrorPerfil('No hemos podido subir la foto. Prueba con otra imagen (JPG o PNG).')
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('avatares').getPublicUrl(ruta)

        nuevaFotoUrl = `${publicUrl}?v=${Date.now()}`
      } catch (err) {
        setGuardandoPerfil(false)
        setErrorPerfil('No hemos podido procesar la imagen. Prueba con otra (JPG o PNG).')
        return
      }
    }

    const { error } = await supabase
      .from('perfiles')
      .update({ descripcion: descripcionPerfil, foto_url: nuevaFotoUrl })
      .eq('id', usuario.id)

    setGuardandoPerfil(false)

    if (error) {
      setErrorPerfil('No hemos podido guardar tu perfil. Inténtalo de nuevo.')
      return
    }

    if (previewFoto) URL.revokeObjectURL(previewFoto)

    setFotoUrl(nuevaFotoUrl)
    setArchivoFoto(null)
    setPreviewFoto(null)
    setConfirmacionPerfil('Perfil actualizado correctamente.')
    setTimeout(() => setConfirmacionPerfil(''), 5000)
  }

  return (
    <div className="mb-8 corte-card border border-[#E2E6CF] bg-white p-6">
      <h2 className="mb-4 text-lg font-bold text-[#1F2400]">Tu perfil</h2>

      <form onSubmit={guardarPerfil} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[#E2E6CF] bg-[#FBFAF3]">
            {previewFoto || fotoUrl ? (
              <img src={previewFoto || fotoUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-[#B5E600]">
                {inicial}
              </div>
            )}
          </div>
          <label className="inline-block cursor-pointer corte-btn border border-[#E2E6CF] px-4 py-2 text-sm font-semibold text-[#3D4A00] transition hover:border-[#B5E600]">
            Elegir foto
            <input type="file" accept="image/*" onChange={manejarSeleccionFoto} className="hidden" />
          </label>
        </div>

        <div>
          <textarea
            value={descripcionPerfil}
            onChange={(e) => setDescripcionPerfil(e.target.value.slice(0, 3000))}
            maxLength={3000}
            rows={4}
            placeholder="Cuéntales a los demás quién eres, tu experiencia y, si organizas sesiones, tu estilo de entrenamiento."
            className="block w-full corte-btn border border-[#E2E6CF] px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
          />
          <p
            className={`mt-1 text-right text-xs ${
              contarPalabras(descripcionPerfil) > 300 ? 'font-semibold text-red-600' : 'text-[#6B7355]'
            }`}
          >
            {contarPalabras(descripcionPerfil)}/300 palabras
          </p>
        </div>

        {errorPerfil && <p className="text-xs text-red-600">{errorPerfil}</p>}
        {confirmacionPerfil && <p className="text-sm font-medium text-[#3D4A00]">{confirmacionPerfil}</p>}

        <button
          type="submit"
          disabled={guardandoPerfil}
          className="self-start corte-btn bg-[#B5E600] px-6 py-2 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {guardandoPerfil ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </form>

      <div className="mt-6 border-t border-[#E2E6CF] pt-6">
        <CambiarUsername usuario={usuario} username={username} setUsername={setUsername} />
      </div>
    </div>
  )
}
