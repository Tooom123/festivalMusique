import numpy as np
import pandas as pd
import pulp

RATIOS = {"securite": 100, "food": 150, "sanitaire": 250, "medical": 400}


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
