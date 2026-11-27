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
]
