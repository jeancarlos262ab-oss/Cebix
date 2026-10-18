import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.services.features import stac  

year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
lng, lat = (float(sys.argv[2]), float(sys.argv[3])) if len(sys.argv) > 3 else (-98.2, 19.0)
d = 0.002
geom = {"type": "Polygon", "coordinates": [[[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]]]}

for tpl in stac._chirps_templates():
    print("\nPlantilla:", tpl)
    for day in (1, 15, 30):
        url = tpl.format(year=year, month=4, day=day)
        try:
            print(f"  {year}-04-{day:02d} -> {stac._chirps_day(url, geom)} mm")
        except Exception as e:  
            print(f"  {year}-04-{day:02d} -> ERROR {type(e).__name__}: {e}")