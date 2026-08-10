# Openfit — Progreso del proyecto

Última actualización: 10 agosto 2026

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

Nota (decisión de producto, 4 agosto 2026): se mantiene el marcado manual de asistencia (asistio/no_asistio) por el entrenador tal como está, a propósito; descartado implementar el marcado automático a las 24h que figuraba antes en pendientes. El marcado manual crea un incentivo cruzado sano: el entrenador marca "asistio" para que el cliente pueda valorarlo, y el cliente le presiona para que lo haga.

Nota (hallazgo técnico, resuelto el 2 agosto 2026): se creía que la tabla public.clases y sus políticas RLS no estaban versionadas en sql/, pero sí lo estaban: sql/016_tabla_clases.sql (tabla, RLS y las tres políticas), sql/019 (FK adicional a perfiles) y sql/010 (función usuario_tiene_reserva_en_clase, usada por la política de SELECT). Verificado el 2 agosto 2026 contra la definición real en Supabase, sin diferencias.

Nota (decisión de marca pendiente, 7 agosto 2026): el nombre "Openfit" hay que cambiarlo sí o sí, ya que es una marca ya registrada por otra empresa del sector fitness (fitness/apps), con riesgo legal si el proyecto crece; openfit.com y openfit.es están cogidos. Candidato actual guardado: "Ruleafit", comprobado libre de dominio (.com) y sin marca previa aparente, pendiente de confirmar como decisión firme. En pruebas de dictado por voz sin contexto, el final "-fit" se falla a veces (se oye como -fic/-cit/-pick), aunque con contexto de app de deporte se acierta mejor; si se confirma el nombre, conviene comprar también ruleafic.com como red de seguridad. Cuando el nombre esté decidido al 100%, cambiar "Openfit" por el nuevo en: cabecera (menú superior), pie de página, página de inicio y el nombre del acceso directo/PWA en móvil (manifest), además de revisar textos legales, correo y metadata donde aparezca. De momento se mantiene "Openfit" en toda la app; no se cambia nada todavía.

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
- Ninguno.

Otros pendientes menores (sin prioridad asignada):
- Pulido fino según el feedback de la beta.
- Historial de /mis-reservas y /mis-clases: cuando haya volumen, mostrar solo el último mes de clases pasadas y sustituir las más antiguas por un contador tipo "X clases realizadas", para no cargar de más la página. Aplazado hasta que haya datos suficientes en la beta.
- Doble rol cliente + entrenador (ver nota en Fase 5): aplazado hasta que el modelo de negocio esté más consolidado.
- Notificaciones push web: bloque completo (motor, eventos directos, recordatorios programados, preferencias y centro de notificaciones), ver "Notificaciones push (Bloque B + C + sub-bloque 7: completo)".

