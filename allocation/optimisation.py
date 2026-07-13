import numpy as np
import pandas as pd
import pulp

RATIOS = {"securite": 100, "food": 150, "sanitaire": 250, "medical": 400}

# Installations physiques par domaine, a l'echelle d'un festival de 50 000 personnes.
# Sert a ancrer l'effectif site-level en effectif PAR installation : la carte du site
# n'affiche que des marqueurs representatifs, pas l'inventaire complet. Ordres de grandeur
# indicatifs (~1 point de restauration / 2 000 pers., ~1 WC / 100 pers. groupes en blocs,
# dispositif previsionnel de secours multi-postes pour un grand rassemblement).
INSTALLATIONS = {
    "securite": {"nombre": None, "libelle": "postes répartis (entrées, scènes, périmètre)"},
    "food": {"nombre": 24, "libelle": "points de restauration"},
    "sanitaire": {"nombre": 30, "libelle": "blocs sanitaires (~450 WC)"},
    "medical": {"nombre": 6, "libelle": "postes de secours"},
}


def calcule_besoins(previsions, anomalies=None):
    besoins = []
    for _, l in previsions.iterrows():
        for type_e, ratio in RATIOS.items():
            besoin = int(np.ceil(l["prevision"] / ratio))
            if anomalies is not None and type_e in ("securite", "medical"):
                concerne = anomalies[(anomalies["jour"] == l["jour"])
                                     & (anomalies["creneau"] == l["creneau"])
                                     & (anomalies["scene_id"] == l["scene_id"])]
                if len(concerne) > 0:
                    besoin = int(np.ceil(besoin * 1.5)) + 2
            besoins.append([l["jour"], l["creneau"], l["scene_id"], type_e, besoin])
    return pd.DataFrame(besoins, columns=["jour", "creneau", "scene_id", "type", "besoin"])


def effectif_disponible(equipes, creneau):
    dispo = equipes[(equipes["dispo_debut"] <= creneau) & (equipes["dispo_fin"] > creneau)]
    return dispo.groupby("type")["effectif"].sum().to_dict()


def optimise(besoins, equipes):
    allocations = []
    for (jour, creneau), groupe in besoins.groupby(["jour", "creneau"]):
        dispo = effectif_disponible(equipes, creneau)
        prob = pulp.LpProblem("allocation", pulp.LpMinimize)
        x = {}
        manque = {}
        for _, l in groupe.iterrows():
            cle = (l["scene_id"], l["type"])
            x[cle] = pulp.LpVariable(f"x_{l['scene_id']}_{l['type']}", lowBound=0, cat="Integer")
            manque[cle] = pulp.LpVariable(f"m_{l['scene_id']}_{l['type']}", lowBound=0)
            prob += manque[cle] >= l["besoin"] - x[cle]
        prob += pulp.lpSum(manque.values()) * 100 + pulp.lpSum(x.values())
        for type_e in RATIOS:
            variables = [x[c] for c in x if c[1] == type_e]
            if len(variables) > 0:
                prob += pulp.lpSum(variables) <= dispo.get(type_e, 0)
        prob.solve(pulp.PULP_CBC_CMD(msg=0))
        for _, l in groupe.iterrows():
            cle = (l["scene_id"], l["type"])
            allocations.append([jour, creneau, l["scene_id"], l["type"],
                                l["besoin"], int(x[cle].value())])
    df = pd.DataFrame(allocations, columns=["jour", "creneau", "scene_id",
                                            "type", "besoin", "alloue"])
    df["couverture"] = np.where(df["besoin"] > 0,
                                np.minimum(df["alloue"] / df["besoin"].clip(lower=1), 1.0),
                                1.0)
    return df


# Transport (navettes) : service a l'echelle du site, dimensionne sur le flux de
# departs. Hypotheses assumees, comme les ratios d'encadrement.
CAPACITE_NAVETTE = 55        # personnes transportees par rotation (aller-retour 30 min)
PART_NAVETTE = 0.35          # part des partants qui prennent la navette (reste : voiture, marche, TC)
FENETRE_EVAC = 4             # creneaux (2 h) pour evacuer la vague de cloture (navettes jusqu'a ~2h)
AGENTS_PAR_NAVETTE = 2       # chauffeur + regulation


