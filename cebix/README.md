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

## Mapa: dos motores según el equipo

`ParcelMap` detecta automáticamente si el equipo tiene pocos recursos
(GPU integrada vieja, pocos núcleos, poca RAM o sin WebGL) y elige el motor:

- **Completo** (`ParcelMapGL.jsx`): MapLibre GL / WebGL. Para laptops/PCs
  con GPU decente.
- **Ligero** (`ParcelMapLite.jsx`): Leaflet, sin WebGL. Mucho más liviano,
  se activa solo en equipos de bajos recursos. También se puede forzar a
  mano con el botón en la esquina inferior izquierda del mapa.

Ambos motores usan Esri (satelital/terreno) y CartoDB (claro/oscuro) como
fuente de tiles, no requieren ninguna API key.

## De dónde salen los datos

Todo lo que se ve en `src/data/` (parcelas, comparación de modelos,
importancia de variables, curvas de NDVI/GDD) se generó a partir del dataset
real del reto (197 parcelas, 138 con rendimiento observado) y de un modelo
Ridge validado espacialmente (leave-region-out). El detalle completo del
análisis y del entrenamiento está documentado en los comentarios al inicio de
cada archivo de `src/data/`.

`src/data/receipts.js` contiene datos de ejemplo (no dependen del dataset del
reto) usados solo por componentes de plantilla que no se usan en las rutas
activas.

## Estructura

```
src/
  pages/        rutas de la app (Dashboard, Parcelas, Modelo, Mapa, etc.)
  components/   componentes de UI, gráficas, mapa y layout
  data/         datos derivados del dataset del reto + modelo
  context/      tema (claro/oscuro), acento y densidad
```
