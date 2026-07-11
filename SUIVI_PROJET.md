# Suivi de projet — Festival Musical Intelligent

Groupe de 5 — soutenance le 15/07/2026, rapport à remettre le 14/07/2026.

<!--faut remplacer les membres par les noms-->

## Répartition des tâches

| Membre | Responsabilité principale | Fichiers |
|---|---|---|
| Artus | Génération des données + simulation à événements discrets, intégration pipeline | `data_generation/`, `run_pipeline.py` |
| Membre 2 | Prévision de l'affluence | `forecasting/` |
| Membre 3 | Détection des anomalies | `anomaly_detection/` |
| Membre 4 | Allocation des ressources | `allocation/` |
| Membre 5 | Scénarios + dashboard | `scenario_simulation/`, `dashboard/` |

Rédaction du rapport et préparation de la soutenance : tout le monde, chacun sur sa partie.

## Planning

| Date | Objectif | État |
|---|---|---|
| Jeu 10/07 | Architecture validée, schéma de données, génération + simulation fonctionnelles | Fait |
| Ven 11/07 | Prévision + détection fonctionnelles, premières métriques | Fait |
| Sam 12/07 | Allocation + scénarios, intégration pipeline complet, dashboard | Fait |
| Dim 13/07 | Refonte du festival à l'échelle réelle (3 scènes, 50 000 pers./jour) suite à relecture — périmètre élargi au-delà du plan initial | Fait |
| Lun 14/07 | Site web de restitution (remplace le dashboard comme support principal), corrections de cohérence, rédaction du rapport | Fait |
| Mar 15/07 | Soutenance (10 min + questions) | À faire |

Le périmètre s'est élargi les 13 et 14/07 (passage à l'échelle réelle, puis site web)
au-delà de ce que prévoyait le planning initial, qui ne réservait ces deux jours qu'à
la relecture et la rédaction. Choix assumé : muscler la restitution plutôt que
s'en tenir au plan initial, en absorbant le travail supplémentaire sans décaler la
date de soutenance.

## Points d'avancement

- 10/07 : réunion de lancement, choix de la stack (Python) et des algorithmes,
  répartition des modules. Décision : simulation à événements discrets plutôt que
  tirage direct des affluences, pour que les scénarios soient comparables.
- 12/07 : revue d'intégration. Corrections décidées : détection des mouvements de
  foule sur les relevés 15 min (les moyennes 30 min diluaient les pics, rappel passé
  de 3/6 à 5/6), effectifs réduits pour rendre l'optimisation non triviale,
  remplacement du scénario « grande scène agrandie » (sans effet, la grande scène ne
  sature jamais) par « petites scènes agrandies ».
- 13/07 : refonte réaliste du festival : 3 scènes thématiques (Rap, DJ, Rock),
  line-up réel de 48 artistes classés par notoriété, rotation 2 scènes actives /
  1 en pause, ouverture 16h-minuit. La comparaison des modèles sur la nouvelle
  configuration a fait retenir la régression linéaire pour la prévision : la forêt
  aléatoire sur-apprend avec seulement 2 jours d'historique (MAE 148 contre 110).
  Ajout des points d'intérêt sur la carte (stands, toilettes, poste de secours),
  interactifs au clic (programme d'une scène, menu d'un stand).
- 13/07 (suite) : passage à l'échelle réelle d'un grand festival. Dates fixées au
  vendredi 4, samedi 5 et dimanche 6 septembre 2026, capacité 50 000 personnes/jour,
  samedi plus fréquenté (~49 600 contre ~38 000 les autres jours), capacités de
  scènes 25 000 (Rap) / 20 000 (DJ) / 5 000 (Rock). Équipes logistiques scalées en
  conséquence (~10x). Benchmark de performance fait avant de généraliser (1,4 s pour
  simuler 48 000 visiteurs sur 1 jour) : le pipeline complet reste sous 1min15 malgré
  les 12 rejeux Monte Carlo. Décision assumée : pas de plafond physique dur sur les
  scènes, pour que la surcharge extrême reste possible (documenté en limite).
- 14/07 : remplacement du Streamlit par un site web dédié (`site/`) comme restitution
  principale : accueil avec les têtes d'affiche des 3 jours, navigation latérale vers
  les pages d'analyse, carte animée conservée, tout en HTML/CSS/JS + ECharts embarqué
  (fonctionne hors-ligne pour la soutenance). Les données sont exportées
  automatiquement depuis la base SQLite (`exporte_site.py`), strictement identiques
  au pipeline. Le Streamlit est conservé en plan B pour la démo.
- 14/07 (soir) : refonte de la carte du site en 3D interactive (React + TypeScript +
  Three.js, dossier `carte3d/`, compilé en bundle autonome dans `site/lib/`) :
  terrain, scènes modélisées, foule instanciée, marcheurs sur les chemins, navigation
  caméra type carte. La logique métier n'a pas bougé : positions, seuils et formules
  portés à l'identique depuis la carte 2D, qui reste en repli automatique si WebGL
  n'est pas disponible.

## Risques identifiés et parades

| Risque | Parade |
|---|---|
| Panne de la démo live en soutenance | Site fonctionne hors-ligne (aucun réseau requis) ; dashboard Streamlit et export PDF des pages en double secours |
| Dérapage du temps de parole (10 min max) | Répétition chronométrée le 14/07, minutage par membre dans docs/SOUTENANCE.md |
| Résultats non reproductibles devant le jury | Graine fixe, pipeline en une commande, testé sur machine propre |
| Membre indisponible en fin de projet | Chaque module documenté dans docs/DOCUMENTATION.md, relecture croisée le 13/07 |

## Suivi des compétences (grille consultée tous les 2-3 jours)

| Compétence | Où c'est couvert |
|---|---|
| Produire | 5 modules fonctionnels et intégrés, pipeline une commande |
| Gérer | Génération automatisée, CSV + SQLite, graine fixe, git |
| Concevoir | Justification écrite de chaque choix dans docs/DOCUMENTATION.md §4 |
| Agir | Répartition ci-dessus, réunions des 10 et 12/07 |
| Formaliser | Rapport (DOCUMENTATION.md), site web de restitution, plan de soutenance minuté |
| Piloter | Ce fichier : planning, risques, avancement |
