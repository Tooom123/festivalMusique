import { useMemo } from "react";
import {
  affluencePour, anomaliesPour, couleurTaux, creneauxDuJour, fluxPour, monde, POSITIONS, setActuel,
} from "../logique/festival";
import type { Donnees } from "../types/donnees";

export interface EtatScene {
  sceneId: number;
  nom: string;
  capacite: number;
  nb: number;
  taux: number;
  couleur: string;
  position: [number, number];
  aAnomalie: boolean;
  artiste?: string; // set en cours, absent si la scene est en pause
}

// Instantane de l'etat du festival pour un jour + un creneau donnes.
// Toutes les valeurs viennent des memes tables que la carte 2D.
export function useFestivalData(donnees: Donnees, jour: number, creneau: number) {
  const creneaux = useMemo(() => creneauxDuJour(donnees, jour), [donnees, jour]);

  const etat = useMemo(() => {
    const parScene = affluencePour(donnees, jour, creneau);
    const anomalies = anomaliesPour(donnees, jour, creneau);
    const scenesAnormales = new Set(anomalies.map((a) => a.scene_id));

    const scenes: EtatScene[] = donnees.scenes.map((s) => {
      const nb = parScene.get(s.scene_id) ?? 0;
      const taux = nb / s.capacite;
      return {
        sceneId: s.scene_id,
        nom: s.nom,
        capacite: s.capacite,
        nb,
        taux,
        couleur: couleurTaux(taux),
        position: monde(...POSITIONS[s.scene_id]),
        aAnomalie: scenesAnormales.has(s.scene_id),
        artiste: setActuel(donnees, jour, s.scene_id, creneau)?.artiste,
      };
    });

    return { scenes, flux: fluxPour(donnees, jour, creneau), anomalies };
  }, [donnees, jour, creneau]);

  return { creneaux, ...etat };
}
