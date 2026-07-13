import { useMemo } from "react";
import type { EtatScene } from "../hooks/useFestivalData";
import { monde } from "../logique/festival";
import { courbeEntre } from "../logique/geometrie";
import type { LigneFlux, Poi } from "../types/donnees";
import { CameraRig } from "./CameraRig";
import { Crowd } from "./Crowd";
import { Effects } from "./Effects";
import { Enfer } from "./Enfer";
import { Flows } from "./Flows";
import { Installations } from "./Installations";
import { Lights } from "./Lights";
import { Paths } from "./Paths";
import { POI } from "./POI";
import { Stage } from "./Stage";
import { Terrain } from "./Terrain";
import { Visitors } from "./Visitors";

interface Props {
  scenes: EtatScene[];
  flux: LigneFlux[];
  pois: Poi[];
  selection: number | null;
  declencheurFocus: number;
  onScene: (sceneId: number) => void;
  onPoi: (poi: Poi) => void;
  onEntree?: () => void;
}

// Assemblage de la scene 3D complete. Les etats (affluence, flux, anomalies)
// arrivent deja calcules par useFestivalData : ce composant ne fait que
// les afficher.
export function FestivalScene({ scenes, flux, pois, selection, declencheurFocus, onScene, onPoi, onEntree }: Props) {
  const courbeEntree = useMemo(
    () => courbeEntre(monde(50, 2), monde(50, 40), 0.12, 0),
    [],
  );

  const totalPresents = scenes.reduce((s, e) => s + e.nb, 0);
  const cibleFocus = useMemo<[number, number] | null>(() => {
    const s = scenes.find((e) => e.sceneId === selection);
    return s ? s.position : null;
  }, [scenes, selection]);

  return (
    <group>
      <Lights />
      <Enfer />
      <Terrain onEntree={onEntree} />
      <Paths pois={pois} />
      <Installations />

      {scenes.map((s) => (
        <Stage
          key={s.sceneId}
          etat={s}
          selectionnee={selection === s.sceneId}
          onSelect={onScene}
        />
      ))}

      <Crowd scenes={scenes} />
      <Flows flux={flux} />

      <Visitors
        courbe={courbeEntree}
        nombre={Math.min(Math.round(totalPresents / 400), 70)}
        vitesse={0.045}
        dispersion={1.8}
        maximum={70}
        graine={91}
      />

      {pois.map((p) => (
        <POI key={p.poi_id} poi={p} onPoi={onPoi} />
      ))}

      <CameraRig cible={cibleFocus} declencheur={declencheurFocus} />
      <Effects />
    </group>
  );
}
