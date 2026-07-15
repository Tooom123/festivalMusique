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


def reduit_flux(evenements):
    # Top 3 des flux de foule par creneau (memes donnees que la carte 2026).
    dep = evenements[(evenements["type"] == "deplacement")
                     & (evenements["scene_origine"] > 0)].copy()
    dep["creneau"] = (dep["minute"] // 30) * 30
    flux = (dep.groupby(["jour", "creneau", "scene_origine", "scene_destination"])
            .size().reset_index(name="nb"))
    return (flux.sort_values("nb", ascending=False)
            .groupby(["jour", "creneau"]).head(3).reset_index(drop=True))


def carte_edition(annee, scenes, prog, resultat):
    # Donnees rejouables d'une edition : foule, flux et anomalies par creneau.
    aff = resultat["affluence_creneau"].assign(annee=annee)
    flux = reduit_flux(resultat["evenements"]).assign(annee=annee)
    anomalies = detection.detecte(resultat["affluence_creneau"], scenes,
                                  resultat["pannes"], resultat["affluence"]).assign(annee=annee)
    prog_c = prog[["jour", "scene_id", "artiste", "heure_debut", "heure_fin",
                   "popularite"]].assign(annee=annee)
    return aff, flux, anomalies, prog_c


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

    print("=== 1b/5 Historique des editions 2022-2025 ===")
    hist_affluence = []
    hist_programmation = []
    hist_editions = []
    cartes_aff, cartes_flux, cartes_anom, cartes_prog = [], [], [], []
    for annee, objectifs in generateur.EDITIONS_PASSEES.items():
        rng_annee = np.random.default_rng(GRAINE + annee)
        prog_annee = generateur.genere_programmation_passee(scenes, annee)
        visiteurs_annee = generateur.genere_visiteurs(rng_annee, objectifs)
        resultat_annee = simulation.simule(scenes, prog_annee, visiteurs_annee,
                                           ressources, rng_annee)
        hist_affluence.append(resultat_annee["affluence_creneau"].assign(annee=annee))
        hist_programmation.append(prog_annee)
        for jour, nb in visiteurs_annee.groupby("jour").size().items():
            hist_editions.append([annee, int(jour), int(nb)])
        a, f, an, p = carte_edition(annee, scenes, prog_annee, resultat_annee)
        cartes_aff.append(a); cartes_flux.append(f)
        cartes_anom.append(an); cartes_prog.append(p)
        print(f"    Edition {annee} : {len(visiteurs_annee)} visiteurs")
    hist_affluence = pd.concat(hist_affluence, ignore_index=True)
    hist_programmation = pd.concat(hist_programmation, ignore_index=True)
    hist_editions = pd.DataFrame(hist_editions, columns=["annee", "jour", "visiteurs"])

    print(f"=== 2/5 Prevision de l'affluence ({generateur.DATES[3]}) ===")
    annee = generateur.ANNEE_COURANTE
    affluence_totale = pd.concat(
        [hist_affluence, resultat["affluence_creneau"].assign(annee=annee)],
        ignore_index=True)
    prog_totale = pd.concat([hist_programmation, prog.assign(annee=annee)],
                            ignore_index=True)
    df = prevision.prepare_donnees(affluence_totale, prog_totale, scenes)
    previsions, metriques, importances, modele = prevision.entraine(df, annee)
    print(f"    Modele retenu : {metriques['modele_retenu']}"
          f" (MAE {metriques['mae_retenue']:.1f} visiteurs, R2 {metriques['r2_retenu']:.3f})")
    print(f"    MAE lineaire : {metriques['mae_lineaire']:.1f}"
          f" | foret : {metriques['mae_foret']:.1f}"
          f" | naif : {metriques['mae_naif']:.1f}"
          f" | sans historique : {metriques['mae_sans_historique']:.1f}")

    reels = visiteurs.groupby("jour").size().to_dict()
    billetterie = generateur.genere_billetterie()
    prevision_ed = prevision.prevision_edition(hist_editions, billetterie, reels,
                                               annee, generateur.CAPACITE_JOUR)
    for _, l in prevision_ed.iterrows():
        print(f"    Jour {int(l['jour'])} ({int(l['part_vendue'] * 100)} % vendu) :"
              f" tendance {int(l['prevision_tendance'])} (ecart {l['erreur_tendance_pct']:.1f} %),"
              f" billetterie {int(l['prevision_billetterie'])} (ecart {l['erreur_billetterie_pct']:.1f} %),"
              f" combinee {int(l['prevision_combinee'])} (ecart {l['erreur_combinee_pct']:.1f} %)"
              f" vs reel {int(l['visiteurs_reels'])}")

    print(f"=== 1c/5 Simulation de la prediction {annee} (totaux prevus) ===")
    objectifs_prevus = {int(l["jour"]): int(l["prevision_combinee"])
                        for _, l in prevision_ed.iterrows()}
    rng_prev = np.random.default_rng(GRAINE + annee)
    visiteurs_prev = generateur.genere_visiteurs(rng_prev, objectifs_prevus)
    resultat_prev = simulation.simule(scenes, prog, visiteurs_prev, ressources, rng_prev)
    a, f, an, p = carte_edition(annee, scenes, prog, resultat_prev)
    cartes_aff.append(a); cartes_flux.append(f)
    cartes_anom.append(an); cartes_prog.append(p)
    print(f"    {len(visiteurs_prev)} visiteurs simules d'apres la prevision combinee")

    cartes_affluence = pd.concat(cartes_aff, ignore_index=True)
    cartes_flux = pd.concat(cartes_flux, ignore_index=True)
    cartes_anomalies = pd.concat(cartes_anom, ignore_index=True)
    cartes_programmation = pd.concat(cartes_prog, ignore_index=True)

    print("=== 3/5 Detection des anomalies ===")
    anomalies = detection.detecte(resultat["affluence_creneau"], scenes,
                                  resultat["pannes"], resultat["affluence"])
    trouvees, total = detection.evalue_detection(anomalies, resultat["injections"])
    print(f"    {len(anomalies)} anomalies detectees"
          f" | {trouvees}/{total} mouvements de foule injectes retrouves")

    alertes_anticipation, m_antic = detection.anticipe_surcharges(previsions, scenes)
    print(f"    Anticipation des surcharges : {m_antic['predites']} annoncees avant l'evenement,"
          f" {m_antic['correctes']} confirmees"
          f" (precision {m_antic['precision']:.0%}, rappel {m_antic['rappel']:.0%})")

    print("=== 4/5 Allocation des ressources (3 jours) ===")
    # Prevision operationnelle appliquee aux 3 jours (meme modele que le dimanche),
    # puis allocation sur tout le festival.
    previsions_3j = prevision.prevoit_operationnel(df, modele, annee)
    besoins_initiaux = optimisation.calcule_besoins(previsions_3j)
    allocation_initiale = optimisation.optimise(besoins_initiaux, equipes)
    besoins_ajustes = optimisation.calcule_besoins(previsions_3j, anomalies)
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

    jour_charge = int(visiteurs.groupby("jour").size().idxmax())
    transport_flux, m_transport = optimisation.dimensionne_transport(visiteurs, jour=jour_charge)
    print(f"    Transport : pic de departs {m_transport['pic_departs']} a la cloture"
          f" -> flotte ideale {m_transport['flotte_ideale']} navettes"
          f" ({m_transport['staff_ideal']} agents)")

    # Dimensionnement sur les besoins PREVUS (planification a partir de la prevision),
    # pas sur les besoins gonfles par les anomalies : on recrute pour la prevision et on
    # absorbe les incidents par reallocation, pas en sur-embauchant partout.
    dimensionnement = optimisation.analyse_dimensionnement(besoins_initiaux)
    ideal = dimensionnement.drop_duplicates("type").set_index("type")["ideal"].to_dict()
    print(f"    Dimensionnement : effectif ideal par domaine {ideal}")
    for pct, g in dimensionnement.groupby("niveau_pct"):
        print(f"      {pct} % de l'effectif de pointe : couverture {g['couverture_globale'].iloc[0]:.1%}"
              f" ({int(g['creneaux_decouverts'].iloc[0])} creneaux a decouvert)")

    print("=== 5/5 Evaluation des scenarios d'organisation ===")
    details, synthese = scenarios.evalue_tous()
    print(synthese.to_string(index=False))

    metriques_df = pd.DataFrame([metriques])
    metriques_df["anomalies_detectees"] = len(anomalies)
    metriques_df["foules_retrouvees"] = trouvees
    metriques_df["foules_injectees"] = total
    metriques_df["antic_precision"] = m_antic["precision"]
    metriques_df["antic_rappel"] = m_antic["rappel"]
    metriques_df["antic_predites"] = m_antic["predites"]
    metriques_df["antic_reelles"] = m_antic["reelles"]
    metriques_df["antic_correctes"] = m_antic["correctes"]

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
        "previsions_3j": previsions_3j[["jour", "creneau", "scene_id", "prevision"]],
        "metriques_prevision": metriques_df,
        "importances_variables": importances,
        "anticipation_alertes": alertes_anticipation,
        "historique_editions": hist_editions,
        "historique_affluence": hist_affluence,
        "historique_programmation": hist_programmation,
        "billetterie": billetterie,
        "prevision_edition": prevision_ed,
        "cartes_affluence": cartes_affluence,
        "cartes_flux": cartes_flux,
        "cartes_anomalies": cartes_anomalies,
        "cartes_programmation": cartes_programmation,
        "anomalies": anomalies,
        "allocation_initiale": allocation_initiale,
        "allocation_figee": figee,
        "allocation_ajustee": allocation_ajustee,
        "dimensionnement": dimensionnement,
        "transport_flux": transport_flux,
        "transport_metriques": pd.DataFrame([m_transport]),
        "scenarios_details": details,
        "scenarios_synthese": synthese,
    })
    import exporte_site
    exporte_site.exporte()

    print(f"Pipeline termine en {time.time() - debut:.1f}s, donnees sauvegardees dans {DOSSIER}")
    print("Site web : ouvrir site/index.html | Dashboard de secours : streamlit run dashboard/app.py")


if __name__ == "__main__":
    main()
