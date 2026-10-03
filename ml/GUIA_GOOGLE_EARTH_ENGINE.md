# Integrar Google Earth Engine (GEE) — features en vivo para parcelas nuevas

## Objetivo

El backend (`backend/`) ya ejecuta el modelo real, pero solo sobre
features **ya calculadas** (CSV). Tu tarea: escribir una función en Python que reciba un
**polígono (GeoJSON)** y un **año**, y regrese un diccionario con las 10 features del
modelo, calculadas en vivo desde Earth Engine. Con eso se puede dibujar una parcela nueva
y obtener predicción real.

**Todo es gratis.** Ya se tomó la decisión de no usar servicios de pago: el modelo final
se reentrenó SIN Planet (API de pago) y sin ningún índice difícil de reproducir (FAPAR,
VI6T, MRA, NDDI/ENDDI). Resultado: **RMSE 0.642 / R² 0.426**, igual o mejor que con esas
variables. No hay que decidir nada más sobre eso.

## Las 10 features y de dónde sale cada una

| # | Feature del modelo | Fuente en GEE | Ventana |
|---|---|---|---|
| 1 | `precip_acum_emergencia_macollamiento_mm` | CHIRPS diario (suma) | 1 abr – 31 may |
| 2 | `bas_n_obs_ciclo` | Conteo de escenas Sentinel-2 + Landsat 8/9 (nubes ≤ 40%) | 1 abr – 31 oct |
| 3 | `bas_lai_espigado_llenado` | Sentinel-2 | 1 ago – 30 sep |
| 4 | `bas_ndti_emergencia_macollamiento` | Sentinel-2 | 1 abr – 31 may |
| 5 | `bas_sti_encanado` | Sentinel-2 | 1 jun – 31 jul |
| 6 | `bas_ndvi_emergencia_macollamiento` | Sentinel-2 | 1 abr – 31 may |
| 7 | `bas_ndwi_espigado_llenado` | Sentinel-2 | 1 ago – 30 sep |
| 8 | `bas_ndti_encanado` | Sentinel-2 | 1 jun – 31 jul |
| 9 | `bas_evi_emergencia_macollamiento` | Sentinel-2 | 1 abr – 31 may |
| 10 | `bas_evi_encanado` | Sentinel-2 | 1 jun – 31 jul |

Ya no se necesita temperatura, topografía ni Planet. Solo **Sentinel-2 + CHIRPS + conteo
de escenas**.

---

## Paso 1 — Proyecto de Google Cloud y registro en Earth Engine

1. Crea (o reutiliza) un proyecto en https://console.cloud.google.com/ y anota el
   **Project ID** técnico (ej. `agrocebada-2026-abc123`).
2. Registra ese proyecto en https://code.earthengine.google.com/register con la opción
   **uso no comercial / académico** (gratis).

## Paso 2 — Cuenta de servicio (para que el backend se autentique solo)

1. Cloud Console → **IAM y administración → Cuentas de servicio → Crear**. Nombre
   sugerido: `agrocebada-gee-backend`.
2. Rol: **Earth Engine Resource Writer** (o Editor si no aparece).
3. Entra a la cuenta → **Claves → Agregar clave → JSON**. Guarda el archivo como
   `gee-service-account.json`.
   **Es una contraseña: agrégalo al `.gitignore`, NUNCA lo subas a GitHub.**
4. Registra también el email de la cuenta de servicio (`...@...iam.gserviceaccount.com`)
   en https://code.earthengine.google.com/register (igual que el paso 1). Si te salta
   error de permisos después, casi siempre es que falta este paso.

## Paso 3 — Instalar y probar conexión

```bash
pip install earthengine-api
```

```python
import ee

credentials = ee.ServiceAccountCredentials(
    email="agrocebada-gee-backend@TU-PROYECTO.iam.gserviceaccount.com",
    key_file="gee-service-account.json",
)
ee.Initialize(credentials, project="TU-PROJECT-ID")
print(ee.Number(1).add(1).getInfo())  # debe imprimir 2
```

## Paso 4 — Índices (fórmulas oficiales del PDF de FIRA)

Sentinel-2 en GEE: colección `COPERNICUS/S2_SR_HARMONIZED`, reflectancia x10000 (hay que
dividir entre 10000). Solo se necesitan estos 6 índices:

