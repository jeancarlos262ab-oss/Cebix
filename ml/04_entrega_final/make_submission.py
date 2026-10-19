"""
Genera el CSV de entrega final para el Reto AgroCebada 2026.

FIRA pide, además de subir todo a la plataforma del reto, enviar por correo a
innovacion@fira.gob.mx un archivo nombrado exactamente:

    nombre_del_equipo_prediccion.csv      (ej. agrozed_prediccion.csv)

con la predicción de rendimiento de las 59 parcelas del conjunto de PREDICCION, en el formato de la plantilla
del reto (ID_area_rendimiento_70_30_Reto_AgroCebada.csv), 4 columnas:

    ID_POLIGONO, AREA_HA, RENDIMIENTO_T_HA, CONJUNTO

Uso (con el mejor modelo: "Solo lluvia", Random Forest, RMSE 0.53 t/ha; sus predicciones salen de entrenar_y_validar.py):
    python make_submission.py --team agrozed --out-dir ./entrega

`--predictions` (opcional, por defecto 03_modelo/resultados_FINAL/predicciones_finales.csv) debe ser un CSV con, al menos:
    ID_POLIGONO, rendimiento_t_ha
`--reference` (opcional) es la plantilla oficial ID_area_rendimiento_*.csv; si no se da, se usa backend/data/parcelas_oficiales.csv,
que trae el mismo ID, área y conjunto de cada parcela.

El script:
  1. Verifica que estén las 59 parcelas de PREDICCION, ni una de más ni de menos.
  2. Verifica que no haya rendimientos nulos, negativos o absurdamente altos (>15 t/ha
     sería un error de escala casi seguro para cebada de temporal).
  3. Escribe el archivo final con el nombre exacto que pide la convocatoria.
"""

import argparse
import os
import sys

import pandas as pd

EXPECTED_N_PREDICT = 59
YIELD_SANITY_MAX = 15.0  # t/ha — por encima de esto casi seguro es un error de unidades


HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PREDICTIONS = os.path.join(HERE, "..", "03_modelo", "resultados_FINAL", "predicciones_finales.csv")
DEFAULT_REFERENCE = os.path.join(HERE, "..", "..", "backend", "data", "parcelas_oficiales.csv")


def load_reference(path):
    """Devuelve ID_POLIGONO, AREA_HA y CONJUNTO de las parcelas de PREDICCION (de la plantilla oficial o de parcelas_oficiales.csv)."""
    ref = pd.read_csv(path, encoding="utf-8-sig")
    ref.columns = [c.strip() for c in ref.columns]
    ref = ref.loc[:, [c for c in ref.columns if not c.lower().startswith("unnamed")]]
    ref = ref.rename(columns={"area_ha": "AREA_HA"})
    for col in ("ID_POLIGONO", "AREA_HA", "CONJUNTO"):
        if col not in ref.columns:
            sys.exit(f"ERROR: la referencia {path} no trae la columna '{col}'.")
    ref["ID_POLIGONO"] = ref["ID_POLIGONO"].astype(str).str.strip()
    return ref[ref["CONJUNTO"].astype(str).str.upper() == "PREDICCION"][["ID_POLIGONO", "AREA_HA", "CONJUNTO"]]


