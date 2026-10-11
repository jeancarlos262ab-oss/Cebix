# CEBIX — Reto AgroCebada 2026

Dashboard de predicción de rendimiento de cebada y elegibilidad crediticia,
construido sobre el dataset del Reto AgroCebada 2026 (Sentinel-2/Landsat,
Planet, CHIRPS, CHIRTS-ERA5, INEGI CEM 4.0).

## Pantalla «Parcela satelital» (`/satelite`)

Permite dibujar (o importar en GeoJSON) una parcela nueva y obtener su predicción con las 10
variables del modelo calculadas en vivo desde imágenes satelitales reales.

No hay datos simulados: la pantalla llama a `POST /predict-from-geometry` del backend, que lee
Sentinel-2, Landsat y CHIRPS (fuentes abiertas, sin cuenta ni tarjeta) y ejecuta el modelo.
Si el backend no responde o no puede calcular, se muestra el error. Detalles, límites y
verificación pendiente en `backend/README_BACKEND.md`.

La pestaña *Validación del cálculo* muestra únicamente resultados reales: ejecuta
`backend/scripts/validate_satelite.py` y guarda su salida como `src/data/sateliteValidation.json`.

### Globo 3D de la pantalla satelital

`/satelite` abre en un globo terráqueo 3D hecho con **Canvas 2D (sin WebGL ni librerías)**:
`GlobeMap.jsx` (interacción y vuelo), `globeRender.js` (render por CPU, función pura) y
`globeTexture.js` (une teselas Esri z=2 y z=3 en un bitmap). Solo redibuja al arrastrar, hacer zoom
o volar; en reposo no consume CPU. Desde el globo se entra con animación al mapa plano
(Leaflet) para dibujar, y el botón **Globo** de la barra regresa. Con una parcela ya dibujada o un
GeoJSON importado se abre directo el mapa plano.

## Requisitos

- Node.js 18 o superior
- Python 3.11 o 3.12 (solo para el backend)

## Ejecución local

**1. Backend** (ver `backend/README_BACKEND.md` para el detalle):

```bash
cd backend
./scripts/setup_venv.sh   # Windows: scripts\setup_venv.bat  (solo la primera vez)
./scripts/run.sh          # Windows: scripts\run.bat -> http://localhost:8000
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

- **Corrida del modelo y envíos a comité:** se guardan en Supabase (tablas `user_analysis` y
  `committee_submissions`, con RLS por usuario), así que se ven igual desde cualquier computadora.
  El navegador solo conserva una copia para pintar al instante. **Corre `supabase/datos_por_usuario.sql`
  una vez** (o `schema.sql` completo en una base nueva). Lo que ya estuviera guardado solo en un
  navegador se sube automáticamente la primera vez que esa cuenta entra desde él.
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
cd backend && python scripts/export_model.py  # regenera models/model_artifact.joblib
python ../ml/03_modelo/build_model_meta.py    # regenera models/model_meta.json (métricas + SHAP global)
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

## Notificaciones por correo

Ajustes → Notificaciones guarda tres preferencias en `profiles` (`notif_email`, `notif_risk`, `notif_weekly`).

- **Alertas de riesgo**: la app manda una foto compacta del portafolio a `/api/portfolio-sync` (2.5 s después de cualquier cambio).
  El servidor la compara con la anterior y, si una parcela que ya existía pasó a amarillo o rojo, manda **un solo correo agrupado**.
  La primera sincronización solo guarda; las parcelas nuevas no generan aviso.
- **Resumen semanal**: el cron de Vercel (`vercel.json`, lunes 14:00 UTC = 8:00 a. m. CDMX) llama a `/api/weekly-summary`.
  Viene apagado por defecto.
- **Alertas por correo** es el interruptor general. Cada correo trae enlace de baja (`/api/unsubscribe`, firmado con HMAC).

Para activarlo:
1. Ejecuta `supabase/notificaciones.sql` en Supabase (SQL Editor).
2. En Vercel agrega `APP_URL`, `UNSUBSCRIBE_SECRET` y `CRON_SECRET` (ver `.env.example`). El resto de variables ya existen por el registro con OTP.
3. Vuelve a desplegar.

Límite: Gmail SMTP permite ~500 correos al día; si crece la base de usuarios, cambia solo `api/_lib/mailer.js` a Resend/Postmark.

