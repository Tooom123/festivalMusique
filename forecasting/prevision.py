import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score

COLONNES = ["scene_id", "capacite", "popularite", "actif", "popularite_suivante",
            "lag1", "lag2", "heure", "soir"]


def prepare_donnees(affluence_creneau, programmation, scenes):
    df = affluence_creneau.merge(scenes[["scene_id", "capacite"]], on="scene_id")
    pops = []
    actifs = []
    pops_suivantes = []
    for _, ligne in df.iterrows():
        c = programmation[(programmation["jour"] == ligne["jour"])
                          & (programmation["scene_id"] == ligne["scene_id"])
                          & (programmation["heure_debut"] <= ligne["creneau"])
                          & (programmation["heure_fin"] > ligne["creneau"])]
        pops.append(int(c.iloc[0]["popularite"]) if len(c) > 0 else 0)
        actifs.append(1 if len(c) > 0 else 0)
        suivant = programmation[(programmation["jour"] == ligne["jour"])
                                & (programmation["scene_id"] == ligne["scene_id"])
                                & (programmation["heure_debut"] > ligne["creneau"])
                                & (programmation["heure_debut"] <= ligne["creneau"] + 60)]
        pops_suivantes.append(int(suivant["popularite"].max()) if len(suivant) > 0 else 0)
    df["popularite"] = pops
    df["actif"] = actifs
    df["popularite_suivante"] = pops_suivantes
    df = df.sort_values(["scene_id", "jour", "creneau"]).reset_index(drop=True)
    df["lag1"] = df.groupby(["scene_id", "jour"])["nb_visiteurs"].shift(1).fillna(0)
    df["lag2"] = df.groupby(["scene_id", "jour"])["nb_visiteurs"].shift(2).fillna(0)
    df["heure"] = df["creneau"] / 60
    df["soir"] = (df["creneau"] >= 20 * 60).astype(int)
    return df


def entraine(df):
    train = df[df["jour"] <= 2]
    test = df[df["jour"] == 3].copy()

    lineaire = LinearRegression()
    lineaire.fit(train[COLONNES], train["nb_visiteurs"])
    pred = lineaire.predict(test[COLONNES])

    foret = RandomForestRegressor(n_estimators=300, random_state=42)
    foret.fit(train[COLONNES], train["nb_visiteurs"])
    pred_foret = foret.predict(test[COLONNES])

    pred_naif = test["lag1"]

    test["prevision"] = np.round(pred).clip(0).astype(int)

    metriques = {
        "mae_lineaire": mean_absolute_error(test["nb_visiteurs"], pred),
        "mae_foret": mean_absolute_error(test["nb_visiteurs"], pred_foret),
        "mae_naif": mean_absolute_error(test["nb_visiteurs"], pred_naif),
        "r2_lineaire": r2_score(test["nb_visiteurs"], pred),
        "r2_foret": r2_score(test["nb_visiteurs"], pred_foret),
    }

    permutation = permutation_importance(lineaire, train[COLONNES], train["nb_visiteurs"],
                                         n_repeats=20, random_state=42)
    importances = pd.DataFrame({"variable": COLONNES,
                                "importance": permutation.importances_mean})
    importances = importances.sort_values("importance", ascending=False).reset_index(drop=True)
    return test, metriques, importances
