import type { Anomalie } from "../types/donnees";

export interface EpisodeAnomalie {
  cle: string; // scene + type : identite de l'episode
  type: string;
  scene_id: number;
  gravite: string;
  debut: number; // creneau de premiere detection
  finActive: number; // dernier creneau ou l'anomalie est encore detectee
  resolution: number | null; // creneau ou elle disparait (null si va jusqu'a la fin du jour)
}

// Regroupe les occurrences consecutives d'une meme anomalie (meme scene + meme
// type) en episodes datés. Deux occurrences separees par un creneau sans
// anomalie forment deux episodes distincts. La resolution est le premier
// creneau ou l'anomalie n'est plus detectee (granularite 30 min du pipeline).
export function episodesAnomalies(
  anomalies: Anomalie[],
  jour: number,
  creneaux: number[],
): EpisodeAnomalie[] {
  const rang = new Map(creneaux.map((c, i) => [c, i]));
  const groupes = new Map<string, Anomalie[]>();

  anomalies
    .filter((a) => a.jour === jour)
    .forEach((a) => {
      const cle = a.scene_id + "|" + a.type;
      const liste = groupes.get(cle) ?? [];
      liste.push(a);
      groupes.set(cle, liste);
    });

  const episodes: EpisodeAnomalie[] = [];
  for (const [cle, liste] of groupes) {
    const presents = [...new Set(liste.map((a) => a.creneau))].sort((x, y) => x - y);
    let i = 0;
    while (i < presents.length) {
      const debut = presents[i];
      let fin = presents[i];
      while (
        i + 1 < presents.length &&
        rang.get(presents[i + 1]) === (rang.get(fin) ?? -9) + 1
      ) {
        i += 1;
        fin = presents[i];
      }
      const rangFin = rang.get(fin) ?? -1;
      const resolution = rangFin + 1 < creneaux.length ? creneaux[rangFin + 1] : null;
      const ref = liste.find((a) => a.creneau === debut)!;
      episodes.push({
        cle,
        type: ref.type,
        scene_id: ref.scene_id,
        gravite: ref.gravite,
        debut,
        finActive: fin,
        resolution,
      });
      i += 1;
    }
  }
  return episodes;
}
