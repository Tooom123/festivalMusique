import numpy as np
import pandas as pd

GENRES = ["rap", "electro", "rock", "varie"]
NB_JOURS = 3
OUVERTURE = 16 * 60
FERMETURE = 24 * 60
CAPACITE_JOUR = 50000

ANNEE_COURANTE = 2026
DATES = {1: "vendredi 4 septembre 2026", 2: "samedi 5 septembre 2026",
         3: "dimanche 6 septembre 2026"}
OBJECTIFS_VISITEURS = {1: 38000, 2: 48000, 3: 38000}

EDITIONS_PASSEES = {
    2022: {1: 30000, 2: 36000, 3: 29000},
    2023: {1: 16000, 2: 21000, 3: 15000},
    2024: {1: 22000, 2: 28000, 3: 21000},
    2025: {1: 42000, 2: 48000, 3: 41000},
}

# Part de la capacite deja vendue en billetterie en ligne, releve a ~2 mois de
# l'evenement (etat actuel). Le samedi part le plus vite (tetes d'affiche).
BILLETTERIE_COURANTE = {1: 0.74, 2: 0.92, 3: 0.50}

ROTATIONS = {
    1: [(1, 2), (1, 3), (2, 3), (1, 2), (1, 3), (2, 3), (1, 2), (1, 3)],
    2: [(2, 3), (1, 2), (1, 3), (2, 3), (1, 2), (1, 3), (2, 3), (1, 2)],
    3: [(1, 3), (2, 3), (1, 2), (1, 3), (2, 3), (1, 2), (1, 3), (2, 3)],
}

LINEUP = {
    1: {
        1: [("Jolagreen23", 3), ("Theodora", 5), ("Josman", 6),
            ("Werenoi", 7), ("Tiakola", 8), ("Gims", 10)],
        2: [("Upsilone", 3), ("Hugel", 4), ("Feder", 6),
            ("Vintage Culture", 7), ("Fisher", 9)],
        3: [("Johnnie Carwash", 3), ("Slift", 5), ("Izïa", 6),
            ("Shaka Ponk", 8), ("Muse", 10)],
    },
    2: {
        1: [("Khali", 3), ("La Mano 1.9", 5), ("Favé", 6),
            ("Gazo", 8), ("Niska", 10)],
        2: [("Bellaire", 3), ("Louise Chen", 4), ("Malaa", 6),
            ("Kungs", 7), ("Petit Biscuit", 8), ("David Guetta", 10)],
        3: [("Bandit Bandit", 3), ("Lysistrata", 4), ("Last Train", 6),
            ("La Femme", 7), ("The Hives", 8)],
    },
    3: {
        1: [("Zamdane", 4), ("Luther", 5), ("SDM", 7),
            ("SCH", 9), ("Ninho", 10)],
        2: [("Habstrakt", 4), ("Folamour", 6), ("Tchami", 7),
            ("Martin Solveig", 8), ("DJ Snake", 10)],
        3: [("It It Anita", 3), ("Frustration", 4), ("Skip the Use", 6),
            ("Idles", 7), ("Royal Blood", 8), ("Queens of the Stone Age", 9)],
    },
}


def genere_scenes():
    donnees = [
        [1, "Scène Rap", "rap", 25000],
        [2, "Scène DJ", "electro", 20000],
        [3, "Scène Rock", "rock", 5000],
    ]
    return pd.DataFrame(donnees, columns=["scene_id", "nom", "genre", "capacite"])


def genere_programmation(scenes, rng=None, decalages=None):
    if decalages is None:
        decalages = {}
    genres = dict(zip(scenes["scene_id"], scenes["genre"]))
    lignes = []
    num = 1
    for jour in range(1, NB_JOURS + 1):
        compteurs = {1: 0, 2: 0, 3: 0}
        for i, paire in enumerate(ROTATIONS[jour]):
            debut = OUVERTURE + i * 60
            for scene_id in paire:
                artiste, popularite = LINEUP[jour][scene_id][compteurs[scene_id]]
                compteurs[scene_id] += 1
                decalage = decalages.get(scene_id, 0)
                lignes.append([num, jour, scene_id, artiste, genres[scene_id],
                               debut + decalage, debut + 60 + decalage, popularite])
                num += 1
    return pd.DataFrame(lignes, columns=["concert_id", "jour", "scene_id", "artiste",
                                         "genre", "heure_debut", "heure_fin", "popularite"])


