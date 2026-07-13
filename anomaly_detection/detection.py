import numpy as np
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


def anticipe_surcharges(previsions, scenes, seuil=0.9):
    """Anticipe les surcharges AVANT l'evenement en appliquant la regle de
    surcharge sur la prevision d'affluence (et non sur l'observe), puis confronte
    ces alertes au reel pour mesurer la fiabilite de l'anticipation.

    Ne concerne que les surcharges, seules anomalies previsibles depuis l'affluence :
    les pannes (aleatoires) et les micro-mouvements de foule ne sont pas anticipables.
    """
    df = previsions.copy()
    if "capacite" not in df.columns:
        df = df.merge(scenes[["scene_id", "capacite"]], on="scene_id")
    df["taux_prevu"] = df["prevision"] / df["capacite"]
    df["taux_reel"] = df["nb_visiteurs"] / df["capacite"]
    df["prevue"] = df["taux_prevu"] >= seuil
    df["reelle"] = df["taux_reel"] >= seuil

    alertes = df[df["prevue"]].copy()
    alertes["gravite"] = np.where(alertes["taux_prevu"] >= 1.0, "critique", "elevee")
    alertes["realise"] = alertes["reelle"]
    alertes = alertes[["jour", "creneau", "scene_id", "taux_prevu", "taux_reel",
                       "gravite", "realise"]].sort_values("creneau").reset_index(drop=True)

    predites = int(df["prevue"].sum())
    reelles = int(df["reelle"].sum())
    correctes = int((df["prevue"] & df["reelle"]).sum())
    metriques = {
        "predites": predites,
        "reelles": reelles,
        "correctes": correctes,
        "precision": round(correctes / predites, 3) if predites else 1.0,
        "rappel": round(correctes / reelles, 3) if reelles else 1.0,
    }
    return alertes, metriques


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
