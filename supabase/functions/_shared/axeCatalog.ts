// axe-core reporta sus violaciones en inglés y con textos genéricos. Volcarlas tal cual al informe
// producía hallazgos en otro idioma, con la misma causa raíz repetida en todos y una "recomendación"
// que era solo un enlace a la documentación de Deque — al lado de los hallazgos de UX se notaba que
// estaban autogenerados. Este catálogo traduce las reglas más frecuentes a un hallazgo real, con su
// causa, su consecuencia y qué hacer concretamente. Es contenido fijo y verificado, sin modelo de
// por medio, así que no hay riesgo de invención.

export interface AxeRuleInfo {
  /** Título del hallazgo, en español y en términos de producto, no de la regla. */
  title: string;
  /** Qué se observó. Se completa con la cantidad de elementos afectados. */
  problem: string;
  /** Por qué suele ocurrir: la decisión de implementación detrás. */
  cause: string;
  /** A quién afecta y cómo, en concreto. */
  userImpact: string;
  /** Qué hacer, ejecutable. */
  fix: string;
}

export const AXE_CATALOG: Record<string, AxeRuleInfo> = {
  "color-contrast": {
    title: "Contraste insuficiente entre texto y fondo",
    problem: "Hay texto cuyo contraste con su fondo está por debajo del mínimo exigido por WCAG (4.5:1 para texto normal, 3:1 para texto grande).",
    cause: "La paleta de marca se aplicó buscando armonía visual sin verificar los ratios de contraste, algo habitual con grises claros sobre blanco o color de marca sobre fondos suaves.",
    userImpact: "Cualquier persona con visión reducida, o cualquiera leyendo con reflejos en pantalla o con el brillo bajo, no distingue ese texto.",
    fix: "Oscurecer el color de texto (o aclarar el fondo) hasta alcanzar 4.5:1. Verificá cada combinación con un medidor de contraste antes de fijarla en el sistema de diseño; no lo estimes a ojo.",
  },
  "heading-order": {
    title: "Jerarquía de encabezados con saltos",
    problem: "Los encabezados no siguen un orden progresivo: se salta un nivel (por ejemplo de h2 a h4) en lugar de descender de a uno.",
    cause: "Los niveles de encabezado se eligieron por su tamaño visual en vez de por su lugar en la estructura del contenido.",
    userImpact: "Quien navega con lector de pantalla se orienta saltando entre encabezados; con niveles salteados pierde la noción de qué sección contiene a cuál.",
    fix: "Reasignar los niveles según la jerarquía real del contenido (un solo h1, luego h2 para secciones, h3 para subsecciones) y controlar el tamaño con CSS, no cambiando la etiqueta.",
  },
  region: {
    title: "Contenido fuera de regiones señalizadas",
    problem: "Hay contenido que no está dentro de ninguna región semántica (header, nav, main, footer o equivalente con rol ARIA).",
    cause: "La maquetación se armó con contenedores genéricos (div) sin asignar las etiquetas semánticas que describen la función de cada zona.",
    userImpact: "Los lectores de pantalla ofrecen saltar directamente a zonas de la página; el contenido suelto queda fuera de ese índice y solo se alcanza recorriendo todo.",
    fix: "Envolver cada zona en su etiqueta semántica: la navegación en nav, el contenido principal en un único main, el pie en footer. Es un cambio de etiquetas que no altera el diseño.",
  },
  "landmark-one-main": {
    title: "Falta la región de contenido principal",
    problem: "La página no declara un elemento main que identifique cuál es su contenido principal.",
    cause: "La plantilla se construyó sin la estructura semántica de landmarks, algo frecuente cuando el maquetado parte de un diseño visual y no de la estructura del documento.",
    userImpact: "Quien usa lector de pantalla no puede saltar al contenido y debe escuchar el encabezado y el menú completos en cada carga.",
    fix: "Envolver el contenido principal de cada página en un único elemento main, excluyendo encabezado, navegación y pie.",
  },
  "link-name": {
    title: "Enlaces sin nombre accesible",
    problem: "Hay enlaces que no exponen ningún texto legible: normalmente enlaces que solo contienen un icono o una imagen.",
    cause: "Se usaron iconos como enlaces confiando en que su significado visual es evidente, sin agregar una alternativa textual.",
    userImpact: "El lector de pantalla los anuncia como \"enlace\" sin más: la persona no puede saber a dónde llevan sin activarlos.",
    fix: "Agregar un aria-label descriptivo a cada enlace de solo icono, que diga la acción y el destino (por ejemplo \"Ir a nuestro Instagram\"), no el nombre del icono.",
  },
  "button-name": {
    title: "Botones sin nombre accesible",
    problem: "Hay botones que no exponen texto legible por tecnologías de asistencia.",
    cause: "Se implementaron controles con solo un icono o un elemento gráfico, sin etiqueta textual asociada.",
    userImpact: "La persona escucha \"botón\" sin saber qué hace: en un formulario o un menú, eso bloquea la tarea por completo.",
    fix: "Añadir aria-label a cada botón de solo icono describiendo su acción (\"Abrir menú\", \"Cerrar\", \"Buscar\"), o incluir texto visible junto al icono.",
  },
  "image-alt": {
    title: "Imágenes sin texto alternativo",
    problem: "Hay imágenes sin atributo alt, por lo que su contenido no se transmite a quien no puede verlas.",
    cause: "Las imágenes se cargaron sin completar su descripción, habitualmente al subirlas desde el gestor de contenidos.",
    userImpact: "Quien usa lector de pantalla pierde esa información; si la imagen comunica algo relevante (un precio, un dato, un producto), lo pierde entero.",
    fix: "Describir en alt lo que la imagen aporta al contenido, no su apariencia. Si es puramente decorativa, dejar alt=\"\" para que se omita.",
  },
  "html-has-lang": {
    title: "Idioma de la página sin declarar",
    problem: "La etiqueta html no declara el idioma del contenido mediante el atributo lang.",
    cause: "La plantilla base no incluye la declaración de idioma, algo que pasa desapercibido porque no tiene ningún efecto visual.",
    userImpact: "Los lectores de pantalla eligen la pronunciación según ese atributo: sin él, pueden leer el español con fonética inglesa y volverse incomprensibles.",
    fix: "Agregar lang=\"es\" a la etiqueta html (o el código del idioma que corresponda a cada versión del sitio).",
  },
  label: {
    title: "Campos de formulario sin etiqueta asociada",
    problem: "Hay campos de formulario que no tienen una etiqueta vinculada de forma programática.",
    cause: "Se usó el texto de placeholder como si fuera la etiqueta, en busca de un formulario visualmente más limpio.",
    userImpact: "El lector de pantalla no anuncia qué se espera en ese campo. Además el placeholder desaparece al escribir, así que cualquiera puede perder la referencia a mitad del formulario.",
    fix: "Asociar un label a cada campo mediante for/id. Si el diseño exige no mostrarlo, ocultarlo visualmente pero mantenerlo en el DOM, nunca eliminarlo.",
  },
  "aria-allowed-role": {
    title: "Roles ARIA aplicados a elementos que no los admiten",
    problem: "Hay elementos con un rol ARIA que no es válido para ese tipo de elemento.",
    cause: "Se agregaron roles buscando mejorar la accesibilidad, pero sobre elementos que ya tienen semántica propia o que no admiten ese rol.",
    userImpact: "Un rol inválido puede hacer que la tecnología de asistencia anuncie el elemento de forma equivocada, lo que confunde más que la ausencia de rol.",
    fix: "Quitar el rol y usar el elemento HTML nativo que ya aporta esa semántica (button, nav, ul). El ARIA correcto es el que no hace falta escribir.",
  },
  "skip-link": {
    title: "Enlace para saltar al contenido no funcional",
    problem: "El enlace de salto al contenido principal existe pero no apunta a un destino válido.",
    cause: "Se incorporó el patrón de skip link sin verificar que el identificador de destino exista realmente en la página.",
    userImpact: "Quien navega por teclado no puede saltarse el menú y debe tabular por toda la navegación en cada página.",
    fix: "Verificar que el destino del enlace coincida con el id del contenedor principal y que ese contenedor pueda recibir el foco.",
  },
  "empty-heading": {
    title: "Encabezados vacíos",
    problem: "Hay etiquetas de encabezado sin ningún texto dentro.",
    cause: "Se usaron encabezados como recurso de espaciado o quedaron vacíos tras editar el contenido.",
    userImpact: "Aparecen en la lista de encabezados del lector de pantalla como entradas en blanco, ensuciando el índice con el que la persona se orienta.",
    fix: "Eliminar los encabezados sin contenido y resolver el espaciado con CSS.",
  },
  "meta-viewport": {
    title: "Zoom bloqueado en dispositivos móviles",
    problem: "La etiqueta viewport impide que el usuario amplíe la página.",
    cause: "Se deshabilitó el zoom para evitar desajustes de maquetación en móvil.",
    userImpact: "Quien necesita ampliar para leer no puede hacerlo. Es una de las barreras de accesibilidad más severas en móvil.",
    fix: "Quitar user-scalable=no y cualquier maximum-scale menor a 5 de la etiqueta viewport, y corregir con CSS los desajustes que aparezcan.",
  },
  "document-title": {
    title: "Página sin título",
    problem: "El documento no tiene un elemento title con contenido.",
    cause: "La plantilla no define el título por página, o quedó vacío en el gestor de contenidos.",
    userImpact: "Es lo primero que anuncia el lector de pantalla al cargar y lo que identifica la pestaña: sin él, no hay forma de distinguir esta página de otra.",
    fix: "Definir un title único y descriptivo por página, empezando por el contenido específico y terminando con el nombre del sitio.",
  },
  list: {
    title: "Listas con estructura inválida",
    problem: "Hay listas que contienen elementos que no son ítems de lista.",
    cause: "Se insertaron contenedores intermedios dentro de la lista al maquetar, rompiendo la relación directa entre la lista y sus ítems.",
    userImpact: "El lector de pantalla anuncia la cantidad de elementos de una lista; si la estructura está rota, ese conteo se pierde o es incorrecto.",
    fix: "Asegurar que los hijos directos de ul y ol sean exclusivamente li, y mover cualquier envoltorio dentro del li.",
  },
  "duplicate-id": {
    title: "Identificadores duplicados",
    problem: "Hay más de un elemento compartiendo el mismo id en la página.",
    cause: "Se repitió un componente sin generar identificadores únicos para cada instancia.",
    userImpact: "Las referencias entre elementos (etiquetas de formulario, descripciones ARIA) apuntan al primer elemento que encuentran, así que pueden anunciar información equivocada.",
    fix: "Generar identificadores únicos por instancia de componente y revisar que las referencias apunten al elemento correcto.",
  },
};

/** Cuando la regla no está en el catálogo se usa el texto de axe, pero al menos con contexto propio. */
export function describeAxeRule(ruleId: string, help: string, description: string): AxeRuleInfo {
  return (
    AXE_CATALOG[ruleId] ?? {
      title: help,
      problem: description,
      cause: "El marcado de la página no cumple esta regla de accesibilidad de WCAG.",
      userImpact: "Puede impedir o dificultar el uso del sitio a personas que dependen de tecnologías de asistencia.",
      fix: `Revisar la guía de la regla "${ruleId}" en la documentación de Deque para el detalle de la corrección.`,
    }
  );
}
