import argparse
import sys
import time
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.services.features import stac  

def read_day(url: str, bbox, tries: int = 4):
    import rasterio
    from rasterio.windows import from_bounds

    last = None
    for attempt in range(tries):
        try:
            with rasterio.Env(GDAL_HTTP_RETRY_CODES="ALL", GDAL_HTTP_USERAGENT=stac.CHIRPS_USER_AGENT):
                with rasterio.open(url) as src:
                    win = from_bounds(*bbox, transform=src.transform).round_offsets().round_lengths()
                    data = src.read(1, window=win).astype("float64")
                    nodata = src.nodata
                    if nodata is not None:
                        data[data == nodata] = float("nan")
                    data[data < 0] = float("nan")
                    return data, src.window_transform(win), src.crs
        except Exception as e:  
            last = e
            time.sleep(2**attempt)
    raise RuntimeError(f"{url}: {last}")

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("year", type=int)
    ap.add_argument("--bbox", type=float, nargs=4, default=[-118.5, 14.0, -86.0, 33.5], metavar=("W", "S", "E", "N"))
    ap.add_argument("--out", type=Path, default=stac.CHIRPS_LOCAL_DIR)
    args = ap.parse_args()

    import numpy as np
    import rasterio

    start = date(args.year, 4, 1)
    days = [start + timedelta(d) for d in range((date(args.year, 6, 1) - start).days)]
    total = None
    transform = crs = None
    templates = stac._chirps_templates()
    print(f"{len(days)} días, plantillas: {templates}")
    for d in days:
        data = None
        errs = []
        for tpl in templates:
            url = tpl.format(year=d.year, month=d.month, day=d.day)
            try:
                data, tf, cr = read_day(url, args.bbox)
                break
            except Exception as e:  
                errs.append(str(e)[:160])
        if data is None:
            print(f"✗ {d}: {errs[0] if errs else 'sin datos'}\nNo se escribe la rejilla: faltan días.", file=sys.stderr)
            return 1
        if total is None:
            total, transform, crs = np.zeros_like(data), tf, cr
        elif data.shape != total.shape:
            print(f"✗ {d}: tamaño distinto ({data.shape} vs {total.shape}); usa solo una versión de CHIRPS.", file=sys.stderr)
            return 1
        total += np.nan_to_num(data, nan=0.0)
        print(f"✓ {d}", end="\r", flush=True)

    args.out.mkdir(parents=True, exist_ok=True)
    path = args.out / f"chirps_abr_may_{args.year}.tif"
    with rasterio.open(
        path, "w", driver="GTiff", height=total.shape[0], width=total.shape[1], count=1, dtype="float32",
        crs=crs, transform=transform, compress="deflate", nodata=-9999.0,
    ) as dst:
        dst.write(total.astype("float32"), 1)
    print(f"\nListo: {path} ({path.stat().st_size / 1024:.0f} KB). Haz commit y vuelve a desplegar.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())