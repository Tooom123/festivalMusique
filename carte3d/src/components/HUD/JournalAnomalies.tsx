import type { EpisodeAnomalie } from "../../logique/anomalies";
import { heureTexte, libelleAnomalie } from "../../logique/festival";

export interface EpisodeAffiche extends EpisodeAnomalie {
  resolu: boolean;
}

interface Props {
  episodes: EpisodeAffiche[]; // actifs en tete, puis resolus, plus recents d'abord
  creneauCourant: number;
  noms: Record<number, string>;
}

// Journal des anomalies : chaque anomalie detectee reste inscrite (datee de son
// debut). Tant qu'elle est active elle est marquee « en cours » ; une fois
// disparue des creneaux suivants, elle est renommee « résolu à HHhMM » plutot
// que retiree, pour garder l'historique complet de la journee visible.
export function JournalAnomalies({ episodes, creneauCourant, noms }: Props) {
  const actives = episodes.filter((e) => !e.resolu).length;

  return (
    <div className="c3d-journal">
      <div className="c3d-journal-tete">
        <span>Anomalies · {heureTexte(creneauCourant)}</span>
        <b>{actives > 0 ? `${actives} en cours` : episodes.length}</b>
      </div>
      <div className="c3d-journal-liste">
        {episodes.length === 0 && <em>Aucune anomalie pour l'instant</em>}
        {episodes.map((e) => (
          <div
            key={`${e.cle}-${e.debut}`}
            className={"c3d-journal-ligne grav-" + e.gravite + (e.resolu ? " resolu" : "")}
          >
            <i />
            <div className="c3d-journal-corps">
              <div className="c3d-journal-titre">
                {libelleAnomalie(e.type)}
                <span className="c3d-journal-scene">{noms[e.scene_id] ?? "Hors scène"}</span>
              </div>
              <div className="c3d-journal-meta">
                <span className="c3d-journal-debut">{heureTexte(e.debut)}</span>
                {e.resolu && e.resolution !== null ? (
                  <span className="c3d-journal-resolu">résolu à {heureTexte(e.resolution)}</span>
                ) : (
                  <span className="c3d-journal-encours">en cours</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
