# Documentation technique — Festival Musical Intelligent

## 1. Objectif

Construire un système d'aide à la gestion d'un festival musical dans un environnement
simulé, répondant aux 4 problématiques du sujet :

1. Prévision de l'affluence
2. Détection de situations anormales
3. Allocation des ressources
4. Évaluation de scénarios d'organisation

Le tout est intégré dans un pipeline unique (`run_pipeline.py`) : les prévisions
alimentent l'allocation, les anomalies déclenchent une réallocation, et la simulation
rejoue l'ensemble sous différentes configurations.

## 2. Architecture

```
generateur.py ──► simulation.py ──► data/festival.db + CSV
                        │
        ┌───────────────┼────────────────────┐
        ▼               ▼                    ▼
  prevision.py    detection.py         scenarios.py
        │               │                    │
        └──────┬────────┘                    │
               ▼                             │
        optimisation.py                      │
               │                             │
               └───────────┬─────────────────┘
                           ▼
                  exporte_site.py
                           │
              ┌────────────┴────────────┐
              ▼                          ▼
   site/donnees.js (site web)   dashboard/app.py (Streamlit, secours)
```

- **Langage** : Python 3 pour tout le pipeline analytique (pandas, scikit-learn, PuLP,
  Streamlit) ; restitution principale en HTML/CSS/JavaScript + ECharts (`site/`),
  autonome et sans dépendance réseau.
- **Stockage** : les données générées sont exportées en CSV (lisibles, diffables) et
  chargées dans une base SQLite (`data/festival.db`). `exporte_site.py` lit cette base
  et génère `site/donnees.js`, consommé par le site web ; le dashboard Streamlit
  interroge directement la base SQLite.
- **Reproductibilité** : toute la génération est pilotée par une graine fixe
  (`GRAINE = 42`) ; relancer le pipeline reproduit exactement les mêmes données.
  Aucun traitement manuel : le dossier `data/` et `site/donnees.js` sont entièrement
  régénérés à chaque exécution.

## 3. Données simulées

Festival de 3 jours — vendredi 4, samedi 5 et dimanche 6 septembre 2026 — 3 scènes
thématiques (Rap, DJ, Rock), ouvert de 16h à minuit. Capacité maximale du site :
50 000 personnes par jour, avec un samedi volontairement plus fréquenté que les deux
autres jours (conformément aux éditions précédentes). Environ 125 000 entrées sur les
3 jours et 620 000 événements générés (39 000 le vendredi, 49 600 le samedi,
36 700 le dimanche).

**2026 est la 5ᵉ édition du festival.** Les quatre éditions précédentes sont simulées
avec la même mécanique et servent d'historique aux modèles de prévision :

| Édition | Entrées (3 jours) | Contexte |
|---|---|---|
| 2022 | 97 817 | première édition, effet de nouveauté |
| 2023 | 52 488 | désaffection, l'effet nouveauté retombe |
| 2024 | 69 382 | reprise progressive |
| 2025 | 128 969 | édition record, samedi quasi complet |
| 2026 | 125 325 | édition courante (simulée) |

