# Festival Musical Intelligent — SAE S8 2026

Système intelligent d'aide à la gestion d'un festival musical : simulation de données,
prévision de l'affluence, détection d'anomalies, allocation des ressources et
évaluation de scénarios d'organisation.

Festival fictif : vendredi 4, samedi 5 et dimanche 6 septembre 2026 — la 5ᵉ édition.
3 scènes (Rap 25 000 places, DJ 20 000, Rock 5 000), capacité maximale
50 000 personnes/jour, samedi le plus fréquenté. Line-up réel de 48 artistes,
rotation à 2 scènes actives sur 3. Les éditions 2022-2025 sont simulées comme
historique et alimentent les modèles de prévision (fréquentation de l'édition par
tendance, prévision fine par scène et créneau).

## Installation

```
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

## Exécution (commande unique)

```
.venv\Scripts\python run_pipeline.py
```

Le pipeline enchaîne les 5 modules et sauvegarde toutes les données dans `data/`
(CSV + base SQLite `festival.db`). Environ 3 min 30 d'exécution (simulation des
5 éditions du festival + 12 rejeux de simulation pour la comparaison de scénarios),
résultats reproductibles (graine fixe).

## Site web (restitution principale)

Ouvrir `site/index.html` dans un navigateur, ou pour un service propre :

```
cd site
python -m http.server 8000
```

puis aller sur http://localhost:8000. Aucune connexion internet nécessaire
(bibliothèque de graphiques et polices embarquées).

9 pages via le menu latéral : vue d'ensemble (têtes d'affiche, chiffres clés),
programmation (line-up des 48 artistes), carte du site en 3D interactive,
affluence, prévisions, anomalies, allocation, recommandations, scénarios.

La **carte du site en 3D** rejoue la journée créneau par créneau : scènes modélisées
avec l'artiste en cours affiché sous l'affluence, foule et flux de visiteurs animés
selon les données, halo coloré par le taux d'occupation, stands cliquables.
Un journal d'anomalies s'accumule pendant la lecture (chaque incident daté, marqué
« en cours » puis « résolu à HHhMM » quand il disparaît). Un sélecteur d'édition
permet de rejouer les 5 éditions : 2022-2025 = déroulé réel passé (déterministe),
2026 = simulation de la prédiction (affluence pilotée par les prévisions). Navigation
type carte (rotation, zoom, déplacement, recentrage au clic). Repli automatique sur
la carte 2D si WebGL n'est pas disponible.

La carte 3D est développée en React + TypeScript + Three.js dans `carte3d/`
(source) et compilée en un bundle autonome `site/lib/carte3d.js` déjà inclus dans
le dépôt : rien à installer pour utiliser le site. Pour modifier la carte 3D :
`cd carte3d && npm install && npm run build`.

Les données du site sont générées par le pipeline (`site/donnees.js`, régénéré à
chaque exécution de `run_pipeline.py` ou via `python exporte_site.py`) : ce sont
exactement les mêmes que dans la base SQLite.

Les photos des têtes d'affiche peuvent être déposées dans `site/photos/`
(voir `site/photos/LISEZMOI.txt`) ; sans photo, une carte stylisée s'affiche.

## Dashboard Streamlit (secours)

```
.venv\Scripts\streamlit run dashboard/app.py
```

Conservé comme plan B pour la démo : mêmes données, mêmes pages.

## Structure du projet

```
run_pipeline.py          orchestration bout-en-bout
exporte_site.py          export des données vers le site web
data_generation/         génération des données + simulation à événements discrets
forecasting/             prévision de l'affluence (régression linéaire vs forêt aléatoire)
anomaly_detection/       détection d'anomalies (règles + Isolation Forest)
allocation/              allocation des ressources (programmation linéaire)
scenario_simulation/     comparaison de scénarios d'organisation (Monte Carlo)
site/                    site web de restitution (HTML/CSS/JS + ECharts, hors-ligne)
carte3d/                 source de la carte 3D (React + TypeScript + Three.js)
dashboard/               dashboard Streamlit de secours
docs/                    documentation technique + plan de soutenance
SUIVI_PROJET.md          organisation et suivi du projet
```

## Documentation

- [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) : objectifs, méthodes, justification des choix, résultats, limites
- [docs/SOUTENANCE.md](docs/SOUTENANCE.md) : plan de la soutenance (10 minutes)
- [SUIVI_PROJET.md](SUIVI_PROJET.md) : répartition des tâches, planning, avancement
