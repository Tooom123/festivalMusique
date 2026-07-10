JOURS_COURT = {1: "Ven. 4/09", 2: "Sam. 5/09", 3: "Dim. 6/09"}
JOURS_LONG = {1: "vendredi 4 septembre 2026", 2: "samedi 5 septembre 2026",
             3: "dimanche 6 septembre 2026"}

COULEURS_SCENES = ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9"]
COULEURS_JOURS = ["#3987e5", "#199e70", "#c98500"]
COULEURS_GRAVITE = {"haute": "#d03b3b", "moyenne": "#ec835a", "basse": "#fab219"}
ECHELLE_SEQ = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]
BON = "#0ca30c"
ALERTE = "#fab219"
SERIEUX = "#ec835a"
CRITIQUE = "#d03b3b"
ENCRE = "#c3c2b7"
GRILLE = "#2c2c2a"


def style_fig(fig, hauteur=430):
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=ENCRE, size=13),
        height=hauteur,
        margin=dict(l=10, r=10, t=30, b=10),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0),
        hoverlabel=dict(bgcolor="#1a1a19", bordercolor="rgba(255,255,255,0.15)",
                        font=dict(color="#ffffff")),
    )
    fig.update_xaxes(gridcolor=GRILLE, zeroline=False, linecolor="#383835")
    fig.update_yaxes(gridcolor=GRILLE, zeroline=False, linecolor="#383835")
    return fig


def heure_texte(minute):
    minute = int(minute)
    return f"{minute // 60:02d}h{minute % 60:02d}"


def couleur_taux(taux):
    if taux >= 1.0:
        return CRITIQUE
    if taux >= 0.9:
        return SERIEUX
    if taux >= 0.7:
        return ALERTE
    return BON
