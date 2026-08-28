import Link from 'next/link'

export const metadata = {
  title: 'Aviso legal · Ruleafit',
}

const h2Class = 'mt-10 mb-4 border-b border-zinc-200 pb-2 text-2xl font-bold text-black'
const h3Class = 'mt-6 mb-2 text-lg font-bold text-black'
const pClass = 'mb-4 leading-relaxed text-zinc-800'
const ulClass = 'mb-4 list-disc space-y-2 pl-6 leading-relaxed text-zinc-800'
const linkClass =
  'font-semibold text-black underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-black/80'

export default function AvisoLegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold text-black">AVISO LEGAL Y CONDICIONES GENERALES DE USO</h1>
      <p className="mb-1 text-sm text-zinc-500">
        <strong>Sitio web:</strong> https://www.ruleafit.com
      </p>
      <p className="mb-8 text-sm text-zinc-500">
        <strong>Última actualización:</strong> 27 de julio de 2026
      </p>

      <h2 className={h2Class}>I. INFORMACIÓN GENERAL</h2>
      <p className={pClass}>
        En cumplimiento con el deber de información dispuesto en la Ley 34/2002 de Servicios de la Sociedad de la Información y el Comercio Electrónico (LSSI-CE) de 11 de julio, se facilitan a continuación los siguientes datos de información general de este sitio web:
      </p>
      <p className={pClass}>
        La titularidad de este sitio web, https://www.ruleafit.com, (en adelante, Sitio Web) la ostenta: <strong>Rubén Fernández Personat</strong>, con NIF <strong>23879574-P</strong>, y cuyos datos de contacto son:
      </p>
      <ul className={ulClass}>
        <li><strong>Dirección:</strong> C/ Lora del Río 46, 41420 Fuentes de Andalucía, Sevilla</li>
        <li><strong>Email de contacto:</strong> rfp99trabajo@gmail.com</li>
      </ul>

      <h2 className={h2Class}>II. NATURALEZA DEL SERVICIO</h2>
      <p className={pClass}>
        Ruleafit es una plataforma en línea que pone en contacto a entrenadores independientes con personas interesadas en participar en sesiones de entrenamiento, ya sea al aire libre o en instalaciones, y de forma individual, en pareja o en grupo.
      </p>
      <p className={pClass}>
        Ruleafit <strong>actúa exclusivamente como intermediario tecnológico</strong>. No presta el servicio deportivo, no emplea a los entrenadores ni mantiene con ellos relación laboral alguna. La sesión de entrenamiento se acuerda y se ejecuta entre el Usuario y el entrenador correspondiente, siendo este último el único responsable de su contenido, desarrollo, idoneidad, titulación y aseguramiento.
      </p>
      <p className={pClass}>
        En la presente versión del Sitio Web <strong>no se realiza ningún cobro ni pago a través de la plataforma</strong>. El precio de la sesión, si lo hubiera, se abona directamente al entrenador fuera de la aplicación, según lo que ambas partes acuerden. Ruleafit no interviene en dicha transacción, no percibe comisión alguna y no gestiona reembolsos.
      </p>
      <p className={pClass}>
        El Sitio Web ofrece asimismo un sistema de puntos de fidelización denominado &quot;Open&quot;, de carácter meramente promocional. Los Open no constituyen dinero electrónico ni medio de pago, no pueden comprarse, recargarse, transferirse ni canjearse por dinero, y no otorgan derecho a contraprestación económica alguna.
      </p>

      <h3 className={h3Class}>Advertencia sobre la actividad física</h3>
      <p className={pClass}>
        La participación en sesiones de entrenamiento conlleva esfuerzo físico y riesgo inherente de lesión. El Usuario declara encontrarse en condiciones físicas adecuadas para la práctica de la actividad y participa bajo su propia responsabilidad. Ante cualquier duda sobre su estado de salud, el Usuario debe consultar a un profesional sanitario antes de participar. El Usuario se compromete a seguir las indicaciones de seguridad del entrenador durante la sesión.
      </p>

      <h2 className={h2Class}>III. TÉRMINOS Y CONDICIONES GENERALES DE USO</h2>

      <h3 className={h3Class}>El objeto de las condiciones: El Sitio Web</h3>
      <p className={pClass}>
        El objeto de las presentes Condiciones Generales de Uso (en adelante, Condiciones) es regular el acceso y la utilización del Sitio Web. A los efectos de las presentes Condiciones se entenderá como Sitio Web: la apariencia externa de los interfaces de pantalla, tanto de forma estática como de forma dinámica, es decir, el árbol de navegación; y todos los elementos integrados tanto en los interfaces de pantalla como en el árbol de navegación (en adelante, Contenidos) y todos aquellos servicios o recursos en línea que en su caso ofrezca a los Usuarios (en adelante, Servicios).
      </p>
      <p className={pClass}>
        Ruleafit se reserva la facultad de modificar, en cualquier momento, y sin aviso previo, la presentación y configuración del Sitio Web y de los Contenidos y Servicios que en él pudieran estar incorporados. El Usuario reconoce y acepta que en cualquier momento Ruleafit pueda interrumpir, desactivar y/o cancelar cualquiera de estos elementos que se integran en el Sitio Web o el acceso a los mismos.
      </p>
      <p className={pClass}>
        El acceso al Sitio Web es gratuito. No obstante, determinados Contenidos y Servicios —como la publicación de sesiones, la reserva de plazas o la consulta del historial— requieren el registro previo del Usuario y la creación de una cuenta.
      </p>

      <h3 className={h3Class}>El Usuario</h3>
      <p className={pClass}>
        El acceso, la navegación y el uso del Sitio Web confiere la condición de Usuario, por lo que se aceptan, desde que se inicia la navegación por el Sitio Web, todas las Condiciones aquí establecidas, así como sus ulteriores modificaciones, sin perjuicio de la aplicación de la correspondiente normativa legal de obligado cumplimiento según el caso. Dada la relevancia de lo anterior, se recomienda al Usuario leerlas cada vez que visite el Sitio Web.
      </p>
      <p className={pClass}>
        El Usuario asume su responsabilidad para realizar un uso correcto del Sitio Web. Esta responsabilidad se extenderá a:
      </p>
      <ul className={ulClass}>
        <li>Un uso de la información, Contenidos y/o Servicios y datos ofrecidos por Ruleafit sin que sea contrario a lo dispuesto por las presentes Condiciones, la Ley, la moral o el orden público, o que de cualquier otro modo puedan suponer lesión de los derechos de terceros o del mismo funcionamiento del Sitio Web.</li>
        <li>La veracidad y licitud de las informaciones aportadas por el Usuario en los formularios extendidos por Ruleafit para el acceso a ciertos Contenidos o Servicios ofrecidos por el Sitio Web. En todo caso, el Usuario notificará de forma inmediata a Ruleafit acerca de cualquier hecho que permita el uso indebido de la información registrada en dichos formularios, tales como, pero no solo, el robo, extravío, o el acceso no autorizado a identificadores y/o contraseñas, con el fin de proceder a su inmediata cancelación.</li>
        <li>La custodia de sus credenciales de acceso, siendo responsable de toda actividad que se realice desde su cuenta.</li>
      </ul>

      <h3 className={h3Class}>Contenido publicado por los Usuarios</h3>
      <p className={pClass}>
        Los entrenadores registrados pueden publicar en el Sitio Web información relativa a sus sesiones, incluyendo título, descripción, modalidad, ubicación, punto de encuentro, fecha, duración, número de plazas y precio.
      </p>
      <p className={pClass}>
        Dicho contenido es aportado por el propio entrenador, bajo su exclusiva responsabilidad, y no es verificado previamente por Ruleafit. El entrenador garantiza que la información publicada es veraz, lícita y no vulnera derechos de terceros.
      </p>
      <p className={pClass}>
        Ruleafit se reserva el derecho de retirar todo contenido que vulnere la ley, el respeto a la dignidad de la persona, que sea discriminatorio, xenófobo, racista, pornográfico, spamming, que atente contra la juventud o la infancia, el orden o la seguridad pública o que, a su juicio, no resultara adecuado para su publicación, así como de suspender o cancelar las cuentas de los Usuarios responsables.
      </p>
      <p className={pClass}>
        En cualquier caso, Ruleafit no será responsable de las manifestaciones u opiniones vertidas por los Usuarios a través del contenido que publiquen.
      </p>
      <p className={pClass}>
        El mero acceso a este Sitio Web no supone entablar ningún tipo de relación de carácter comercial entre Ruleafit y el Usuario.
      </p>
      <p className={pClass}>
        El Usuario declara ser mayor de edad y disponer de la capacidad jurídica suficiente para vincularse por las presentes Condiciones. Por lo tanto, este Sitio Web de Ruleafit no se dirige a menores de edad. Ruleafit declina cualquier responsabilidad por el incumplimiento de este requisito.
      </p>
      <p className={pClass}>
        El Sitio Web está dirigido principalmente a Usuarios residentes en España. Ruleafit no asegura que el Sitio Web cumpla con legislaciones de otros países, ya sea total o parcialmente. Si el Usuario reside o tiene su domicilio en otro lugar y decide acceder y/o navegar en el Sitio Web lo hará bajo su propia responsabilidad, deberá asegurarse de que tal acceso y navegación cumple con la legislación local que le es aplicable, no asumiendo Ruleafit responsabilidad alguna que se pueda derivar de dicho acceso.
      </p>

      <h2 className={h2Class}>IV. ACCESO Y NAVEGACIÓN EN EL SITIO WEB: EXCLUSIÓN DE GARANTÍAS Y RESPONSABILIDAD</h2>
      <p className={pClass}>
        Ruleafit no garantiza la continuidad, disponibilidad y utilidad del Sitio Web, ni de los Contenidos o Servicios. Ruleafit hará todo lo posible por el buen funcionamiento del Sitio Web, sin embargo, no se responsabiliza ni garantiza que el acceso a este Sitio Web no vaya a ser ininterrumpido o que esté libre de error.
      </p>
      <p className={pClass}>
        Tampoco se responsabiliza o garantiza que el contenido o software al que pueda accederse a través de este Sitio Web, esté libre de error o cause un daño al sistema informático (software y hardware) del Usuario. En ningún caso Ruleafit será responsable por las pérdidas, daños o perjuicios de cualquier tipo que surjan por el acceso, navegación y el uso del Sitio Web, incluyéndose, pero no limitándose, a los ocasionados a los sistemas informáticos o los provocados por la introducción de virus.
      </p>
      <p className={pClass}>
        Ruleafit tampoco se hace responsable de los daños que pudiesen ocasionarse a los usuarios por un uso inadecuado de este Sitio Web. En particular, no se hace responsable en modo alguno de las caídas, interrupciones, falta o defecto de las telecomunicaciones que pudieran ocurrir.
      </p>
      <p className={pClass}>
        Asimismo, Ruleafit no responde de la celebración, cancelación, puntualidad, contenido, calidad ni seguridad de las sesiones de entrenamiento publicadas por los entrenadores, ni de los acuerdos económicos que estos alcancen con los Usuarios fuera de la plataforma.
      </p>
      <p className={pClass}>
        Nada en las presentes Condiciones excluye o limita la responsabilidad que no pueda excluirse o limitarse legalmente conforme a la normativa española de defensa de los consumidores y usuarios.
      </p>

      <h2 className={h2Class}>V. POLÍTICA DE ENLACES</h2>
      <p className={pClass}>
        El Sitio Web utiliza cartografía de OpenStreetMap para la visualización de las ubicaciones de las sesiones, sujeta a las condiciones de uso y licencia de dicho proveedor.
      </p>
      <p className={pClass}>
        El Usuario o tercero que realice un hipervínculo desde una página web de otro, distinto, sitio web al Sitio Web de Ruleafit deberá saber que:
      </p>
      <p className={pClass}>
        No se permite la reproducción —total o parcialmente— de ninguno de los Contenidos y/o Servicios del Sitio Web sin autorización expresa de Ruleafit.
      </p>
      <p className={pClass}>
        No se permite tampoco ninguna manifestación falsa, inexacta o incorrecta sobre el Sitio Web de Ruleafit, ni sobre los Contenidos y/o Servicios del mismo.
      </p>
      <p className={pClass}>
        A excepción del hipervínculo, el sitio web en el que se establezca dicho hiperenlace no contendrá ningún elemento, de este Sitio Web, protegido como propiedad intelectual por el ordenamiento jurídico español, salvo autorización expresa de Ruleafit.
      </p>
      <p className={pClass}>
        El establecimiento del hipervínculo no implicará la existencia de relaciones entre Ruleafit y el titular del sitio web desde el cual se realice, ni el conocimiento y aceptación de Ruleafit de los contenidos, servicios y/o actividades ofrecidas en dicho sitio web, y viceversa.
      </p>

      <h2 className={h2Class}>VI. PROPIEDAD INTELECTUAL E INDUSTRIAL</h2>
      <p className={pClass}>
        Ruleafit por sí o como parte cesionaria, es titular de todos los derechos de propiedad intelectual e industrial del Sitio Web, así como de los elementos contenidos en el mismo (a título enunciativo y no exhaustivo, imágenes, sonido, audio, vídeo, software o textos, marcas o logotipos, combinaciones de colores, estructura y diseño, selección de materiales usados, programas de ordenador necesarios para su funcionamiento, acceso y uso, etc.). Serán, por consiguiente, obras protegidas como propiedad intelectual por el ordenamiento jurídico español, siéndoles aplicables tanto la normativa española y comunitaria en este campo, como los tratados internacionales relativos a la materia y suscritos por España.
      </p>
      <p className={pClass}>
        Lo anterior se entiende sin perjuicio de la titularidad que corresponda a cada Usuario sobre el contenido que él mismo publique en el Sitio Web. Al publicar dicho contenido, el Usuario concede a Ruleafit una licencia gratuita y no exclusiva para alojarlo, reproducirlo y mostrarlo públicamente dentro del Sitio Web, con la finalidad exclusiva de prestar el servicio.
      </p>
      <p className={pClass}>
        Todos los derechos reservados. En virtud de lo dispuesto en la Ley de Propiedad Intelectual, quedan expresamente prohibidas la reproducción, la distribución y la comunicación pública, incluida su modalidad de puesta a disposición, de la totalidad o parte de los contenidos de esta página web, con fines comerciales, en cualquier soporte y por cualquier medio técnico, sin la autorización de Ruleafit.
      </p>
      <p className={pClass}>
        El Usuario se compromete a respetar los derechos de propiedad intelectual e industrial de Ruleafit. Podrá visualizar los elementos del Sitio Web o incluso imprimirlos, copiarlos y almacenarlos en el disco duro de su ordenador o en cualquier otro soporte físico siempre y cuando sea, exclusivamente, para su uso personal. El Usuario, sin embargo, no podrá suprimir, alterar, o manipular cualquier dispositivo de protección o sistema de seguridad que estuviera instalado en el Sitio Web.
      </p>
      <p className={pClass}>
        En caso de que el Usuario o tercero considere que cualquiera de los Contenidos del Sitio Web suponga una violación de los derechos de protección de la propiedad intelectual, deberá comunicarlo inmediatamente a Ruleafit a través de los datos de contacto del apartado de INFORMACIÓN GENERAL de este Aviso Legal y Condiciones Generales de Uso.
      </p>

      <h2 className={h2Class}>VII. PROTECCIÓN DE DATOS</h2>
      <p className={pClass}>
        El tratamiento de los datos personales de los Usuarios se rige por lo dispuesto en la Política de Privacidad del Sitio Web, accesible en{' '}
        <Link href="/privacidad" className={linkClass}>
          /privacidad
        </Link>
        .
      </p>

      <h2 className={h2Class}>VIII. ACCIONES LEGALES, LEGISLACIÓN APLICABLE Y JURISDICCIÓN</h2>
      <p className={pClass}>
        Ruleafit se reserva la facultad de presentar las acciones civiles o penales que considere necesarias por la utilización indebida del Sitio Web y Contenidos, o por el incumplimiento de las presentes Condiciones.
      </p>
      <p className={pClass}>
        La relación entre el Usuario y Ruleafit se regirá por la normativa vigente y de aplicación en el territorio español. De surgir cualquier controversia en relación con la interpretación y/o a la aplicación de estas Condiciones las partes someterán sus conflictos a la jurisdicción ordinaria sometiéndose a los jueces y tribunales que correspondan conforme a derecho, sin perjuicio de los fueros imperativos que correspondan al Usuario en su condición de consumidor.
      </p>
    </main>
  )
}