def dimensionne_transport(visiteurs, jour=3, creneau=30, ouverture=16 * 60, fermeture=24 * 60):
    """Dimensionne la flotte de navettes a l'echelle du site.

    Les navettes servent DEUX flux : amener les visiteurs (arrivees, concentrees a
    l'ouverture) et les evacuer (departs, qui explosent a la cloture). On taille la
    flotte sur la contrainte la plus dure — evacuer la vague de cloture dans une fenetre
    raisonnable — puis on rejoue les deux flux a travers cette flotte (modele de file :
    ce qui depasse le debit attend le creneau suivant), ce qui donne la charge reelle
    des navettes heure par heure. Les navettes sont en place des 15h30 (avant l'ouverture).
    """
    v = visiteurs[visiteurs["jour"] == jour]
    arr = ((v["heure_arrivee"] // creneau) * creneau).value_counts().to_dict()
    dep = ((v["heure_depart"] // creneau) * creneau).value_counts().to_dict()

    # Flotte dimensionnee sur l'evacuation de cloture (contrainte la plus critique).
    exode = int(dep.get(fermeture - creneau, 0))
    partants_navette = int(round(exode * PART_NAVETTE))
    flotte = int(np.ceil(partants_navette / (CAPACITE_NAVETTE * FENETRE_EVAC)))
    debit = flotte * CAPACITE_NAVETTE  # personnes transportees par creneau

    debut = ouverture - creneau                      # 15h30 : navettes en place
    fin = fermeture + (FENETRE_EVAC + 1) * creneau    # marge pour vider la file de sortie
    grille = list(range(debut, fin, creneau))

    def ecoule(demande):
        # Charge navette reelle : ce qui depasse le debit attend le creneau suivant.
        charge, file = [], 0.0
        for c in grille:
            file += demande.get(c, 0) * PART_NAVETTE
            servi = min(file, debit)
            file -= servi
            charge.append(int(round(servi)))
        return charge

    charge_arr = ecoule(arr)
    charge_dep = ecoule(dep)
    flux = pd.DataFrame({"creneau": grille, "arrivees": charge_arr, "departs": charge_dep})
    # On garde le creneau de mise en place (15h30, vide) en tete et on coupe les vides de fin.
    actifs = flux[(flux["arrivees"] > 0) | (flux["departs"] > 0)].index
    flux = flux.loc[:actifs.max()].reset_index(drop=True)

    metriques = {
        "jour": jour,
        "pic_departs": exode,
        "part_navette": PART_NAVETTE,
        "partants_navette": partants_navette,
        "flotte_ideale": flotte,
        "staff_ideal": flotte * AGENTS_PAR_NAVETTE,
        "capacite_navette": CAPACITE_NAVETTE,
        "fenetre_evac_h": FENETRE_EVAC * creneau / 60,
        "debit_creneau": debit,
    }
    return flux, metriques


NIVEAUX = (0.5, 0.75, 0.9, 1.0, 1.1)


def analyse_dimensionnement(besoins, niveaux=NIVEAUX, seuil_ok=0.99):
    """Teste plusieurs niveaux d'effectif d'un coup et deduit l'effectif ideal.

    Reference (100 %) par domaine = pic de besoin simultane (max sur les creneaux
    de la somme des besoins des scenes). Pour chaque niveau, on plafonne l'effectif
    a ce pourcentage de la reference et on ré-optimise la repartition ; on mesure
    la couverture obtenue. L'effectif ideal d'un domaine est le plus petit niveau
    teste qui couvre au moins `seuil_ok` de ses besoins (sinon la reference).
    """
    # Reference (100 %) = pic de besoin simultane, cad le max sur tous les
    # (jour, creneau) de la somme des besoins des scenes. Le max sur les 3 jours
    # revient au jour le plus charge : on dimensionne pour le pire cas du festival.
    pic = (besoins.groupby(["jour", "creneau", "type"])["besoin"].sum()
           .reset_index().groupby("type")["besoin"].max())
    reference = {t: int(pic[t]) for t in pic.index}

    par_niveau = {}
    couv_domaine = {t: {} for t in reference}
    for niveau in niveaux:
        pct = int(round(niveau * 100))
        capacites = {t: max(1, int(round(reference[t] * niveau))) for t in reference}
        equipes_syn = pd.DataFrame(
            [[i, t, capacites[t], 0, 24 * 60] for i, t in enumerate(reference)],
            columns=["equipe_id", "type", "effectif", "dispo_debut", "dispo_fin"])
        alloc = optimise(besoins, equipes_syn)
        par_niveau[pct] = {
            "capacites": capacites,
            "couverture_globale": float(alloc["couverture"].mean()),
            "creneaux_decouverts": int((alloc["couverture"] < 0.999).sum()),
        }
        for t, c in alloc.groupby("type")["couverture"].mean().items():
            couv_domaine[t][pct] = float(c)

    ideal = {}
    for t in reference:
        retenu = reference[t]
        for niveau in niveaux:
            pct = int(round(niveau * 100))
            if couv_domaine[t][pct] >= seuil_ok:
                retenu = int(round(reference[t] * niveau))
                break
        ideal[t] = retenu

    lignes = []
    for niveau in niveaux:
        pct = int(round(niveau * 100))
        info = par_niveau[pct]
        for t in reference:
            lignes.append([pct, t, info["capacites"][t], round(couv_domaine[t][pct], 4),
                           reference[t], ideal[t],
                           round(info["couverture_globale"], 4),
                           info["creneaux_decouverts"]])
    return pd.DataFrame(lignes, columns=[
        "niveau_pct", "type", "effectif", "couverture_domaine", "reference",
        "ideal", "couverture_globale", "creneaux_decouverts"])
