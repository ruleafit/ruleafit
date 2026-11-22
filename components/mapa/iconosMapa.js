import L from 'leaflet'

// Marcador circular con la foto de perfil de quien publica la sesión (misma
// foto_url que el perfil público, llega con la consulta de sesiones). Sin foto,
// o si no carga, se ve la inicial sobre lima, como el avatar del perfil. Los
// iconos se guardan en caché para no recrearlos en cada render.
// (Movido tal cual desde components/MapaClases.js para compartirlo con el zoom máximo.)
export const TAM_MARCADOR = 44
const cacheIconos = new Map()

function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export function iconoOrganizador(perfil) {
  const clave = `${perfil?.foto_url || ''}|${perfil?.username || ''}`
  const guardado = cacheIconos.get(clave)
  if (guardado) return guardado

  const inicial = escaparHtml((perfil?.username || '?').charAt(0).toUpperCase())
  const foto = perfil?.foto_url
    ? `<img src="${escaparHtml(perfil.foto_url)}" alt="" onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />`
    : ''

  const icono = L.divIcon({
    html: `<div style="position:relative;width:${TAM_MARCADOR}px;height:${TAM_MARCADOR}px;border-radius:50%;overflow:hidden;box-sizing:border-box;background:#B5E600;border:3px solid #fff;box-shadow:0 0 0 2px #3D4A00,0 2px 5px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:#1F2400;font-weight:800;font-size:18px;line-height:1;">${inicial}${foto}</div>`,
    className: '',
    iconSize: [TAM_MARCADOR, TAM_MARCADOR],
    iconAnchor: [TAM_MARCADOR / 2, TAM_MARCADOR / 2],
    popupAnchor: [0, -TAM_MARCADOR / 2],
  })
  cacheIconos.set(clave, icono)
  return icono
}

// «+N» cuando en un mismo punto hay más organizadores de los que caben como fotos.
// Mismo aspecto que los círculos con número del agrupamiento normal.
export function iconoMasOrganizadores(cantidad) {
  return L.divIcon({
    html: `<div style="
        width:40px;
        height:40px;
        border-radius:50%;
        background:#3D4A00;
        border:3px solid #fff;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 2px 4px rgba(0,0,0,0.45);
      "><span style="color:#FFFFFF;font-weight:700;font-size:13px;line-height:1;">+${cantidad}</span></div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}
