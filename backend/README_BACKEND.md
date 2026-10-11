# Backend de inferencia real — Reto AgroCebada 2026

Ya está probado end-to-end en este mismo entorno: se levantó el servidor, se le mandó
el CSV real de las 59 parcelas de evaluación por HTTP, y las 59 predicciones que regresó
coinciden EXACTO (0 diferencias) con las que ya teníamos calculadas offline en
`ml/03_modelo/resultados_3_FINAL_top10_sin_planet/predicciones_finales.csv`. Es el modelo real
corriendo por request, no una copia de resultados guardados.

## Estructura del backend

```
backend/
├── app/
│   ├── main.py                 # crea la app FastAPI (CORS + routers)
│   ├── config.py               # rutas de archivos y variables de entorno
│   ├── schemas.py              # modelos de entrada (Pydantic)
│   ├── api/                    # endpoints, uno por tema
│   │   ├── health.py           #   GET /health, /
│   │   ├── model.py            #   GET /features, /model-info, /example-csv
│   │   ├── predict.py          #   POST /predict, /predict-csv
│   │   ├── satellite.py        #   GET /satellite-status, POST /predict-from-geometry
│   │   └── geo.py              #   POST /parse-geometry (SHP / GeoJSON / KML / KMZ -> polígonos)
│   └── services/               # lógica de negocio
│       ├── model_service.py    #   carga del modelo + inferencia (IC90, SHAP local)
│       ├── satellite_service.py#   proveedor de features satelitales (fuentes abiertas)
│       └── features/
│           ├── stac.py         #   features desde fuentes abiertas (por defecto)
│           └── common.py       #   ventanas, validación de polígonos y errores compartidos
├── models/                     # model_artifact.joblib + model_meta.json
├── data/                       # ejemplo_features_predict.csv (lo sirve /example-csv)
├── scripts/                    # herramientas que NO van al contenedor
│   ├── export_model.py         #   reentrena y regenera models/model_artifact.joblib
│   ├── validate_satelite.py    #   valida el cálculo satelital contra el dataset oficial
│   └── run.sh, run.bat, setup_venv.sh, setup_venv.bat
├── Dockerfile, render.yaml, requirements.txt
└── README_BACKEND.md
```

El comando de arranque es `uvicorn app.main:app` (antes `main:app`). Las URLs de la API no cambiaron,
así que el frontend no necesita ajustes.

## Correrlo local (con entorno virtual)

Requiere Python 3.11 o 3.12. Las dependencias quedan aisladas en `backend/.venv`.

**Linux / macOS**
```bash
cd backend
./scripts/setup_venv.sh     # crea .venv e instala requirements (solo la primera vez)
./scripts/run.sh            # activa .venv y arranca en http://localhost:8000
```

**Windows**
```bat
cd backend
scripts\setup_venv.bat
scripts\run.bat
```

**Manual**
```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
deactivate                       # para salir del entorno
```

`scikit-learn` está fijado en 1.8.0 porque `models/model_artifact.joblib` se guardó con esa
versión; con otra sale `InconsistentVersionWarning`. Si reentrenas con `scripts/export_model.py`,
actualiza ese pin a la versión con la que lo regeneres.

Pruébalo:
```bash
curl http://localhost:8000/
curl http://localhost:8000/features
curl http://localhost:8000/model-info
curl -X POST http://localhost:8000/predict-csv -F "file=@ruta/a/features_predict.csv"
```

`models/model_artifact.joblib` ya está incluido (el modelo ya entrenado — no hace falta
reentrenar para usar el backend). Si vuelven a correr `select_features.py` con otras
features, regeneren el artefacto:

```bash
python scripts/export_model.py          # usa ../ml/02_datos_procesados/features_train.csv por defecto
python ../ml/03_modelo/build_model_meta.py   # regenera models/model_meta.json (lo que sirve /model-info)
```

`numpy` está limitado a `<2.4` porque desde la 2.4 exige una CPU con instrucciones X86_V2
y en equipos antiguos falla con `RuntimeError: NumPy was built with baseline optimizations`.
Si aun así falla, usa `pip install "numpy==1.26.4"` dentro del entorno.

## Desplegarlo (para que el frontend en producción lo pueda llamar)

Este backend es un contenedor Docker estándar — cualquiera de estas opciones tiene capa
gratuita y sirve para el reto (no necesitas nada más sofisticado):

**Render.com** (la más simple):
1. Sube el repo completo a GitHub (el `render.yaml` de la raíz ya apunta a `backend/`).
2. En Render: "New Blueprint" → conecta el repo. Define `ALLOWED_ORIGINS` con el dominio del frontend (sin `/` final).
3. Espera el build (~2 min) → te da una URL pública tipo `https://tu-app.onrender.com`.

