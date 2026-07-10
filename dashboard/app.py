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
    c4.metric("Erreur de prévision (MAE)", f"{metriques['mae_lineaire'][0]:.0f} visiteurs",
              f"R2 = {metriques['r2_lineaire'][0]:.2f}", delta_color="off")
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

    st.caption("Pipeline : simulation à événements discrets, prévision (régression linéaire), "
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
    st.title(f"Prévision de l'affluence ({JOURS_LONG[3]})")
    st.caption("Régression linéaire entraînée sur les jours 1 et 2, comparée à une forêt "
               "aléatoire et à un modèle naïf qui reprend le créneau précédent. Avec deux "
               "jours d'historique, le modèle linéaire généralise mieux que la forêt.")
    previsions = charge("previsions")
    metriques = charge("metriques_prevision")
    importances = charge("importances_variables")
    previsions["nom"] = previsions["scene_id"].map(noms_scenes)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("MAE régression linéaire", f"{metriques['mae_lineaire'][0]:.1f}",
              "modèle retenu", delta_color="off")
    c2.metric("MAE forêt aléatoire", f"{metriques['mae_foret'][0]:.1f}")
    c3.metric("MAE modèle naïf", f"{metriques['mae_naif'][0]:.1f}")
    c4.metric("R2 régression linéaire", f"{metriques['r2_lineaire'][0]:.3f}")

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
