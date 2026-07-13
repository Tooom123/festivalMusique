// Logique metier portee 1:1 depuis site/app.js (carte 2D) : memes positions,
// memes seuils de couleur, memes formules de taille et de largeur de flux.
// Seule la couche d'affichage change, pas les calculs.

import type { Anomalie, Concert, LigneAffluence, LigneFlux } from "../types/donnees";

export const POSITIONS: Record<number, [number, number]> = {
  1: [50, 76],
  2: [20, 30],
  3: [80, 30],
};

export const COULEURS_SCENES: Record<number, string> = {
  1: "#3987e5",
  2: "#199e70",
  3: "#c98500",
};

export const ECHELLE_MONDE = 1.3;

// Coordonnees 2D (x: 0-100 gauche->droite, y: 0-100 bas->haut) vers monde 3D (x, z).
export function monde(x: number, y: number): [number, number] {
  return [(x - 50) * ECHELLE_MONDE, (50 - y) * ECHELLE_MONDE];
}

export function heureTexte(m: number): string {
  m = Math.round(m);
  return (
    String(Math.floor(m / 60)).padStart(2, "0") + "h" + String(m % 60).padStart(2, "0")
  );
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}

const LIBELLES_ANOMALIE: Record<string, string> = {
  mouvement_foule: "Mouvement de foule",
  surcharge: "Surcharge",
  surcharge_critique: "Surcharge critique",
  comportement_atypique: "Comportement atypique",
};

// Type technique (snake_case) -> libelle lisible. Les pannes sont dynamiques
// (panne_navette, panne_stand_food, ...) : prefixe generique.
export function libelleAnomalie(type: string): string {
  if (LIBELLES_ANOMALIE[type]) return LIBELLES_ANOMALIE[type];
  if (type.startsWith("panne_")) return "Panne · " + type.slice(6).replace(/_/g, " ");
  return type.replace(/_/g, " ");
}

// Seuils identiques a couleurTaux() de la carte 2D.
export function couleurTaux(t: number): string {
  if (t >= 1.0) return "#d03b3b";
  if (t >= 0.9) return "#ec835a";
  if (t >= 0.7) return "#fab219";
  return "#0ca30c";
}

// 2D : symbolSize = 14 + 1.5 * sqrt(nb). Meme loi, convertie en rayon monde.
export function rayonFoule(nb: number): number {
  return (14 + 1.5 * Math.sqrt(Math.max(nb, 0))) * 0.055;
}

// 2D : largeur de ligne = 1.5 + min(nb / 40, 6). Meme formule, convertie en metres.
export function largeurFlux(nb: number): number {
  return (1.5 + Math.min(nb / 40, 6)) * 0.45;
}

export function creneauxDuJour(affluence: LigneAffluence[], jour: number): number[] {
  return [...new Set(
    affluence.filter((a) => a.jour === jour).map((a) => a.creneau),
  )].sort((a, b) => a - b);
}

export function affluencePour(
  affluence: LigneAffluence[],
  jour: number,
  creneau: number,
): Map<number, number> {
  const carte = new Map<number, number>();
  affluence
    .filter((a) => a.jour === jour && a.creneau === creneau)
    .forEach((a) => carte.set(a.scene_id, a.nb_visiteurs));
  return carte;
}

export function fluxPour(flux: LigneFlux[], jour: number, creneau: number): LigneFlux[] {
  return flux.filter((f) => f.jour === jour && f.creneau === creneau);
}

export function anomaliesPour(
  anomalies: Anomalie[],
  jour: number,
  creneau: number,
): Anomalie[] {
  return anomalies.filter((a) => a.jour === jour && a.creneau === creneau);
}

export function prochainSet(
  programmation: Concert[], jour: number, sceneId: number, creneau: number,
) {
  return programmation
    .filter((p) => p.jour === jour && p.scene_id === sceneId && p.heure_fin > creneau)
    .sort((a, b) => a.heure_debut - b.heure_debut)[0];
}

// Set en cours sur une scene a l'instant donne (undefined si la scene est en pause).
export function setActuel(
  programmation: Concert[], jour: number, sceneId: number, creneau: number,
) {
  return programmation.find(
    (p) =>
      p.jour === jour &&
      p.scene_id === sceneId &&
      p.heure_debut <= creneau &&
      p.heure_fin > creneau,
  );
}
