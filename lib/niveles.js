// Sistema de niveles de usuario (0-100), basado en el saldo de Rulos.
//
// Decidido con el usuario el 11 sept 2026: los primeros niveles cuestan
// poco (para que se consigan rápido, incluso solo con el pack de
// bienvenida + foto + descripción) y cada tramo de 10 niveles cuesta más
// que el anterior, para que los niveles altos cuesten mucho y no sea fácil
// llegar a 100.
//
// Coste en Rulos de subir UN nivel dentro de cada tramo de 10 (índice 0 =
// tramo 1-10, índice 1 = tramo 11-20, ... índice 9 = tramo 91-100).
// Tramos 1-50: sube de 5 en 5 (15, 20, 25, 30, 35). Tramos 51-100: sube de
// 10 en 10 (45, 55, 65, 75, 85).
const COSTE_POR_TRAMO = [15, 20, 25, 30, 35, 45, 55, 65, 75, 85]

export const NIVEL_MAX = 100

// Umbral de Rulos acumulados necesario para ALCANZAR cada nivel (índice =
// nivel, de 0 a NIVEL_MAX). Se calcula una sola vez al cargar el módulo:
// UMBRALES[0] = 0, UMBRALES[100] = 4500 con los costes de arriba.
const UMBRALES = [0]
for (let nivel = 1; nivel <= NIVEL_MAX; nivel++) {
  const tramo = Math.ceil(nivel / 10) - 1
  UMBRALES.push(UMBRALES[nivel - 1] + COSTE_POR_TRAMO[tramo])
}

// Devuelve el nivel (0-100) y los datos de progreso hacia el siguiente
// nivel a partir de un saldo de Rulos. Usa el saldo actual (rulos_saldos.
// saldo): desde que la asistencia es automática y no hay retiradas, el
// saldo nunca baja, así que no hace falta distinguir "histórico" de
// "actual".
// Rango "de broma" que acompaña al nivel, con juego de palabras sobre
// "rulero" (usuario de Ruleafit). Acordado con el usuario el 11 sept 2026:
// - Una palabra de decena (9 en total, cada una cubre 10 niveles, de 1-10 a
//   81-90) + una palabra de unidad (según el último dígito del nivel: 1 =
//   Principiante ... 0 = Indestructible).
// - Del 91 al 99 hay una décima palabra de decena ("Ultra rulero") que no
//   se comparte con la de 81-90 ("Mega rulero").
// - El nivel 100 es un caso único fuera de esta combinación: no lleva
//   unidad, es solo "Rulerey".
// - El icono va ligado a la DECENA (se mantiene fijo dentro de cada
//   tramo), no a la unidad, para que no cambie en cada nivel.
const DECADAS = [
  ['Rulerito', '🌱'],
  ['Ruletito', '✨'],
  ['Mini rulero', '🔥'],
  ['Rulero', '💪'],
  ['Ruletero', '⚡'],
  ['Ruleador', '🥉'],
  ['Ruleazo', '🥈'],
  ['Super rulero', '🥇'],
  ['Mega rulero', '🏆'],
  ['Ultra rulero', '💎'],
]

const UNIDADES_TEXTO = [
  'Principiante',
  'Constante',
  'Motivado',
  'Imparable',
  'Veterano',
  'Élite',
  'Referente',
  'Leyenda',
  'Imbatible',
  'Indestructible',
]

const RULEREY = { nombre: 'Rulerey', icono: '👑' }

// Devuelve { nombre, icono } del rango correspondiente a un nivel (0-100).
export function calcularRango(nivel) {
  if (nivel >= NIVEL_MAX) return RULEREY

  const n = Math.max(1, nivel)
  const decadaIdx = Math.min(DECADAS.length - 1, Math.floor((n - 1) / 10))
  const unidadIdx = (n - 1) % 10
  const [nombreDecada, icono] = DECADAS[decadaIdx]

  return { nombre: `${nombreDecada} ${UNIDADES_TEXTO[unidadIdx]}`, icono }
}

export function calcularNivel(rulosSaldo) {
  const saldo = Math.max(0, rulosSaldo || 0)

  let nivel = 0
  for (let n = NIVEL_MAX; n >= 0; n--) {
    if (saldo >= UMBRALES[n]) {
      nivel = n
      break
    }
  }

  const esMaximo = nivel >= NIVEL_MAX
  const rulosNivelActual = UMBRALES[nivel]
  const rulosSiguienteNivel = esMaximo ? null : UMBRALES[nivel + 1]

  return {
    nivel,
    esMaximo,
    rulosNivelActual,
    rulosSiguienteNivel,
    rulosParaSiguiente: esMaximo ? 0 : rulosSiguienteNivel - saldo,
    progreso: esMaximo ? 1 : (saldo - rulosNivelActual) / (rulosSiguienteNivel - rulosNivelActual),
  }
}
