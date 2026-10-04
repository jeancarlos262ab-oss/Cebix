FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Librerías del SISTEMA que necesita rasterio (sus wheels traen GDAL, pero no estas). Sin libexpat1 falla con
# «libexpat.so.1: cannot open shared object file». Detectadas con readelf sobre rasterio 1.5.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 zlib1g libstdc++6 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY gee_features.py .
COPY stac_features.py .
COPY model_artifact.joblib .
COPY model_meta.json .
COPY data ./data

# Render inyecta $PORT (10000 por defecto); en local cae a 8000.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