```python
def add_indices(image):
    img = image.divide(10000)
    B2, B3, B4, B8 = img.select("B2"), img.select("B3"), img.select("B4"), img.select("B8")
    B11, B12 = img.select("B11"), img.select("B12")

    ndvi = B8.subtract(B4).divide(B8.add(B4)).rename("ndvi")
    evi = B8.subtract(B4).divide(
        B8.add(B4.multiply(6)).subtract(B2.multiply(7.5)).add(1)
    ).multiply(2.5).rename("evi")
    savi = B8.subtract(B4).multiply(1.5).divide(B8.add(B4).add(0.5))
    lai = savi.multiply(-1).add(0.69).divide(0.59).log().multiply(-1).divide(0.91).rename("lai")
    ndwi = B8.subtract(B11).divide(B8.add(B11)).rename("ndwi")
    ndti = B11.subtract(B12).divide(B11.add(B12)).rename("ndti")
    sti = B11.divide(B12).rename("sti")

    return image.addBands([ndvi, evi, lai, ndwi, ndti, sti])
```

Ojo con LAI: la fórmula del PDF es `(-log((0.69 - SAVI)/0.59)) / 0.91`. Cuando SAVI ≥ 0.69
el logaritmo no está definido (da NaN/inf); es esperable en píxeles muy densos — esas
escenas simplemente no aportan a la mediana, igual que en el dataset original.

## Paso 5 — Filtro de nubes y mediana por ventana (replicar el dataset oficial)

**Importante para que los números coincidan:** en el CSV oficial, cada fila es
*una fecha* con el **promedio del polígono** (`ndvi_promedio`, etc.), y el pipeline offline
saca la **mediana de esas fechas** dentro de cada ventana. Hay que hacer lo mismo
(promedio del polígono por imagen → mediana entre imágenes), NO un compuesto mediano por
píxel — da números distintos.

```python
def s2_collection(geometry, start, end):
    return (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geometry)
        .filterDate(start, end)
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", 40))  # mismo umbral que build_features.py
        .map(add_indices)
    )

def window_median(geometry, year, start_md, end_md, band):
    col = s2_collection(geometry, f"{year}-{start_md}", f"{year}-{end_md}")

    def per_image(img):
        val = img.select(band).reduceRegion(
            reducer=ee.Reducer.mean(), geometry=geometry, scale=10, maxPixels=1e9
        ).get(band)
        return ee.Feature(None, {"v": val})

    values = ee.FeatureCollection(col.map(per_image)).filter(ee.Filter.notNull(["v"]))
    return values.aggregate_array("v").reduce(ee.Reducer.median()).getInfo()
```

Nota: `filterDate` excluye el día final, así que usa el día **siguiente** al último de la
ventana como `end` (`06-01`, `08-01`, `10-01`), como en el Paso 7.

Ventanas a usar (ya acordadas con el equipo; están en `build_features.py > PHENO_WINDOWS`):
`emergencia_macollamiento` = abr–may, `encanado` = jun–jul, `espigado_llenado` = ago–sep.

## Paso 6 — Precipitación (CHIRPS) y conteo de escenas

```python
def precip_acumulada(geometry, start, end):
    total = (
        ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        .filterDate(start, end)
        .sum()
    )
    return total.reduceRegion(
        ee.Reducer.mean(), geometry, scale=5566, maxPixels=1e9
    ).get("precipitation").getInfo()

def n_obs_ciclo(geometry, year):
    """Fechas distintas con escena Sentinel-2 o Landsat 8/9 (nubes <= 40%),
    1 abr - 31 oct. Se cuenta por FECHA porque en el dataset oficial hay una fila por
    (parcela, fecha, sensor)."""
    start, end = f"{year}-04-01", f"{year}-11-01"

    s2 = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
          .filterBounds(geometry).filterDate(start, end)
          .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", 40)))
    s2_dates = s2.aggregate_array("system:time_start").map(
        lambda t: ee.Date(t).format("YYYY-MM-dd")).distinct().size()

    def landsat(col_id):
        return (ee.ImageCollection(col_id)
                .filterBounds(geometry).filterDate(start, end)
                .filter(ee.Filter.lte("CLOUD_COVER", 40)))
    ls = landsat("LANDSAT/LC08/C02/T1_L2").merge(landsat("LANDSAT/LC09/C02/T1_L2"))
    ls_dates = ls.aggregate_array("system:time_start").map(
        lambda t: ee.Date(t).format("YYYY-MM-dd")).distinct().size()

    return s2_dates.add(ls_dates).getInfo()
```

Referencia para validar: en el dataset oficial una parcela típica tiene ~34 fechas
Sentinel-2 y ~20 Landsat en el ciclo (≈54 en total). Si tu conteo sale muy lejos de eso
(ej. 20 o 100), revisa el filtro de nubes o si estás contando tiles duplicados.

## Paso 7 — Función completa (misma forma de salida que espera el backend)

