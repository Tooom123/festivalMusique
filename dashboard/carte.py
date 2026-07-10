import numpy as np
import plotly.graph_objects as go

from theme import CRITIQUE, ENCRE, couleur_taux, heure_texte

POSITIONS = {1: (50, 76), 2: (20, 30), 3: (80, 30)}
MAX_FLUX = 3
STYLES_POI = {"stand_boisson": ("diamond", "#c98500"),
              "stand_nourriture": ("diamond", "#c98500"),
              "stand_mixte": ("diamond", "#c98500"),
              "toilettes": ("square", "#6da7ec"),
              "secourisme": ("cross", "#199e70")}


def taille_cercle(nb):
    return 14 + 1.5 * np.sqrt(max(nb, 0))


def trace_scenes(df, noms, capacites):
    x, y, tailles, couleurs, textes, survols, custom = [], [], [], [], [], [], []
    for _, l in df.iterrows():
        sid = int(l["scene_id"])
        px_, py_ = POSITIONS[sid]
        taux = l["nb_visiteurs"] / capacites[sid]
        x.append(px_)
        y.append(py_)
        tailles.append(taille_cercle(l["nb_visiteurs"]))
        couleurs.append(couleur_taux(taux))
        textes.append(f"<b>{noms[sid]}</b><br>{int(l['nb_visiteurs'])}")
        survols.append(f"{noms[sid]}<br>{int(l['nb_visiteurs'])} visiteurs<br>"
                       f"Occupation : {taux:.0%}<br>Capacité : {capacites[sid]}<br>"
                       f"<i>Cliquer pour voir le programme</i>")
        custom.append(["scene", sid])
    return go.Scatter(x=x, y=y, mode="markers+text", text=textes,
                      textposition="middle center",
                      textfont=dict(color="#ffffff", size=11),
                      marker=dict(size=tailles, color=couleurs, opacity=0.85,
                                  line=dict(color="rgba(255,255,255,0.35)", width=1.5)),
                      hovertext=survols, hoverinfo="text", customdata=custom,
                      showlegend=False)


def trace_anomalies(anomalies_creneau, noms):
    x, y, survols = [], [], []
    for _, l in anomalies_creneau.iterrows():
        sid = int(l["scene_id"])
        if sid not in POSITIONS:
            continue
        px_, py_ = POSITIONS[sid]
        x.append(px_)
        y.append(py_ + 11)
        survols.append(f"Anomalie : {l['type']} ({l['gravite']})<br>{noms[sid]}")
    return go.Scatter(x=x, y=y, mode="markers", hovertext=survols, hoverinfo="text",
                      marker=dict(symbol="x", size=15, color=CRITIQUE,
                                  line=dict(color="#0d0d0d", width=1)),
                      showlegend=False)


def traces_flux(flux_creneau):
    traces = []
    tops = flux_creneau.nlargest(MAX_FLUX, "nb")
    for i in range(MAX_FLUX):
        if i < len(tops):
            l = tops.iloc[i]
            x0, y0 = POSITIONS[int(l["scene_origine"])]
            x1, y1 = POSITIONS[int(l["scene_destination"])]
            largeur = 1.5 + min(l["nb"] / 40, 6)
            traces.append(go.Scatter(x=[x0, x1], y=[y0, y1], mode="lines",
                                     line=dict(color="rgba(57,135,229,0.45)", width=largeur),
                                     hoverinfo="skip", showlegend=False))
        else:
            traces.append(go.Scatter(x=[], y=[], mode="lines",
                                     hoverinfo="skip", showlegend=False))
    return traces


def trace_pois(pois):
    symboles = [STYLES_POI[t][0] for t in pois["type"]]
    couleurs_poi = [STYLES_POI[t][1] for t in pois["type"]]
    custom = [["poi", int(p)] for p in pois["poi_id"]]
    survols = [f"{n}<br><i>Cliquer pour voir le détail</i>" if t.startswith("stand")
               else n for n, t in zip(pois["nom"], pois["type"])]
    return go.Scatter(x=pois["x"], y=pois["y"], mode="markers+text",
                      text=pois["nom"], textposition="bottom center",
                      textfont=dict(color="#898781", size=10),
                      marker=dict(symbol=symboles, size=11, color=couleurs_poi,
                                  line=dict(color="rgba(255,255,255,0.4)", width=1)),
                      hovertext=survols, hoverinfo="text", customdata=custom,
                      showlegend=False)


def construit_carte(affluence_creneau, scenes, anomalies, evenements, jour, pois=None):
    noms = dict(zip(scenes["scene_id"], scenes["nom"]))
    capacites = dict(zip(scenes["scene_id"], scenes["capacite"]))

    aff = affluence_creneau[affluence_creneau["jour"] == jour]
    ano = anomalies[anomalies["jour"] == jour]
    dep = evenements[(evenements["jour"] == jour) & (evenements["type"] == "deplacement")].copy()
    dep["creneau"] = (dep["minute"] // 30) * 30
    dep = dep[dep["scene_origine"] > 0]
    flux = (dep.groupby(["creneau", "scene_origine", "scene_destination"])
            .size().reset_index(name="nb"))

    creneaux = sorted(aff["creneau"].unique())
    frames = []
    for c in creneaux:
        donnees = [trace_scenes(aff[aff["creneau"] == c], noms, capacites),
                   trace_anomalies(ano[ano["creneau"] == c], noms)]
        donnees += traces_flux(flux[flux["creneau"] == c])
        frames.append(go.Frame(data=donnees, name=heure_texte(c),
                               traces=list(range(len(donnees)))))

    donnees_base = list(frames[0].data)
    if pois is not None and len(pois) > 0:
        donnees_base.append(trace_pois(pois))
    fig = go.Figure(data=donnees_base, frames=frames)

    fig.add_shape(type="rect", x0=1, y0=2, x1=99, y1=92,
                  line=dict(color="rgba(255,255,255,0.14)", width=1.5),
                  fillcolor="rgba(255,255,255,0.015)")
    fig.add_annotation(x=50, y=2, text="Entrée", showarrow=False,
                       font=dict(color=ENCRE, size=12), yshift=-16)

    etapes = [dict(args=[[f.name], {"frame": {"duration": 0, "redraw": True},
                                    "mode": "immediate"}],
                   label=f.name, method="animate") for f in frames]

    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        height=620, margin=dict(l=10, r=10, t=10, b=10),
        xaxis=dict(visible=False, range=[-4, 104], fixedrange=True),
        yaxis=dict(visible=False, range=[-8, 100], fixedrange=True),
        hoverlabel=dict(bgcolor="#1a1a19", font=dict(color="#ffffff")),
        updatemenus=[dict(
            type="buttons", direction="left", x=0.02, y=1.06, showactive=False,
            bgcolor="#1a1a19", bordercolor="rgba(255,255,255,0.2)",
            font=dict(color="#ffffff"),
            buttons=[
                dict(label="Lecture", method="animate",
                     args=[None, {"frame": {"duration": 650, "redraw": True},
                                  "fromcurrent": True, "transition": {"duration": 300}}]),
                dict(label="Pause", method="animate",
                     args=[[None], {"frame": {"duration": 0, "redraw": True},
                                    "mode": "immediate"}]),
            ])],
        sliders=[dict(steps=etapes, x=0.02, len=0.96, y=-0.02,
                      currentvalue=dict(prefix="Créneau : ", font=dict(color="#ffffff", size=15)),
                      font=dict(color=ENCRE, size=10),
                      bgcolor="#1a1a19", activebgcolor="#3987e5",
                      bordercolor="rgba(255,255,255,0.15)")],
    )
    return fig
