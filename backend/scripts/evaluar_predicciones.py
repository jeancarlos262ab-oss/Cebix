import argparse
import json

import numpy as np
import pandas as pd

def load_pred(path):
    if path.lower().endswith(".json"):
        d = json.load(open(path, encoding="utf-8"))
        return pd.DataFrame(d["predicciones"] if isinstance(d, dict) else d)
    return pd.read_csv(path, encoding="utf-8-sig")

def main(pred_path, real_path):
    p = load_pred(pred_path)
    r = pd.read_csv(real_path, encoding="utf-8-sig").iloc[:, :]
    r = r.rename(columns={c: "real" for c in r.columns if c.upper() in ("RENDIMIENTO_T_HA", "REAL", "RENDIMIENTO")})
    d = p.merge(r[["ID_POLIGONO", "real"]], on="ID_POLIGONO").dropna(subset=["real", "yieldEstimate"])
    if d.empty:
        raise SystemExit("Ningún ID_POLIGONO coincide entre predicciones y observado.")
    e = d.real - d.yieldEstimate
    rmse, mae = float(np.sqrt((e ** 2).mean())), float(e.abs().mean())
    r2 = 1 - (e ** 2).sum() / ((d.real - d.real.mean()) ** 2).sum()
    base = float(np.sqrt(((d.real - d.real.mean()) ** 2).mean()))
    print(f"Parcelas comparadas: {len(d)}")
    print(f"RMSE {rmse:.3f} t/ha | MAE {mae:.3f} t/ha | R² {r2:.3f} | sesgo medio {e.mean():+.3f} t/ha")
    print(f"Referencia (predecir el promedio observado): RMSE {base:.3f} t/ha -> el modelo {'mejora' if rmse < base else 'NO mejora'}")
    if {"ic90_inferior", "ic90_superior"} <= set(d.columns):
        cov = ((d.real >= d.ic90_inferior) & (d.real <= d.ic90_superior)).mean()
        print(f"Cobertura del IC 90 %: {cov:.1%} (esperado ~90 %)")
    if "Estado" in d.columns:
        print("\nRMSE por estado:")
        print(d.assign(e2=e ** 2).groupby("Estado").e2.mean().pow(.5).round(3).to_string())
    if "fuera_de_rango" in d.columns and d.fuera_de_rango.any():
        s = d.fuera_de_rango
        print(f"\nRMSE fuera de rango ({s.sum()} parcelas): {np.sqrt((e[s] ** 2).mean()):.3f} | dentro: {np.sqrt((e[~s] ** 2).mean()):.3f}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pred", required=True)
    ap.add_argument("--real", required=True)
    a = ap.parse_args()
    main(a.pred, a.real)