La programmation est un vrai line-up de 48 artistes (16 sets d'une heure par jour) :
à chaque instant exactement 2 scènes jouent, la troisième est en pause pour le
changement de plateau (rotation Rap+DJ, Rap+Rock, DJ+Rock). Sur chaque scène, la
notoriété monte au fil de la journée : artistes émergents en fin d'après-midi,
têtes d'affiche (Gims, David Guetta, Muse, Niska, DJ Snake...) sur les créneaux
de 22h et 23h. La rotation décale d'un jour à l'autre pour que chaque scène ait
son soir de clôture.

Les capacités des scènes (25 000 Rap, 20 000 DJ, 5 000 Rock, soit 50 000 au total)
sont des repères de dimensionnement, pas des plafonds physiques durs : rien
n'empêche, dans la simulation, que la foule se concentre très majoritairement devant
une seule scène si sa programmation l'attire — la probabilité de rejoindre une scène
déjà pleine chute fortement mais reste non nulle. C'est volontaire : un vrai
festival ne peut pas téléporter les gens ailleurs, la surcharge doit rester possible
pour que la détection d'anomalies et l'allocation de ressources aient un sens.

| Table | Contenu |
|---|---|
| `scenes` | Scène Rap (25 000 places), Scène DJ (20 000), Scène Rock (5 000) |
| `programmation` | line-up réel : 48 artistes, sets d'1h, notoriété 3-10 croissante dans la journée |
| `visiteurs` | arrivée (normale centrée 18h), durée de visite, genre musical préféré |
| `equipes` | équipes logistiques (sécurité, food, sanitaire, médical, transport) avec créneaux de disponibilité |
| `ressources` | postes de secours, stands, blocs sanitaires, navettes par scène |
| `points_interet` | emplacements fixes du site : stands boissons/nourriture/mixte, 3 blocs de toilettes, poste de secours (affichés sur la carte) |
| `evenements` | flux arrivée / déplacement / départ de chaque visiteur (simulation) |
| `affluence` / `affluence_creneau` | relevés de présence par scène (pas de 15 min, agrégés par créneau de 30 min) |
| `pannes`, `injections_foule` | incidents injectés dans la simulation (vérité terrain pour évaluer la détection) |
| `historique_editions` | fréquentation quotidienne des éditions 2022-2025 |
| `historique_affluence` / `historique_programmation` | détail par créneau et programmation des éditions passées (entraînement des modèles) |
| `billetterie` | part de capacité vendue en ligne par jour, relevée à ~2 mois de l'événement |
| `prevision_edition` | prévisions 2026 (tendance, billetterie, combinée) et écarts au réel |
| `cartes_affluence` / `cartes_flux` / `cartes_anomalies` / `cartes_programmation` | données rejouables des 5 éditions pour la carte 3D (2022-2025 réelles, 2026 prédiction) |
| `dimensionnement` | couverture et effectif idéal par domaine pour 5 niveaux d'effectif (50-110 %) |
| `anticipation_alertes` | surcharges prédites depuis l'affluence prévue, avec confrontation au réel |
| `transport_flux` / `transport_metriques` | charge des navettes (arrivées + départs) par créneau et flotte dimensionnée |

### Simulation à événements discrets

La fréquentation n'est pas tirée directement : elle émerge d'une simulation.
À chaque pas de 15 minutes, les visiteurs arrivent, choisissent une scène
(probabilité proportionnelle à la popularité du concert en cours, doublée si le genre
correspond à leur préférence, quasi nulle si la scène est pleine), une partie des
présents se déplace, puis les départs sont traités. Ce choix rend les scénarios
comparables : changer la programmation ou les capacités change réellement les flux.
La rotation des scènes amplifie le phénomène : à chaque changement de créneau, une
scène s'éteint et une autre se rallume, ce qui déclenche des migrations massives
que la détection et la carte animée mettent en évidence.

Des incidents sont injectés volontairement (2 pannes et 2 mouvements de foule massifs
par jour) et enregistrés à part : ils servent de vérité terrain pour mesurer le rappel
du module de détection.

## 4. Choix des méthodes et justifications

### 4.1 Prévision de l'affluence — deux horizons, appuyés sur l'historique

**Niveau 1 — fréquentation de l'édition (dimensionnement).** Deux signaux
complémentaires, combinés :

- *Tendance historique* : à partir de la fréquentation quotidienne des éditions
  2022-2025, une régression sur l'année prédit la fréquentation de chaque journée
  2026 (bornée par la capacité).
- *Billetterie en ligne* : à ~2 mois de l'événement, on relève la part de capacité
  déjà vendue (74 % vendredi, 92 % samedi, 50 % dimanche) et on projette la
  fréquentation finale en supposant qu'une part de la capacité restante se vendra
  encore (ventes tardives + sur place, `TAUX_CONVERSION_RESTANT = 0.35`).
- *Prévision combinée* : moyenne des deux. La combinaison est **plus robuste** que
  chaque signal isolé — voir §5. Point clé : la tendance seule sous-estimait le
  samedi de 17 % (elle ne « voit » pas l'engouement de l'année) ; la billetterie,
  elle, le capte immédiatement (92 % déjà vendu) et ramène l'erreur à 4 %.

C'est une estimation d'ordre de grandeur (4 points d'historique par jour), assumée
comme telle : elle sert à dimensionner avant le festival, pas à piloter en temps réel.

**Niveau 2 — prévision opérationnelle par scène et créneau de 30 min.**

- **Problème** : prédire le nombre de visiteurs par scène et par créneau pour le
  dimanche 6 septembre 2026, à partir des 4 éditions passées complètes et du
  vendredi/samedi 2026 (découpage temporel strict, pas de fuite).
- **Variables** : scène, capacité, notoriété du set en cours, scène active ou en
  pause, notoriété du set suivant (le line-up est public, donc connu à l'avance),
  heure, indicateur soirée, affluence des deux créneaux précédents (prévision à
  court terme, comme en exploitation réelle où les comptages remontent en continu).
- **Choix, départagé empiriquement** : régression linéaire, forêt aléatoire et
  modèle naïf sont comparés sur le dimanche. Résultat instructif : **le meilleur
  modèle dépend du volume de données**. Sans l'historique (entraînement sur
  96 points, vendredi + samedi seulement), la régression linéaire gagnait
  (MAE 1 678) car la forêt sur-apprenait. Avec les 4 éditions d'historique
  (672 points), la **forêt aléatoire repasse devant** (MAE 1 443 contre 1 506 pour
  la linéaire et 2 662 pour le naïf) : elle a désormais assez d'exemples pour
  capturer les non-linéarités (saturation, rotations différentes) sans sur-apprendre.
  Le pipeline sélectionne automatiquement le meilleur des deux et l'affiche comme
  « modèle retenu ».
- **Apport mesuré de l'historique** : à modèle optimal dans chaque régime, la MAE
  passe de 1 678 à 1 443, soit **−14 %** d'erreur grâce aux éditions passées.
- **Interprétabilité** : importance des variables mesurée par permutation
  (méthode agnostique au modèle).

### 4.2 Détection d'anomalies — règles métier + Isolation Forest

- **Choix hybride**, justifié ainsi :
  - Les situations à définition claire (surcharge = taux d'occupation ≥ 90 %,
    panne remontée par un capteur, variation brutale de présence entre deux relevés
    de 15 min) sont détectées par des **règles explicites** : explicables et sans
    faux négatif sur leur périmètre.
  - Les écarts au comportement attendu sans définition a priori sont détectés par
    **Isolation Forest** (non supervisé, car les anomalies ne sont pas labellisées
    en conditions réelles) sur les variables (affluence, taux d'occupation, variation).
- Les mouvements de foule sont détectés sur les relevés fins (15 min) et non sur les
  moyennes par créneau, qui diluent les pics.
- **Anticipation (détection proactive)** : au-delà de la détection réactive, on
  applique la règle de surcharge sur la *prévision* d'affluence (et non sur l'observé)
  pour **alerter avant l'événement** — « surcharge prévue à 20h30 sur Scène Rock ».
  On confronte ensuite ces alertes au réel pour mesurer la fiabilité de l'anticipation
  (précision et rappel). Seules les surcharges sont anticipables (elles découlent de
  l'affluence, qu'on prédit) ; les pannes (aléatoires) et les micro-mouvements de foule
  ne le sont pas — c'est assumé. Ce module relie explicitement prévision → détection.

### 4.3 Allocation des ressources — programmation linéaire

- **Modèle** : pour chaque créneau de **chacun des 3 jours**, minimiser le manque de
  couverture (besoin non couvert, pondéré fortement) sous contrainte d'effectif
  disponible par type d'équipe. Variables entières (personnes), résolu avec PuLP + CBC.
  La prévision opérationnelle (même modèle que le dimanche) est appliquée aux 3 jours.
- **Besoins** : dérivés des prévisions par des ratios d'encadrement
  (1 agent de sécurité / 100 visiteurs, 1 food / 150, 1 sanitaire / 250, 1 médical / 400) —
  à l'échelle du festival (jusqu'à 50 000 personnes/jour), cela représente des équipes
  de plusieurs centaines de personnes par type, réparties en dizaines d'équipes avec
  des créneaux de disponibilité différents.
- **Justification** : le problème est exactement un problème d'optimisation sous
  contraintes linéaires ; la solution est optimale et démontrable, contrairement à
  une heuristique.
- **Boucle de réaction** : les anomalies du dimanche augmentent le besoin en sécurité
  et médical (+50 % et +2) sur les scènes et créneaux touchés, et l'allocation est
  ré-optimisée. On mesure l'apport de cette réallocation en comparant avec
  l'allocation initiale figée.
- **Dimensionnement du personnel** : au-delà de « comment répartir », l'allocation
  répond à « combien déployer ». On dimensionne sur les **besoins prévus** (planification
  à partir de la prévision), pas sur les besoins gonflés par les anomalies : on recrute
  pour la prévision et on absorbe les incidents par réallocation, pas en sur-embauchant
  partout. On teste, en une passe, cinq niveaux d'effectif (50 / 75 / 90 / 100 / 110 % du
  besoin de pointe — le maximum simultané, atteint le **jour le plus chargé**, samedi).
  Pour chaque niveau, on plafonne l'effectif, on ré-optimise et on mesure la couverture
  et les créneaux à découvert. L'effectif idéal d'un domaine est le plus petit niveau
  couvrant ≥ 99 % de ses besoins : **sécurité 386, food 257, sanitaire 155, médical 97**
  (90 % du pic prévu dans chaque domaine). À comparer à ce qui est **déployé** (sécurité
  400, food 280, sanitaire 160, médical 100) : le festival est bien dimensionné, avec une
  petite marge. Ces effectifs sont à l'échelle du **site entier** ; on les rapporte à un
  nombre réaliste d'installations pour 50 000 personnes (`INSTALLATIONS` : ≈ 24 points de
  restauration, ≈ 30 blocs sanitaires, ≈ 6 postes de secours) → effectif par installation
  (food ~11, sanitaire ~5, médical ~16). La carte du site n'affiche que des marqueurs
  représentatifs, pas l'inventaire complet.
