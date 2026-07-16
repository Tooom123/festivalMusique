"""Controle des invariants sur les donnees simulees.

Une donnee simulee n'est utile que si elle est plausible. Ce module verifie, a
chaque execution du pipeline et avant que les modules d'analyse ne travaillent,
que la simulation a produit des donnees coherentes. Un invariant viole leve une
ErreurInvariant : mieux vaut arreter le pipeline que d'entrainer un modele sur
des donnees fausses.
"""

from data_generation.generateur import CAPACITE_JOUR, FERMETURE, NB_JOURS, OUVERTURE

CRENEAU = 30


class ErreurInvariant(AssertionError):
    """Une regle de coherence des donnees simulees n'est pas respectee."""


def _presents_par_pas(evenements, jour):
    # Reconstruit le nombre de personnes sur le site au fil du temps a partir
    # des arrivees et des departs (un deplacement ne change pas le total).
    e = evenements[evenements["jour"] == jour]
    arrivees = e[e["type"] == "arrivee"].groupby("minute").size()
    departs = e[e["type"] == "depart"].groupby("minute").size()
    return arrivees.reindex(
        sorted(set(arrivees.index) | set(departs.index)), fill_value=0
    ).sub(departs, fill_value=0).cumsum()


def valide(scenes, visiteurs, affluence, affluence_creneau, evenements):
    """Verifie les invariants et renvoie un resume lisible des controles.

    Leve ErreurInvariant au premier manquement.
    """
    controles = []
    capacites = dict(zip(scenes["scene_id"], scenes["capacite"]))

    # 1. Conservation des visiteurs : la somme des presences par scene ne peut
    #    pas depasser le nombre de personnes effectivement sur le site.
    for jour in range(1, NB_JOURS + 1):
        sur_site = _presents_par_pas(evenements, jour)
        par_scene = (affluence[affluence["jour"] == jour]
                     .groupby("minute")["nb_visiteurs"].sum())
        commun = par_scene.index.intersection(sur_site.index)
        ecart = (par_scene.loc[commun] - sur_site.loc[commun]).max()
        if ecart > 0:
            raise ErreurInvariant(
                f"jour {jour} : {int(ecart)} visiteurs de plus devant les scenes "
                f"que de personnes presentes sur le site")
    controles.append("conservation des visiteurs")

    # 2. Capacite du site : au plus CAPACITE_JOUR entrees par jour.
    par_jour = visiteurs.groupby("jour").size()
    if (par_jour > CAPACITE_JOUR).any():
        pire = par_jour.idxmax()
        raise ErreurInvariant(
            f"jour {pire} : {int(par_jour.max())} visiteurs pour une capacite de "
            f"{CAPACITE_JOUR}")
    controles.append(f"capacite du site ({int(par_jour.max())} max / {CAPACITE_JOUR})")

    # 3. Coherence temporelle : tous les creneaux d'ouverture sont presents pour
    #    chaque scene et chaque jour, sans trou ni doublon.
    attendus = set(range(OUVERTURE, FERMETURE, CRENEAU))
    for jour in range(1, NB_JOURS + 1):
        for scene_id in capacites:
            lignes = affluence_creneau[(affluence_creneau["jour"] == jour)
                                       & (affluence_creneau["scene_id"] == scene_id)]
            vus = set(lignes["creneau"])
            if vus != attendus:
                manquants = sorted(attendus - vus)
                raise ErreurInvariant(
                    f"jour {jour}, scene {scene_id} : {len(manquants)} creneau(x) "
                    f"manquant(s) ({manquants[:3]}...)")
            if len(lignes) != len(attendus):
                raise ErreurInvariant(
                    f"jour {jour}, scene {scene_id} : creneaux en double")
    controles.append(f"coherence temporelle ({len(attendus)} creneaux x "
                     f"{len(capacites)} scenes x {NB_JOURS} jours)")

    # 4. Plausibilite du profil : l'affluence doit croitre vers la soiree.
    #    On compare le total du site en debut de soiree (>= 20h) a celui de
    #    l'ouverture (< 18h) : un festival se remplit, il ne se vide pas.
    for jour in range(1, NB_JOURS + 1):
        j = affluence_creneau[affluence_creneau["jour"] == jour]
        debut = j[j["creneau"] < 18 * 60]["nb_visiteurs"].sum()
        soir = j[j["creneau"] >= 20 * 60]["nb_visiteurs"].sum()
        if soir <= debut:
            raise ErreurInvariant(
                f"jour {jour} : profil implausible, la soiree ({int(soir)}) n'est pas "
                f"plus chargee que l'ouverture ({int(debut)})")
    controles.append("profil d'affluence (creux en journee, pic en soiree)")

    return controles
