import time
from pathlib import Path

import numpy as np
import pandas as pd

from allocation import optimisation
from anomaly_detection import detection
from data_generation import base, generateur, simulation
from forecasting import prevision
from scenario_simulation import scenarios

GRAINE = 42
DOSSIER = Path(__file__).parent / "data"


def main():
    debut = time.time()

    print("=== 1/5 Generation des donnees et simulation du festival ===")
    rng = np.random.default_rng(GRAINE)
    scenes = generateur.genere_scenes()
    prog = generateur.genere_programmation(scenes, rng)
    visiteurs = generateur.genere_visiteurs(rng)
    equipes = generateur.genere_equipes(rng)
    ressources = generateur.genere_ressources(rng)
    points_interet = generateur.genere_points_interet()
    resultat = simulation.simule(scenes, prog, visiteurs, ressources, rng)
    print(f"    {len(visiteurs)} visiteurs, {len(resultat['evenements'])} evenements,"
          f" {len(resultat['pannes'])} pannes injectees,"
          f" {len(resultat['injections'])} mouvements de foule injectes")
    for jour in (1, 2, 3):
        nb = int((visiteurs["jour"] == jour).sum())
        print(f"      {generateur.DATES[jour]} : {nb} visiteurs")

    print(f"=== 2/5 Prevision de l'affluence ({generateur.DATES[3]}) ===")
    df = prevision.prepare_donnees(resultat["affluence_creneau"], prog, scenes)
    previsions, metriques, importances = prevision.entraine(df)
    print(f"    MAE regression lineaire (retenue) : {metriques['mae_lineaire']:.1f} visiteurs"
          f" | foret aleatoire : {metriques['mae_foret']:.1f}"
          f" | modele naif : {metriques['mae_naif']:.1f}")
    print(f"    R2 regression lineaire : {metriques['r2_lineaire']:.3f}")

    print("=== 3/5 Detection des anomalies ===")
    anomalies = detection.detecte(resultat["affluence_creneau"], scenes,
                                  resultat["pannes"], resultat["affluence"])
    trouvees, total = detection.evalue_detection(anomalies, resultat["injections"])
    print(f"    {len(anomalies)} anomalies detectees"
          f" | {trouvees}/{total} mouvements de foule injectes retrouves")

    print(f"=== 4/5 Allocation des ressources ({generateur.DATES[3]}) ===")
    besoins_initiaux = optimisation.calcule_besoins(previsions)
    allocation_initiale = optimisation.optimise(besoins_initiaux, equipes)
    anomalies_j3 = anomalies[anomalies["jour"] == 3]
    besoins_ajustes = optimisation.calcule_besoins(previsions, anomalies_j3)
    allocation_ajustee = optimisation.optimise(besoins_ajustes, equipes)
    figee = besoins_ajustes.merge(
        allocation_initiale[["jour", "creneau", "scene_id", "type", "alloue"]],
        on=["jour", "creneau", "scene_id", "type"])
    figee["couverture"] = np.where(figee["besoin"] > 0,
                                   np.minimum(figee["alloue"] / figee["besoin"].clip(lower=1), 1.0),
                                   1.0)
    print(f"    Couverture des besoins prevus (allocation initiale) : {allocation_initiale['couverture'].mean():.1%}")
    print(f"    Couverture des besoins ajustes si allocation figee : {figee['couverture'].mean():.1%}")
    print(f"    Couverture des besoins ajustes apres reallocation : {allocation_ajustee['couverture'].mean():.1%}")

    print("=== 5/5 Evaluation des scenarios d'organisation ===")
    details, synthese = scenarios.evalue_tous()
    print(synthese.to_string(index=False))

    metriques_df = pd.DataFrame([metriques])
    metriques_df["anomalies_detectees"] = len(anomalies)
    metriques_df["foules_retrouvees"] = trouvees
    metriques_df["foules_injectees"] = total

    base.sauvegarde(DOSSIER, {
        "scenes": scenes,
        "programmation": prog,
        "visiteurs": visiteurs,
        "equipes": equipes,
        "ressources": ressources,
        "points_interet": points_interet,
        "evenements": resultat["evenements"],
        "affluence": resultat["affluence"],
        "affluence_creneau": resultat["affluence_creneau"],
        "pannes": resultat["pannes"],
        "injections_foule": resultat["injections"],
        "previsions": previsions,
        "metriques_prevision": metriques_df,
        "importances_variables": importances,
        "anomalies": anomalies,
        "allocation_initiale": allocation_initiale,
        "allocation_figee": figee,
        "allocation_ajustee": allocation_ajustee,
        "scenarios_details": details,
        "scenarios_synthese": synthese,
    })
    print(f"Pipeline termine en {time.time() - debut:.1f}s, donnees sauvegardees dans {DOSSIER}")
    print("Dashboard : streamlit run dashboard/app.py")


if __name__ == "__main__":
    main()
