"""
Prueba del cálculo de lluvia CHIRPS (abril-mayo) con los cambios de stac.py.

Colócalo en  E:\Proyecto Cebix\backend\scripts\  y ejecútalo desde la carpeta backend:

    python scripts/probar_chirps_2025.py
    python scripts/probar_chirps_2025.py 2025            # otro año
    python scripts/probar_chirps_2025.py 2025 -98.2 19.0 # otro punto (lon lat)

Paso 1: prueba el archivo que antes daba 403 (30 de mayo) con reintentos.
Paso 2: corre el cálculo completo de lluvia abr-may con una parcela de ejemplo.
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

year = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
lon = float(sys.argv[2]) if len(sys.argv) > 2 else -98.2
lat = float(sys.argv[3]) if len(sys.argv) > 3 else 19.0

# Parcela de ejemplo: cuadrito de ~1 km alrededor del punto (cámbialo por una parcela tuya si quieres).
d = 0.005
geom = {
    "type": "Polygon",
    "coordinates": [[[lon - d, lat - d], [lon - d, lat + d], [lon + d, lat + d], [lon + d, lat - d], [lon - d, lat - d]]],
}

print(f"== Paso 1: ¿responde el archivo del 30 de mayo de {year}? ==")
import rasterio

url = f"https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/cogs/p05/{year}/chirps-v2.0.{year}.05.30.cog"
ok = False
for i in range(5):
    try:
        with rasterio.Env(GDAL_HTTP_RETRY_CODES="ALL"), rasterio.open(url) as s:
            print(f"  intento {i}: OK ({s.width}x{s.height})")
            ok = True
            break
    except Exception as e:  # noqa: BLE001
        print(f"  intento {i}: FALLA {str(e)[:110]}")
        time.sleep(2**i)
print("  ->", "responde (el 403 era un límite de peticiones)" if ok else "403 permanente: se usará otra versión de CHIRPS para ese día")

print(f"\n== Paso 2: lluvia acumulada abr-may {year} (puede tardar 1-2 min) ==")
from app.services.features import stac

warnings = []
t0 = time.time()
mm = stac._precip(geom, year, warnings)
print(f"  lluvia acumulada: {mm} mm   ({time.time() - t0:.0f} s)")
print("  advertencias:", warnings or "ninguna")
if mm is None:
    print("  -> el modelo usaría la mediana de entrenamiento. Pásame las advertencias de arriba.")
elif any("estimada" in w for w in warnings):
    print("  -> faltaron pocos días y se estimó la suma con los días válidos.")
else:
    print("  -> listo: suma completa.")
