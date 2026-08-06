// Marcador de "ubicación buscada": pin coral de marca (#FF6B3D), distinto de los
// marcadores azules existentes (pin por defecto de Leaflet en MapaSelector, punto
// "Estás aquí" en MapaClases). Compartido por components/MapaSelector.js y
// components/MapaClases.js para señalar el punto elegido en el buscador de direcciones.

import L from 'leaflet'

export function iconoBusqueda() {
  const svg = `<svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
      <polygon points="10,29 22,29 16,40" fill="#FF6B3D" stroke="#fff" stroke-width="2" stroke-linejoin="round" />
      <circle cx="16" cy="15" r="14" fill="#FF6B3D" stroke="#fff" stroke-width="2" />
      <circle cx="16" cy="15" r="5" fill="#fff" />
    </svg>`

  return L.divIcon({
    html: `<div style="width:32px;height:40px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.45));">${svg}</div>`,
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
  })
}
