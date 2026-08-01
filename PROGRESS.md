# Openfit — Progreso del proyecto

Última actualización: 1 agosto 2026

## Fase 0 · Entorno base — completada
- Node, VS Code y Git instalados.
- Proyecto Next.js creado y subido a GitHub.

## Fase 1 · Cuentas y sesión — completada
- Registro real con Supabase (app/registro).
- Login (app/login).
- Página /cuenta: ver usuario/rol y cerrar sesión.
- Roles cliente/entrenador guardados en user_metadata.rol.
- Confirmación de email desactivada (solo desarrollo).
- Conector lib/supabaseClient.js, claves en .env.local.
- Home personalizada con botones a login/registro.

## Fase 2 · Clases — completada
Hecho:
- Tabla clases en Supabase con RLS.
- /publicar: formulario con mapa real (Leaflet) para lat/lng.
- /clases: listado en tarjetas (dirección, punto de encuentro, coordenadas).
- Restricción "solo entrenadores publican" (interfaz + política RLS).
- Menú de navegación (roles, indicador animado bajo enlace activo, botones de acción).
- Detalles estéticos: formulario de /publicar centrado por secciones, tarjetas de /clases con indicador de plazas libres.
- Filtros en /clases: por ciudad y categoría, aplicados al instante, con mensaje de estado vacío.
- Ficha de detalle de cada clase (/clases/[id]) con mapa de solo lectura, gestión de clase no encontrada y enlace "Ver detalle" en las tarjetas.
- Mapa en /clases con marcador por clase y popup resumen, filtros de ciudad/categoría/cuándo (hoy, mañana, próximos 7 y 30 días)/franja horaria, exclusión permanente de clases canceladas o con fecha pasada.

Falta:
- Ninguno.

## Fase 3 · Reservas — completada
Hecho:
- Tabla reservas con RLS, índice único para evitar reservas duplicadas, y función RPC reservar_clase() con bloqueo de fila para evitar sobreventa (sql/001_reservas.sql, ejecutado en Supabase).
- Botón Reservar (components/BotonReservar.js) en tarjetas y ficha de detalle, con estados según sesión, rol, aforo, clase pasada/inactiva y reserva ya existente. Llama a la función RPC reservar_clase() y actualiza el contador de plazas al momento.
- Página /mis-reservas: lista de reservas activas del cliente ordenadas por fecha, restringida por rol, con enlace en el menú visible solo para clientes.
- Panel del entrenador (/mis-clases): función RPC segura reservas_de_mis_clases() y página que agrupa las reservas por clase, con email y fecha de reserva de cada cliente.
- Cancelación de reservas (/mis-reservas): función RPC segura cancelar_reserva(), botón con confirmación, mensaje informativo según si quedaban 2h o más (sin cargo real todavía, pendiente de la cartera en Fase 4).

Falta:
- Ninguno.

## Nombres de usuario (previo a Fase 4)
Hecho:
- Tabla perfiles con generación automática al registrarse (trigger), backfill de cuentas existentes, comprobación de disponibilidad antes de registrarse o cambiar de nombre (username_disponible), campo de nombre de usuario en /registro, edición desde /cuenta, y panel del entrenador (Mis clases) mostrando nombre de usuario en vez de email por privacidad.

## Fase 4 · Open (puntos de fidelización) — completada
Hecho:
- Sistema de Open completo: tablas open_saldos/open_movimientos/open_motivos con RLS, bienvenida automática (20 Open) al registrarse, asistencia confirmada (5 Open) marcada por el entrenador vía marcar_asistencia() con corrección mediante movimiento compensatorio, saldo e historial visibles en /cuenta, botones de asistencia en /mis-clases.

Falta:
- Ninguno.

