<!--faut remplacer les membres par les noms-->


# Plan de soutenance — 10 minutes

Support : le site web en direct (ouvrir `site/index.html` avant de passer —
fonctionne hors-ligne, aucune installation nécessaire). Plans de secours : dashboard
Streamlit (`streamlit run dashboard/app.py`, mêmes données) puis export PDF des captures.

## Déroulé

| Temps | Qui | Contenu |
|---|---|---|
| 0:00 – 1:00 | Membre 1 | Contexte : festival vendredi 4 - dimanche 6 septembre 2026, 3 scènes (Rap 25 000, DJ 20 000, Rock 5 000 places), capacité max 50 000 personnes/jour, samedi le plus fréquenté (~49 600 vs ~38 000), line-up de 48 artistes avec rotation 2 scènes actives sur 3, les 4 problématiques du sujet — **ouvrir le site sur l'accueil** : têtes d'affiche et chiffres clés posent le décor, puis page « Programmation » |
| 1:00 – 2:30 | Membre 2 | Données et simulation : schéma des données, simulation à événements discrets (les flux émergent des choix des visiteurs, aucun plafond dur sur les scènes), incidents injectés comme vérité terrain — **lancer le replay animé sur la page « Carte du site »** : la journée se rejoue sous les yeux du jury, cliquer sur une scène (programme) et un stand (menu) |
| 2:30 – 4:00 | Membre 3 | Prévision : régression linéaire vs forêt aléatoire vs naïf (MAE 1 678 vs 1 986 vs 2 662, R² 0.76), choix justifié par expérimentation (avec 2 jours d'historique la forêt sur-apprend), importance des variables — page « Prévisions » |
| 4:00 – 5:30 | Membre 4 | Détection : approche hybride règles + Isolation Forest, rappel 6/6 sur les mouvements de foule injectés, pannes toutes remontées — page « Anomalies » |
| 5:30 – 7:00 | Membre 5 | Allocation : programmation linéaire (PuLP), besoins dérivés des prévisions, réallocation déclenchée par les anomalies (94.5 % → 98.8 % de couverture) — pages « Allocation » puis « Recommandations » : le système traduit les chiffres en décisions |
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

- *Pourquoi une simple régression linéaire et pas un modèle plus puissant ?*
  On a testé : forêt aléatoire (plusieurs profondeurs) et gradient boosting font
  tous moins bien (MAE 1 800-2 500 contre 1 678). Avec 2 jours d'historique
  (96 points), les modèles complexes sur-apprennent ; les relations sont quasi
  linéaires (notoriété + inertie du créneau précédent). Le bon modèle est celui qui
  généralise, pas le plus sophistiqué.
- *Comment savez-vous que la détection fonctionne ?*
  Incidents injectés dans la simulation et enregistrés à part = vérité terrain ;
  rappel mesuré (6/6), pannes 6/6.
- *Pourquoi les scènes peuvent dépasser leur capacité affichée ?*
  Choix volontaire : dans un vrai festival, on ne peut pas téléporter les gens
  ailleurs. La probabilité de rejoindre une scène pleine chute fortement mais reste
  non nulle, donc une scène peut monter jusqu'à ~2x sa capacité si sa programmation
  est trop populaire — exactement le genre de situation que la détection doit
  repérer et que l'allocation doit compenser.
- *Que se passe-t-il si les prévisions sont fausses ?*
  L'allocation est ré-optimisée quand les anomalies remontent : le système corrige
  en cours de journée.
- *Pourquoi SQLite et pas PostgreSQL ?*
  Volume modeste, aucun besoin de serveur, fichier unique versionnable et portable
  pour la correction.
