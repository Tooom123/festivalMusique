import numpy as np
import pandas as pd

from allocation import optimisation
from data_generation import generateur, simulation

SCENARIOS = {
    "base": {},
    "scenes_dj_rock_agrandies": {"capacites": {2: 24000, 3: 9000}},
    "horaires_decales": {"decalages": {1: 0, 2: 15, 3: 30}},
    "securite_renforcee": {"equipes": {"securite": 1.4, "medical": 1.3}},
}

COUTS_HORAIRES = {"securite": 22, "food": 16, "sanitaire": 15, "medical": 28, "transport": 18}


def cout_personnel(equipes):
    total = 0.0
    for _, l in equipes.iterrows():
        heures = (l["dispo_fin"] - l["dispo_debut"]) / 60
        total += l["effectif"] * heures * COUTS_HORAIRES[l["type"]]
    return total * 3


def couverture_rapide(affluence_creneau, equipes):
    valeurs = []
    for (jour, creneau), groupe in affluence_creneau.groupby(["jour", "creneau"]):
        dispo = optimisation.effectif_disponible(equipes, creneau)
        for type_e, ratio in optimisation.RATIOS.items():
            besoin = int(np.ceil(groupe["nb_visiteurs"] / ratio).sum())
            if besoin > 0:
                valeurs.append(min(1.0, dispo.get(type_e, 0) / besoin))
    return float(np.mean(valeurs))


def evalue_scenario(nom, params, n_runs=3, graine=100):
    lignes = []
    for run in range(n_runs):
        rng = np.random.default_rng(graine + run)
        scenes = generateur.genere_scenes()
        for sid, cap in params.get("capacites", {}).items():
            scenes.loc[scenes["scene_id"] == sid, "capacite"] = cap
        prog = generateur.genere_programmation(scenes, rng, params.get("decalages"))
        visiteurs = generateur.genere_visiteurs(rng)
        equipes = generateur.genere_equipes(rng, params.get("equipes"))
        ressources = generateur.genere_ressources(rng)
        resultat = simulation.simule(scenes, prog, visiteurs, ressources, rng)

        aff = resultat["affluence_creneau"].merge(scenes[["scene_id", "capacite"]], on="scene_id")
        aff["taux"] = aff["nb_visiteurs"] / aff["capacite"]
        taux_surcharge = float((aff["taux"] >= 0.9).mean())
        pic = float(aff["taux"].max())
        couverture = couverture_rapide(resultat["affluence_creneau"], equipes)
        cout = cout_personnel(equipes)
        lignes.append([nom, run, taux_surcharge, pic, couverture, cout])
    return pd.DataFrame(lignes, columns=["scenario", "run", "taux_surcharge",
                                         "pic_occupation", "couverture_besoins",
                                         "cout_personnel"])


def evalue_tous(n_runs=3):
    resultats = []
    for nom, params in SCENARIOS.items():
        resultats.append(evalue_scenario(nom, params, n_runs))
    details = pd.concat(resultats, ignore_index=True)
    synthese = (details.groupby("scenario")[["taux_surcharge", "pic_occupation",
                                             "couverture_besoins", "cout_personnel"]]
                .mean().round(3).reset_index())
    return details, synthese
