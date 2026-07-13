import { useNombreAmorti } from "../../hooks/useCreneau";
import type { EtatScene } from "../../hooks/useFestivalData";
import { fmt, heureTexte } from "../../logique/festival";
import type { Concert, LigneFlux } from "../../types/donnees";

interface Props {
  etat: EtatScene;
  delta: number;
  creneau: number;
  flux: LigneFlux[];
  noms: Record<number, string>;
  set: Concert | undefined;
  onFermer: () => void;
  onAnalyse?: () => void;
}

// Panneau de details affiche a la selection d'une scene : affluence,
// evolution vs creneau precedent, flux entrants / sortants, set en cours.
export function PanneauScene({ etat, delta, creneau, flux, noms, set, onFermer, onAnalyse }: Props) {
  const nb = useNombreAmorti(etat.nb);
  const entrants = flux.filter((f) => f.scene_destination === etat.sceneId);
  const sortants = flux.filter((f) => f.scene_origine === etat.sceneId);

  return (
    <div className="c3d-panneau">
      <div className="c3d-panneau-tete">
        <h3>{etat.nom}</h3>
        <button onClick={onFermer} aria-label="Fermer le panneau">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <div className="c3d-panneau-nombre" style={{ color: etat.couleur }}>
        {fmt(nb)}
        <span>festivaliers · {Math.round(etat.taux * 100)} % de la capacité</span>
      </div>

      <div className="c3d-panneau-lignes">
        <div>
          <span>Évolution vs créneau précédent</span>
          <b className={delta > 0 ? "hausse" : delta < 0 ? "baisse" : ""}>
            {delta > 0 ? "+" : ""}{fmt(delta)}
          </b>
        </div>
        <div>
          <span>Capacité</span>
          <b>{fmt(etat.capacite)}</b>
        </div>
        {set && (
          <div>
            <span>{set.heure_debut <= creneau ? "Sur scène" : "Prochain set"}</span>
            <b>{set.artiste} · {heureTexte(set.heure_debut)}–{heureTexte(set.heure_fin)}</b>
          </div>
        )}
      </div>

      <div className="c3d-panneau-flux">
        <div>
          <span>Flux entrants</span>
          {entrants.length === 0 && <em>aucun sur ce créneau</em>}
          {entrants.map((f, i) => (
            <div key={i} className="c3d-flux-ligne entrant">
              <i />depuis {noms[f.scene_origine]}<b>{fmt(f.nb)}</b>
            </div>
          ))}
        </div>
        <div>
          <span>Flux sortants</span>
          {sortants.length === 0 && <em>aucun sur ce créneau</em>}
          {sortants.map((f, i) => (
            <div key={i} className="c3d-flux-ligne sortant">
              <i />vers {noms[f.scene_destination]}<b>{fmt(f.nb)}</b>
            </div>
          ))}
        </div>
      </div>

      {etat.aAnomalie && (
        <div className="c3d-panneau-alerte">Anomalie détectée sur ce créneau</div>
      )}

      {onAnalyse && (
        <button className="c3d-panneau-analyse" onClick={onAnalyse}>
          Affluence &amp; prévision de la scène
        </button>
      )}
    </div>
  );
}
