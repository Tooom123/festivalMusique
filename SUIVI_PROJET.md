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
  n'est pas disponible. Ajouts en suivant : timeline ralentie à 2,1 s/créneau,
  artiste en cours affiché sous chaque scène, journal d'anomalies daté avec suivi
  de résolution (« en cours » puis « résolu à HHhMM »).
- 14/07 (nuit) : le festival devient la 5ᵉ édition. Les éditions 2022-2025 sont
  simulées comme historique (nouveauté 98k, creux 52k, reprise 69k, record 129k) et
  alimentent la prévision à deux horizons : fréquentation de l'édition par tendance
  (vendredi prédit à 1,1 %, samedi sous-estimé de 17 % car il sature — limite
  documentée) et prévision fine par scène/créneau. Résultat méthodologique fort :
  l'historique réduit la MAE de 14 % (1 678 → 1 443) et fait basculer le modèle
  optimal de la régression linéaire vers la forêt aléatoire — le pipeline retient
  automatiquement le meilleur des deux.
- 14/07 (nuit, suite) : ajout d'un second signal de prévision d'édition — la
  billetterie en ligne (74/92/50 % vendus à 2 mois de l'événement). Combinée à la
  tendance, elle rattrape le samedi que la tendance sous-estimait (17 % → 4 %
  d'erreur). Nouveau panneau billetterie sur la page Prévisions du site.
- 14/07 (nuit, fin) : la carte 3D devient multi-éditions (sélecteur d'année). Les
  éditions 2022-2025 sont rejouables (déroulé réel passé, déterministe), et 2026 est
  la simulation de notre prédiction (totaux pilotés par la prévision combinée, line-up
  annoncé). Chaque édition a foule + flux + anomalies recalculés dans le pipeline.
  Le déroulé réel 2026 reste la vérité terrain des autres modules.
- 14/07 (nuit, fin) : la détection gagne un module d'anticipation — on applique la
  règle de surcharge sur la prévision d'affluence pour alerter avant l'événement, et
  on mesure la fiabilité (7 alertes, 6 confirmées, précision/rappel 86 %). Détection
  proactive qui relie prévision↔détection. Nouvelle section sur la page Anomalies.
- 14/07 (nuit, fin) : intégration propre du transport (5ᵉ domaine de ressources de
  l'énoncé). Contrairement aux équipes par scène, la flotte de navettes est
  dimensionnée à l'échelle du site sur le pic de départs (~15 000 à la clôture) →
  24 navettes, 48 agents, cohérent avec le personnel transport généré. Comble le seul
  angle mort de l'allocation (transport auparavant généré/facturé mais non alloué).
- 13/07 (relecture) : enrichissement du transport suite à revue — le service gère
  désormais **deux flux** (arrivées à l'ouverture dès 15h30 + évacuation de clôture),
  rejoués à travers la flotte par un modèle de file. Le graphique montre la charge des
  navettes heure par heure (arrivées vs départs) avec la ligne de débit de la flotte, et
  le calcul des 24 navettes est explicité (5 237 à évacuer ÷ 220 places/2 h). Correction
  d'un artefact d'affichage (axes en « 15 k » et non « 15,000 », créneaux après minuit).
- 13/07 (relecture, suite) : levée d'une incohérence relevée en revue — les effectifs
  idéaux (food 220, sanitaire 133, médical 101) juraient avec la carte qui ne montre
  que quelques marqueurs (1 stand, 3 toilettes). Ce sont des effectifs à l'échelle du
  site entier ; on les ancre désormais sur un nombre réaliste d'installations pour
  50 000 personnes (`INSTALLATIONS` : ~24 points resto, ~30 blocs sanitaires, ~6 postes
  de secours) et on affiche l'effectif par installation (~9/stand, ~4/bloc, ~17/poste).
  Aucun calcul touché, la carte reste schématique (note explicite ajoutée).
- 13/07 (relecture, suite) : la carte 3D montre désormais l'infrastructure réelle —
  couche procédurale déterministe d'installations (`logique/installations.ts` :
  ~24 stands de restauration, ~30 blocs sanitaires, 6 postes de secours, postes de
  sécurité aux entrées/coins/fronts de scène), décor non cliquable pour ne pas
  surcharger de labels. Les POI nommés (menus, chemins) sont conservés ; des étiquettes
  de zone reprennent les comptes de l'allocation. Terrain élargi et caméra reculée pour
  cadrer tout le site. Couche purement visuelle, la logique métier ne bouge pas.
- 14/07 (nuit, fin) : l'allocation gagne un module de dimensionnement du personnel —
  on teste 50/75/90/100/110 % de l'effectif de pointe en une passe (réutilise
  l'optimiseur), on mesure la couverture et les créneaux à découvert, et on déduit
  l'effectif idéal par domaine. Montre que 100 % suffit (au-delà = gaspillage) et
  chiffre le juste besoin par domaine. Nouvelle section sur la page Allocation.

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
