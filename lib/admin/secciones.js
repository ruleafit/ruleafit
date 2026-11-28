// Solo servidor. Apartados del panel de administración y cómo contar lo que cada
// uno tiene pendiente. Una página nueva de /admin se añade aquí.
async function contar(consulta) {
  const { count, error } = await consulta
  // Sin la tabla (SQL sin aplicar) no se enseña número.
  return error ? null : count
}

const pendientes = (admin, tabla) =>
  contar(admin.from(tabla).select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'))

export const SECCIONES = [
  {
    href: '/admin/verificaciones',
    titulo: 'Verificaciones',
    descripcion: 'Identidad, titulaciones y centros por revisar.',
    async pendientes(admin) {
      const partes = await Promise.all(
        ['verificaciones_identidad', 'titulaciones', 'verificaciones_centro'].map((t) => pendientes(admin, t))
      )
      return partes.includes(null) ? null : partes.reduce((a, b) => a + b, 0)
    },
  },
  {
    href: '/admin/denuncias',
    titulo: 'Denuncias',
    descripcion: 'Denuncias de sesiones, usuarios y titulaciones.',
    pendientes: (admin) => pendientes(admin, 'denuncias'),
  },
  {
    href: '/admin/incidencias',
    titulo: 'Incidencias',
    descripcion: 'Reclamaciones de pago abiertas o en revisión.',
    pendientes: (admin) =>
      contar(
        admin.from('incidencias_pago').select('id', { count: 'exact', head: true }).in('estado', ['abierta', 'en_revision'])
      ),
  },
  {
    href: '/admin/contracargos',
    titulo: 'Contracargos',
    descripcion: 'Pagos que el banco retira y su resultado.',
    pendientes: (admin) =>
      contar(admin.from('contracargos').select('id', { count: 'exact', head: true }).eq('estado', 'abierto')),
  },
  {
    href: '/admin/liquidaciones',
    titulo: 'Liquidaciones',
    descripcion: 'Cierres a organizadores y transferencias pendientes.',
    pendientes: (admin) => pendientes(admin, 'liquidaciones_lineas'),
  },
  {
    href: '/admin/facturas',
    titulo: 'Facturas',
    descripcion: 'Facturas de comisión y de Pro (borradores).',
    pendientes: (admin) => contar(admin.from('facturas').select('id', { count: 'exact', head: true }).eq('estado', 'borrador')),
  },
  {
    href: '/admin/alertas',
    titulo: 'Alertas',
    descripcion: 'Alertas de pagos sin resolver y frenos.',
    pendientes: (admin) =>
      contar(admin.from('alertas_operativas').select('id', { count: 'exact', head: true }).is('resuelta_en', null)),
  },
]
