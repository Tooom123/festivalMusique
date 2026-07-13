import json
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd

from allocation.optimisation import INSTALLATIONS
from dashboard import menus, reco

DOSSIER = Path(__file__).parent / "data"
SORTIE = Path(__file__).parent / "site" / "donnees.js"

JOURS_COURT = {1: "Ven. 4/09", 2: "Sam. 5/09", 3: "Dim. 6/09"}
JOURS_LONG = {1: "Vendredi 4 septembre", 2: "Samedi 5 septembre", 3: "Dimanche 6 septembre"}


def charge(conn, nom):
    return pd.read_sql(f"SELECT * FROM {nom}", conn)


def calcule_flux(evenements):
    dep = evenements[(evenements["type"] == "deplacement")
                     & (evenements["scene_origine"] > 0)].copy()
    dep["creneau"] = (dep["minute"] // 30) * 30
    flux = (dep.groupby(["jour", "creneau", "scene_origine", "scene_destination"])
            .size().reset_index(name="nb"))
    tops = (flux.sort_values("nb", ascending=False)
            .groupby(["jour", "creneau"]).head(3))
    return tops


def exporte():
    conn = sqlite3.connect(DOSSIER / "festival.db")

    scenes = charge(conn, "scenes")
    programmation = charge(conn, "programmation")
    pois = charge(conn, "points_interet")
    affluence = charge(conn, "affluence_creneau")
    previsions = charge(conn, "previsions")
    metriques = charge(conn, "metriques_prevision")
    importances = charge(conn, "importances_variables")
    anomalies = charge(conn, "anomalies")
    anticipation_alertes = charge(conn, "anticipation_alertes")
    initiale = charge(conn, "allocation_initiale")
    figee = charge(conn, "allocation_figee")
    ajustee = charge(conn, "allocation_ajustee")
    dimensionnement = charge(conn, "dimensionnement")
    transport_flux = charge(conn, "transport_flux")
    transport_metriques = charge(conn, "transport_metriques")
    synthese = charge(conn, "scenarios_synthese")
    details = charge(conn, "scenarios_details")
    visiteurs = charge(conn, "visiteurs")
    evenements = charge(conn, "evenements")
    historique_editions = charge(conn, "historique_editions")
    billetterie = charge(conn, "billetterie")
    prevision_edition = charge(conn, "prevision_edition")
    cartes_affluence = charge(conn, "cartes_affluence")
    cartes_flux = charge(conn, "cartes_flux")
    cartes_anomalies = charge(conn, "cartes_anomalies")
    cartes_programmation = charge(conn, "cartes_programmation")
    conn.close()

    recommandations = reco.genere(previsions, scenes, anomalies, initiale, ajustee, synthese)
    flux = calcule_flux(evenements)

    annee_courante = int(cartes_affluence["annee"].max())
    editions_carte = []
    for an in sorted(cartes_affluence["annee"].unique()):
        editions_carte.append({
            "annee": int(an),
            "type": "prediction" if an == annee_courante else "historique",
            "affluence": cartes_affluence[cartes_affluence["annee"] == an]
                .drop(columns="annee").to_dict("records"),
            "flux": cartes_flux[cartes_flux["annee"] == an]
                .drop(columns="annee").to_dict("records"),
            "anomalies": cartes_anomalies[cartes_anomalies["annee"] == an]
                .drop(columns="annee").to_dict("records"),
            "programmation": cartes_programmation[cartes_programmation["annee"] == an]
                .drop(columns="annee").to_dict("records"),
        })

    pct_initiale = round(float(initiale["couverture"].mean()) * 100, 1)
    pct_figee = round(float(figee["couverture"].mean()) * 100, 1)
    pct_ajustee = round(float(ajustee["couverture"].mean()) * 100, 1)

    donnees = {
        "jours_court": JOURS_COURT,
        "jours_long": JOURS_LONG,
        "scenes": scenes.to_dict("records"),
        "programmation": programmation.to_dict("records"),
        "pois": pois.to_dict("records"),
        "menus": menus.MENUS,
        "affluence": affluence.to_dict("records"),
        "previsions": previsions[["jour", "creneau", "scene_id", "nb_visiteurs",
                                  "prevision"]].to_dict("records"),
        "metriques": {k: (round(float(v), 3) if isinstance(v, (int, float, np.floating))
                          else v)
                      for k, v in metriques.iloc[0].items()},
        "importances": importances.to_dict("records"),
        "anomalies": anomalies.to_dict("records"),
        "anticipation": {
            "precision": float(metriques.iloc[0]["antic_precision"]),
            "rappel": float(metriques.iloc[0]["antic_rappel"]),
            "predites": int(metriques.iloc[0]["antic_predites"]),
            "reelles": int(metriques.iloc[0]["antic_reelles"]),
            "correctes": int(metriques.iloc[0]["antic_correctes"]),
            "alertes": anticipation_alertes.to_dict("records"),
        },
        "allocation": {
            "couverture_initiale": pct_initiale,
            "couverture_figee": pct_figee,
            "couverture_ajustee": pct_ajustee,
            "lignes": ajustee.to_dict("records"),
        },
        "dimensionnement": {
            "niveaux": dimensionnement.drop_duplicates("niveau_pct")[
                ["niveau_pct", "couverture_globale", "creneaux_decouverts"]]
                .to_dict("records"),
            "domaines": dimensionnement[["niveau_pct", "type", "effectif",
                                         "couverture_domaine"]].to_dict("records"),
            "ideal": dimensionnement.drop_duplicates("type")[
                ["type", "ideal", "reference"]].to_dict("records"),
            "installations": INSTALLATIONS,
        },
        "transport": {
            **{k: (int(v) if isinstance(v, (int, np.integer)) else float(v))
               for k, v in transport_metriques.iloc[0].items()},
            "flux": transport_flux.to_dict("records"),
        },
        "recommandations": recommandations,
        "scenarios": {
            "synthese": synthese.to_dict("records"),
            "details": details.to_dict("records"),
        },
        "historique_editions": historique_editions.to_dict("records"),
        "billetterie": billetterie.to_dict("records"),
        "prevision_edition": prevision_edition.to_dict("records"),
        "flux": flux.to_dict("records"),
        "cartes_editions": editions_carte,
        "kpi": {
            "visiteurs_total": int(len(visiteurs)),
            "visiteurs_par_jour": {int(j): int(n) for j, n in
                                   visiteurs.groupby("jour").size().items()},
            "pic_affluence": int(affluence["nb_visiteurs"].max()),
            "nb_anomalies": int(len(anomalies)),
            "nb_anomalies_hautes": int((anomalies["gravite"] == "haute").sum()),
        },
    }

    def convertit(o):
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            return float(o)
        raise TypeError(str(type(o)))

    texte = json.dumps(donnees, ensure_ascii=False, default=convertit)
    SORTIE.write_text("const DONNEES = " + texte + ";\n", encoding="utf-8")
    print(f"Export site : {SORTIE} ({SORTIE.stat().st_size // 1024} Ko)")


if __name__ == "__main__":
    exporte()