## Mínimo de plazas y cancelación de clase (post Fase 4)
Hecho:
- Campo plazas_min en /publicar y aviso visual de "pendiente de confirmación" en tarjetas/ficha.
- Botón "Cancelar esta clase" para el entrenador en /mis-clases (función cancelar_clase, cancela la clase y todas sus reservas activas).
- Aviso claro en /mis-reservas cuando una reserva fue cancelada por el entrenador (cancelada_por_entrenador), en sección separada.
- Corregido un bucle de recursión en las políticas RLS de clases/reservas surgido al implementar esto (sql/010_arreglo_recursion_rls.sql).

## Pantalla de inicio tras login/registro (post Fase 4)
Hecho:
- Home (/) muestra botones grandes con iconos según rol (entrenador: Clases/Mis clases/Publicar/Mi cuenta; cliente: Clases/Mis reservas/Mi cuenta) cuando hay sesión iniciada.
- Login y registro redirigen automáticamente a esta pantalla.
- Enlace "Inicio" añadido al menú de navegación.

## Fase 5 · Pulido y lanzamiento — en curso
Hecho:
- Despliegue en Vercel: producción en https://openfit-five.vercel.app.
- Variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY configuradas en Vercel (valores no documentados aquí).
- En Supabase se añadieron el Site URL y las Redirect URLs de producción, manteniendo también las de localhost.
- Corregido el título de la pestaña del navegador ("Create Next App" → "Openfit").
- Rediseño visual completo, responsive desde el principio:
  - Base visual compartida: paleta de marca en app/globals.css, tipografía de titulares, y animaciones (aparición al hacer scroll vía IntersectionObserver en components/RevelarAlLlegar.js, hover de tarjetas que se elevan, zoom lento de imágenes), todo respetando prefers-reduced-motion.
  - Portada (/) rehecha: hero a pantalla casi completa con parallax suave, franja de categorías, franja de comunidad y sección de tres puntos con iconos.
  - /clases rediseñada: cabecera con imagen de fondo, filtros en píldora con acento lima, tarjetas con imagen según categoría, estado vacío con icono y botón para limpiar filtros.
  - /mis-reservas rediseñada: cabecera propia, imagen por categoría en cada tarjeta, franja de color en el borde izquierdo según estado (próxima en lima, ya pasada en gris, cancelada por el entrenador en rojo suave) y etiqueta de cuenta atrás ("faltan N días" / "es mañana" / "es hoy").
  - /cuenta rediseñada: cabecera con imagen desenfocada, saldo de Open destacado en tarjeta propia justo debajo de la cabecera, historial de movimientos con el nuevo estilo.
