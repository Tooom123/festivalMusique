import type { EditionCarte } from "../../types/donnees";

interface Props {
  editions: EditionCarte[];
  edition: number;
  jour: number;
  joursLong: Record<string, string>;
  onChangeEdition: (annee: number) => void;
  onChangeJour: (jour: number) => void;
  onEnsemble?: () => void;
}

const JOURS_COURT: Record<number, string> = { 1: "Ven.", 2: "Sam.", 3: "Dim." };

// Contrôles superposés en haut à droite de la carte : bouton "Vue d'ensemble"
// (ouvre le panneau récap dans le drawer de la page hôte), puis sélecteurs
// d'édition et de jour + badge indiquant si l'édition est réelle ou prédite.
// Ces sélecteurs vivaient dans la sidebar de l'ancien site ; la carte étant
// désormais plein écran, ils sont portés dans le HUD.
export function BarreControles({
  editions,
  edition,
  jour,
  onChangeEdition,
  onChangeJour,
  onEnsemble,
}: Props) {
  const editionCourante = editions.find((e) => e.annee === edition) ?? editions[editions.length - 1];
  const estPrediction = editionCourante.type === "prediction";

  return (
    <>
      {onEnsemble && (
        <button className="c3d-bouton-ensemble" onClick={onEnsemble}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
          </svg>
          <span>Vue d'ensemble</span>
        </button>
      )}

      <div className="c3d-selecteurs">
        <span className={"c3d-badge-edition " + (estPrediction ? "pred" : "hist")}>
          {estPrediction ? `Prédiction ${edition}` : `Réel ${edition}`}
        </span>
        <div className="segments segments-edition">
          {editions.map((e) => (
            <button
              key={e.annee}
              className={"segment" + (e.annee === edition ? " actif" : "")}
              onClick={() => onChangeEdition(e.annee)}
            >
              {e.type === "prediction" ? `${e.annee} · Préd.` : e.annee}
            </button>
          ))}
        </div>
        <div className="segments">
          {[1, 2, 3].map((j) => (
            <button
              key={j}
              className={"segment" + (j === jour ? " actif" : "")}
              onClick={() => onChangeJour(j)}
            >
              {JOURS_COURT[j]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
