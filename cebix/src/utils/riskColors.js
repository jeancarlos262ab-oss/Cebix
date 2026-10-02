/**
 * Colores del semáforo de elegibilidad: única fuente de verdad.
 * Son los mismos de la pantalla de Predicciones (Semaphore.jsx): ámbar =
 * --accent-500 de "brand", verde = --accent-500 de "ndvi" y un rojo terroso con
 * la misma saturación/luminosidad. Cualquier barra, punto, pin o leyenda que
 * represente riesgo debe importar de aquí, no escribir su propio hex.
 */
export const RISK_COLORS = {
  red: "#B8493B",
  yellow: "#C08A2E",
  green: "#4C9A63",
};
