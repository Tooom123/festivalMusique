<!--faut remplacer les membres par les noms-->


# Plan de soutenance — 10 minutes

Support : le site web en direct (ouvrir `site/index.html` avant de passer —
fonctionne hors-ligne, aucune installation nécessaire). Plans de secours : dashboard
Streamlit (`streamlit run dashboard/app.py`, mêmes données) puis export PDF des captures.

## Déroulé

| Temps | Qui | Contenu |
|---|---|---|
| 0:00 – 1:00 | Membre 1 | Contexte : festival vendredi 4 - dimanche 6 septembre 2026, 3 scènes (Rap 25 000, DJ 20 000, Rock 5 000 places), capacité max 50 000 personnes/jour, samedi le plus fréquenté (~49 600 vs ~38 000), line-up de 48 artistes avec rotation 2 scènes actives sur 3, les 4 problématiques du sujet — **ouvrir le site sur l'accueil** : têtes d'affiche et chiffres clés posent le décor, puis page « Programmation » |
| 1:00 – 2:30 | Membre 2 | Données et simulation : schéma des données, simulation à événements discrets (les flux émergent des choix des visiteurs, aucun plafond dur sur les scènes), incidents injectés comme vérité terrain — **page « Carte du site »** : montrer le sélecteur d'édition (rejouer 2022-2025 = déroulé réel passé, puis 2026 = simulation de notre prédiction), lancer le replay animé, cliquer sur une scène (programme) et un stand (menu) |
| 2:30 – 4:00 | Membre 3 | Prévision à deux horizons. Fréquentation de la 5ᵉ édition : la tendance des 4 années **plus la billetterie en ligne** (74/92/50 % vendus) → le point fort à raconter : la tendance rate le samedi (17 % d'erreur), la billetterie le rattrape (92 % vendu → 4 % d'erreur), on combine pour un dimensionnement robuste. Puis prévision par scène/créneau : l'historique réduit la MAE de 1 678 à 1 443 (−14 %) **et fait basculer le modèle optimal de la régression linéaire vers la forêt aléatoire**. Page « Prévisions » (graphe éditions + panneau billetterie) |
| 4:00 – 5:30 | Membre 4 | Détection : approche hybride règles + Isolation Forest, rappel 6/6 sur les mouvements de foule injectés, pannes toutes remontées. Puis l'**anticipation** : on prédit les surcharges depuis la prévision d'affluence pour alerter AVANT l'événement (7 annoncées, 6 confirmées, précision/rappel 86 %) — détection proactive qui relie prévision↔détection — page « Anomalies » |
| 5:30 – 7:00 | Membre 5 | Allocation : programmation linéaire (PuLP), besoins dérivés des prévisions, réallocation déclenchée par les anomalies (94.5 % → 99.7 % de couverture). Puis le **dimensionnement** : on teste 50/75/90/100/110 % d'effectif d'un coup → la couverture plafonne à 100 % (déployer plus = gaspillage, moins de 90 % = zones à risque), l'effectif idéal par domaine (sécurité 382, food 220…), et le **transport dimensionné à part** (service site-level à deux flux — arrivées à l'ouverture, évacuation à la clôture ; 14 963 × 35 % ÷ 220 → 24 navettes, 48 agents) — page « Allocation » puis « Recommandations » |
| 7:00 – 8:30 | Membre 1 | Scénarios : rejeu Monte Carlo, comparaison des 4 configurations avec leur coût (agrandir les scènes DJ/Rock : surcharge 17.1 % → 8.6 % à coût constant ; sécurité renforcée : +94 450 EUR pour un résultat pire que la base) — page « Scénarios » |
| 8:30 – 10:00 | Membre 2 | Limites (données simulées, prévision court terme, continuité des équipes, pas de plafond physique dur) et conclusion : chaîne complète prévision → anomalies → réallocation → simulation |

## Messages clés

1. **Intégration** : les modules ne sont pas indépendants — les prévisions alimentent
   l'allocation, les anomalies déclenchent la réallocation, la simulation rejoue tout.
2. **Justification** : chaque méthode est comparée à une alternative (forêt vs linéaire
   vs naïf ; règles vs non supervisé ; optimisation exacte vs heuristique).
3. **Réalisme assumé** : à l'échelle d'un vrai festival (50 000 personnes/jour), rien
   n'empêche une foule de se masser devant une seule scène — la simulation le permet
   volontairement, c'est ce qui rend la détection et l'allocation utiles.
4. **Évaluation honnête** : vérité terrain injectée pour mesurer la détection,
   limites assumées.
5. **Reproductibilité** : une commande, graine fixe, aucune manipulation manuelle.

## Questions probables

