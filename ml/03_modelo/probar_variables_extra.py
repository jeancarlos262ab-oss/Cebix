"""
Prueba si agregar topografía (pendiente, elevación) y/o temperatura (Tmax, Tmin, GDD) a las 10 variables
finales mejora el modelo, con la misma validación espacial (leave-region-out) y 10 semillas del Random Forest.

Uso:
    python probar_variables_extra.py
Escribe resultados_4_variables_extra/prueba_variables_extra.csv (lo lee process_meta.py).
"""
import os
import sys
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from train_model import leave_region_out_cv, load_data  # noqa: E402

warnings.filterwarnings("ignore")

BASE = [
    "precip_acum_emergencia_macollamiento_mm", "bas_n_obs_ciclo", "bas_lai_espigado_llenado",
    "bas_ndti_emergencia_macollamiento", "bas_sti_encanado", "bas_ndvi_emergencia_macollamiento",
    "bas_ndwi_espigado_llenado", "bas_ndti_encanado", "bas_evi_emergencia_macollamiento", "bas_evi_encanado",
]
TEMP = ["tmax_media_ciclo", "tmin_media_ciclo", "gdd_acumulado_ciclo"]
SETS = [
    ("Variables actuales", "", []),
    ("+ Pendiente", "Topografía", ["pendiente_grados"]),
    ("+ Elevación", "Topografía", ["elevacion_m"]),
    ("+ Pendiente y elevación", "Topografía", ["pendiente_grados", "elevacion_m"]),
    ("+ Temperatura", "Temperatura (Tmax, Tmin, GDD)", TEMP),
    ("+ Topografía y temperatura", "Ambas", ["pendiente_grados", "elevacion_m"] + TEMP),
]
SEEDS = [42, 1, 2, 3, 4, 5, 6, 7, 8, 9]


def main():
    d = os.path.join(HERE, "..", "02_datos_procesados")
    train, _, _ = load_data(os.path.join(d, "features_train.csv"), os.path.join(d, "features_predict.csv"))
    y = train["rendimiento_t_ha"]
    rows = []
    for name, group, extra in SETS:
        feats = BASE + extra
        r2s, rmses, maes = [], [], []
        for s in SEEDS:
            oof = leave_region_out_cv(
                train, feats, "RF",
                lambda s=s: RandomForestRegressor(n_estimators=300, max_depth=4, min_samples_leaf=4, random_state=s),
            )
            r2s.append(r2_score(y, oof))
            rmses.append(np.sqrt(mean_squared_error(y, oof)))
            maes.append(mean_absolute_error(y, oof))
        rows.append({"variante": name, "grupo": group, "n_features": len(feats), "r2": np.mean(r2s), "r2_sd": np.std(r2s),
                     "rmse": np.mean(rmses), "mae": np.mean(maes)})
        print(f"{name:30s} n={len(feats):2d}  R2={np.mean(r2s):.3f} ± {np.std(r2s):.3f}  RMSE={np.mean(rmses):.3f}")
    out = os.path.join(HERE, "resultados_4_variables_extra", "prueba_variables_extra.csv")
    pd.DataFrame(rows).round(4).to_csv(out, index=False)
    print("->", out)


if __name__ == "__main__":
    main()