- **Transport (navettes) — dimensionnement site-level** : les 4 domaines ci-dessus se
  répartissent par scène ; le transport, lui, est un service à l'échelle du site, piloté
  par **deux flux** — les **arrivées** (concentrées à l'ouverture, la flotte tourne à plein
  dès 15h30) et les **départs**, qui montent au fil de la soirée puis explosent à la
  clôture (~20 000 personnes partent vers minuit le samedi, jour le plus chargé). On
  dimensionne la flotte sur la contrainte la plus dure — évacuer la vague de cloture en
  2 h — puis on rejoue les deux flux à travers cette flotte (modèle de file : ce qui
  dépasse le débit d'un créneau attend le suivant), ce qui donne la charge réelle des
  navettes heure par heure. Calcul : 20 246 départs × 35 % en navette = 7 086 personnes à
  évacuer, sur 4 rotations de 55 places (2 h) → 7 086 ÷ 220 ≈ **33 navettes, 66 agents**.
  Hypothèses assumées et documentées (55 personnes/rotation, 35 % de report modal — le
  reste en voiture/à pied/en TC, 2 h de fenêtre). Les 5 domaines de ressources de
  l'énoncé (sécurité, food, sanitaire, médical, transport) sont ainsi
  tous couverts, chacun avec la logique adaptée (par scène vs site-level).

### 4.4 Évaluation de scénarios — rejeu Monte Carlo

- Chaque scénario (configuration de capacités, horaires, effectifs) est rejoué
  **3 fois avec des graines différentes** ; les métriques sont moyennées pour ne pas
  conclure sur un run bruité.
- Métriques : part des créneaux en surcharge (taux ≥ 0,9), pic d'occupation,
  couverture des besoins en personnel, coût du personnel sur les 3 jours (coût horaire
  par type d'équipe × effectif × amplitude de présence).
- Scénarios comparés : base, scènes DJ et Rock agrandies, horaires décalés entre
  scènes, sécurité renforcée.

### 4.5 Restitution — site web dédié

- La restitution principale est un **site web autonome** (`site/`, HTML/CSS/JS +
  ECharts, aucune dépendance réseau : bibliothèque de graphiques et polices
  embarquées), présenté comme le site public du festival : page d'accueil avec les
  têtes d'affiche des 3 jours, puis les pages d'analyse accessibles par le menu
  latéral (9 pages : accueil, programmation, carte du site, affluence, prévisions,
  anomalies, allocation, recommandations, scénarios).
- **Les données sont strictement identiques au pipeline** : `exporte_site.py` lit la
  base SQLite produite par `run_pipeline.py` et génère `site/donnees.js` ; aucune
  valeur n'est ressaisie à la main. L'export est rejoué automatiquement à chaque
  exécution du pipeline. Le dashboard Streamlit est conservé comme solution de
  secours pour la démonstration.
- Justification du choix : Streamlit est idéal pour prototyper mais impose sa mise
  en page ; un site statique donne un rendu maîtrisé, se lance sans serveur
  (double-clic sur `index.html`) et fonctionne hors-ligne le jour de la soutenance.
- **Carte du site en 3D temps réel** (React + TypeScript + Three.js via React Three
  Fiber, compilée en un bundle unique `site/lib/carte3d.js`) : le site du festival
  est modélisé en vue aérienne interactive — scènes avec écrans et faisceaux,
  chemins, stands, foule instanciée dont la densité suit l'affluence, marcheurs qui
  matérialisent les flux entre scènes (sens de déplacement visible), halo au sol
  coloré par le taux d'occupation (vert < 70 %, jaune, orange, rouge > 100 %),
  marqueurs d'anomalies. Navigation type carte (rotation, zoom, déplacement,
  recentrage sur une scène au clic) et timeline qui rejoue la journée créneau par
  créneau : c'est la matérialisation visuelle de la simulation à événements discrets.
- **Sélecteur d'édition** : la carte rejoue au choix les 5 éditions du festival.
  Les éditions **2022 à 2025** sont le déroulé réel passé (rejouées à partir de
  l'historique, déterministes : mêmes graines, donc identiques à chaque lancement).
  L'édition **2026** est la *simulation de la prédiction* : une simulation à
  événements discrets dont les totaux par jour sont pilotés par la prévision combinée
  (tendance + billetterie) et le line-up 2026 annoncé — c'est « à quoi ressemblera le
  festival si notre prédiction est juste ». Un badge distingue explicitement
  « Déroulé réel » (passé) de « Prédiction » (2026). Chaque édition a ses propres
  foule, flux et anomalies. Le déroulé réel 2026 (vérité terrain des modules
  détection / allocation / scénarios) reste, lui, sur les pages Affluence et Anomalies.
- **Seule la couche d'affichage a changé** : les positions, seuils, formules de
  taille et de largeur de flux sont portés à l'identique depuis la carte 2D
  (`carte3d/src/logique/festival.ts`). Cliquer sur une scène affiche ses
  statistiques (affluence, évolution, flux entrants/sortants, set en cours) et son
  programme (pour 2026 ; les éditions passées n'ont pas de programmation d'époque
  conservée) ; cliquer sur un stand affiche sa carte (produits et prix). En cas
  d'échec WebGL, la page bascule automatiquement sur l'ancienne carte 2D ECharts,
  elle aussi multi-éditions, conservée en repli.
- **Recommandations opérationnelles** : un module traduit les sorties chiffrées en
  actions concrètes priorisées (surcharges prévues → limiter les entrées, renforts
  décidés par la réallocation, besoins résiduels non couverts, configuration
  d'organisation recommandée par la simulation comparative). Justification : un outil
  d'aide à la gestion doit produire des décisions, pas seulement des courbes.
- Couleurs : palette validée pour les daltonismes, échelle séquentielle une teinte
  pour les heatmaps, couleurs d'état réservées aux gravités.

## 5. Résultats

Résultats du pipeline (graine 42, environ 3 min 30 d'exécution — simulation des
5 éditions plus les 12 rejeux Monte Carlo des scénarios) :

### Prévision de l'édition (tendance + billetterie)

| Journée 2026 | Vendu | Tendance | Billetterie | Combinée | Réel |
|---|---|---|---|---|---|
| Vendredi | 74 % | 38 629 (1.1 %) | 41 550 (6.4 %) | 40 090 (2.7 %) | 39 041 |
| Samedi | 92 % | 41 121 (**17.0 %**) | 47 400 (**4.4 %**) | 44 260 (10.7 %) | 49 558 |
| Dimanche | 50 % | 35 001 (4.7 %) | 33 750 (8.1 %) | 34 376 (6.4 %) | 36 726 |

Enseignement : **aucun signal seul n'est parfait, mais ils sont complémentaires**.
La tendance rate le samedi (17 % d'erreur) car elle ne perçoit pas l'engouement
propre à cette édition ; la billetterie le corrige spectaculairement (92 % déjà
vendu → 4,4 % d'erreur). Inversement le dimanche, encore peu vendu (50 %), est mieux
capté par la tendance. La combinaison des deux borne le risque : jamais plus de
~11 % d'erreur, là où parier sur un seul signal peut coûter 17 %. C'est l'intérêt
d'un dimensionnement robuste plutôt que d'un pari.

### Prévision opérationnelle (dimanche 6 septembre, 48 points scène × créneau)

| Modèle (entraîné avec l'historique) | MAE (visiteurs) |
|---|---|
| Forêt aléatoire (retenue) | **1 443** |
| Régression linéaire | 1 506 |
| Naïf (créneau précédent) | 2 662 |
| Meilleur modèle **sans** historique | 1 678 |

R² du modèle retenu : **0.741**. L'historique des 4 éditions réduit l'erreur de
**14 %** et fait basculer le modèle optimal de la régression linéaire (peu de
données) vers la forêt aléatoire (assez de données pour les non-linéarités).
Variables les plus importantes (par permutation) : affluence des créneaux
précédents, scène active ou en pause, notoriété du set. Une MAE de 1 443 représente
moins de 6 % de la capacité de la plus grande scène (25 000).

### Détection

91 anomalies détectées sur les 3 jours. Sur les 6 mouvements de foule injectés
(vérité terrain), **6 sont retrouvés** (rappel 100 % sur cette graine). Les 6 pannes
injectées sont toutes remontées.

Anticipation des surcharges (dimanche) : **7 surcharges annoncées avant l'événement,
6 confirmées** le jour J → précision 86 %, rappel 86 %. On prévoit donc à l'avance,
avec une fiabilité honnête, où et quand les scènes vont saturer.

### Allocation (les 3 jours)

| Situation | Couverture des besoins (moyenne 3 jours) |
|---|---|
| Besoins prévus, allocation optimisée | 99.6 % |
| Besoins ajustés (anomalies), allocation figée | 92.2 % |
| Besoins ajustés, après réallocation | **96.7 %** |

La réallocation déclenchée par les anomalies récupère l'essentiel de la couverture
perdue, à effectifs constants. Les effectifs générés étant volontairement serrés, la
couverture ne remonte pas tout à fait à 100 % le jour le plus chargé — c'est justement
ce que le dimensionnement ci-dessous chiffre.

Dimensionnement du personnel (couverture par niveau d'effectif du pic prévu, samedi) :

| Effectif déployé | Couverture | Créneaux à découvert |
|---|---|---|
| 50 % | 84.4 % | 155 |
| 75 % | 97.7 % | 48 |
| 90 % | 99.7 % | 12 |
| **100 %** | **100.0 %** | **0** |
| 110 % | 100.0 % | 0 |

Enseignement : la couverture monte vite puis **plafonne à 100 %** — déployer plus que
l'effectif de pointe ne sert à rien (personnel payé pour rien), et descendre sous
90 % ouvre des zones à risque. Effectif idéal par domaine (plus petit niveau couvrant
≥ 99 % des besoins) : **sécurité 386, food 257, sanitaire 155, médical 97** — soit 90 %
du pic prévu dans chaque domaine. C'est légèrement en dessous de ce qui est déployé
(400 / 280 / 160 / 100) : le festival est correctement dimensionné, avec une petite marge.

### Scénarios (moyenne sur 3 runs)

| Scénario | Créneaux en surcharge | Pic d'occupation | Couverture besoins | Coût personnel (3 j) |
|---|---|---|---|---|
| base | 17.1 % | 2.05 | 99.3 % | 410 270 EUR |
| scènes DJ et Rock agrandies | **8.6 %** | **1.41** | 99.3 % | 410 270 EUR |
| horaires décalés | 18.1 % | 1.98 | 99.3 % | 410 270 EUR |
| sécurité renforcée | 18.3 % | 2.54 | 99.4 % | 504 720 EUR |

Le pic d'occupation supérieur à 1 confirme que rien n'empêche une scène de dépasser
sa capacité nominale (cf. §3) : dans le scénario base, une scène atteint jusqu'à
205 % de sa capacité affichée à un instant donné. Conclusion opérationnelle :
agrandir les scènes DJ et Rock fait passer les créneaux en surcharge de 17.1 % à
8.6 % à coût de personnel constant, alors que renforcer la sécurité coûte
94 450 EUR de plus et n'améliore quasiment rien (18.3 % de surcharge, pire que la
base) — le sur-effectif ne réduit pas la densité de foule, il ne fait qu'aider à
la gérer une fois qu'elle est là.

## 6. Limites

- Les données sont simulées : le comportement des visiteurs suit nos hypothèses
  (choix proportionnel à la popularité), le modèle de prévision apprend donc en partie
  les règles de notre propre simulateur.
- La prévision utilise l'affluence des créneaux précédents : elle est valable à court
  terme (30 min) mais pas pour planifier la journée entière à l'avance.
- Le rappel de 100 % sur les mouvements de foule est mesuré sur une seule graine ;
  la robustesse de la détection mériterait d'être évaluée sur plusieurs générations.
- La notoriété des artistes du line-up est estimée manuellement (score 3-10), elle
  ne vient pas d'une source de données réelle (streams, ventes).
- La prévision de l'édition par tendance repose sur 4 points par journée : elle
  donne un ordre de grandeur, pas une prévision fiable (samedi sous-estimé de 17 %),
  d'où la combinaison avec la billetterie.
- Le taux de conversion de la billetterie restante (35 %) est une hypothèse globale
  unique ; en réalité il varie selon les jours (acheteurs précoces le vendredi,
  tardifs le dimanche), ce qui explique que la billetterie soit excellente le samedi
  mais moins le dimanche.
- Les éditions passées sont simulées avec une structure de programmation similaire
  à celle de 2026 (mêmes créneaux de notoriété) : hypothèse simplificatrice, un vrai
  historique aurait des line-ups plus variés.
- L'allocation optimise chaque créneau indépendamment : pas de contrainte de
  continuité des équipes entre créneaux (une équipe peut changer de scène toutes les
  30 min, ce qui est peu réaliste).
- 3 runs par scénario suffisent à dégager les tendances mais restent peu pour des
  intervalles de confiance sérieux.
- Le coût des scénarios ne couvre que le personnel : agrandir une scène a un coût
  d'infrastructure qui n'est pas modélisé.
- L'absence de plafond physique dur sur les scènes (§3) est un choix assumé pour
  rendre la surcharge possible, mais elle peut produire des pics extrêmes
  (jusqu'à 205 % de la capacité affichée) qui n'ont pas été confrontés à des données
  réelles de mouvement de foule à cette échelle.

## 7. Reproduction

```
.venv\Scripts\python run_pipeline.py
```

Régénère les données et `site/donnees.js`. Puis ouvrir `site/index.html` dans un
navigateur (restitution principale, hors-ligne) — ou, en secours :

```
.venv\Scripts\streamlit run dashboard/app.py
```
