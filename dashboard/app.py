import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

import carte
import menus
import reco
from theme import (COULEURS_GRAVITE, COULEURS_JOURS, COULEURS_SCENES, ECHELLE_SEQ,
                   JOURS_COURT, JOURS_LONG, heure_texte, style_fig)

DOSSIER = Path(__file__).parent.parent / "data"

LIBELLES_VARIABLES = {"lag1": "affluence créneau -1", "lag2": "affluence créneau -2",
                      "heure": "heure", "popularite": "popularité artiste",
                      "capacite": "capacité scène", "scene_id": "scène", "soir": "soirée",
                      "actif": "scène active", "popularite_suivante": "popularité set suivant"}
ORDRE_SCENARIOS = ["base", "scenes_dj_rock_agrandies", "horaires_decales", "securite_renforcee"]


@st.cache_data
def charge(nom):
    conn = sqlite3.connect(DOSSIER / "festival.db")
    df = pd.read_sql(f"SELECT * FROM {nom}", conn)
    conn.close()
    return df


st.set_page_config(page_title="Festival Musical Intelligent", layout="wide")

if not (DOSSIER / "festival.db").exists():
    st.error("Aucune donnée trouvée. Lancer d'abord : python run_pipeline.py")
    st.stop()

scenes = charge("scenes")
noms_scenes = dict(zip(scenes["scene_id"], scenes["nom"]))
couleurs = {noms_scenes[sid]: COULEURS_SCENES[i] for i, sid in enumerate(sorted(noms_scenes))}

st.sidebar.title("Festival Musical Intelligent")
page = st.sidebar.radio("Navigation", [
    "Vue d'ensemble", "Programmation", "Carte du site", "Affluence", "Prévisions",
    "Anomalies", "Allocation", "Recommandations", "Scénarios"])
st.sidebar.divider()
st.sidebar.caption("Données générées par run_pipeline.py (graine 42).")


if page == "Vue d'ensemble":
    st.title("Vue d'ensemble")
    visiteurs = charge("visiteurs")
    anomalies = charge("anomalies")
    metriques = charge("metriques_prevision")
    affluence = charge("affluence_creneau")
    ajustee = charge("allocation_ajustee")

    st.caption("Vendredi 4, samedi 5 et dimanche 6 septembre 2026. Capacité maximale : "
               "50 000 personnes par jour. Le samedi est le jour le plus fréquenté, "
               "conformément aux éditions précédentes.")
    hautes = int((anomalies["gravite"] == "haute").sum())
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Visiteurs sur 3 jours", f"{len(visiteurs):,}".replace(",", " "))
    c2.metric("Pic d'affluence", int(affluence["nb_visiteurs"].max()),
              help="Maximum atteint sur une scène et un créneau")
    c3.metric("Anomalies détectées", len(anomalies), f"dont {hautes} de gravité haute",
              delta_color="off")
    c4.metric("Erreur de prévision (MAE)", f"{metriques['mae_retenue'][0]:.0f} visiteurs",
              f"R2 = {metriques['r2_retenu'][0]:.2f}", delta_color="off")
    c5.metric("Couverture des besoins", f"{ajustee['couverture'].mean():.0%}",
              "après réallocation", delta_color="off")

    gauche, droite = st.columns([3, 2])
    with gauche:
        st.subheader("Affluence totale du site")
        total = affluence.groupby(["jour", "creneau"])["nb_visiteurs"].sum().reset_index()
        total["heure"] = total["creneau"].apply(heure_texte)
        total["jour"] = total["jour"].map(JOURS_COURT)
        fig = px.line(total, x="heure", y="nb_visiteurs", color="jour",
                      color_discrete_sequence=COULEURS_JOURS,
                      category_orders={"jour": list(JOURS_COURT.values())})
        fig.update_traces(line_width=2.5)
        fig.update_layout(xaxis_title=None, yaxis_title="Visiteurs présents", legend_title=None)
        st.plotly_chart(style_fig(fig), width="stretch")
    with droite:
        st.subheader("Anomalies par jour")
        par_jour = anomalies.groupby(["jour", "gravite"]).size().reset_index(name="nb")
        par_jour["jour"] = par_jour["jour"].map(JOURS_COURT)
        fig2 = px.bar(par_jour, x="jour", y="nb", color="gravite",
                      color_discrete_map=COULEURS_GRAVITE,
                      category_orders={"gravite": ["haute", "moyenne", "basse"],
                                       "jour": list(JOURS_COURT.values())})
        fig2.update_layout(xaxis_title=None, yaxis_title="Anomalies", legend_title=None,
                           bargap=0.45)
        fig2.update_traces(marker_line_width=0)
        st.plotly_chart(style_fig(fig2), width="stretch")

    st.caption("Pipeline : simulation à événements discrets, prévision (historique 2022-2025 + comparatif de modèles), "
               "détection (règles + Isolation Forest), allocation (programmation linéaire), "
               "scénarios (rejeu Monte Carlo).")

