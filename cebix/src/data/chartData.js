/**
 * Curvas derivadas de datos reales del ciclo abril-octubre 2025 (el único año
 * cubierto por el Dataset PRO y por el rendimiento observado del reto).
 *
 * yieldTrend*: usa el NDVI medio mensual real (Sentinel-2, nubosidad<40%,
 * promediado sobre las 138 parcelas de entrenamiento) como proxy de
 * acumulación de biomasa, y lo reescala para que el acumulado final coincida
 * con el rendimiento medio observado (3.96 ton/ha). No es una medición directa
 * de rendimiento mes a mes (eso no existe: el rendimiento solo se mide una vez,
 * al final del ciclo), sino una trayectoria de crecimiento consistente con la
 * fenología real observada.
 *
 * gdd*: grados-día de crecimiento (base 4°C) calculados con Tmin/Tmax
 * mensuales de CHIRTS-ERA5 para las 197 parcelas. "budget" es el máximo GDD
 * observado ese mes entre todas las parcelas (techo climático de la región);
 * "spent" es el promedio real observado ese mes.
 */

const months = ["Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct"];

// NDVI medio mensual real (Sentinel-2, ciclo 2025) -> acumulado normalizado a
// 3.96 ton/ha (rendimiento medio de las 138 parcelas de entrenamiento).
const yieldByMonth = [0.23, 0.45, 0.78, 1.51, 2.36, 3.23, 3.96];

export const yieldTrendFull = months.map((month, i) => ({
  month,
  value: yieldByMonth[i],
}));

export const yieldTrend60d = months.slice(4).map((month, i) => ({
  month,
  value: yieldByMonth.slice(4)[i],
}));

export const yieldTrend30d = months.slice(5).map((month, i) => ({
  month,
  value: yieldByMonth.slice(5)[i],
}));

// GDD promedio y máximo real por mes (base 4°C), sobre las 197 parcelas.
const gddMean = [430, 496, 441, 436, 448, 420, 384];
const gddMax = [443, 510, 450, 448, 461, 431, 394];

export const gddFull = months.map((month, i) => ({
  month,
  budget: gddMax[i],
  spent: gddMean[i],
}));

export const gdd60d = months.slice(4).map((month, i) => ({
  month,
  budget: gddMax.slice(4)[i],
  spent: gddMean.slice(4)[i],
}));

export const gdd30d = months.slice(5).map((month, i) => ({
  month,
  budget: gddMax.slice(5)[i],
  spent: gddMean.slice(5)[i],
}));