def genere_billetterie():
    lignes = [[jour, part, int(round(part * CAPACITE_JOUR))]
              for jour, part in BILLETTERIE_COURANTE.items()]
    return pd.DataFrame(lignes, columns=["jour", "part_vendue", "ventes_actuelles"])


def genere_programmation_passee(scenes, annee):
    genres = dict(zip(scenes["scene_id"], scenes["genre"]))
    lignes = []
    num = 1
    for jour in range(1, NB_JOURS + 1):
        compteurs = {1: 0, 2: 0, 3: 0}
        for i, paire in enumerate(ROTATIONS[jour]):
            debut = OUVERTURE + i * 60
            for scene_id in paire:
                popularite = LINEUP[jour][scene_id][compteurs[scene_id]][1]
                compteurs[scene_id] += 1
                lignes.append([annee, num, jour, scene_id,
                               f"Artiste {annee}.{num:02d}", genres[scene_id],
                               debut, debut + 60, popularite])
                num += 1
    return pd.DataFrame(lignes, columns=["annee", "concert_id", "jour", "scene_id",
                                         "artiste", "genre", "heure_debut", "heure_fin",
                                         "popularite"])


def genere_visiteurs(rng, objectifs=None):
    if objectifs is None:
        objectifs = OBJECTIFS_VISITEURS
    lignes = []
    vid = 1
    for jour in range(1, NB_JOURS + 1):
        objectif = objectifs.get(jour, 38000)
        nb = min(int(objectif * rng.uniform(0.95, 1.05)), CAPACITE_JOUR)
        arrivees = np.clip(rng.normal(18 * 60, 90, nb), OUVERTURE, 22 * 60).astype(int)
        durees = np.clip(rng.normal(5 * 60, 90, nb), 120, 480).astype(int)
        genres = rng.choice(GENRES, size=nb, p=[0.5, 0.4, 0.07, 0.03])
        for i in range(nb):
            depart = int(min(arrivees[i] + durees[i], FERMETURE - 1))
            lignes.append([vid, jour, genres[i], int(arrivees[i]), depart])
            vid += 1
    return pd.DataFrame(lignes, columns=["visiteur_id", "jour", "genre_prefere",
                                         "heure_arrivee", "heure_depart"])


def genere_equipes(rng, multiplicateurs=None):
    if multiplicateurs is None:
        multiplicateurs = {}
    base = [("securite", 40, 10), ("food", 28, 10), ("sanitaire", 20, 8),
            ("medical", 20, 5), ("transport", 10, 5)]
    lignes = []
    eid = 1
    for type_equipe, nb_equipes, taille in base:
        nb = int(round(nb_equipes * multiplicateurs.get(type_equipe, 1.0)))
        for _ in range(nb):
            debut = int(rng.choice([15 * 60, 16 * 60, 18 * 60]))
            fin = int(rng.choice([22 * 60, FERMETURE, FERMETURE]))
            lignes.append([eid, type_equipe, taille, debut, fin])
            eid += 1
    return pd.DataFrame(lignes, columns=["equipe_id", "type", "effectif",
                                         "dispo_debut", "dispo_fin"])


def genere_points_interet():
    donnees = [
        [1, "stand_boisson", "Bar — Scénarios & coûts", 35, 62],
        [2, "stand_nourriture", "Food truck — Scénarios & coûts", 65, 62],
        [3, "stand_mixte", "Buvette — Scénarios & coûts", 50, 40],
        [4, "toilettes", "Sanitaires ouest — Allocation", 8, 72],
        [5, "toilettes", "Sanitaires est — Allocation", 92, 72],
        [6, "toilettes", "Sanitaires entrée — Allocation", 38, 8],
        [7, "secourisme", "Poste de secours — Anomalies", 62, 8],
    ]
    return pd.DataFrame(donnees, columns=["poi_id", "type", "nom", "x", "y"])


def genere_ressources(rng):
    lignes = []
    rid = 1
    for scene_id in range(1, 4):
        lignes.append([rid, "poste_secours", scene_id, 1])
        rid += 1
        lignes.append([rid, "stand_food", scene_id, int(rng.integers(2, 5))])
        rid += 1
        lignes.append([rid, "bloc_sanitaire", scene_id, int(rng.integers(2, 4))])
        rid += 1
    for _ in range(8):
        lignes.append([rid, "navette", 0, 1])
        rid += 1
    return pd.DataFrame(lignes, columns=["ressource_id", "type", "scene_id", "quantite"])
