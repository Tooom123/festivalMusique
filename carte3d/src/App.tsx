import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { FestivalScene } from "./components/FestivalScene";
import { JournalAnomalies } from "./components/HUD/JournalAnomalies";
import { Legende } from "./components/HUD/Legende";
import { PanneauScene } from "./components/HUD/PanneauScene";
import { Timeline } from "./components/HUD/Timeline";
import { useCreneau } from "./hooks/useCreneau";
import { useFestivalData } from "./hooks/useFestivalData";
import { episodesAnomalies } from "./logique/anomalies";
import { affluencePour, prochainSet } from "./logique/festival";
import type { Donnees, Poi } from "./types/donnees";

interface Props {
  donnees: Donnees;
  jour: number;
  onScene?: (sceneId: number) => void;
  onPoi?: (poi: Poi) => void;
}

// Racine de la carte 3D : etat (jour, creneau, selection), Canvas R3F et HUD.
// Les callbacks onScene / onPoi permettent a la page hote de conserver ses
// panneaux existants (programme d'une scene, carte d'un stand).
export function App({ donnees, jour, onScene, onPoi }: Props) {
  const [selection, setSelection] = useState<number | null>(null);
  const [declencheurFocus, setDeclencheurFocus] = useState(0);

  const creneauxInit = useMemo(
    () => [...new Set(donnees.affluence.filter((a) => a.jour === jour).map((a) => a.creneau))].sort((a, b) => a - b),
    [donnees, jour],
  );
  const { idx, setIdx, lecture, basculeLecture, creneau } = useCreneau(creneauxInit, jour);
  const { creneaux, scenes, flux } = useFestivalData(donnees, jour, creneau);

  const noms = useMemo(() => {
    const n: Record<number, string> = {};
    donnees.scenes.forEach((s) => { n[s.scene_id] = s.nom; });
    return n;
  }, [donnees]);

  // Episodes d'anomalies du jour (calcules une fois), puis vue au creneau
  // courant : ceux commences, avec leur statut resolu / en cours. Actifs en
  // tete, puis resolus, du plus recent au plus ancien.
  const episodesJour = useMemo(
    () => episodesAnomalies(donnees, jour, creneaux),
    [donnees, jour, creneaux],
  );
  const episodesVisibles = useMemo(
    () =>
      episodesJour
        .filter((e) => e.debut <= creneau)
        .map((e) => ({
          ...e,
          resolu: e.resolution !== null && creneau >= e.resolution,
        }))
        .sort((a, b) => Number(a.resolu) - Number(b.resolu) || b.debut - a.debut),
    [episodesJour, creneau],
  );

  const etatSelection = scenes.find((s) => s.sceneId === selection) ?? null;

  const delta = useMemo(() => {
    if (!etatSelection || idx === 0) return 0;
    const precedent = affluencePour(donnees, jour, creneaux[idx - 1]);
    return etatSelection.nb - (precedent.get(etatSelection.sceneId) ?? 0);
  }, [donnees, jour, creneaux, idx, etatSelection]);

  const set = useMemo(
    () => (etatSelection ? prochainSet(donnees, jour, etatSelection.sceneId, creneau) : undefined),
    [donnees, jour, etatSelection, creneau],
  );

  function selectionneScene(sceneId: number) {
    setSelection(sceneId);
    setDeclencheurFocus((d) => d + 1);
    onScene?.(sceneId);
  }

  return (
    <div className="c3d-conteneur">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 95, 118], fov: 38, near: 1, far: 900 }}
        onPointerMissed={() => setSelection(null)}
      >
        <color attach="background" args={["#07090f"]} />
        <fog attach="fog" args={["#07090f", 190, 460]} />
        <FestivalScene
          scenes={scenes}
          flux={flux}
          pois={donnees.pois}
          selection={selection}
          declencheurFocus={declencheurFocus}
          onScene={selectionneScene}
          onPoi={(p) => onPoi?.(p)}
        />
      </Canvas>

      <Legende />
      <JournalAnomalies
        episodes={episodesVisibles}
        creneauCourant={creneau}
        noms={noms}
      />
      <Timeline
        creneaux={creneaux}
        idx={idx}
        setIdx={setIdx}
        lecture={lecture}
        basculeLecture={basculeLecture}
      />
      {etatSelection && (
        <PanneauScene
          etat={etatSelection}
          delta={delta}
          creneau={creneau}
          flux={flux}
          noms={noms}
          set={set}
          onFermer={() => setSelection(null)}
        />
      )}
    </div>
  );
}
