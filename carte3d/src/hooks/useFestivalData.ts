import { useMemo } from "react";
import {
  affluencePour, anomaliesPour, couleurTaux, creneauxDuJour, fluxPour, monde, POSITIONS, setActuel,
} from "../logique/festival";
import type { EditionCarte, SceneFestival } from "../types/donnees";

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

// Instantane de l'etat du festival pour une edition, un jour et un creneau.
// Toutes les valeurs viennent des memes tables que la carte 2D.
export function useFestivalData(
  scenesRef: SceneFestival[],
  edition: EditionCarte,
  jour: number,
  creneau: number,
) {
  const creneaux = useMemo(
    () => creneauxDuJour(edition.affluence, jour),
    [edition, jour],
  );

  const etat = useMemo(() => {
    const parScene = affluencePour(edition.affluence, jour, creneau);
    const anomalies = anomaliesPour(edition.anomalies, jour, creneau);
    const scenesAnormales = new Set(anomalies.map((a) => a.scene_id));

    const scenes: EtatScene[] = scenesRef.map((s) => {
      const nb = parScene.get(s.scene_id) ?? 0;
      const taux = nb / s.capacite;
      // Les editions passees ont des noms d'artistes generiques : on n'affiche
      // que les vrais noms (line-up 2026 annonce), pas "Artiste 2022.01".
      const a = setActuel(edition.programmation, jour, s.scene_id, creneau)?.artiste;
      return {
        sceneId: s.scene_id,
        nom: s.nom,
        capacite: s.capacite,
        nb,
        taux,
        couleur: couleurTaux(taux),
        position: monde(...POSITIONS[s.scene_id]),
        aAnomalie: scenesAnormales.has(s.scene_id),
        artiste: a && !a.startsWith("Artiste ") ? a : undefined,
      };
    });

    return { scenes, flux: fluxPour(edition.flux, jour, creneau), anomalies };
  }, [scenesRef, edition, jour, creneau]);

  return { creneaux, ...etat };
}
