import numpy as np
import pandas as pd

from data_generation.generateur import GENRES, NB_JOURS, OUVERTURE, FERMETURE

PAS = 15
CRENEAU = 30


def calcule_poids(infos, compte, capacites):
    ids = list(infos.keys())
    tableau = {}
    for genre in GENRES:
        poids = []
        for s in ids:
            pop, g = infos[s]
            p = float(pop)
            if g == genre:
                p = p * 2.5
            if compte[s] >= capacites[s]:
                p = 0.01
            poids.append(p)
        p = np.array(poids)
        tableau[genre] = p / p.sum()
    return ids, tableau


def simule(scenes, programmation, visiteurs, ressources, rng,
           taux_mobilite=0.25, nb_pannes_jour=2, nb_foules_jour=2):
    evenements = []
    releves = []
    pannes = []
    injections = []
    capacites = dict(zip(scenes["scene_id"], scenes["capacite"]))

    for jour in range(1, NB_JOURS + 1):
        vis = visiteurs[visiteurs["jour"] == jour]
        prog = programmation[programmation["jour"] == jour]
        position = {}
        compte = {s: 0 for s in capacites}

        for _ in range(nb_pannes_jour):
            idx = int(rng.integers(0, len(ressources)))
            ressource = ressources.iloc[idx]
            debut = int(rng.integers(16 * 60, 23 * 60))
            duree = int(rng.integers(30, 121))
            pannes.append([jour, int(ressource["ressource_id"]), ressource["type"],
                           int(ressource["scene_id"]), debut, debut + duree])

        minutes_foule = [int(m) * PAS for m in rng.integers(19 * 60 // PAS, 23 * 60 // PAS, nb_foules_jour)]

        for minute in range(OUVERTURE, FERMETURE, PAS):
            infos = {}
            for s in capacites:
                c = prog[(prog["scene_id"] == s) & (prog["heure_debut"] <= minute)
                         & (prog["heure_fin"] > minute)]
                if len(c) > 0:
                    infos[s] = (c.iloc[0]["popularite"], c.iloc[0]["genre"])
                else:
                    infos[s] = (1, "aucun")

            ids, tableau = calcule_poids(infos, compte, capacites)

            arrivants = vis[(vis["heure_arrivee"] >= minute) & (vis["heure_arrivee"] < minute + PAS)]
            for genre, groupe in arrivants.groupby("genre_prefere"):
                choix = rng.choice(ids, size=len(groupe), p=tableau[genre])
                for i, (_, v) in enumerate(groupe.iterrows()):
                    s = int(choix[i])
                    position[v["visiteur_id"]] = [s, genre, v["heure_depart"]]
                    compte[s] += 1
                    evenements.append([jour, minute, "arrivee", int(v["visiteur_id"]), 0, s])

            partants = [vid for vid, (s, g, dep) in position.items() if dep < minute + PAS]
            for vid in partants:
                s = position[vid][0]
                compte[s] -= 1
                evenements.append([jour, minute, "depart", vid, s, 0])
                del position[vid]

            presents = list(position.keys())
            nb_mobiles = int(len(presents) * taux_mobilite)
            if nb_mobiles > 0:
                mobiles = rng.choice(presents, size=nb_mobiles, replace=False)
                par_genre = {}
                for vid in mobiles:
                    par_genre.setdefault(position[vid][1], []).append(vid)
                for genre, vids in par_genre.items():
                    choix = rng.choice(ids, size=len(vids), p=tableau[genre])
                    for i, vid in enumerate(vids):
                        ancienne = position[vid][0]
                        nouvelle = int(choix[i])
                        if nouvelle != ancienne and compte[nouvelle] < capacites[nouvelle] * 1.1:
                            compte[ancienne] -= 1
                            compte[nouvelle] += 1
                            position[vid][0] = nouvelle
                            evenements.append([jour, minute, "deplacement", vid, ancienne, nouvelle])

            if minute in minutes_foule and len(position) > 100:
                source = max(compte, key=compte.get)
                autres = [s for s in capacites if s != source]
                cible = autres[int(rng.integers(0, len(autres)))]
                occupants = [vid for vid, (s, g, d) in position.items() if s == source]
                nb_bouge = int(len(occupants) * 0.5)
                if nb_bouge > 0:
                    bouges = rng.choice(occupants, size=nb_bouge, replace=False)
                    for vid in bouges:
                        position[vid][0] = cible
                        evenements.append([jour, minute, "deplacement", vid, source, cible])
                    compte[source] -= nb_bouge
                    compte[cible] += nb_bouge
                    injections.append([jour, minute, source, cible, nb_bouge])

            for s in capacites:
                releves.append([jour, minute, s, compte[s]])

    evenements = pd.DataFrame(evenements, columns=["jour", "minute", "type", "visiteur_id",
                                                   "scene_origine", "scene_destination"])
    affluence = pd.DataFrame(releves, columns=["jour", "minute", "scene_id", "nb_visiteurs"])
    affluence["creneau"] = (affluence["minute"] // CRENEAU) * CRENEAU
    affluence_creneau = (affluence.groupby(["jour", "creneau", "scene_id"])["nb_visiteurs"]
                         .mean().round().astype(int).reset_index())
    pannes = pd.DataFrame(pannes, columns=["jour", "ressource_id", "type", "scene_id",
                                           "debut", "fin"])
    injections = pd.DataFrame(injections, columns=["jour", "minute", "scene_source",
                                                   "scene_cible", "nb_visiteurs"])
    return {"evenements": evenements, "affluence": affluence,
            "affluence_creneau": affluence_creneau, "pannes": pannes,
            "injections": injections}