elif page == "Programmation":
    st.title("Programmation")
    st.caption("16 sets d'une heure par jour, de 16h à minuit. Deux scènes actives en "
               "permanence, la troisième en pause pour le changement de plateau. "
               "Les têtes d'affiche clôturent à 23h.")
    programmation = charge("programmation")
    programmation["nom"] = programmation["scene_id"].map(noms_scenes)

    jour = st.selectbox("Jour", [1, 2, 3], format_func=lambda j: JOURS_LONG[j])
    df = programmation[programmation["jour"] == jour].copy()
    base = pd.Timestamp("2026-07-01")
    df["debut"] = base + pd.to_timedelta(df["heure_debut"], unit="m")
    df["fin"] = base + pd.to_timedelta(df["heure_fin"], unit="m")

    fig = px.timeline(df, x_start="debut", x_end="fin", y="nom", color="nom",
                      text="artiste", color_discrete_map=couleurs,
                      hover_data={"popularite": True, "debut": False, "fin": False,
                                  "nom": False})
    fig.update_traces(textposition="inside", insidetextanchor="middle",
                      textfont=dict(color="#ffffff", size=13),
                      marker_line=dict(color="#0d0d0d", width=2))
    fig.update_yaxes(categoryorder="array",
                     categoryarray=[noms_scenes[s] for s in sorted(noms_scenes, reverse=True)],
                     title=None)
    fig.update_xaxes(tickformat="%Hh%M", title=None)
    fig.update_layout(showlegend=False)
    st.plotly_chart(style_fig(fig, 360), width="stretch")

    st.subheader("Grille horaire")
    df["heure"] = df["heure_debut"].apply(heure_texte)
    grille = df.pivot_table(index="heure", columns="nom", values="artiste",
                            aggfunc="first").fillna("—")
    st.dataframe(grille, width="stretch")