## Mapa de clases: clustering y ubicación del cliente (durante la beta)
Hecho:
- Clustering de marcadores (components/MapaClases.js): instalada la librería react-leaflet-cluster (v4.1.3, compatible con React 19 y react-leaflet 5; instalación limpia, sin --force ni --legacy-peer-deps), con sus dos CSS importados manualmente (MarkerCluster.css y MarkerCluster.Default.css). Los marcadores de clases cercanas se agrupan en una burbuja al alejar el zoom y se separan al acercar; burbuja verde oscuro #3D4A00 con el número en blanco, mediante icono personalizado vía iconCreateFunction.
- Ubicación del cliente en el mapa (components/MapaClases.js): botón "Ver mi ubicación" (control flotante sobre el mapa) que usa la Geolocation API del navegador (getCurrentPosition, una sola lectura) para centrar el mapa en la posición del cliente (zoom 14). Marcador de punto azul estilo Google Maps (#1A73E8) con halo translúcido y borde blanco, colocado fuera del grupo de clustering (no se agrupa con las clases) y con zIndexOffset alto para quedar siempre por encima de los marcadores de clase. Si el permiso se deniega, falla la geolocalización o el navegador no la soporta, se muestra un aviso discreto y el mapa sigue funcionando sin el marcador de usuario.

## Correcciones varias (1 agosto 2026)
Hecho:
- Fix del zoom automático de Safari en iPhone al enfocar campos de formulario: regla en app/globals.css que fija font-size 16px en input/select/textarea solo en móvil (@media max-width: 640px), sin tocar el tamaño en escritorio.
- Descripción del entrenador ampliada de 300 caracteres a 300 palabras: contador de palabras y validación al guardar en /cuenta (no deja guardar si se superan las 300 palabras), y CHECK de la base de datos ampliado de 300 a 3000 caracteres como red de seguridad, no como límite real (sql/022_ampliar_limite_descripcion.sql, ya ejecutado en Supabase).

## Contador de clases realizadas (2 agosto 2026)
Hecho:
- /mis-clases: en clases ya pasadas sin ninguna reserva, ya no aparece el mensaje "Todavía no se ha apuntado nadie. En cuanto alguien reserve, lo verás aquí." (pensado para clases futuras); ahora muestra "Esta clase no tuvo reservas.", solo cuando claseYaPaso() confirma que la clase ya pasó. En clases futuras sin reservas el mensaje original se mantiene igual.
- Contador de "clases realizadas" para ambos roles, sin RPCs ni consultas nuevas donde ya había datos cargados:
  - /mis-reservas (cliente): texto discreto junto al título "Historial" con el número de reservas cuya asistencia = 'asistio', derivado de los datos ya cargados (se amplió el select de reservas para incluir la columna asistencia).
  - /mis-clases (entrenador): mismo texto discreto junto a "Historial", contando las clases ya pasadas (claseYaPaso()) que no están canceladas, derivado de clasesConAlumnos ya cargado.
  - /cuenta: tarjeta destacada "Clases realizadas" junto a "Open acumulados", mismo estilo (icono en círculo, número grande, etiqueta). Aquí sí hizo falta una consulta nueva por rol, ya que /cuenta no cargaba ni clases ni reservas: para clientes, cuenta de reservas con asistencia = 'asistio'; para entrenadores, clases propias no canceladas filtradas por claseYaPaso(). En los tres sitios se usa el valor real guardado en base de datos, 'asistio' sin tilde (columna reservas.asistencia, ver sql/006_open_fidelizacion.sql).

## Feedback de usuarios y valoraciones de entrenadores (2 agosto 2026)
Hecho:
- Feedback de usuarios ("Ayuda"): nueva tabla public.feedback en Supabase (id, user_id, mensaje, created_at; CHECK de mensaje entre 1 y 5000 caracteres y no vacío; RLS con política de INSERT solo del propio usuario autenticado, auth.uid() = user_id, y sin política de SELECT para usuarios normales, ya que el feedback se revisa desde el panel de Supabase con la service role, que se salta RLS). Nueva página /ayuda con formulario (solo para usuarios con sesión iniciada; sin sesión, mensaje pidiendo iniciar sesión) que guarda el mensaje con un insert; textarea con contador y límite de 5000 caracteres (coherente con el CHECK de la base de datos, ampliado desde 1000 iniciales). Enlace "Ayuda" añadido al footer (components/PieDePagina.js). SQL versionado en sql/023_tabla_feedback.sql y sql/024_ampliar_limite_feedback.sql, ambos ya ejecutados en Supabase. Pendiente para más adelante (dominio ya resuelto — desbloqueado, listo para abordar; sigue dependiendo del SMTP con Resend, ver sección "Después de la beta"): aviso por correo al recibir un mensaje de feedback (trigger), con asunto tipo "AYUDA USUARIO".
- Valoraciones de entrenadores: nueva tabla public.valoraciones (cliente_id y entrenador_id referencian perfiles.id; estrellas de 1 a 5; opinion opcional, hasta 750 caracteres en base de datos como red de seguridad y 100 palabras como límite real controlado en frontend; UNIQUE(cliente_id, entrenador_id) para una única valoración por par, editable). RLS: SELECT público (nota media y opiniones visibles sin sesión); INSERT/UPDATE solo del propio cliente y solo si ha asistido a alguna clase del entrenador valorado (EXISTS sobre reservas + clases con asistencia = 'asistio'); sin política de DELETE. SQL en sql/025_tabla_valoraciones.sql, ya ejecutado en Supabase.
  - Perfil público del entrenador (app/entrenador/[username]/page.js): nota media + número de valoraciones + botón "Ver opiniones", visibles para cualquiera (visitantes sin sesión, clientes y el propio entrenador viendo su perfil). Formulario para valorar (1 a 5 estrellas clicables + opinión opcional con contador de palabras) solo para clientes que han asistido a una clase del entrenador; si el cliente ya tiene una valoración, el formulario carga sus valores y funciona en modo edición (upsert con onConflict cliente_id+entrenador_id); mensaje discreto para clientes que aún no cumplen el requisito de asistencia. Título de la sección de descripción cambiado de "Sobre mí" a "Sobre @username", para que tenga sentido visto desde fuera.
  - Página nueva app/entrenador/[username]/opiniones/page.js: lista pública de las opiniones escritas del entrenador (se excluyen las valoraciones sin texto), ordenadas de más reciente a más antigua, mostrando solo estrellas + texto + fecha, sin ningún dato del cliente autor (anónimas por diseño de la consulta, sin ningún embed a perfiles del cliente).
  - /cuenta: el entrenador ve también su nota media + número de valoraciones + botón "Ver opiniones", en una tarjeta junto a las de Open acumulados/Clases realizadas, para consultar su feedback sin tener que buscar su propio perfil público. No se muestra nada de esto a los clientes.
- Longitud mínima de contraseña subida de 6 a 8 caracteres en la configuración de Supabase (Authentication -> Email). Cambio de configuración, no de código; afecta solo a registros y cambios de contraseña nuevos, no a las contraseñas ya existentes.

Falta:
- Ninguno.

## Fix de contador y confirmación al cerrar sesión (4 agosto 2026)
Hecho:
- Fix del contador "Clases activas" en la portada del entrenador (app/page.js): antes contaba también clases ya pasadas (solo filtraba por estado = 'activa'), así que en la práctica se acercaba al total de clases publicadas. Ahora se calcula con una variable nueva, clasesActivasAhora, que filtra por estado activo Y no pasada (claseYaPaso), sin afectar al contador "Reservas acumuladas" (sigue usando la variable original).
- Confirmación al cerrar sesión: al pulsar "Cerrar sesión" aparece un window.confirm ("¿Estás seguro de que quieres cerrar sesión?"), mismo patrón ya usado para cancelar clase/reserva. Aplicado en el menú de navegación (components/Menu.js) y en /cuenta. Además se quitó el botón "Cerrar sesión" redundante de la portada (app/page.js), ya que el del menú aparece en todas las páginas con sesión iniciada.

Falta:
- Ninguno.

## Terminología "clase/clases" a "sesión/sesiones" en la interfaz (4 agosto 2026)
Hecho:
- Texto visible de toda la interfaz (menús, portada, /clases, /clases/[id], /mis-clases, /mis-clases/[id]/editar, /mis-reservas, /publicar, /login, perfil público del entrenador y sus opiniones, metadata del manifest PWA y aviso de privacidad) cambiado de "clase/clases" a "sesión/sesiones", sin tocar la tabla clases, las funciones RPC, las rutas, los nombres de archivo/carpeta ni las variables (16 archivos de frontend). aviso-legal quedó sin tocar por ya usar "sesión/sesiones".
- Descripción del motivo de Open asistencia_confirmada actualizada a la misma terminología (sql/027_texto_motivo_asistencia_sesion.sql, ya ejecutado en Supabase); el historial de Open de asistencias ya concedidas muestra ahora el texto nuevo, ya que se lee la descripción actual del motivo.

Falta:
- Ninguno.

## Seguir entrenadores y buscador de entrenadores (5 agosto 2026)
Hecho:
- Tabla public.seguimientos (sql/028_seguimientos.sql, ya ejecutado en Supabase): registra qué cliente sigue a qué entrenador (seguidor_id, entrenador_id, ambos referencian auth.users(id)), con UNIQUE(seguidor_id, entrenador_id) para evitar duplicados y CHECK(seguidor_id <> entrenador_id) para impedir el autoseguimiento. RLS: lectura pública; INSERT y DELETE solo sobre las propias filas (auth.uid() = seguidor_id); sin política de UPDATE (un seguimiento se crea o se borra, no se edita). Igual que en valoraciones, el rol (quién puede seguir y a quién se puede seguir) no se valida en la base de datos sino en el frontend, ya que perfiles no guarda el rol.
- Botón Seguir/Siguiendo (components/BotonSeguir.js) en el perfil público del entrenador (app/entrenador/[username]/page.js), con los mismos estados que el resto de la app: sin sesión, enlace a /login; el propio entrenador viendo su perfil, oculto; cliente, botón funcional que alterna entre "Seguir" (lima) y "Siguiendo" (borde), insertando/borrando filas en seguimientos.
- Contador PRIVADO de seguidores en /cuenta, visible solo para el entrenador: función RPC contar_mis_seguidores() (sql/029_contar_seguidores.sql, security definer, cuenta solo los propios vía auth.uid()), mostrado en una tarjeta junto a las de Open acumulados/Clases realizadas/Valoraciones. Decisión de producto: el número de seguidores NO se muestra en el perfil público, a propósito, para no penalizar a los entrenadores nuevos con un efecto "los que ya tienen tirón crecen más" desde el principio.
- Buscador de entrenadores para clientes (app/entrenadores/page.js), accesible solo con sesión de cliente iniciada (sin sesión invita a iniciar sesión; con sesión de entrenador, mensaje "Esta sección es para clientes."): función RPC listar_entrenadores() (sql/030_listar_entrenadores.sql, security definer, filtra por el rol real en auth.users.raw_user_meta_data, no por tener clases publicadas) devuelve id/username/descripcion/foto_url de cada entrenador; búsqueda por username en el propio cliente, sin volver a llamar a Supabase al escribir; tarjetas con foto o inicial, enlazando al perfil público (/entrenador/[username]). Enlace "Entrenadores" añadido al menú de navegación, visible solo para clientes logueados.

Falta:
- Ninguno.

## Navegación móvil responsive y acceso a Entrenadores desde el inicio (5 agosto 2026)
Hecho:
- Menú de navegación (components/Menu.js) convertido en responsive: en móvil, botón tipo pastilla lima con icono + texto ("Menú"/"Cerrar" según esté cerrado o abierto) que despliega un panel a pantalla completa con todos los enlaces en columna y buen tamaño de toque; en escritorio (md y superior) el menú queda exactamente igual que antes, sin ningún cambio visual. La lista de enlaces se calcula una única vez a partir de usuario/rol y se reutiliza en ambas versiones, para no duplicar la lógica de roles; el resaltado de página activa (subrayado animado) en escritorio no se tocó.
- Tarjeta de acceso "Entrenadores" añadida a la portada (app/page.js) para el cliente con sesión iniciada, junto a las de Sesiones/Mis reservas/Mi cuenta, enlazando a /entrenadores.

Falta:
- Ninguno.

## Buscador de direcciones en los mapas y ajustes de navegación (6 agosto 2026)
Hecho:
- Buscador de direcciones con autocompletado en los mapas de /publicar y /clases: geocodificación con Nominatim de OpenStreetMap (lib/geocodificar.js), sin coste y sin API key, limitada a España (countrycodes=es); salvaguardas para no abusar del servicio público: mínimo de 4 caracteres antes de llamar, debounce de 400ms, y caché en memoria por texto de búsqueda. Componente reutilizable components/BuscadorDireccion.js: desplegable de hasta 5 sugerencias, marco lima permanente, placeholder corto "Buscar calle o lugar" (pensado para que no se corte en pantallas de móvil). Nota técnica: no requiere nada en Supabase, la geocodificación la resuelve el propio navegador contra la API pública de Nominatim. Nota de escalado: la instancia pública de Nominatim es suficiente para la beta y bastante más volumen; si algún día el uso creciera mucho, se migraría a una instancia self-hosted o a un proveedor de pago (Mapbox, Google), cambio acotado a lib/geocodificar.js.
- En /publicar (components/MapaSelector.js): al buscar una calle aparece un marcador CORAL de referencia (icono propio, lib/iconoBusqueda.js) con letrero "Esta es la ubicación que buscaste" al pincharlo; el pin AZUL de la sesión (el que de verdad se guarda) sigue fijándose solo al pinchar el punto exacto en el mapa. Decisión de producto: separar a propósito "la calle que busqué" (mera referencia visual) del "punto exacto de la sesión" (lo que se guarda en clases.lat/lng), para no dar por hecho que el centro aproximado de una calle es el punto de encuentro real.
- En /clases (components/MapaClases.js): el buscador solo centra el mapa (no filtra ni toca la lista de sesiones ni la consulta a Supabase), con el mismo marcador coral de referencia; el buscador y el botón "Ver mi ubicación" se sacaron de encima del mapa (antes superpuestos con position:absolute, tapaban a veces el letrero de una sesión) a una barra en flujo normal encima del recuadro del mapa, igual que en /publicar; esto permitió quitar el autoPan forzado que se había añadido como parche (el letrero de una sesión ya no aparece y desaparece).
- Textos de navegación adaptados al rol: el acceso a /clases (menú de escritorio, menú hamburguesa de móvil y tarjeta de acceso de la portada) muestra "Descubre sesiones" sin sesión iniciada, "Busca tu sesión" para clientes y "Sesiones publicadas" para entrenadores, en vez del genérico "Sesiones" de antes.
- Corregido el z-index del mapa en móvil: al hacer scroll, el mapa (o sus controles/overlays) podían pintarse por encima de la barra de navegación superior, tapándola. Arreglado con isolate (aísla el contexto de apilamiento de cada mapa) en components/MapaClases.js y components/MapaSelector.js, y subiendo el z-index del <nav> sticky (components/Menu.js) de z-50 a z-[2000] como refuerzo.

Falta:
- Ninguno.

## Botón de limpiar en el buscador de direcciones (7 agosto 2026)
Hecho:
- Botón "X" en components/BuscadorDireccion.js para vaciar el texto de golpe (antes había que borrar letra a letra), visible solo cuando hay texto escrito; también se activa el mismo efecto de limpieza si el usuario borra el texto a mano hasta dejarlo vacío. Nueva prop onLimpiar, usada en los dos mapas (components/MapaSelector.js en /publicar y components/MapaClases.js en /clases) para apagar a la vez el marcador coral de referencia. En /publicar esto además libera el punto donde estaba el coral, permitiendo fijar ahí mismo el pin azul de la sesión.

Falta:
- Ninguno.

## Actualización de Next a 16.3.0 (7 agosto 2026)
Hecho:
- Subida de Next de 16.2.10 a 16.3.0 (salto de versión menor, no breaking), que cierra las 3 vulnerabilidades "high" que reportaba npm audit en next/postcss/sharp (arrastraban desde antes, no las trajo react-leaflet-cluster); npm audit queda en 0 vulnerabilidades. Probado en local tras la subida (build y funcionamiento igual que antes).

Falta:
- Ninguno.

## Autocancelación de sesiones sin mínimo (8 agosto 2026)
Hecho:
- Las sesiones con plazas_min > 0 que no alcanzan el mínimo se cancelan solas, automáticamente, cuando faltan ~1h50 para su inicio (comprobación cada 5 minutos vía cron, así que el margen real es esa ventana de 5 min alrededor de las 1h50).
- Nueva columna clases.motivo_cancelacion ('entrenador' | 'minimo') para distinguir quién canceló la clase. SQL 031, ya ejecutado en Supabase.
- Barrera real de 2h en cancelar_reserva(): el cliente ya no puede cancelar su reserva si faltan menos de 2h para el inicio (antes el límite de 2h solo calculaba el flag informativo reembolso_aplicable, sin impedir cancelar). SQL 032, ya ejecutado en Supabase.
- Función autocancelar_clases_sin_minimo() que hace la cancelación en bloque (clase + sus reservas activas), marcando motivo_cancelacion = 'minimo' y sin marcar cancelada_por_entrenador (esta cancelación no la decide el entrenador). SQL 033, ya ejecutado en Supabase.
- Cron de pg_cron 'autocancelar-clases', cada 5 minutos, que ejecuta la función anterior. SQL 034, ya ejecutado en Supabase, con la extensión pg_cron activada.
- Probado: validado a mano (canceladas 2 sesiones de prueba) y con el cron real en producción (canceló una sesión de prueba sola a los 5 minutos, sin intervención manual).

## Notificaciones push (Bloque B + C + sub-bloque 7: completo) (9 agosto 2026)
Hecho:
- Motor de notificaciones push completo y probado en producción, incluida una prueba real en iPhone.
- Piezas: claves VAPID generadas (pública en NEXT_PUBLIC_VAPID_PUBLIC_KEY, privada en VAPID_PRIVATE_KEY), service worker (public/sw.js, registrado desde components/RegistrarServiceWorker.js montado en app/layout.js), toggle de suscripción en /cuenta (components/NotificacionesToggle.js), tabla public.push_subscriptions (sql/035, RLS: cada usuario solo ve/crea/borra las suyas) y tabla public.notificaciones_cola (sql/036, cola sin políticas RLS: solo la escriben funciones SECURITY DEFINER y el backend con service role). Backend de envío: lib/enviarPush.js (usa la librería web-push) y cliente admin lib/supabaseAdmin.js (service role key, solo servidor), expuestos a través de la API app/api/procesar-notificaciones/route.js (POST protegido con el secreto CRON_SECRET vía cabecera Authorization).
- Eventos directos ya enganchados a la cola: publicar una sesión nueva avisa a los seguidores del entrenador (trigger notificar_publicacion_clase(), sql/037); cancelar una clase (manual del entrenador o automática por no alcanzar el mínimo) avisa a cada cliente con reserva activa, y la autocancelación por mínimo avisa además al propio entrenador (sql/038); una reserva que agota las plazas de una sesión avisa al entrenador (sql/039).
- Despliegue: variables NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY y CRON_SECRET configuradas en Vercel; extensión pg_net instalada en Supabase; cron de producción (pg_cron + pg_net) que llama cada minuto a /api/procesar-notificaciones (sql/040, documentado en el repo con el secreto en placeholder, valor real solo en Supabase/Vercel).
- Bloque C (recordatorios programados), completo y en producción: tabla recordatorios_enviados con unique(clase_id, usuario_id, tipo) para deduplicar (sql/041); función procesar_recordatorios() que escanea sesiones activas y encola recordatorios en 6 bandas (cliente 24h/7h/2h + entrenador 24h/7h/2h), dedupe vía on conflict, y la banda de 2h solo aplica si ya se alcanzó plazas_min (sql/042); cron pg_cron 'procesar-recordatorios' cada 5 minutos (sql/043, jobid 3). Validado en producción: llegó el recordatorio de 24h a cliente y entrenador, y el dedupe quedó confirmado (count 1 tras varios escaneos del cron sobre la misma sesión).
- Sub-bloque 7 (preferencias + centro de notificaciones), completo y en producción: dos tablas nuevas con RLS —notificaciones_historial (registro de TODAS las notificaciones generadas, con flag leido) y preferencias_notificaciones (opt-out por categoría)— (sql/044); función helper generar_notificacion() que escribe SIEMPRE en el historial y encola push solo si la preferencia de la categoría del tipo está activa (las categorías críticas —cancelaciones— siempre se envían), con mapeo tipo→categoría granular (cada recordatorio con su propia categoría) (sql/045 v1, sql/050 v2 granular). Las 5 funciones que generaban notificaciones se reconvirtieron para pasar por generar_notificacion(): publicación (sql/037→046), cancelación manual y por mínimo (sql/038→047), plazas agotadas (sql/039→048) y recordatorios (sql/042→049); ya no quedan inserts directos a notificaciones_cola en código de negocio. UI en /cuenta: panel de preferencias por categoría (components/PreferenciasNotificaciones.js, opt-out, toggles individuales que se atenúan si el push general está desactivado, cancelaciones siempre activas y no desactivables, color lima de marca #B5E600) y panel de historial fijo con las 10 últimas notificaciones (components/HistorialNotificaciones.js). Campana de notificaciones en components/Menu.js (components/CampanaNotificaciones.js), independiente del menú y siempre visible a la izquierda del botón "Menú" en escritorio y móvil: punto rojo si hay no leídas, lista de las 10 últimas, marca como leídas al abrir, refresco cada 60s. Commit f145b97.

Falta: nada crítico. Opcional a futuro: purga de historial antiguo (notificaciones_historial crecerá sin límite) y verificar en una autocancelación real (no solo de prueba) que los avisos de autocancelación por mínimo (cliente y entrenador) llegan correctamente en producción.

## Aviso de activar notificaciones tras la primera acción (9 agosto 2026)
Hecho:
- Banner discreto (components/AvisoActivarNotificaciones.js) que invita a activar las push tras la primera acción del usuario, no al registrarse: cliente al seguir a un entrenador o reservar una sesión; entrenador al publicar una sesión. No exige que sea la primera acción absoluta del usuario; cualquiera de esas tres acciones lo dispara.
- Arquitectura: la lógica de suscripción push se extrajo de NotificacionesToggle a un hook compartido lib/usePush.js (mismo comportamiento, ahora reutilizable; activar() devuelve true/false). Las acciones emiten un evento global window 'primera-accion' (una línea en BotonSeguir, BotonReservar y app/publicar); el banner, montado en Menu.js y siempre presente con sesión iniciada, lo escucha vía un disparador incremental. El efecto solo reacciona al cambio del disparador (useRef guarda el último procesado), nunca al iniciar sesión ni al cambiar otras dependencias.
- Frecuencia (opt-out amable, guardada en localStorage clave aviso_notif_v1): se ofrece 1 vez; si el usuario cierra con "ahora no" espera 7 días; a la 2ª negativa no vuelve a insistir. No se muestra si las push ya están activadas, si el permiso del navegador está en denied, o si no hay soporte.
- Caso iPhone: si detecta iOS sin la PWA instalada, en vez de pedir permiso invita a instalar la app reutilizando BotonInstalarApp.
- Commit a76679f.

Falta:
- Ninguno.

## Validación de fecha pasada al publicar (9 agosto 2026)
Hecho:
- Impedir crear una sesión con fecha+hora ya pasada. Dos capas: (1) validación en el navegador en app/publicar/page.js reutilizando claseYaPaso de lib/ventanaEdicionClase (aviso inmediato al entrenador, no publica); (2) red de seguridad en base de datos con trigger BEFORE INSERT en clases (funcion validar_clase_no_pasada, sql/051) que rechaza fecha+hora anterior a ahora en hora Europe/Madrid.
- Basta con que sea futura, sin margen minimo.
Falta:
- Ninguno.

## Login con Google (OAuth) (10 agosto 2026)
Hecho:
- Boton "Continuar con Google" en /login y /registro (signInWithOAuth, provider google, redirectTo a /auth/callback).
- Ruta /auth/callback (app/auth/callback/page.js): cliente, procesa la sesion; si el usuario ya tiene rol en user_metadata va a /, si no va a /completar-perfil.
- Pantalla /completar-perfil (app/completar-perfil/page.js): usuario nuevo de Google elige rol (Cliente/Entrenador con doble confirmacion y aviso destacado de que no se puede cambiar) y username (validado con RPC username_disponible). Al confirmar guarda rol+username en user_metadata (updateUser) Y actualiza el username en la tabla perfiles.
- Detalle clave: el trigger crear_perfil_para_usuario_nuevo crea la fila de perfiles en el momento del login de Google con un username derivado del email (Google no manda username); por eso completar-perfil DEBE actualizar perfiles ademas de user_metadata, ya que la app lee el username de perfiles.
- El registro normal (email/password) se mantiene intacto; Google es un carril aparte. Se añadio tambien el aviso coral destacado de "el rol no se puede cambiar" al registro normal, por coherencia.
- Config (Fase 0): proveedor Google activado en Supabase Auth con Client ID/Secret de Google Cloud; Redirect URLs de localhost y produccion.
- Commit 82fcee2.
Falta:
- Confirmar que la Redirect URL de produccion (https://www.ruleafit.com/auth/callback) esta en Supabase (la de localhost si esta, probado en local).

## Después de la beta (decidido el 27 julio 2026)

Hecho (8 agosto 2026):
- Dominio ruleafit.com comprado (comvive) y vinculado a Vercel, con DNS configurado y SSL activo en los tres dominios.
- Supabase Auth actualizado: Site URL y Redirect URLs apuntando a https://www.ruleafit.com (sin quitar vercel.app ni localhost).
- metadataBase añadido en app/layout.js apuntando a https://www.ruleafit.com.

Hecho (10 agosto 2026) · Bloque A · Infraestructura de correo (Resend):
- Cuenta creada en Resend (organización openfit2026), plan gratuito (3.000 correos/mes, 100/día, 1 dominio).
- Dominio ruleafit.com verificado en Resend. Registros DNS añadidos en comvive.es: DKIM (TXT resend._domainkey), SPF (TXT send), MX (send -> feedback-smtp.eu-west-1.amazonses.com, prioridad 10) y DMARC (TXT _dmarc, v=DMARC1; p=none;). Los registros previos de Vercel quedaron intactos. Región de envío: EU (Ireland).
- SMTP propio configurado en Supabase (Authentication -> Emails -> Custom SMTP): host smtp.resend.com, puerto 465, usuario "resend", contraseña = API key de Resend. Remitente no-reply@ruleafit.com, nombre visible "Openfit" (provisional, hasta el rename final). Intervalo mínimo por usuario: 60 s.
- Validado: correo de recuperación enviado desde Authentication -> Users llega correctamente desde no-reply@ruleafit.com con remitente Openfit.

Hecho (10 agosto 2026) · Bloque B · Confirmación de registro:
- Plantilla "Confirm signup" traducida al español en Supabase (asunto "Confirma tu cuenta en Openfit" y cuerpo con marca Openfit), respetando la variable {{ .ConfirmationURL }}.
- Interruptor "Confirm email" activado en Supabase (Authentication -> Sign In / Providers -> Email). Comprobado antes que los 40 usuarios existentes ya tenían email_confirmed_at (no se bloquea a nadie); solo afecta a registros nuevos.
- Aviso claro en /login cuando el email no está confirmado: nueva rama en traducirErrorLogin() de app/login/page.js que detecta error.code === 'email_not_confirmed' (con respaldo por texto) y muestra un mensaje pidiendo confirmar el correo y revisar spam. Commit c91b06f.
- Validado en producción: registro con correo real -> correo en español -> no deja entrar sin confirmar (mensaje claro) -> tras confirmar, entra.

Falta:
- Traducir al español la plantilla de email de recuperación de contraseña en Supabase (Bloque C). La de confirmación ya está traducida.
- Recuperar contraseña (Bloque C): flujo de UI (enlace en /login + página para pedir el reset + página para fijar la nueva contraseña) y su plantilla. El envío ya está resuelto (SMTP).
- 2FA activado el 27 julio 2026 en las tres cuentas críticas del proyecto (Vercel, GitHub y Google), con app de autenticación y códigos de recuperación guardados.

## Fase 6 · Pagos reales con Stripe — futuro, fuera del MVP
- Sustituir la cartera simulada por pagos reales. Posterior al lanzamiento.
- Rediseño de Open ligado al precio: no regalar los 5 Open de asistencia en clases gratis o muy baratas; conceder Open solo por encima de un umbral de precio X, aún por decidir.

Nota (investigación del modelo de cobros, 7 agosto 2026): Stripe Connect "puro" no encaja, porque el dinero recargado por el cliente queda a la espera sin saber todavía a qué entrenador (receptor) irá. El modelo correcto técnicamente, y coherente con el sistema Open ya existente, es una cartera propia: el cliente recarga dinero, lo convierte en Open, gasta Open entre usuarios dentro de la app, y el entrenador que los recibe los retira convirtiéndolos de vuelta en euros. Problema pendiente: este modelo implica custodiar saldo de terceros y emitir Open (posible "dinero electrónico" a efectos legales), lo que puede requerir licencia propia o apoyarse en un proveedor que ya la tenga. Conclusión: antes de implementar pagos reales hace falta consultar con un asesor especializado en fintech/pagos; se preparó un documento de consulta con términos genéricos para llevarle a esa consulta.

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
