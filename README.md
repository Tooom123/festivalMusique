<!--faut remplacer les membres par les noms-->

# Festival Musical Intelligent — SAE S8 2026

Système intelligent d'aide à la gestion d'un festival musical : simulation de données,
prévision de l'affluence, détection d'anomalies, allocation des ressources et
évaluation de scénarios d'organisation.

Festival fictif : vendredi 4, samedi 5 et dimanche 6 septembre 2026, 3 scènes
(Rap 25 000 places, DJ 20 000, Rock 5 000), capacité maximale 50 000 personnes/jour,
samedi le plus fréquenté. Line-up réel de 48 artistes, rotation à 2 scènes actives
sur 3.

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
(CSV + base SQLite `festival.db`). Environ 1 minute d'exécution (dominée par les
12 rejeux de simulation pour la comparaison de scénarios), résultats reproductibles
(graine fixe).

## Dashboard

```
.venv\Scripts\streamlit run dashboard/app.py
```

9 pages : vue d'ensemble, programmation (line-up des 48 artistes), carte du site avec
replay animé de la journée (affluence, anomalies, flux de foule, stands et points
d'intérêt), affluence, prévisions, anomalies, allocation, recommandations générées
automatiquement, scénarios.

## Structure du projet

```
run_pipeline.py          orchestration bout-en-bout
data_generation/         génération des données + simulation à événements discrets
forecasting/             prévision de l'affluence (régression linéaire vs forêt aléatoire)
anomaly_detection/       détection d'anomalies (règles + Isolation Forest)
allocation/              allocation des ressources (programmation linéaire)
scenario_simulation/     comparaison de scénarios d'organisation (Monte Carlo)
dashboard/               restitution Streamlit
docs/                    documentation technique + plan de soutenance
SUIVI_PROJET.md          organisation et suivi du projet
```

## Documentation

- [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) : objectifs, méthodes, justification des choix, résultats, limites
- [docs/SOUTENANCE.md](docs/SOUTENANCE.md) : plan de la soutenance (10 minutes)
- [SUIVI_PROJET.md](SUIVI_PROJET.md) : répartition des tâches, planning, avancement
