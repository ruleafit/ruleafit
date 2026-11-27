// Solo servidor. Elimina del Storage los archivos apuntados en
// archivos_verificacion_por_borrar (sql/110). Si Storage falla, la fila se
// queda en la cola y se reintenta en la siguiente pasada.
export async function purgarArchivos(admin, { incluirHuerfanos = true } = {}) {
  if (incluirHuerfanos) {
    const { error } = await admin.rpc('encolar_huerfanos_verificacion')
    if (error) console.error('Verificaciones: no se pudieron buscar archivos huérfanos.', error.message)
  }

  const { data: cola, error } = await admin
    .from('archivos_verificacion_por_borrar')
    .select('bucket, ruta')
    .order('creado_en', { ascending: true })
    .limit(200)
  if (error) throw new Error(error.message)

  const porBucket = new Map()
  for (const { bucket, ruta } of cola || []) {
    porBucket.set(bucket, [...(porBucket.get(bucket) || []), ruta])
  }

  let borrados = 0
  let pendientes = 0
  for (const [bucket, rutas] of porBucket) {
    const { error: errorStorage } = await admin.storage.from(bucket).remove(rutas)
    if (errorStorage) {
      console.error(`Verificaciones: no se pudo borrar en ${bucket}.`, errorStorage.message)
      pendientes += rutas.length
      continue
    }
    const { error: errorCola } = await admin
      .from('archivos_verificacion_por_borrar')
      .delete()
      .eq('bucket', bucket)
      .in('ruta', rutas)
    if (errorCola) pendientes += rutas.length
    else borrados += rutas.length
  }
  return { borrados, pendientes }
}
