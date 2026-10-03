# CEBIX — Reto AgroCebada 2026

Dashboard de predicción de rendimiento de cebada y elegibilidad crediticia,
construido sobre el dataset del Reto AgroCebada 2026 (Sentinel-2/Landsat,
Planet, CHIRPS, CHIRTS-ERA5, INEGI CEM 4.0).

## Estructura del proyecto

```
src/        frontend (React + Vite): dashboard, mapa, predicciones, SHAP
backend/    API FastAPI que EJECUTA el modelo real en cada request
ml/         pipeline de features, entrenamiento, validación y CSV de entrega a FIRA
render.yaml despliegue del backend en Render (apunta a backend/)
```

**El frontend no trae datos del modelo escritos en el código.** Todo viene de la API:

| Qué se muestra | De dónde sale |
|---|---|
| Predicciones, IC 90 %, SHAP local, coordenadas | `POST /predict-csv` (el modelo corre en cada llamada) |
| RMSE / MAE / R², comparación de algoritmos, SHAP global, preguntas guía, pasos de validación | `GET /model-info` |
| CSV de ejemplo (59 parcelas de evaluación) | `GET /example-csv` |

Las gráficas del dashboard (rendimiento por estado, distribución, rangos) se calculan en el
navegador con las parcelas de la última corrida del modelo. Si no hay corrida, no hay datos:
las pantallas piden ejecutar el modelo o subir un CSV.

## Requisitos

- Node.js 18 o superior
- Python 3.11 o 3.12 (solo para el backend)

## Ejecución local

**1. Backend** (ver `backend/README_BACKEND.md` para el detalle):

```bash
cd backend
./setup_venv.sh        # Windows: setup_venv.bat  (solo la primera vez)
./run.sh               # Windows: run.bat -> http://localhost:8000
```

**2. Frontend** (en otra terminal, desde la raíz):

```bash
cp .env.example .env   # completa VITE_SUPABASE_* y, si hace falta, VITE_MODEL_API_URL
npm install
npm run dev            # http://localhost:5173
```

```bash
npm run build      # build de producción en dist/
npm run preview    # sirve el build de dist/ para probarlo localmente
```

## Despliegue

- **Backend → Render:** `render.yaml` ya apunta a `backend/Dockerfile`. Define `ALLOWED_ORIGINS`
  con el dominio del frontend (sin `/` final).
- **Frontend → Vercel:** define `VITE_MODEL_API_URL` con la URL pública del backend, más
  `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Datos por usuario

Cada cuenta ve solo lo que ella misma hizo:

- **Corrida del modelo y envíos a comité:** se guardan en el navegador con la clave del usuario
  (`cebix-analysis-v1:<id>`), no en una clave global. Al cambiar de cuenta empieza vacío.
- **Parcelas capturadas a mano (`parcels_custom`):** cada fila lleva `user_id` y Supabase solo
  devuelve las del usuario (RLS). En una base nueva corre `supabase/schema.sql`; si ya tenías la
  tabla, corre `supabase/parcels_custom_por_usuario.sql` (trae al final las opciones para las
  filas antiguas, que quedan sin dueño).

## CRUD de parcelas

Al hacer clic en una parcela de la lista se abre su pantalla, con **Editar** y **Eliminar**
(Crear está en **Agregar parcela** de la lista, o importando un CSV; Leer es la propia pantalla).

| Tipo de parcela | Editar | Eliminar |
|---|---|---|
| Capturada a mano o importada (Supabase) | todos los campos; score y semáforo se recalculan | se borra de la cuenta |
| De la corrida del modelo | solo nombre, municipio, superficie y coordenadas (rendimiento, score y SHAP son del modelo) | se quita de la corrida actual |

Si Supabase rechaza una operación, el formulario o el diálogo muestran el motivo y no pierden lo escrito.
Una cuenta nueva puede crear parcelas sin ejecutar antes el modelo.

## Si reentrenas el modelo

```bash
cd backend && python export_model.py          # regenera model_artifact.joblib
python ../ml/03_modelo/build_model_meta.py    # regenera model_meta.json (métricas + SHAP global)
```

Sin el segundo paso, `/model-info` seguiría mostrando las métricas del modelo anterior.

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

Dataset del Reto AgroCebada 2026 (197 parcelas, 138 con rendimiento observado; Sentinel-2/Landsat,
CHIRPS, CHIRTS-ERA5, INEGI CEM 4.0). Modelo final: **Random Forest, 10 features seleccionadas por
SHAP, sin Planet**, validado con leave-region-out. La narrativa completa (3 rondas, decisiones y
limitaciones) está en `ml/README.md`.

Lo que sigue siendo código y no sale del modelo: la fórmula del score de crédito y el semáforo
(70 / 45) en `src/context/ParcelsContext.jsx`, y los polígonos de estados del mapa
(`src/data/estadosBoundaries.json`).

## Estructura

```
src/
  pages/        rutas de la app (Dashboard, Parcelas, Modelo, Mapa, etc.)
  components/   componentes de UI, gráficas, mapa y layout
  services/     modelApi.js (cliente de la API) y Supabase
  context/      ModelInfo (/model-info), Parcels (corrida actual), tema, auth
  utils/        parcelStats.js (estadísticas de la corrida), CSV, reporte PDF
```