**Railway.app / Fly.io**: apunta el servicio a la carpeta `backend/` (usa su Dockerfile).

Cualquiera de las tres te da una URL HTTPS pública gratis — esa es la que pones en el
frontend (ver más abajo). El plan gratuito de Render "duerme" el servicio si no recibe
tráfico unos minutos; el primer request después tarda ~20-30s en despertar (normal, no es
un error) — para la demo en vivo del jurado, conviene abrir la URL un par de minutos
antes de empezar.

## Conectarlo al frontend

En tu `.env` de Vite:
```
VITE_MODEL_API_URL=https://tu-app.onrender.com
```

El dashboard (`src/services/modelApi.js`) ya consume esta API: ejecuta el modelo con
`/predict-csv` y carga métricas y SHAP global desde `/model-info`.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/` | Confirma que el servicio está vivo y qué modelo cargó |
| GET | `/health` | Chequeo ligero (no carga el modelo); lo usa Render |
| GET | `/features` | Lista las 10 features que el modelo espera, con nombre legible |
| GET | `/model-info` | Métricas de validación, comparación de algoritmos, SHAP global, preguntas guía (de `models/model_meta.json`) |
| GET | `/example-csv` | CSV de ejemplo: 59 parcelas de evaluación con `lat`/`lng` |
| POST | `/predict` | JSON con una o varias parcelas → predicción real |
| POST | `/predict-csv` | Sube un CSV (mismo formato que `features_predict.csv`) → predicción real de cada fila |
| POST | `/parse-geometry` | Lee shapefile (`.zip` o `.shp`+`.dbf`+`.prj`), GeoJSON, KML o KMZ y devuelve los polígonos en lng/lat con área, centroide y validación (ver abajo) |
| POST | `/predict-from-geometry` | Polígono GeoJSON + año → calcula las 10 features en vivo desde satélite (fuentes abiertas, sin cuenta) y predice (30–90 s) |
| GET | `/satellite-status` | Proveedor activo y si está listo (no llama a la red) |

## Archivos de parcelas (`POST /parse-geometry`)

Multipart con uno o varios archivos en el campo `files` (máx. 20 MB en total). Formatos: shapefile (un `.zip`, o `.shp` + `.dbf` + `.prj`
sueltos; `.shx` y `.cpg` opcionales), GeoJSON, KML y KMZ. Reproyecta a EPSG:4326 con el `.prj` (si no hay `.prj`, solo acepta coordenadas que ya sean
lat/lng), separa los MultiPolygon, ignora altitud y huecos, simplifica contornos de más de 500 vértices y valida cada polígono con las mismas reglas
que `/predict-from-geometry` (área 0.05–5000 ha, sin cruces). Cada polígono trae `error` si no se podría calcular.

```bash
curl -X POST http://localhost:8000/parse-geometry -F "files=@parcelas.zip"
```

Respuesta: `{ n_poligonos, n_validos, advertencias, poligonos: [{ ID_POLIGONO, nombre, Estado, Municipio, geometry, area_ha, lat, lng, vertices, error, origen, propiedades }] }`.
Reconoce atributos `ID_POLIGONO`/`id`/`nombre`, `Estado` y `Municipio` (aunque el DBF los trunque a 10 caracteres). Errores: 400 archivo ilegible, 413 muy grande,
415 formato no compatible, 422 sin polígonos o sin `.prj` con coordenadas proyectadas.

## Parcelas nuevas desde satélite (`POST /predict-from-geometry`)

Sin cuentas, sin tarjeta y sin cuota: usa solo fuentes abiertas que se leen de forma anónima (`app/services/features/stac.py`).

| Variable | Fuente |
|---|---|
| NDVI, EVI, LAI, NDWI, NDTI, STI (8 de las 10 features) | Sentinel-2 L2A, catálogo abierto **Earth Search** (Element 84, AWS Open Data). Se descarga solo el recorte de la parcela (COG) |
| Conteo de escenas (`bas_n_obs_ciclo`) | Metadatos de Sentinel-2 + Landsat 8/9 (T1, nubes ≤ 40 %), contando fechas distintas |
| Lluvia abr–may | **CHIRPS v2.0** diario (UCSB-CHC), COG anónimo, 61 días, ponderado por fracción de píxel cubierta |

Método idéntico al del dataset oficial: promedio del polígono por escena → mediana por ventana fenológica.

```bash
curl http://localhost:8000/satellite-status      # {"provider":"stac","ready":true,...}
curl -X POST http://localhost:8000/predict-from-geometry -H "Content-Type: application/json" -d '{
  "ID_POLIGONO": "NUEVA_01", "Estado": "Puebla", "anio": 2025,
  "geometry": {"type": "Polygon", "coordinates": [[[-98.43,19.28],[-98.429,19.28],[-98.429,19.281],[-98.43,19.281],[-98.43,19.28]]]}
}'
```

Respuesta: `features_calculadas` (las 10), `yieldEstimate`, `ic90_inferior/superior`, `confidence`, `shap`, `area_ha`,
`proveedor` y `advertencias` (avisos legibles: año distinto de 2025, pocas escenas, variable sin datos…).

**Códigos de error**

| Código | Cuándo |
|---|---|
| 422 | Geometría inválida (no Polygon, UTM, se cruza, <0.05 ha), año fuera de 2018–hoy, o se obtuvieron datos de menos de 7 de las 10 variables |
| 429 | Ya hay otro cálculo en curso (se procesa uno a la vez para cuidar la memoria) |
| 502 | La fuente de imágenes o el catálogo no respondieron (reintenta en unos minutos) |
| 503 | Faltan librerías en el servidor |

**Variables de entorno opcionales** (por si cambian las rutas públicas, sin tocar código): `STAC_API_URL`, `STAC_S2_COLLECTION`,
`STAC_LS_COLLECTION`, `CHIRPS_URL_TEMPLATE`, `STAC_WORKERS`, `AREA_WARN_HA`, `SAT_QUEUE_TIMEOUT_S`.

**Superficie:** no hay tope. Si la zona mide más de `AREA_WARN_HA` (1000 ha por defecto) se calcula igual, pero la respuesta trae una advertencia: el promedio de una zona tan grande mezcla cultivos y coberturas distintas y no representa a una parcela.

### Qué está verificado y qué NO (decirlo así en el reporte)

- **Verificado** con imágenes sintéticas en disco: lectura del recorte, máscara del polígono, remuestreo del SWIR de 20 a 10 m, fórmulas de los
  6 índices, mediana por ventana, descarte de duplicados reprocesados, conteo de fechas (excluye Landsat 7 y categoría T2), lluvia de 61 días con
  ponderación entre píxeles y rechazo si falta un día, errores HTTP, y el flujo completo frontend → backend → modelo.
- **NO verificado contra los servicios reales** (el entorno de desarrollo no tenía internet): la ruta pública de CHIRPS, los nombres de colección y
  de banda de Earth Search (`blue, red, nir, swir16, swir22`), la escala/offset de reflectancia que publica, el uso de memoria en el plan gratuito de
  Render y la velocidad real. Primera ejecución recomendada: `curl /satellite-status`, luego `python scripts/validate_satelite.py ... --n 1`.
- **Los números pueden diferir del dataset oficial** (otra versión de procesamiento, píxeles de borde, LAI con valores no finitos descartados píxel a
  píxel). Por eso la validación del Paso 8 es obligatoria antes de citar resultados:

```bash
pip install geopandas
python scripts/validate_satelite.py --csv ../ml/02_datos_procesados/features_completo.csv --shp ruta/a/Parcelas_Reto_AGC_CONJUNTO.shp --n 5
```
Imprime la diferencia porcentual por variable y guarda `validacion_satelite.json`; cópialo a `cebix/src/data/sateliteValidation.json`.

### Si `/satellite-status` o la pantalla dicen «Faltan librerías en el servidor»

- `rasterio: no instalado` → `python -m pip install -r requirements.txt` en el MISMO entorno que ejecuta `uvicorn`, y reiniciar.
- `libexpat.so.1: cannot open shared object file` → falta una librería del **sistema**, no de Python. En Docker ya se instala en el `Dockerfile`
  (`libexpat1`); hay que **reconstruir la imagen** (en Render: nuevo despliegue sin caché). En un Debian/Ubuntu propio: `sudo apt-get install -y libexpat1`.
- `pip` no puede instalar `rasterio` → casi siempre la versión de Python; usa 3.11 o 3.12.

### ¿Es realmente gratis?

Los datos sí: Sentinel-2 y Landsat son abiertos, y tanto Earth Search como CHIRPS se leen sin llave ni registro. Earth Search aclara que es de uso libre
**sin garantía de servicio**, así que puede ser lento o fallar a ratos. El hospedaje es aparte: el plan gratuito de Render duerme el servicio y tiene
límites de memoria (no los medí con esta carga).

## Limitación honesta (decirla en el reporte/demo si preguntan)

`/predict` y `/predict-csv` ejecutan el modelo real sobre features YA CALCULADAS. Las parcelas nuevas dibujadas en el mapa
solo se pueden predecir con `/predict-from-geometry`, que lee satélites reales pero cuyo parecido con el dataset oficial
depende de que la validación del Paso 8 haya pasado. El modelo final ya no usa Planet (de pago): todas sus features son reproducibles con fuentes gratuitas.