elif page == "Carte du site":
    st.title("Carte du site")
    st.caption("Taille des cercles : affluence. Couleur : taux d'occupation "
               "(vert < 70 %, jaune 70-90 %, orange 90-100 %, rouge > 100 %). "
               "Croix rouge : anomalie. Traits bleus : principaux flux de visiteurs. "
               "Losanges : stands, carrés : toilettes, croix verte : poste de secours. "
               "Cliquer sur une scène ou un stand pour le détail. "
               "Le bouton Lecture rejoue la journée créneau par créneau.")
    evenements = charge("evenements")
    affluence = charge("affluence_creneau")
    anomalies = charge("anomalies")
    points_interet = charge("points_interet")
    programmation = charge("programmation")

    gauche, droite = st.columns([5, 1])
    with droite:
        jour = st.selectbox("Jour", [1, 2, 3], index=1, format_func=lambda j: JOURS_LONG[j])
        aff_jour = affluence[affluence["jour"] == jour]
        st.metric("Pic du jour", int(aff_jour["nb_visiteurs"].max()))
        st.metric("Anomalies du jour", int((anomalies["jour"] == jour).sum()))
    with gauche:
        fig = carte.construit_carte(affluence, scenes, anomalies, evenements, jour,
                                    points_interet)
        etat = st.plotly_chart(fig, width="stretch", config={"displayModeBar": False},
                               on_select="rerun", selection_mode="points", key="carte")

    clic = None
    points = etat.selection.points if etat and etat.selection else []
    if points and "customdata" in points[0]:
        clic = points[0]["customdata"]

    st.divider()
    if clic is None:
        st.caption("Aucune sélection : cliquez sur une scène ou un stand sur la carte.")
    elif clic[0] == "scene":
        scene_id = clic[1]
        st.subheader(f"Programme — {noms_scenes[scene_id]}")
        df = programmation[(programmation["scene_id"] == scene_id)
                           & (programmation["jour"] == jour)].sort_values("heure_debut")
        df_aff = pd.DataFrame({
            "Horaire": [f"{heure_texte(d)} - {heure_texte(f)}"
                       for d, f in zip(df["heure_debut"], df["heure_fin"])],
            "Artiste": df["artiste"].values,
            "Notoriété": df["popularite"].values,
        })
        st.dataframe(df_aff, width="stretch", hide_index=True)
    elif clic[0] == "poi":
        poi_id = clic[1]
        ligne = points_interet[points_interet["poi_id"] == poi_id].iloc[0]
        if ligne["type"] in menus.MENUS:
            st.subheader(ligne["nom"])
            st.dataframe(menus.carte_menu(ligne["type"]), width="stretch", hide_index=True)
        else:
            st.subheader(ligne["nom"])
            st.caption("Point d'intérêt du site.")

elif page == "Affluence":
    st.title("Affluence par scène")
    affluence = charge("affluence_creneau")
    affluence["nom"] = affluence["scene_id"].map(noms_scenes)
    jour = st.selectbox("Jour", [1, 2, 3], format_func=lambda j: JOURS_LONG[j])
    df = affluence[affluence["jour"] == jour].sort_values("creneau").copy()
    df["heure"] = df["creneau"].apply(heure_texte)
    heures = [heure_texte(c) for c in sorted(df["creneau"].unique())]

    fig = px.line(df, x="heure", y="nb_visiteurs", color="nom",
                  color_discrete_map=couleurs, category_orders={"heure": heures})
    fig.update_traces(line_width=2.5)
    fig.update_layout(xaxis_title=None, yaxis_title="Visiteurs présents", legend_title=None)
    st.plotly_chart(style_fig(fig), width="stretch")

    st.subheader("Taux d'occupation")
    df = df.merge(scenes[["scene_id", "capacite"]], on="scene_id")
    df["taux"] = (df["nb_visiteurs"] / df["capacite"]).round(2)
    pivot = df.pivot_table(index="nom", columns="heure", values="taux")[heures]
    fig2 = px.imshow(pivot, color_continuous_scale=ECHELLE_SEQ, aspect="auto",
                     labels={"color": "Occupation", "x": "", "y": ""})
    st.plotly_chart(style_fig(fig2, 380), width="stretch")

