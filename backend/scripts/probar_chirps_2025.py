import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

year = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
lon = float(sys.argv[2]) if len(sys.argv) > 2 else -98.2
lat = float(sys.argv[3]) if len(sys.argv) > 3 else 19.0

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
    except Exception as e:  
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