```python
def extract_features_gee(geometry_geojson, year=2025):
    geom = ee.Geometry(geometry_geojson)  # GeoJSON en lat/lng (EPSG:4326)

    return {
        "precip_acum_emergencia_macollamiento_mm": precip_acumulada(geom, f"{year}-04-01", f"{year}-06-01"),
        "bas_n_obs_ciclo": n_obs_ciclo(geom, year),
        "bas_lai_espigado_llenado": window_median(geom, year, "08-01", "10-01", "lai"),
        "bas_ndti_emergencia_macollamiento": window_median(geom, year, "04-01", "06-01", "ndti"),
        "bas_sti_encanado": window_median(geom, year, "06-01", "08-01", "sti"),
        "bas_ndvi_emergencia_macollamiento": window_median(geom, year, "04-01", "06-01", "ndvi"),
        "bas_ndwi_espigado_llenado": window_median(geom, year, "08-01", "10-01", "ndwi"),
        "bas_ndti_encanado": window_median(geom, year, "06-01", "08-01", "ndti"),
        "bas_evi_emergencia_macollamiento": window_median(geom, year, "04-01", "06-01", "evi"),
        "bas_evi_encanado": window_median(geom, year, "06-01", "08-01", "evi"),
    }
```

Cada `.getInfo()` es una llamada de red (~1-3 s). Son ~10, así que una parcela tarda unos
15-30 s en total. Para la demo, avisa al usuario en el frontend con un "Calculando índices
satelitales...".

## Paso 8 — VALIDACIÓN (obligatoria antes de conectarlo)

1. Toma 5 parcelas de `02_datos_procesados/features_completo.csv` (las de ENTRENAMIENTO
   ya tienen sus valores) y sus polígonos del shapefile `Parcelas_Reto_AGC_CONJUNTO.shp`
   (conviértelos a GeoJSON en EPSG:4326 con `geopandas`: `gdf.to_crs(4326).geometry`).
2. Corre `extract_features_gee(geom, 2025)` sobre cada una.
3. Compara las 10 columnas contra `features_completo.csv` y arma una tabla con la
   diferencia porcentual.
4. **Criterio:** índices espectrales y precipitación dentro de ~10-15%. `bas_n_obs_ciclo`
   puede diferir más (depende de cómo se cuentan tiles/fechas); si es sistemático, se
   ajusta o se documenta.
5. Guarda esa tabla: va en el reporte técnico como evidencia de qué tan fiel es el
   cálculo en vivo respecto al dataset oficial. Diferencias pequeñas son normales
   (distinta versión de procesamiento atmosférico, geometría exacta, etc.).

Si algo sale muy fuera de rango, revisa primero: (a) que el polígono esté en lat/lng y
no en UTM, (b) que las fechas `end` sean el día *siguiente* al último de la ventana,
(c) que uses promedio-por-imagen → mediana (Paso 5) y no compuesto por píxel.

## Paso 9 — Conectar al backend

Cuando la validación pase, agrega el endpoint nuevo en
`backend/main.py` **sin tocar `/predict-csv`** (ya está probado):

```python
from fastapi import Body

@app.post("/predict-from-geometry")
def predict_from_geometry(payload: dict = Body(...)):
    # {"ID_POLIGONO": "NUEVA_01", "Estado": "Puebla", "geometry": {...GeoJSON...}, "anio": 2025}
    features = extract_features_gee(payload["geometry"], payload.get("anio", 2025))
    df = pd.DataFrame([features])
    result = run_inference(df, [payload["Estado"]])[0]
    return {"ID_POLIGONO": payload["ID_POLIGONO"], "features_calculadas": features, **result}
```

Variables de entorno para producción (Render/Railway): sube el contenido del JSON de la
cuenta de servicio como variable secreta (ej. `GEE_SERVICE_ACCOUNT_JSON`) y escríbelo a un
archivo temporal al arrancar, en vez de subir el archivo al repo.

## Riesgos / cosas que se pueden atorar

- **Cuotas**: GEE gratuito limita peticiones concurrentes. Procesa parcelas de una en una.
- **Clave revocada**: si el backend deja de autenticar de un día para otro, revisa que el
  proyecto de Cloud siga activo y que la clave no se haya regenerado.
- **Primer request lento**: normal (arranque en frío de Render + latencia de GEE).
- **El año importa**: el modelo se entrenó con el ciclo abril–octubre **2025**. Para otros
  años el modelo extrapola (clima distinto); dilo si preguntan.
- **Ventanas fenológicas fijas**: se asumen iguales para todas las parcelas (abr–may /
  jun–jul / ago–sep), igual que en el entrenamiento. Es el supuesto agronómico ya
  documentado en el README.

## Recursos

- Registro Earth Engine: https://code.earthengine.google.com/register
- Consola de Google Cloud: https://console.cloud.google.com/
- Instalación de `earthengine-api`: https://developers.google.com/earth-engine/guides/python_install
- Catálogo de datasets (para confirmar nombres de bandas): https://developers.google.com/earth-engine/datasets
