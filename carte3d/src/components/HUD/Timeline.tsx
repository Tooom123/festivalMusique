import { heureTexte } from "../../logique/festival";

interface Props {
  creneaux: number[];
  idx: number;
  setIdx: (i: number) => void;
  lecture: boolean;
  basculeLecture: () => void;
}

// Timeline : pilote exactement les memes creneaux que la carte 2D
// (16 pas de 30 min, lecture automatique a 700 ms par pas).
export function Timeline({ creneaux, idx, setIdx, lecture, basculeLecture }: Props) {
  return (
    <div className="c3d-timeline">
      <button
        className="c3d-bouton-lecture"
        onClick={basculeLecture}
        aria-label={lecture ? "Mettre en pause" : "Lancer la lecture"}
      >
        {lecture ? (
          <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.52.86l10.2-6.5a1 1 0 0 0 0-1.7L9.52 4.63A1 1 0 0 0 8 5.5Z" /></svg>
        )}
      </button>
      <div className="c3d-timeline-corps">
        <div className="c3d-heure-courante">{heureTexte(creneaux[idx] ?? 0)}</div>
        <input
          type="range"
          min={0}
          max={Math.max(creneaux.length - 1, 0)}
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          aria-label="Créneau horaire"
        />
        <div className="c3d-graduations">
          {creneaux.map((c, i) => (
            <span key={c} className={i % 4 === 0 ? "visible" : ""}>
              {i % 4 === 0 ? heureTexte(c) : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