- *Pourquoi la forêt aléatoire et pas un modèle plus simple / plus puissant ?*
  On a mesuré les deux régimes : sans historique (96 points), la régression
  linéaire gagnait car la forêt sur-apprenait ; avec les 4 éditions d'historique
  (672 points), la forêt repasse devant (MAE 1 443 contre 1 506). Le pipeline
  retient automatiquement le meilleur. Conclusion : le bon modèle dépend du volume
  de données, pas d'une préférence a priori.
- *D'où vient l'historique des éditions précédentes ?*
  Les éditions 2022-2025 sont simulées avec la même mécanique que 2026, avec des
  niveaux de fréquentation scénarisés (nouveauté, creux, reprise, record). Dans un
  cas réel, on brancherait la billetterie et les comptages des années passées ;
  la chaîne de traitement resterait identique.
- *Pourquoi combiner tendance et billetterie plutôt que garder la meilleure ?*
  Pour la robustesse : selon l'année, l'un ou l'autre peut se tromper. La billetterie
  sauve le samedi (que la tendance rate à 17 %), la tendance est meilleure le
  dimanche encore peu vendu. Combiner borne le risque (jamais plus de ~11 %) au lieu
  de parier sur un seul signal.
- *Comment savez-vous que la détection fonctionne ?*
  Incidents injectés dans la simulation et enregistrés à part = vérité terrain ;
  rappel mesuré (6/6), pannes 6/6.
- *Votre système peut-il prévenir avant l'incident, pas seulement le constater ?*
  Oui pour les surcharges : on applique la règle sur la prévision d'affluence, ce qui
  donne des alertes avant le jour J (7 annoncées, 6 confirmées, précision 86 %). Les
  pannes et micro-mouvements de foule restent imprévisibles — on ne prétend pas les
  anticiper, ce serait malhonnête.
- *Pourquoi les scènes peuvent dépasser leur capacité affichée ?*
  Choix volontaire : dans un vrai festival, on ne peut pas téléporter les gens
  ailleurs. La probabilité de rejoindre une scène pleine chute fortement mais reste
  non nulle, donc une scène peut monter jusqu'à ~2x sa capacité si sa programmation
  est trop populaire — exactement le genre de situation que la détection doit
  repérer et que l'allocation doit compenser.
- *Que se passe-t-il si les prévisions sont fausses ?*
  L'allocation est ré-optimisée quand les anomalies remontent : le système corrige
  en cours de journée.
- *Avez-vous vraiment besoin de tout l'effectif prévu ?*
  Non, et on le montre : on teste 50/75/90/100/110 % d'un coup. La couverture plafonne
  à 100 %, donc au-delà du besoin de pointe c'est du gaspillage ; en dessous de 90 %,
  des créneaux passent à découvert. On donne l'effectif idéal domaine par domaine —
  sécurité et médical suffisent à 90 % de leur pic, food et sanitaire à 100 %.
  On mesure la couverture, pas des incidents inventés par le sous-effectif.
- *220 agents food alors qu'on voit un seul stand sur la carte ?*
  Les effectifs sont dimensionnés à l'échelle du site entier (ratio d'encadrement ×
  affluence de 50 000 personnes), pas par marqueur de la carte. La carte est
  schématique : elle place quelques repères (1 stand, 3 toilettes) pour la lisibilité,
  pas l'inventaire réel. Ramenés aux installations réelles d'un festival de cette
  taille (~24 points de restauration, ~30 blocs sanitaires, ~6 postes de secours), ça
  fait ~9 agents par stand, ~4 par bloc sanitaire, ~17 par poste de secours — des
  ordres de grandeur normaux. Le site affiche cette répartition sous chaque chiffre.
- *D'où sortent les 24 navettes et le 35 % ?*
  La flotte est taillée sur la contrainte la plus dure — évacuer la clôture. 14 963
  personnes partent vers minuit ; on suppose que 35 % prennent la navette (report modal,
  le reste vient en voiture, à pied ou en TC), soit 5 237 personnes à évacuer. Une navette
  fait 55 places par rotation de 30 min, donc 4 rotations en 2 h → 220 places : 5 237 ÷ 220
  ≈ 24 navettes (48 agents, 2 par navette). Le 35 % est le paramètre à caler sur
  l'implantation réelle du site et l'offre de parking ; on l'assume comme hypothèse, pas
  comme une mesure. La même flotte absorbe les arrivées (concentrées à l'ouverture), moins
  critiques car étalées sur l'après-midi.
- *Pourquoi SQLite et pas PostgreSQL ?*
  Volume modeste, aucun besoin de serveur, fichier unique versionnable et portable
  pour la correction.