- Categorías de clase reducidas de seis a cuatro (Fuerza / funcional, Cardio, Yoga / Pilates / movilidad, Otros); los datos de las clases existentes se migraron manualmente en Supabase con UPDATE. El mapa de imagen por categoría vive en lib/imagenesCategoria.js, compartido entre /clases y /mis-reservas.
- Imágenes del proyecto en public/imagenes (portada, fuerza, running, yoga, combate, comunidad), descargadas de Pexels con licencia gratuita de uso comercial.
- Giro estratégico de mensajes: los textos ya no prometen exclusivamente entrenamiento al aire libre ni en grupo, de cara a abrirse en el futuro a gimnasios y a entrenamientos individuales o en pareja.
- Captación de entrenadores en la portada sin sesión: hero único sin dividir en dos columnas (se descartó por obligar a elegir bando sin contexto y restar impacto); sección propia añadida debajo de la franja de categorías, visualmente diferenciada con fondo verde muy oscuro, línea introductoria "¿Eres entrenador?" en lima, titular "Tú pones las reglas.", cuerpo, tres puntos de apoyo con iconos y botón a /registro, visible solo sin sesión iniciada. Enlace discreto "¿Eres entrenador?" añadido al menú de navegación (solo sin sesión), con scroll suave hasta esa sección (`scroll-behavior: smooth` en app/globals.css, respetando prefers-reduced-motion).
- Portada diferenciada con sesión iniciada: hero más corto (45vh en vez de 85vh) con saludo "Hola, [usuario]" y "¿Qué entrenas hoy?" en vez del mensaje de venta, manteniendo la rejilla de accesos con el mismo protagonismo; sin sesión el hero queda exactamente igual que antes.
- Rediseño de /publicar con la misma base visual del resto de la app: cabecera con imagen y degradado, campos agrupados en tarjetas con título (componente TituloBloque: icono + barra lima + texto en verde oscuro), textos de ayuda bajo los campos que lo necesitaban, y mensajes de éxito/error con icono.
- /mis-alumnos renombrada a /mis-clases (ruta, enlaces del menú y de la portada, y todos los textos visibles), y rediseñada con la misma base visual: cabecera propia, cada clase en su tarjeta con imagen según categoría, lista de alumnos con el estado de asistencia diferenciado visualmente, botón "Cancelar esta clase" separado del resto de acciones y en rojo discreto, y estado vacío con icono y botón a /publicar cuando el entrenador no tiene ninguna clase.
- Nueva función mis_clases() (sql/011_panel_entrenador_y_contador.sql): el entrenador ve todas sus clases en /mis-clases aunque todavía no tengan ninguna reserva (antes, al depender solo de reservas_de_mis_clases(), una clase recién publicada y sin apuntados no aparecía); reservas_de_mis_clases() se mantiene intacta y sigue siendo la única fuente de la lista de alumnos por clase.
- Corregido cancelar_clase() (mismo archivo): al cancelar una clase entera, ahora deja plazas_ocupadas a 0 en el mismo UPDATE que marca la clase como cancelada, evitando que el contador quedara desincronizado (antes se cancelaban las reservas pero el contador se quedaba congelado con el valor previo).
- Las plazas se muestran según quién mira, no según la página: ocupadas ("3/10 plazas ocupadas") para el entrenador, libres ("Quedan 7 plazas") para el cliente o sin sesión, mediante lib/formatoPlazas.js, aplicado en /clases, /clases/[id] y /mis-clases.
- Aviso de "pendiente de confirmación" (según plazas_min) añadido también en /mis-reservas (antes solo estaba en /clases y /clases/[id]) y en /mis-clases (con confirmación en verde "Mínimo alcanzado" cuando ya se llega al mínimo); la condición se extrajo a lib/confirmacionClase.js para no duplicarla en las cuatro páginas.
- Edición de clases publicadas: función RPC editar_clase() (sql/012_editar_clase.sql, corregida en sql/013_arreglo_suelo_plazas_min.sql para que el suelo de 1 en plazas_min no bloquee la edición de clases que se publicaron sin mínimo), página app/mis-clases/[id]/editar/page.js (carga la clase vía mis_clases(), mensaje claro si no se puede editar —no existe/no es tuya, está cancelada, ya ha pasado o falta menos de 2h—, formulario con los campos libremente editables y plazas_min/plazas_max con su restricción de dirección aplicada también en el cliente, resto de campos de solo lectura) y botón "Editar" en las tarjetas de /mis-clases, visible solo cuando la clase es editable.
- Portada adaptada al entrenador con sesión iniciada: debajo del hero, bloque con sus cifras (clases activas, reservas acumuladas y próxima clase) obtenidas de mis_clases(); si no tiene ninguna clase publicada, un estado vacío con llamada a publicar la primera en su lugar; los tres puntos con iconos pasan a sus mensajes ("Tu horario, tus normas", "Tú fijas el precio y las plazas", "Cobras directo, sin intermediarios"); la franja de categorías y la franja de comunidad (ambas dirigidas al cliente) se ocultan para el entrenador, sustituyendo la segunda por una llamada a publicar una clase nueva.
- Rediseño de la ficha de detalle de clase (/clases/[id]): cabecera con imagen según categoría y título destacado, información agrupada en bloques con jerarquía clara (fecha/hora/duración primero, precio destacado, plazas con aviso de confirmación, detalles, ubicación), botón de reservar fijo en la parte inferior de la pantalla en móvil, botón "Cómo llegar" que abre Google Maps con las coordenadas de la clase, y el botón de copiar coordenadas extraído a components/BotonCopiarCoordenadas.js, compartido con /clases para no duplicar el comportamiento.
- Rediseño de /login y /registro con la base visual del resto de la app y una cabecera de marca compartida entre ambas (logo Openfit y frase breve, sin imagen pesada), con enlace claro entre las dos páginas. Sin tocar el flujo de creación de cuenta, la asignación de rol ni el trigger de perfiles/username.
- Casilla obligatoria de mayoría de edad en /registro, justo antes de "Crear cuenta", con el texto "Declaro ser mayor de 18 años y acepto el aviso legal." ("aviso legal" enlazado a /aviso-legal, se abre en pestaña nueva sin perder lo escrito). El registro se bloquea si no está marcada; el dato no se guarda en Supabase, solo se impide el registro.
- Errores de Supabase traducidos al español en /login y /registro en lugar del texto crudo en inglés ("Invalid login credentials" -> "El correo o la contraseña no son correctos.", email ya registrado -> "Ya existe una cuenta con este correo.", resto -> mensaje genérico en español). Estado de carga ("Creando cuenta...") diferenciado visualmente del de error.
- Aviso legal actualizado (legal/aviso-legal.md y app/aviso-legal/page.js): ya no describe el servicio solo como "sesiones de entrenamiento al aire libre", coherente con la apertura futura a gimnasios y a entrenamientos individuales o en pareja.
- Etiqueta de asistencia en la lista de alumnos de /mis-clases: ahora solo aparece en clases ya pasadas y dice "Sin marcar" (antes se mostraba también en clases futuras y se confundía con el aviso de "pendiente de confirmación" de la clase).
- Clase de prueba "x" eliminada de la base de datos: primero un SQL de solo lectura para comprobar si tenía reservas (sql/014_comprobar_clase_x.sql), y después un borrado acotado por IDs exactos de la clase y su reserva, en una transacción (sql/015_borrar_clase_x.sql). Ambos versionados en el repo.
- Tabla public.clases versionada por fin en sql/016_tabla_clases.sql: definición reproducible (create table if not exists) con las 22 columnas y sus tipos/defaults reales, la PK, el CHECK de plazas_min, la FK a auth.users con on delete cascade, el enable row level security y las tres políticas RLS (crear solo entrenadores, editar las propias, ver activas o reservadas), reflejando el estado real en Supabase a 27 julio 2026. La función usuario_tiene_reserva_en_clase que usa la política ya estaba versionada en sql/010.
- Versión de Node fijada con "engines": "24.x" en package.json, alineada con la versión que usa Vercel.
- PWA: la web ya se puede añadir a la pantalla de inicio del móvil. Manifest generado por código en app/manifest.js (nombre, descripción, start_url, display standalone, colores de marca: fondo crema #FBFAF3 y theme lima #B5E600, iconos 192 y 512). export const viewport con themeColor lima en app/layout.js. Iconos openfit-icon-192.png y openfit-icon-512.png en public/ (pin de ubicación sobre una mancuerna, fondo lima).
- Botón de instalación de la PWA "Ten Openfit a mano" (components/BotonInstalarApp.js), insertado en la portada tras el hero y visible para todos los visitantes en móvil: en Android/Chrome lanza el diálogo nativo de instalación (evento beforeinstallprompt), en iPhone/Safari abre un panel con instrucciones para añadir a pantalla de inicio, y se oculta en ordenador o si la app ya está instalada. El margen vertical vive en el propio componente para no dejar hueco cuando no se muestra.
- Registro preparado para la confirmación de email (app/registro/page.js): signUp ahora captura data y, si no hay sesión (confirmación activada), muestra un mensaje de éxito pidiendo revisar la bandeja de entrada y la carpeta de spam en lugar de redirigir. Con la confirmación desactivada el comportamiento no cambia (sigue entrando directo). El código queda listo para cuando se active.
- Campo "modalidad" renombrado a "tipo_actividad" y cambiado de significado: antes era "presencial/online", ahora es texto libre para el tipo de actividad (zumba, boxeo, running...). Tocó código (publicar, editar, ficha de detalle y tarjetas usan tipo_actividad con la etiqueta "Tipo de actividad") y base de datos: sql/017 renombró la columna, sql/018 recreó editar_clase con el parámetro p_tipo_actividad (hizo falta DROP FUNCTION + CREATE porque Postgres no permite renombrar un parámetro con CREATE OR REPLACE, restaurando después el grant execute a authenticated), y sql/016 actualizado para reflejar la columna renombrada. CLAUDE.md también actualizado.
- Flujo completo probado de punta a punta en producción (registro como entrenador y como cliente, publicar clase, buscar y filtrar, reservar, cancelar) antes de repartir la beta.
- Retirada la frase "al aire libre" del subtítulo de /clases (coherente con el giro de mensajes hacia gimnasios e individual/pareja).
- Portada de entrenador: el tercer punto "Cobras directo, sin intermediarios" cambiado a "Cobros y reservas automáticos" (el anterior dejaría de ser cierto al introducir comisión con Stripe).
- /clases: las clases cuya fecha+hora de inicio ya pasó dejan de mostrarse en el listado y el mapa. Antes el filtro comparaba solo la fecha (no la hora) y no usaba zona horaria de Madrid; ahora usa claseYaPaso() de lib/. Las clases no se borran, solo se ocultan.
- /mis-reservas rediseñada: reservas próximas arriba (en color), historial de pasadas abajo (en gris atenuado) bajo el título "Historial", y bloque de canceladas por el entrenador movido justo debajo de las próximas y recoloreado en rojo suave. Las canceladas se ocultan pasada 1h de su hora de inicio (horasHastaClase). Eliminadas copias locales duplicadas de claseYaPaso.
- /mis-clases (entrenador): mismo tratamiento de historial (próximas arriba, pasadas abajo atenuadas bajo "Historial"). La tarjeta se extrajo a renderTarjeta(clase, indice, atenuada); la gestión de asistencia sigue funcionando en las clases pasadas del historial.
- Se muestra el username del entrenador de cada clase en /clases, en la ficha de detalle /clases/[id] y en /mis-reservas (incluido el bloque de canceladas, que ahora dice "Cancelada por el entrenador @username"). En negrita y verde de marca sobre fondo claro, adaptado al tono del contexto en historial y canceladas. Requirió sql/019: una FK clases.trainer_id -> perfiles.id para habilitar el embed perfiles(username) de Supabase, y ampliar la política RLS de perfiles a lectura pública (to public) porque /clases es pública y el username no es dato sensible. sql/019 ya ejecutado en Supabase.
- Botón de instalar la PWA: las instrucciones para iPhone del panel de iOS ahora cubren tanto el flujo antiguo (botón Compartir directo) como el nuevo de iOS reciente (tres puntos, Compartir, Ver más, Añadir). Verificado en un iPhone reciente: se leen bien y la lista <ol> no duplica el número de cada paso.
- Etiqueta visual "Dirección" cambiada a "Zona" en toda la interfaz de clases (formulario de /publicar, con placeholder de ejemplo "Ej: Nervión, o C/ Larios"; ficha de detalle con prefijo "Zona:"; listado /clases; /mis-reservas; edición de clase). Solo cambió el texto visible: la columna de la base de datos y el nombre del campo/estado en el código siguen llamándose "direccion".
- Mejoras en el mapa de clases (components/MapaClases.js):
  - Botón "Ver detalles" dentro del popup de cada clase, enlazando a la ficha /clases/[id], para no tener que buscar la clase en el listado tras localizarla en el mapa.
  - Marcadores diferenciados por categoría con forma + color en vez del pin azul único: círculo amarillo #F2C037 (Fuerza / funcional), triángulo rojo #E5533D (Cardio), cuadrado azul #3D8BFF (Yoga / Pilates / movilidad), rombo morado #9B5DE5 (Otros), círculo gris #9AA0A6 por defecto. Cada marcador es un L.divIcon con SVG y un pico inferior que señala la ubicación exacta (icono anclado en la punta). Se usan formas además de colores para no depender solo del color (accesible para daltonismo).
  - Leyenda discreta debajo del mapa con cada forma+color junto a su categoría.

Nota (decisión de producto): un usuario tiene un único rol (cliente o entrenador), guardado en user_metadata.rol al registrarse. Si un entrenador quiere reservar clases, hoy tiene que crearse otra cuenta como cliente; no se implementa doble rol por ahora. Se preguntará en la beta si merece la pena permitirlo.

Nota (hallazgo técnico): la tabla public.clases y sus políticas RLS iniciales (SELECT, INSERT) no están versionadas en ningún archivo de sql/ — se crearon directamente en el editor de Supabase antes de empezar a versionar el SQL del proyecto. Las funciones que escriben sobre clases (editar_clase(), cancelar_clase(), etc.) usan SECURITY DEFINER precisamente para no depender de si existe o no una política de UPDATE sobre esa tabla, que no queda documentada aquí.

Beta lanzada (en curso):
- Beta repartida a ~30 personas del círculo cercano (~6 entrenadores, resto clientes), sin confirmación de email, con mensajes de WhatsApp distintos por rol. La app corre en producción (Vercel + Supabase); la gente la está usando durante una semana como si fuera real.
- Recogiendo errores y sugerencias (estéticas y de funcionalidad) para ir corrigiendo. IMPORTANTE: al haber gente usando la app en vivo, extremar el cuidado con lo que se sube a main.

## Perfil público de entrenador (durante la beta)
Hecho:
- Base de datos: columnas descripcion (text, máx. 300 caracteres vía CHECK) y foto_url (text) añadidas a public.perfiles (sql/020_perfiles_descripcion_foto.sql, ya ejecutado en Supabase).
- Storage: bucket público "avatares" creado en Supabase Storage, con políticas RLS (lectura pública; subir/actualizar/borrar solo el propio archivo, en la ruta {user_id}/avatar.jpg) (sql/021_storage_avatares_politicas.sql, ya ejecutado).
- /cuenta: los entrenadores (rol === 'entrenador') pueden editar su descripción (textarea con contador X/300) y subir su foto de perfil, guardando ambas con un único botón "Guardar perfil". La foto se comprime en el propio navegador antes de subir (canvas, máx. 800px en el lado mayor, JPEG calidad 0.8, sin librerías externas), se sube a avatares/{user.id}/avatar.jpg con upsert, y se guarda la URL pública con un parámetro de versión para evitar problemas de caché del navegador.
- /cuenta reorganizada: para entrenadores, un único bloque "Perfil del entrenador" arriba del todo fusiona foto + descripción + correo + nombre de usuario + cambiar nombre de usuario (este último mantiene su propio botón y su lógica intactos); para clientes se mantiene el bloque de correo + username como estaba. El contenido de correo/username se extrajo a un fragmento JSX reutilizable para no duplicarlo entre ambos casos.
- El avatar circular de la cabecera de /cuenta muestra ahora la foto de perfil si existe, con la inicial como reserva si no la hay.
- Página pública nueva app/entrenador/[username]/page.js, accesible sin sesión iniciada: busca el perfil por username (insensible a mayúsculas) y muestra foto (o inicial), @username, descripción y número de clases activas (trainer_id + estado 'activa', descartando las ya pasadas con claseYaPaso()). Si el perfil no tiene ni foto ni descripción, muestra "Este entrenador aún no ha completado su perfil."; si el username no existe, pantalla de "Entrenador no encontrado" con enlace de vuelta a /clases. Incluye un hueco {/* TODO: valoraciones */} preparado para el futuro.
- El @username del entrenador es ahora un enlace a su perfil público en /clases, en la ficha /clases/[id] y en las tres tarjetas de /mis-reservas (próximas, canceladas e historial).

Falta:
- Sistema de valoraciones del entrenador (diseño ya decidido, sin implementar): 1 a 5 estrellas; solo puede valorar un cliente que haya entrenado con ese entrenador (reservas.asistencia = 'asistio'); un cliente solo puede valorar una vez a cada entrenador, pero puede editar su valoración; opinión escrita corta opcional (~100 caracteres) visible en el perfil público. Irá en el hueco TODO ya preparado en app/entrenador/[username]/page.js.

Otros pendientes menores (sin prioridad asignada):
- Pulido fino según el feedback de la beta.
- Cambiar lang="en" por lang="es" en app/layout.js (toda la interfaz es en español).
- Subir la longitud mínima de contraseña de 6 a 8 caracteres en Supabase (recomendado para producción).
- Historial de /mis-reservas y /mis-clases: cuando haya volumen, mostrar solo el último mes de clases pasadas y sustituir las más antiguas por un contador tipo "X clases realizadas", para no cargar de más la página. Aplazado hasta que haya datos suficientes en la beta.
- 3 vulnerabilidades "high" que reporta npm audit en next/postcss/sharp, preexistentes (anteriores a esta sesión, no las trajo react-leaflet-cluster); `npm audit fix --force` propone subir Next fuera del rango declarado en package.json y podría romper cosas, así que no se toca con la beta en vivo. Pendiente revisarlo con calma, sin --force.

## Mapa de clases: clustering y ubicación del cliente (durante la beta)
Hecho:
- Clustering de marcadores (components/MapaClases.js): instalada la librería react-leaflet-cluster (v4.1.3, compatible con React 19 y react-leaflet 5; instalación limpia, sin --force ni --legacy-peer-deps), con sus dos CSS importados manualmente (MarkerCluster.css y MarkerCluster.Default.css). Los marcadores de clases cercanas se agrupan en una burbuja al alejar el zoom y se separan al acercar; burbuja verde oscuro #3D4A00 con el número en blanco, mediante icono personalizado vía iconCreateFunction.
- Ubicación del cliente en el mapa (components/MapaClases.js): botón "Ver mi ubicación" (control flotante sobre el mapa) que usa la Geolocation API del navegador (getCurrentPosition, una sola lectura) para centrar el mapa en la posición del cliente (zoom 14). Marcador de punto azul estilo Google Maps (#1A73E8) con halo translúcido y borde blanco, colocado fuera del grupo de clustering (no se agrupa con las clases) y con zIndexOffset alto para quedar siempre por encima de los marcadores de clase. Si el permiso se deniega, falla la geolocalización o el navegador no la soporta, se muestra un aviso discreto y el mapa sigue funcionando sin el marcador de usuario.

## Correcciones varias (1 agosto 2026)
Hecho:
- Fix del zoom automático de Safari en iPhone al enfocar campos de formulario: regla en app/globals.css que fija font-size 16px en input/select/textarea solo en móvil (@media max-width: 640px), sin tocar el tamaño en escritorio.
- Descripción del entrenador ampliada de 300 caracteres a 300 palabras: contador de palabras y validación al guardar en /cuenta (no deja guardar si se superan las 300 palabras), y CHECK de la base de datos ampliado de 300 a 3000 caracteres como red de seguridad, no como límite real (sql/022_ampliar_limite_descripcion.sql, ya ejecutado en Supabase).

## Después de la beta (decidido el 27 julio 2026)
- Confirmación de email en Supabase: reactivarla cuando se abra a usuarios que no sean del círculo cercano. El código del registro ya está preparado. Requiere resolver antes el envío de correos (ver siguiente punto).
- Envío de correos con SMTP propio: el servidor compartido de Supabase no sirve para producción (2-3 correos/hora, cae en spam). Se usará Resend. IMPORTANTE (comprobado el 27 julio 2026): Resend sin un dominio propio verificado solo permite enviar correos a la propia dirección de la cuenta, no a terceros; por tanto Resend exige tener dominio propio.
- Dominio propio (p. ej. openfit.es): da una URL de marca en vez de openfit-five.vercel.app y es requisito para el SMTP propio con Resend. Comprarlo y configurarlo en Vercel y en Resend.
- Traducir al español la plantilla del email de confirmación en Supabase: el botón de editar el HTML (Source) está deshabilitado en el plan actual y pide configurar SMTP propio, así que depende de tener Resend con dominio propio.
- Aviso en /login para usuarios que intenten entrar sin haber confirmado el correo: cuando se active la confirmación, Supabase devuelve un error distinto en ese caso; conviene mostrar un mensaje claro tipo "confirma tu correo antes de entrar".
- Login con Google (OAuth): se valoró para la beta pero se pospone por ser un montaje aparte (Google Cloud Console, credenciales, pantalla de consentimiento). Ventaja: quien entra con Google no necesita confirmar el email.
- 2FA activado el 27 julio 2026 en las tres cuentas críticas del proyecto (Vercel, GitHub y Google), con app de autenticación y códigos de recuperación guardados.

## Fase 6 · Pagos reales con Stripe — futuro, fuera del MVP
- Sustituir la cartera simulada por pagos reales. Posterior al lanzamiento.

## Análisis de competencia (21 julio 2026)

Competidor directo detectado: Trainity (trainityapp.com), lanzado en julio de 2026. Misma propuesta que Openfit: entrenamientos en grupo al aire libre en Sevilla, sin cuotas mensuales, precios desde 3 €.

Sus ventajas sobre Openfit:
- Pagos reales con Stripe (tarjeta, Apple Pay, Google Pay). Cobran al cliente, abonan al entrenador y se quedan una comisión de intermediación.
- Documentación legal completa: aviso legal, condiciones de contratación, condiciones para entrenadores, privacidad, cookies, consentimiento informado de riesgo, titular identificado con NIF.
- SEO trabajado, con páginas específicas por búsqueda (entrenador personal en Sevilla, entrenamiento al aire libre, funcional, en grupo, para perder peso).
- Sistema de valoraciones y reseñas, limitado a quienes reservaron por la plataforma.
- Reserva sin registro: solo nombre, email y teléfono.
- Sección de perfiles de entrenador.

Sus debilidades frente a Openfit:
- No tienen panel de entrenador: el alta se hace por un formulario externo de Google, y el entrenador no puede publicar ni gestionar sus sesiones.
- La cancelación es manual (formulario o email), no automática.
- Sin cuentas de usuario, por lo que el cliente no tiene historial ni "mis reservas".
- Solo operan en Sevilla.
- Sin sistema de fidelización.
- Cancelación más rígida: 24 h de antelación frente a las 2 h de Openfit.

Conclusiones para la hoja de ruta:
- La ventaja diferencial de Openfit es el panel del entrenador (publicar, ver alumnos, marcar asistencia, cancelar clase). Conviene reforzarla para captar entrenadores.
- Subir la prioridad de los pagos reales (Fase 6): dejan de ser un extra posterior al lanzamiento para ser la diferencia entre producto y demostración.
- Valorar añadir a la hoja de ruta perfiles públicos de entrenador y valoraciones tras la clase. No dependen de Stripe y son clave para la confianza en un marketplace.
- Antes de cobrar dinero habrá que preparar la documentación legal correspondiente, con asesoramiento profesional.
