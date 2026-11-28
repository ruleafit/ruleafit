import { htmlFactura } from '../../lib/pagos/facturas.ts'

// Descarga el documento: se abre en el navegador y desde ahí se imprime o se guarda como PDF.
export function descargarFactura(factura) {
  const url = URL.createObjectURL(new Blob([htmlFactura(factura)], { type: 'text/html;charset=utf-8' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `${factura.numero || 'borrador-factura'}.html`
  enlace.click()
  URL.revokeObjectURL(url)
}
