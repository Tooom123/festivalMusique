import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score

COLONNES = ["scene_id", "capacite", "popularite", "actif", "popularite_suivante",
            "lag1", "lag2", "heure", "soir"]


def prepare_donnees(affluence_creneau, programmation, scenes):
    df = affluence_creneau.merge(scenes[["scene_id", "capacite"]], on="scene_id")
    pops = []
    actifs = []
    pops_suivantes = []
    for _, ligne in df.iterrows():
        c = programmation[(programmation["annee"] == ligne["annee"])
                          & (programmation["jour"] == ligne["jour"])
                          & (programmation["scene_id"] == ligne["scene_id"])
                          & (programmation["heure_debut"] <= ligne["creneau"])
                          & (programmation["heure_fin"] > ligne["creneau"])]
        pops.append(int(c.iloc[0]["popularite"]) if len(c) > 0 else 0)
        actifs.append(1 if len(c) > 0 else 0)
        suivant = programmation[(programmation["annee"] == ligne["annee"])
                                & (programmation["jour"] == ligne["jour"])
                                & (programmation["scene_id"] == ligne["scene_id"])
                                & (programmation["heure_debut"] > ligne["creneau"])
                                & (programmation["heure_debut"] <= ligne["creneau"] + 60)]
        pops_suivantes.append(int(suivant["popularite"].max()) if len(suivant) > 0 else 0)
    df["popularite"] = pops
    df["actif"] = actifs
    df["popularite_suivante"] = pops_suivantes
    df = df.sort_values(["annee", "scene_id", "jour", "creneau"]).reset_index(drop=True)
    df["lag1"] = df.groupby(["annee", "scene_id", "jour"])["nb_visiteurs"].shift(1).fillna(0)
    df["lag2"] = df.groupby(["annee", "scene_id", "jour"])["nb_visiteurs"].shift(2).fillna(0)
    df["heure"] = df["creneau"] / 60
    df["soir"] = (df["creneau"] >= 20 * 60).astype(int)
    return df


def entraine(df, annee_courante):
    train = df[(df["annee"] < annee_courante)
               | ((df["annee"] == annee_courante) & (df["jour"] <= 2))]
    test = df[(df["annee"] == annee_courante) & (df["jour"] == 3)].copy()

    lineaire = LinearRegression()
    lineaire.fit(train[COLONNES], train["nb_visiteurs"])
    pred_lin = lineaire.predict(test[COLONNES])

    foret = RandomForestRegressor(n_estimators=300, random_state=42)
    foret.fit(train[COLONNES], train["nb_visiteurs"])
    pred_foret = foret.predict(test[COLONNES])

    pred_naif = test["lag1"]

    mae_lin = mean_absolute_error(test["nb_visiteurs"], pred_lin)
    mae_foret = mean_absolute_error(test["nb_visiteurs"], pred_foret)

    if mae_lin <= mae_foret:
        modele_retenu, modele, pred = "regression lineaire", lineaire, pred_lin
    else:
        modele_retenu, modele, pred = "foret aleatoire", foret, pred_foret

    train_sans = df[(df["annee"] == annee_courante) & (df["jour"] <= 2)]
    lin_sans = LinearRegression().fit(train_sans[COLONNES], train_sans["nb_visiteurs"])
    foret_sans = RandomForestRegressor(n_estimators=300, random_state=42)
    foret_sans.fit(train_sans[COLONNES], train_sans["nb_visiteurs"])
    mae_sans_historique = min(
        mean_absolute_error(test["nb_visiteurs"], lin_sans.predict(test[COLONNES])),
        mean_absolute_error(test["nb_visiteurs"], foret_sans.predict(test[COLONNES])),
    )

    test["prevision"] = np.round(pred).clip(0).astype(int)

    metriques = {
        "modele_retenu": modele_retenu,
        "mae_retenue": min(mae_lin, mae_foret),
        "mae_lineaire": mae_lin,
        "mae_foret": mae_foret,
        "mae_naif": mean_absolute_error(test["nb_visiteurs"], pred_naif),
        "mae_sans_historique": mae_sans_historique,
        "r2_lineaire": r2_score(test["nb_visiteurs"], pred_lin),
        "r2_foret": r2_score(test["nb_visiteurs"], pred_foret),
        "r2_retenu": r2_score(test["nb_visiteurs"], pred),
    }

    permutation = permutation_importance(modele, train[COLONNES], train["nb_visiteurs"],
                                         n_repeats=20, random_state=42)
    importances = pd.DataFrame({"variable": COLONNES,
                                "importance": permutation.importances_mean})
    importances = importances.sort_values("importance", ascending=False).reset_index(drop=True)
    return test, metriques, importances


# Part de la capacite encore disponible qui se vendra d'ici l'evenement (ventes
# tardives + sur place), estimee a partir des courbes de vente typiques a 2 mois.
TAUX_CONVERSION_RESTANT = 0.35


def prevision_edition(historique_editions, billetterie, reels_courants,
                      annee_courante, capacite_jour):
    ventes = dict(zip(billetterie["jour"], billetterie["ventes_actuelles"]))
    parts = dict(zip(billetterie["jour"], billetterie["part_vendue"]))
    lignes = []
    for jour, groupe in historique_editions.groupby("jour"):
        pente, origine = np.polyfit(groupe["annee"], groupe["visiteurs"], 1)
        p_tendance = int(np.clip(pente * annee_courante + origine, 0, capacite_jour))

        vendus = ventes.get(jour, 0)
        p_billetterie = int(min(
            capacite_jour,
            vendus + (capacite_jour - vendus) * TAUX_CONVERSION_RESTANT))

        p_combinee = int(round((p_tendance + p_billetterie) / 2))
        reel = int(reels_courants.get(jour, 0))

        def err(p):
            return round(abs(p - reel) / max(reel, 1) * 100, 1)

        lignes.append([jour, parts.get(jour, 0.0), p_tendance, p_billetterie,
                       p_combinee, reel, err(p_tendance), err(p_billetterie),
                       err(p_combinee)])
    return pd.DataFrame(lignes, columns=[
        "jour", "part_vendue", "prevision_tendance", "prevision_billetterie",
        "prevision_combinee", "visiteurs_reels", "erreur_tendance_pct",
        "erreur_billetterie_pct", "erreur_combinee_pct"])
