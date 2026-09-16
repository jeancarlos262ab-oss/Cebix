# CEBIX — Reto AgroCebada 2026

Dashboard de predicción de rendimiento de cebada y elegibilidad crediticia,
construido sobre el dataset del Reto AgroCebada 2026 (Sentinel-2/Landsat,
Planet, CHIRPS, CHIRTS-ERA5, INEGI CEM 4.0).

## Requisitos

- Node.js 18 o superior

## Instalación y ejecución

```bash
npm install
npm run dev       # servidor de desarrollo en http://localhost:5173
```

```bash
npm run build      # build de producción en dist/
npm run preview    # sirve el build de dist/ para probarlo localmente
```

## Variables de entorno (opcionales)

Copia `.env.example` a `.env` si quieres usar las capas de mapa base
"Satelital + etiquetas", "Claro", "Oscuro" o "Terreno" (Stadia Maps) fuera de
`localhost`. La capa "Satelital" (Esri World Imagery) funciona siempre, sin
necesidad de API key.

## De dónde salen los datos

Todo lo que se ve en `src/data/` (parcelas, comparación de modelos,
importancia de variables, curvas de NDVI/GDD) se generó a partir del dataset
real del reto (197 parcelas, 138 con rendimiento observado) y de un modelo
Ridge validado espacialmente (leave-region-out). El detalle completo del
análisis y del entrenamiento está documentado en los comentarios al inicio de
cada archivo de `src/data/`.

`src/data/users.js` y `src/data/receipts.js` son datos de ejemplo
(no dependen del dataset del reto) usados solo para poblar la pantalla de
Usuarios y componentes de plantilla que no se usan en las rutas activas.

## Estructura

```
src/
  pages/        rutas de la app (Dashboard, Parcelas, Modelo, Mapa, etc.)
  components/   componentes de UI, gráficas, mapa y layout
  data/         datos derivados del dataset del reto + modelo
  context/      tema (claro/oscuro), acento y densidad
```