elif page == "Prévisions":
    st.title("Prévision de l'affluence")
    st.caption("Deux horizons : la fréquentation de la 5e édition estimée par la tendance "
               "des éditions 2022-2025, puis la prévision par scène et créneau de 30 min "
               "pour le dimanche (modèles entraînés sur les 4 éditions passées plus le "
               "vendredi et le samedi 2026, comparés sur les données du dimanche).")
    previsions = charge("previsions")
    metriques = charge("metriques_prevision")
    importances = charge("importances_variables")
    historique = charge("historique_editions")
    prevision_ed = charge("prevision_edition")
    previsions["nom"] = previsions["scene_id"].map(noms_scenes)

    st.subheader("Affluence par édition")
    totaux = historique.groupby("annee")["visiteurs"].sum().reset_index()
    reel_2026 = int(prevision_ed["visiteurs_reels"].sum())
    combinee_2026 = int(prevision_ed["prevision_combinee"].sum())
    annees = [str(a) for a in totaux["annee"]] + ["2026"]
    valeurs = list(totaux["visiteurs"]) + [reel_2026]
    fig_ed = go.Figure()
    fig_ed.add_trace(go.Bar(x=annees, y=valeurs, name="Fréquentation réelle",
                            marker_color=["#31415f"] * 4 + ["#3987e5"]))
    fig_ed.add_trace(go.Scatter(x=["2026"], y=[combinee_2026], mode="markers",
                                name="Prévision combinée (tendance + billetterie)",
                                marker=dict(symbol="diamond", size=14, color="#e66767")))
    fig_ed.update_layout(yaxis_title="Entrées sur 3 jours", legend_title=None, bargap=0.4)
    st.plotly_chart(style_fig(fig_ed, 340), width="stretch")

    st.subheader("Billetterie en ligne (état à 2 mois de l'événement)")
    billetterie_vue = prevision_ed.copy()
    billetterie_vue["jour"] = billetterie_vue["jour"].map(JOURS_LONG)
    billetterie_vue["part_vendue"] = (billetterie_vue["part_vendue"] * 100).round().astype(int).astype(str) + " %"
    st.dataframe(
        billetterie_vue[["jour", "part_vendue", "prevision_tendance",
                         "prevision_billetterie", "prevision_combinee", "visiteurs_reels"]]
        .rename(columns={"jour": "Jour", "part_vendue": "Vendu", "prevision_tendance": "Prév. tendance",
                         "prevision_billetterie": "Prév. billetterie",
                         "prevision_combinee": "Prév. combinée", "visiteurs_reels": "Réel"}),
        width="stretch", hide_index=True)

    retenu = metriques["modele_retenu"][0]
    nom_retenu = "forêt aléatoire" if retenu == "foret aleatoire" else "régression linéaire"
    nom_autre = "régression linéaire" if retenu == "foret aleatoire" else "forêt aléatoire"
    mae_autre = metriques["mae_lineaire"][0] if retenu == "foret aleatoire" else metriques["mae_foret"][0]
    gain = (1 - metriques["mae_retenue"][0] / metriques["mae_sans_historique"][0]) * 100

    st.subheader(f"Prévision par scène et créneau ({JOURS_LONG[3]})")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("MAE modèle retenu", f"{metriques['mae_retenue'][0]:.1f}",
              f"{nom_retenu} · R2 {metriques['r2_retenu'][0]:.3f}", delta_color="off")
    c2.metric(f"MAE {nom_autre}", f"{mae_autre:.1f}")
    c3.metric("MAE modèle naïf", f"{metriques['mae_naif'][0]:.1f}")
    c4.metric("Apport de l'historique", f"-{gain:.0f} %",
              f"MAE {metriques['mae_sans_historique'][0]:.0f} sans les éditions passées",
              delta_color="off")

    scene_choisie = st.selectbox("Scène", list(noms_scenes.values()))
    df = previsions[previsions["nom"] == scene_choisie].sort_values("creneau").copy()
    df["heure"] = df["creneau"].apply(heure_texte)
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=df["heure"], y=df["nb_visiteurs"], name="Observé",
                             line=dict(color="#3987e5", width=2.5)))
    fig.add_trace(go.Scatter(x=df["heure"], y=df["prevision"], name="Prévu",
                             line=dict(color="#e66767", width=2.5, dash="dash")))
    fig.update_layout(xaxis_title=None, yaxis_title="Visiteurs", legend_title=None)
    st.plotly_chart(style_fig(fig), width="stretch")

    st.subheader("Importance des variables")
    imp = importances.copy()
    imp["variable"] = imp["variable"].map(LIBELLES_VARIABLES)
    fig2 = px.bar(imp, x="importance", y="variable", orientation="h",
                  color_discrete_sequence=["#3987e5"])
    fig2.update_layout(yaxis=dict(autorange="reversed"), xaxis_title="Importance",
                       yaxis_title=None)
    fig2.update_traces(marker_line_width=0)
    st.plotly_chart(style_fig(fig2, 340), width="stretch")