def main(predictions_path, features_predict_path, team_name, out_dir, reference_path=DEFAULT_REFERENCE):
    os.makedirs(out_dir, exist_ok=True)

    preds = pd.read_csv(predictions_path)
    preds.columns = [c.strip() for c in preds.columns]

    if "ID_POLIGONO" not in preds.columns:
        sys.exit("ERROR: el CSV de predicciones necesita una columna 'ID_POLIGONO'.")

    yield_col_candidates = [c for c in preds.columns if "rendimiento" in c.lower()]
    if not yield_col_candidates:
        sys.exit("ERROR: no encuentro una columna de rendimiento (debe contener 'rendimiento' en el nombre).")
    yield_col = yield_col_candidates[0]

    expected_ids = None
    if features_predict_path and os.path.exists(features_predict_path):
        expected = pd.read_csv(features_predict_path)
        expected_ids = set(expected["ID_POLIGONO"].str.strip())

    preds["ID_POLIGONO"] = preds["ID_POLIGONO"].str.strip()
    got_ids = set(preds["ID_POLIGONO"])

    # --- validaciones ---
    problems = []

    if expected_ids is not None:
        faltantes = expected_ids - got_ids
        sobrantes = got_ids - expected_ids
        if faltantes:
            problems.append(f"Faltan {len(faltantes)} parcelas de predicción: {sorted(faltantes)}")
        if sobrantes:
            problems.append(f"Hay {len(sobrantes)} IDs que no pertenecen al conjunto de predicción: {sorted(sobrantes)}")
    elif len(preds) != EXPECTED_N_PREDICT:
        problems.append(f"Se esperaban {EXPECTED_N_PREDICT} parcelas y el archivo trae {len(preds)}.")

    n_nulos = preds[yield_col].isna().sum()
    if n_nulos:
        problems.append(f"{n_nulos} predicciones vienen vacías (NaN).")

    negativos = preds[preds[yield_col] < 0]
    if len(negativos):
        problems.append(f"{len(negativos)} predicciones negativas: {negativos['ID_POLIGONO'].tolist()}")

    fuera_de_rango = preds[preds[yield_col] > YIELD_SANITY_MAX]
    if len(fuera_de_rango):
        problems.append(
            f"{len(fuera_de_rango)} predicciones > {YIELD_SANITY_MAX} t/ha, revisa unidades: "
            f"{fuera_de_rango['ID_POLIGONO'].tolist()}"
        )

    duplicados = preds["ID_POLIGONO"].duplicated().sum()
    if duplicados:
        problems.append(f"{duplicados} ID_POLIGONO duplicados en el archivo.")

    if problems:
        print("Se encontraron problemas — revisa antes de enviar:\n")
        for p in problems:
            print(f"  - {p}")
        print("\nNo se generó el archivo de entrega hasta corregir lo anterior.")
        sys.exit(1)

    # --- archivo final ---
    ref = load_reference(reference_path)
    if len(ref) != EXPECTED_N_PREDICT:
        sys.exit(f"ERROR: la referencia trae {len(ref)} parcelas de PREDICCION y se esperaban {EXPECTED_N_PREDICT}.")
    if set(ref["ID_POLIGONO"]) != got_ids:
        sys.exit("ERROR: los IDs de las predicciones no coinciden con los de la plantilla de PREDICCION.")
    out = ref.merge(preds[["ID_POLIGONO", yield_col]].rename(columns={yield_col: "RENDIMIENTO_T_HA"}), on="ID_POLIGONO", how="left")
    out["RENDIMIENTO_T_HA"] = out["RENDIMIENTO_T_HA"].round(2)
    out = out[["ID_POLIGONO", "AREA_HA", "RENDIMIENTO_T_HA", "CONJUNTO"]].sort_values("ID_POLIGONO").reset_index(drop=True)

    filename = f"{team_name.strip().lower().replace(' ', '_')}_prediccion.csv"
    out_path = os.path.join(out_dir, filename)
    out.to_csv(out_path, index=False)

    print(f"OK — {len(out)} parcelas, sin problemas detectados.")
    print(f"Archivo listo para enviar a innovacion@fira.gob.mx:\n  {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--predictions", default=DEFAULT_PREDICTIONS, help="CSV con ID_POLIGONO y la columna de rendimiento predicho (por defecto, el del mejor modelo)")
    parser.add_argument("--reference", default=DEFAULT_REFERENCE, help="Plantilla oficial ID_area_rendimiento_*.csv o parcelas_oficiales.csv (ID, área y conjunto)")
    parser.add_argument("--features-predict", default=None, help="features_predict.csv (opcional, para validar que están las 59 parcelas correctas)")
    parser.add_argument("--team", required=True, help="Nombre del equipo, ej. agrozed")
    parser.add_argument("--out-dir", default="./entrega")
    args = parser.parse_args()
    main(args.predictions, args.features_predict, args.team, args.out_dir, args.reference)
