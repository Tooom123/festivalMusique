LIBELLES_TYPES = {"securite": "agents de sécurité", "food": "équipiers food",
                  "sanitaire": "agents sanitaires", "medical": "secouristes",
                  "transport": "agents transport"}

JOURS = {1: "vendredi", 2: "samedi", 3: "dimanche"}

from scenario_simulation.scenarios import LIBELLES as LIBELLES_SCENARIOS


def heure_texte(minute):
    minute = int(minute)
    return f"{minute // 60:02d}h{minute % 60:02d}"


def genere(previsions, scenes, anomalies, initiale, ajustee, synthese):
    recos = []
    noms = dict(zip(scenes["scene_id"], scenes["nom"]))

    df = previsions.merge(scenes[["scene_id", "capacite"]], on="scene_id",
                          suffixes=("", "_s"))
    df["taux_prevu"] = df["prevision"] / df["capacite"]
    surcharges = df[df["taux_prevu"] >= 0.9].sort_values("taux_prevu", ascending=False)
    for _, l in surcharges.head(5).iterrows():
        gravite = "critique" if l["taux_prevu"] >= 1.0 else "eleve"
        recos.append({
            "gravite": gravite,
            "titre": f"Surcharge prévue sur {noms[int(l['scene_id'])]} — {JOURS[int(l['jour'])]} {heure_texte(l['creneau'])}",
            "detail": f"Occupation prévue à {l['taux_prevu']:.0%} de la capacité "
                      f"({int(l['prevision'])} visiteurs pour {int(l['capacite'])} places). "
                      f"Limiter les entrées en amont et ouvrir les sorties latérales.",
        })

    fusion = ajustee.merge(initiale[["jour", "creneau", "scene_id", "type", "alloue"]],
                           on=["jour", "creneau", "scene_id", "type"],
                           suffixes=("", "_avant"))
    fusion["delta"] = fusion["alloue"] - fusion["alloue_avant"]
    renforts = (fusion[fusion["delta"] > 0]
                .groupby(["scene_id", "type"])["delta"].sum().reset_index()
                .sort_values("delta", ascending=False))
    for _, l in renforts.head(5).iterrows():
        recos.append({
            "gravite": "info",
            "titre": f"+{int(l['delta'])} {LIBELLES_TYPES[l['type']]} réaffectés sur {noms[int(l['scene_id'])]}",
            "detail": "Réallocation déclenchée automatiquement par les anomalies détectées "
                      "sur cette scène (cumul des créneaux sur les 3 jours).",
        })

    manques = (fusion[fusion["besoin"] > fusion["alloue"]]
               .groupby(["scene_id", "type"])
               .agg(manque=("besoin", "sum"), couvert=("alloue", "sum")).reset_index())
    manques["deficit"] = manques["manque"] - manques["couvert"]
    manques = manques.sort_values("deficit", ascending=False)
    for _, l in manques.head(3).iterrows():
        recos.append({
            "gravite": "moyen",
            "titre": f"Besoin résiduel non couvert : {LIBELLES_TYPES[l['type']]} sur {noms[int(l['scene_id'])]}",
            "detail": f"Il manque {int(l['deficit'])} personnes cumulées sur les 3 jours malgré "
                      f"la réallocation : l'effectif total est insuffisant aux heures de pointe. "
                      f"Prévoir des vacataires ou étaler la programmation.",
        })

    tri = synthese.sort_values("taux_surcharge")
    meilleur = tri.iloc[0]
    base = synthese[synthese["scenario"] == "base"].iloc[0]
    if meilleur["scenario"] != "base":
        surcout = meilleur["cout_personnel"] - base["cout_personnel"]
        if abs(surcout) < 1:
            cout_texte = "à coût de personnel constant"
        else:
            cout_texte = f"pour un surcoût de personnel de {surcout:+,.0f} EUR".replace(",", " ")
        recos.append({
            "gravite": "ok",
            "titre": f"Organisation recommandée : {LIBELLES_SCENARIOS.get(meilleur['scenario'], meilleur['scenario'])}",
            "detail": f"La simulation comparative fait passer les créneaux en surcharge de "
                      f"{base['taux_surcharge']:.1%} à {meilleur['taux_surcharge']:.1%} et le pic "
                      f"d'occupation de {base['pic_occupation']:.2f} à {meilleur['pic_occupation']:.2f}, "
                      f"{cout_texte}.",
        })
    pire_rapport = synthese.sort_values("cout_personnel", ascending=False).iloc[0]
    if (pire_rapport["scenario"] != "base"
            and pire_rapport["cout_personnel"] > base["cout_personnel"]
            and pire_rapport["taux_surcharge"] >= meilleur["taux_surcharge"]):
        recos.append({
            "gravite": "moyen",
            "titre": f"Rapport coût/bénéfice défavorable : {LIBELLES_SCENARIOS.get(pire_rapport['scenario'], pire_rapport['scenario'])}",
            "detail": f"Ce scénario coûte {pire_rapport['cout_personnel'] - base['cout_personnel']:+,.0f} EUR "
                      f"de personnel pour une surcharge de {pire_rapport['taux_surcharge']:.1%} "
                      f"(contre {meilleur['taux_surcharge']:.1%} pour la meilleure option) : "
                      f"renforcer les effectifs traite le symptôme, pas la cause.".replace(",", " "),
        })

    ordre = {"critique": 0, "eleve": 1, "moyen": 2, "info": 3, "ok": 4}
    recos.sort(key=lambda r: ordre[r["gravite"]])
    return recos