elif page == "Anomalies":
    st.title("Anomalies détectées")
    st.caption("Règles métier (surcharges, pannes, mouvements de foule) complétées par "
               "Isolation Forest. La détection est évaluée contre les incidents injectés "
               "dans la simulation.")
    anomalies = charge("anomalies")
    metriques = charge("metriques_prevision")
    anomalies["nom"] = anomalies["scene_id"].map(noms_scenes).fillna("Hors scène")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Gravité haute", int((anomalies["gravite"] == "haute").sum()))
    c2.metric("Gravité moyenne", int((anomalies["gravite"] == "moyenne").sum()))
    c3.metric("Gravité basse", int((anomalies["gravite"] == "basse").sum()))
    c4.metric("Mouvements de foule retrouvés",
              f"{int(metriques['foules_retrouvees'][0])}/{int(metriques['foules_injectees'][0])}",
              help="Rappel mesuré contre les incidents injectés dans la simulation")

    jour = st.selectbox("Jour", [1, 2, 3], format_func=lambda j: JOURS_LONG[j])
    df = anomalies[anomalies["jour"] == jour].sort_values("creneau").copy()
    df["heure"] = df["creneau"].apply(heure_texte)
    heures = [heure_texte(c) for c in sorted(df["creneau"].unique())]
    fig = px.scatter(df, x="heure", y="nom", color="gravite", symbol="type",
                     color_discrete_map=COULEURS_GRAVITE,
                     category_orders={"heure": heures,
                                      "gravite": ["haute", "moyenne", "basse"]})
    fig.update_traces(marker_size=13, marker_line=dict(width=1, color="rgba(255,255,255,0.3)"))
    fig.update_layout(xaxis_title=None, yaxis_title=None, legend_title=None)
    st.plotly_chart(style_fig(fig), width="stretch")

    st.dataframe(df[["heure", "nom", "type", "gravite", "source"]],
                 width="stretch", hide_index=True)

    st.subheader("Anticipation — prévoir les surcharges avant l'événement")
    st.caption("On applique la règle de surcharge sur la prévision d'affluence du dimanche "
               "6 septembre 2026 pour alerter à l'avance, puis on vérifie combien de ces "
               "alertes se sont produites. Seules les surcharges sont anticipables (pas les "
               "pannes ni les micro-mouvements de foule).")
    antic = charge("anticipation_alertes")
    ac1, ac2, ac3, ac4 = st.columns(4)
    ac1.metric("Surcharges anticipées", int(metriques["antic_predites"][0]),
               "avant le festival", delta_color="off")
    ac2.metric("Confirmées le jour J",
               f"{int(metriques['antic_correctes'][0])}/{int(metriques['antic_predites'][0])}",
               delta_color="off")
    ac3.metric("Précision", f"{metriques['antic_precision'][0]:.0%}",
               "quand on alerte, on a raison", delta_color="off")
    ac4.metric("Rappel", f"{metriques['antic_rappel'][0]:.0%}",
               "des surcharges réelles anticipées", delta_color="off")

    antic = antic.sort_values("creneau").copy()
    antic["Heure"] = antic["creneau"].apply(heure_texte)
    antic["Scène"] = antic["scene_id"].map(noms_scenes)
    antic["Occupation prévue"] = (antic["taux_prevu"] * 100).round().astype(int).astype(str) + " %"
    antic["Occupation réelle"] = (antic["taux_reel"] * 100).round().astype(int).astype(str) + " %"
    antic["Alerte"] = antic["realise"].map({1: "confirmée", 0: "non survenue",
                                            True: "confirmée", False: "non survenue"})
    st.dataframe(antic[["Heure", "Scène", "Occupation prévue", "Occupation réelle", "Alerte"]],
                 width="stretch", hide_index=True)

