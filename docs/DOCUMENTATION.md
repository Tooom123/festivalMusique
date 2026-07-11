<!--faut remplacer les membres par les noms-->


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

### 4.1 Prévision de l'affluence — régression linéaire retenue après comparatif

- **Problème** : prédire le nombre de visiteurs par scène et par créneau de 30 min
  pour le dimanche 6 septembre, à partir du vendredi et du samedi (découpage temporel
  strict, pas de fuite).
- **Variables** : scène, capacité, notoriété du set en cours, scène active ou en
  pause, notoriété du set suivant (le line-up est public, donc connu à l'avance),
  heure, indicateur soirée, affluence des deux créneaux précédents (prévision à
  court terme, comme en exploitation réelle où les comptages remontent en continu).
- **Choix** : trois modèles ont été comparés sur le dimanche — régression linéaire,
  forêt aléatoire (plusieurs profondeurs testées) et modèle naïf. La **régression
  linéaire l'emporte nettement** (MAE 1 678 contre 1 986 pour la meilleure forêt et
  2 662 pour le naïf) : avec seulement 2 jours d'historique (96 points d'entraînement),
  la forêt sur-apprend et généralise mal sur la rotation du dimanche, qui diffère de
  celles des deux premiers jours. C'est un résultat classique : peu de données et des
  relations quasi linéaires (l'affluence suit la notoriété et l'inertie du créneau
  précédent) favorisent le modèle simple. La forêt reste dans le comparatif du
  dashboard pour documenter ce choix.
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

### 4.3 Allocation des ressources — programmation linéaire

- **Modèle** : pour chaque créneau du dimanche, minimiser le manque de couverture
  (besoin non couvert, pondéré fortement) sous contrainte d'effectif disponible par
  type d'équipe. Variables entières (personnes), résolu avec PuLP + solveur CBC.
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
  chemins, stands, foule instanciée dont la densité suit l'affluence réelle,
  marcheurs qui matérialisent les flux entre scènes (sens de déplacement visible),
  halo au sol coloré par le taux d'occupation (vert < 70 %, jaune, orange,
  rouge > 100 %), marqueurs d'anomalies. Navigation type carte (rotation, zoom,
  déplacement, recentrage sur une scène au clic) et timeline qui rejoue la journée
  créneau par créneau : c'est la matérialisation visuelle de la simulation à
  événements discrets. **Seule la couche d'affichage a changé** : les positions,
  seuils, formules de taille et de largeur de flux sont portés à l'identique depuis
  la carte 2D (`carte3d/src/logique/festival.ts`), et les mêmes tables alimentent
  les deux rendus. Cliquer sur une scène affiche ses statistiques (affluence,
  évolution, flux entrants/sortants, set en cours) et son programme ; cliquer sur
  un stand affiche sa carte (produits et prix). En cas d'échec WebGL, la page
  bascule automatiquement sur l'ancienne carte 2D ECharts, conservée en repli.
- **Recommandations opérationnelles** : un module traduit les sorties chiffrées en
  actions concrètes priorisées (surcharges prévues → limiter les entrées, renforts
  décidés par la réallocation, besoins résiduels non couverts, configuration
  d'organisation recommandée par la simulation comparative). Justification : un outil
  d'aide à la gestion doit produire des décisions, pas seulement des courbes.
- Couleurs : palette validée pour les daltonismes, échelle séquentielle une teinte
  pour les heatmaps, couleurs d'état réservées aux gravités.

## 5. Résultats

Résultats du pipeline (graine 42, environ 65 s d'exécution — dominées par les
12 rejeux de simulation à 3 jours des scénarios) :

### Prévision (dimanche 6 septembre, 48 points scène × créneau)

| Modèle | MAE (visiteurs) |
|---|---|
| Régression linéaire (retenue) | **1 678** |
| Forêt aléatoire | 1 986 |
| Naïf (créneau précédent) | 2 662 |

R² de la régression linéaire : **0.756**. Variables les plus importantes
(par permutation) : affluence des créneaux précédents, scène active ou en pause,
notoriété du set. Une MAE de 1 678 représente environ 7 % de la capacité de la
plus grande scène (25 000) — cohérent avec l'échelle du festival.

### Détection

91 anomalies détectées sur les 3 jours. Sur les 6 mouvements de foule injectés
(vérité terrain), **6 sont retrouvés** (rappel 100 % sur cette graine). Les 6 pannes
injectées sont toutes remontées.

### Allocation (dimanche 6 septembre)

| Situation | Couverture des besoins |
|---|---|
| Besoins prévus, allocation optimisée | 99.9 % |
| Besoins ajustés (anomalies), allocation figée | 94.5 % |
| Besoins ajustés, après réallocation | **98.8 %** |

La réallocation déclenchée par les anomalies récupère l'essentiel de la couverture
perdue, à effectifs constants.

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
