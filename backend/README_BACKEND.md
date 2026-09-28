# Backend de inferencia real — Reto AgroCebada 2026

Ya está probado end-to-end en este mismo entorno: se levantó el servidor, se le mandó
el CSV real de las 59 parcelas de evaluación por HTTP, y las 59 predicciones que regresó
coinciden EXACTO (0 diferencias) con las que ya teníamos calculadas offline en
`03_modelo/resultados_3_FINAL_top10_sin_planet/predicciones_finales.csv`. Es el modelo real
corriendo por request, no una copia de resultados guardados.

## Correrlo local (con entorno virtual)

Requiere Python 3.11 o 3.12. Las dependencias quedan aisladas en `backend/.venv`.

**Linux / macOS**
```bash
cd backend
./setup_venv.sh     # crea .venv e instala requirements (solo la primera vez)
./run.sh            # activa .venv y arranca en http://localhost:8000
```

**Windows**
```bat
cd backend
setup_venv.bat
run.bat
```

**Manual**
```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
deactivate                       # para salir del entorno
```

`scikit-learn` está fijado en 1.8.0 porque `model_artifact.joblib` se guardó con esa
versión; con otra sale `InconsistentVersionWarning`. Si reentrenas con `export_model.py`,
actualiza ese pin a la versión con la que lo regeneres.

Pruébalo:
```bash
curl http://localhost:8000/
curl http://localhost:8000/features
curl -X POST http://localhost:8000/predict-csv -F "file=@ruta/a/features_predict.csv"
```

`model_artifact.joblib` ya está incluido (el modelo ya entrenado — no hace falta
reentrenar para usar el backend). Si vuelven a correr `select_features.py` con otras
features, regeneren el artefacto:

```bash
python export_model.py --train ../02_datos_procesados/features_train.csv --out ./model_artifact.joblib
```

`numpy` está limitado a `<2.4` porque desde la 2.4 exige una CPU con instrucciones X86_V2
y en equipos antiguos falla con `RuntimeError: NumPy was built with baseline optimizations`.
Si aun así falla, usa `pip install "numpy==1.26.4"` dentro del entorno.

## Desplegarlo (para que el frontend en producción lo pueda llamar)

Este backend es un contenedor Docker estándar — cualquiera de estas opciones tiene capa
gratuita y sirve para el reto (no necesitas nada más sofisticado):

**Render.com** (la más simple):
1. Sube esta carpeta `backend/` a un repo de GitHub.
2. En Render: "New Web Service" → conecta el repo → detecta el Dockerfile solo.
3. Espera el build (~2 min) → te da una URL pública tipo `https://tu-app.onrender.com`.

**Railway.app**: mismo flujo, "New Project" → "Deploy from GitHub" → detecta el Dockerfile.

**Fly.io**: `fly launch` desde esta carpeta (usa el Dockerfile automáticamente).

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

Y usa el componente de ejemplo `EjecutarModeloUpload.jsx` (en este mismo paquete) como
punto de partida para una página donde subes un CSV y ves las predicciones reales
calculadas en vivo — es exactamente lo que las bases de FIRA piden con "aplicación que
permita ejecutar el modelo predictivo".

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/` | Confirma que el servicio está vivo y qué modelo cargó |
| GET | `/features` | Lista las 10 features que el modelo espera, con nombre legible |
| POST | `/predict` | JSON con una o varias parcelas → predicción real |
| POST | `/predict-csv` | Sube un CSV (mismo formato que `features_predict.csv`) → predicción real de cada fila |

## Limitación honesta (decirla en el reporte/demo si preguntan)

Este backend ejecuta el modelo real sobre features YA CALCULADAS (las 10 columnas que
`build_features.py` extrae de satélite/clima/topografía). No recalcula esas features
en vivo a partir de una geometría nueva dibujada en el mapa — eso requeriría conectar
Google Earth Engine en tiempo real (gratis). Ya está lista la guía paso a paso para
que un compañero lo implemente: ver `GUIA_GOOGLE_EARTH_ENGINE.md` en la raíz del paquete.
El modelo final ya no usa Planet (de pago), así que todas sus features son reproducibles
con fuentes gratuitas. Lo que sí resuelve de verdad: cualquier CSV con esas 10
columnas —incluyendo el que use el jurado para verificar— se predice en vivo, con el
modelo real, no con una tabla fija.