elif page == "Allocation":
    st.title(f"Allocation des ressources ({JOURS_LONG[3]})")
    st.caption("Répartition du personnel optimisée par programmation linéaire à partir des "
               "prévisions, puis ré-optimisée quand des anomalies sont détectées.")
    initiale = charge("allocation_initiale")
    figee = charge("allocation_figee")
    ajustee = charge("allocation_ajustee")

    pct_initiale = round(initiale["couverture"].mean() * 100, 1)
    pct_figee = round(figee["couverture"].mean() * 100, 1)
    pct_ajustee = round(ajustee["couverture"].mean() * 100, 1)
    c1, c2, c3 = st.columns(3)
    c1.metric("Besoins prévus couverts", f"{pct_initiale:.1f} %",
              "allocation initiale", delta_color="off")
    c2.metric("Besoins ajustés, allocation figée", f"{pct_figee:.1f} %",
              "sans réaction aux anomalies", delta_color="off")
    c3.metric("Besoins ajustés après réallocation", f"{pct_ajustee:.1f} %",
              f"+{pct_ajustee - pct_figee:.1f} pts de couverture")

    type_choisi = st.selectbox("Type d'équipe", sorted(initiale["type"].unique()))
    df = ajustee[ajustee["type"] == type_choisi].sort_values("creneau").copy()
    df["nom"] = df["scene_id"].map(noms_scenes)
    df["heure"] = df["creneau"].apply(heure_texte)
    heures = [heure_texte(c) for c in sorted(df["creneau"].unique())]
    fig = px.bar(df, x="heure", y="alloue", color="nom", color_discrete_map=couleurs,
                 category_orders={"heure": heures})
    fig.update_layout(xaxis_title=None, yaxis_title="Personnel alloué", legend_title=None,
                      bargap=0.25)
    fig.update_traces(marker_line=dict(width=1, color="#0d0d0d"))
    st.plotly_chart(style_fig(fig), width="stretch")

    st.subheader("Besoin et alloué par scène (cumul de la journée)")
    resume = df.groupby("nom")[["besoin", "alloue"]].sum().reset_index()
    fig2 = go.Figure()
    fig2.add_trace(go.Bar(x=resume["nom"], y=resume["besoin"], name="Besoin",
                          marker_color="#9ec5f4"))
    fig2.add_trace(go.Bar(x=resume["nom"], y=resume["alloue"], name="Alloué",
                          marker_color="#3987e5"))
    fig2.update_layout(barmode="group", yaxis_title="Personnel", legend_title=None,
                       bargap=0.35)
    fig2.update_traces(marker_line_width=0)
    st.plotly_chart(style_fig(fig2, 380), width="stretch")

    st.subheader("Dimensionnement du personnel — combien déployer ?")
    st.caption(f"D'après la prévision d'affluence du {JOURS_LONG[3]} 2026 : faut-il vraiment "
               "100 % de l'effectif de pointe ? On teste tous les niveaux d'un coup : en dessous, "
               "des créneaux restent à découvert (risque) ; au-dessus, c'est du personnel payé "
               "pour rien.")
    dim = charge("dimensionnement")
    niveaux = dim.drop_duplicates("niveau_pct").sort_values("niveau_pct")
    couleurs_niv = ["#d03b3b" if c < 0.9 else "#fab219" if c < 0.999 else "#0ca30c"
                    for c in niveaux["couverture_globale"]]
    fig3 = go.Figure(go.Bar(
        x=[f"{p} %" for p in niveaux["niveau_pct"]],
        y=(niveaux["couverture_globale"] * 100).round(1),
        marker_color=couleurs_niv,
        text=[f"{n} à découvert" for n in niveaux["creneaux_decouverts"]],
    ))
    fig3.update_layout(xaxis_title="Effectif déployé", yaxis_title="Couverture (%)",
                       yaxis_range=[0, 105])
    st.plotly_chart(style_fig(fig3, 340), width="stretch")

    from allocation.optimisation import INSTALLATIONS
    ideal = dim.drop_duplicates("type")[["type", "ideal", "reference"]].copy()
    ideal["Domaine"] = ideal["type"].map({"securite": "Sécurité", "food": "Food",
                                          "sanitaire": "Sanitaire", "medical": "Médical"})

    def _repartition(row):
        i = INSTALLATIONS.get(row["type"], {})
        if i.get("nombre"):
            return f"≈ {i['nombre']} {i['libelle']} (~{round(row['ideal'] / i['nombre'])}/inst.)"
        return i.get("libelle", "")
    ideal["Répartition (site entier)"] = ideal.apply(_repartition, axis=1)
    st.write("**Effectif idéal par domaine**")
    st.dataframe(
        ideal.rename(columns={"ideal": "Effectif idéal", "reference": "Effectif de pointe (100 %)"})
        [["Domaine", "Effectif idéal", "Effectif de pointe (100 %)", "Répartition (site entier)"]]
        .sort_values("Effectif idéal", ascending=False),
        width="stretch", hide_index=True)
    st.caption("Effectifs à l'échelle du site entier, répartis sur toutes les installations d'un "
               "festival de 50 000 personnes. La carte n'affiche que quelques marqueurs représentatifs.")

    st.subheader("Transport — dimensionner la flotte de navettes")
    st.caption("Les navettes gèrent deux flux : amener le public à l'ouverture (dès 15h30) et "
               "évacuer la vague de départs qui explose à la clôture. On dimensionne la flotte sur "
               "la contrainte la plus dure — l'évacuation en 2 h — et on en déduit le personnel.")
    tflux = charge("transport_flux").sort_values("creneau")
    tm = charge("transport_metriques").iloc[0]
    tc1, tc2, tc3 = st.columns(3)
    tc1.metric("Pic de départs", int(tm["pic_departs"]), "à évacuer à la clôture", delta_color="off")
    tc2.metric("Flotte idéale", f"{int(tm['flotte_ideale'])} navettes",
               f"évacuation en {tm['fenetre_evac_h']:.0f} h", delta_color="off")
    tc3.metric("Personnel transport", f"{int(tm['staff_ideal'])} agents",
               "2 par navette", delta_color="off")
    tflux["heure"] = tflux["creneau"].apply(heure_texte)
    fig_t = go.Figure()
    fig_t.add_bar(x=tflux["heure"], y=tflux["arrivees"], name="Arrivées", marker_color="#3987e5")
    fig_t.add_bar(x=tflux["heure"], y=tflux["departs"], name="Départs", marker_color="#c98500")
    fig_t.add_hline(y=int(tm["debit_creneau"]), line_dash="dash", line_color="#8b8ba0",
                    annotation_text=f"Débit flotte : {int(tm['debit_creneau'])}/30 min",
                    annotation_position="top left", annotation_font_color="#8b8ba0")
    fig_t.update_layout(barmode="group", yaxis_title="Passagers navette / 30 min", xaxis_title=None,
                        legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0))
    st.plotly_chart(style_fig(fig_t, 320), width="stretch")
    part = int(round(tm["part_navette"] * 100))
    st.caption(f"**Pourquoi {int(tm['flotte_ideale'])} navettes ?** {int(tm['pic_departs'])} départs × "
               f"{part} % en navette = {int(tm['partants_navette'])} personnes à évacuer, en "
               f"{tm['fenetre_evac_h']:.0f} h ({int(tm['fenetre_evac_h'] * 2)} rotations de "
               f"{int(tm['capacite_navette'])} places) → {int(tm['partants_navette'])} ÷ "
               f"{int(tm['capacite_navette'] * tm['fenetre_evac_h'] * 2)} ≈ {int(tm['flotte_ideale'])}. "
               f"Le {part} % est une hypothèse de report modal, à ajuster selon l'implantation du site.")

