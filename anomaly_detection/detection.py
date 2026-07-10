import pandas as pd
from sklearn.ensemble import IsolationForest

CRENEAU = 30


def detecte(affluence_creneau, scenes, pannes, affluence_pas=None):
    df = affluence_creneau.merge(scenes[["scene_id", "capacite"]], on="scene_id")
    df["taux"] = df["nb_visiteurs"] / df["capacite"]
    df = df.sort_values(["scene_id", "jour", "creneau"]).reset_index(drop=True)
    df["variation"] = df.groupby(["scene_id", "jour"])["nb_visiteurs"].diff().fillna(0)

    anomalies = []
    for _, l in df.iterrows():
        if l["taux"] >= 1.0:
            anomalies.append([l["jour"], l["creneau"], l["scene_id"],
                              "surcharge_critique", "haute", "regle"])
        elif l["taux"] >= 0.9:
            anomalies.append([l["jour"], l["creneau"], l["scene_id"],
                              "surcharge", "moyenne", "regle"])

    if affluence_pas is not None:
        fin = affluence_pas.merge(scenes[["scene_id", "capacite"]], on="scene_id")
        fin = fin.sort_values(["scene_id", "jour", "minute"]).reset_index(drop=True)
        fin["variation"] = fin.groupby(["scene_id", "jour"])["nb_visiteurs"].diff().fillna(0)
        seuils = fin["capacite"] * 0.2
        seuils = seuils.clip(lower=80)
        brusques = fin[fin["variation"].abs() >= seuils]
        for _, l in brusques.iterrows():
            creneau = (l["minute"] // CRENEAU) * CRENEAU
            anomalies.append([l["jour"], creneau, l["scene_id"],
                              "mouvement_foule", "haute", "regle"])

    iso = IsolationForest(contamination=0.04, random_state=42)
    df["score_iso"] = iso.fit_predict(df[["nb_visiteurs", "taux", "variation"]])
    for _, l in df[df["score_iso"] == -1].iterrows():
        anomalies.append([l["jour"], l["creneau"], l["scene_id"],
                          "comportement_atypique", "basse", "isolation_forest"])

    for _, p in pannes.iterrows():
        creneau = (p["debut"] // CRENEAU) * CRENEAU
        anomalies.append([p["jour"], creneau, p["scene_id"],
                          "panne_" + p["type"], "moyenne", "capteur"])

    resultat = pd.DataFrame(anomalies, columns=["jour", "creneau", "scene_id",
                                                "type", "gravite", "source"])
    resultat = resultat.drop_duplicates().sort_values(["jour", "creneau"]).reset_index(drop=True)
    return resultat


def evalue_detection(anomalies, injections):
    trouvees = 0
    for _, inj in injections.iterrows():
        creneau = (inj["minute"] // CRENEAU) * CRENEAU
        proche = anomalies[(anomalies["jour"] == inj["jour"])
                           & (anomalies["creneau"].between(creneau - CRENEAU, creneau + CRENEAU))
                           & (anomalies["scene_id"].isin([inj["scene_source"], inj["scene_cible"]]))]
        if len(proche) > 0:
            trouvees += 1
    return trouvees, len(injections)