elif page == "Recommandations":
    st.title("Recommandations")
    st.caption("Générées automatiquement à partir des prévisions, des anomalies, de la "
               "réallocation et des scénarios simulés.")
    previsions = charge("previsions")
    anomalies = charge("anomalies")
    initiale = charge("allocation_initiale")
    ajustee = charge("allocation_ajustee")
    synthese = charge("scenarios_synthese")

    recommandations = reco.genere(previsions, scenes, anomalies, initiale, ajustee, synthese)

    for r in recommandations:
        texte = f"**{r['titre']}** — {r['detail']}"
        if r["gravite"] in ("critique", "eleve"):
            st.error(texte)
        elif r["gravite"] == "moyen":
            st.warning(texte)
        elif r["gravite"] == "ok":
            st.success(texte)
        else:
            st.info(texte)

elif page == "Scénarios":
    st.title("Comparaison de scénarios d'organisation")
    st.caption("Chaque configuration est rejouée 3 fois par la simulation avec des graines "
               "différentes, les métriques sont moyennées.")
    synthese = charge("scenarios_synthese")
    details = charge("scenarios_details")

    meilleur = synthese.sort_values("taux_surcharge").iloc[0]
    base = synthese[synthese["scenario"] == "base"].iloc[0]
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Meilleure configuration", meilleur["scenario"].replace("_", " "))
    c2.metric("Créneaux en surcharge", f"{meilleur['taux_surcharge']:.1%}",
              f"{meilleur['taux_surcharge'] - base['taux_surcharge']:+.1%} vs base",
              delta_color="inverse")
    c3.metric("Pic d'occupation", f"{meilleur['pic_occupation']:.2f}",
              f"{meilleur['pic_occupation'] - base['pic_occupation']:+.2f} vs base",
              delta_color="inverse")
    ecart_cout = meilleur["cout_personnel"] - base["cout_personnel"]
    if abs(ecart_cout) < 1:
        c4.metric("Coût du personnel", f"{meilleur['cout_personnel']:,.0f} EUR".replace(",", " "),
                  "identique à la base", delta_color="off")
    else:
        c4.metric("Coût du personnel", f"{meilleur['cout_personnel']:,.0f} EUR".replace(",", " "),
                  f"{ecart_cout:+,.0f} vs base".replace(",", " "), delta_color="inverse")

    gauche, droite = st.columns(2)
    with gauche:
        st.subheader("Créneaux en surcharge")
        fig = px.bar(synthese, x="scenario", y="taux_surcharge",
                     color_discrete_sequence=["#3987e5"],
                     category_orders={"scenario": ORDRE_SCENARIOS})
        fig.update_layout(xaxis_title=None, yaxis_title=None, yaxis_tickformat=".0%",
                          bargap=0.45)
        fig.update_traces(marker_line_width=0)
        st.plotly_chart(style_fig(fig, 380), width="stretch")
    with droite:
        st.subheader("Coût du personnel (3 jours)")
        fig2 = px.bar(synthese, x="scenario", y="cout_personnel",
                      color_discrete_sequence=["#199e70"],
                      category_orders={"scenario": ORDRE_SCENARIOS})
        fig2.update_layout(xaxis_title=None, yaxis_title="EUR", bargap=0.45)
        fig2.update_traces(marker_line_width=0)
        st.plotly_chart(style_fig(fig2, 380), width="stretch")

    st.subheader("Couverture des besoins (3 runs)")
    fig3 = px.box(details, x="scenario", y="couverture_besoins",
                  color_discrete_sequence=["#9085e9"],
                  category_orders={"scenario": ORDRE_SCENARIOS})
    fig3.update_layout(xaxis_title=None, yaxis_title=None, yaxis_tickformat=".1%")
    st.plotly_chart(style_fig(fig3, 340), width="stretch")

    st.dataframe(synthese.set_index("scenario").loc[ORDRE_SCENARIOS].reset_index(),
                 width="stretch", hide_index=True)
