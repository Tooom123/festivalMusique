import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { FestivalScene } from "./components/FestivalScene";
import { BarreControles } from "./components/HUD/BarreControles";
import { JournalAnomalies } from "./components/HUD/JournalAnomalies";
import { Legende } from "./components/HUD/Legende";
import { PanneauScene } from "./components/HUD/PanneauScene";
import { Timeline } from "./components/HUD/Timeline";
import { useCreneau } from "./hooks/useCreneau";
import { useFestivalData } from "./hooks/useFestivalData";
import { episodesAnomalies } from "./logique/anomalies";
import { affluencePour, prochainSet } from "./logique/festival";
import type { Donnees, EditionCarte, Poi } from "./types/donnees";

interface Props {
  donnees: Donnees;
  edition: number;
  jour: number;
  onScene?: (sceneId: number) => void;
  onPoi?: (poi: Poi) => void;
  onEnsemble?: () => void;
  onEntree?: () => void;
  onChangeEdition?: (annee: number) => void;
  onChangeJour?: (jour: number) => void;
}

// Racine de la carte 3D : etat (edition, jour, creneau, selection), Canvas R3F
// et HUD. Les callbacks onScene / onPoi / onEntree / onEnsemble routent vers le
// drawer d'analyse de la page hote. Les selecteurs edition/jour vivent desormais
// dans le HUD (la sidebar de l'ancien site ayant disparu).
export function App({
  donnees, edition, jour, onScene, onPoi, onEnsemble, onEntree, onChangeEdition, onChangeJour,
}: Props) {
  const [selection, setSelection] = useState<number | null>(null);
  const [declencheurFocus, setDeclencheurFocus] = useState(0);

  const editionData: EditionCarte = useMemo(
    () => donnees.editions.find((e) => e.annee === edition) ?? donnees.editions[donnees.editions.length - 1],
    [donnees, edition],
  );

  const creneauxInit = useMemo(
    () => [...new Set(editionData.affluence.filter((a) => a.jour === jour).map((a) => a.creneau))].sort((a, b) => a - b),
    [editionData, jour],
  );
  const { idx, setIdx, lecture, basculeLecture, creneau } = useCreneau(creneauxInit, jour);
  const { creneaux, scenes, flux } = useFestivalData(donnees.scenes, editionData, jour, creneau);

  const noms = useMemo(() => {
    const n: Record<number, string> = {};
    donnees.scenes.forEach((s) => { n[s.scene_id] = s.nom; });
    return n;
  }, [donnees]);

  // Episodes d'anomalies du jour (calcules une fois), puis vue au creneau
  // courant : ceux commences, avec leur statut resolu / en cours. Actifs en
  // tete, puis resolus, du plus recent au plus ancien.
  const episodesJour = useMemo(
    () => episodesAnomalies(editionData.anomalies, jour, creneaux),
    [editionData, jour, creneaux],
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
    const precedent = affluencePour(editionData.affluence, jour, creneaux[idx - 1]);
    return etatSelection.nb - (precedent.get(etatSelection.sceneId) ?? 0);
  }, [editionData, jour, creneaux, idx, etatSelection]);

  const set = useMemo(
    () => (etatSelection ? prochainSet(editionData.programmation, jour, etatSelection.sceneId, creneau) : undefined),
    [editionData, jour, etatSelection, creneau],
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
        camera={{ position: [0, 106, 132], fov: 40, near: 1, far: 900 }}
        onPointerMissed={() => setSelection(null)}
      >
        <color attach="background" args={["#0a0505"]} />
        <fog attach="fog" args={["#140a08", 190, 460]} />
        <FestivalScene
          scenes={scenes}
          flux={flux}
          pois={donnees.pois}
          selection={selection}
          declencheurFocus={declencheurFocus}
          onScene={selectionneScene}
          onPoi={(p) => onPoi?.(p)}
          onEntree={onEntree}
        />
      </Canvas>

      <BarreControles
        editions={donnees.editions}
        edition={edition}
        jour={jour}
        joursLong={donnees.jours_long}
        onChangeEdition={(a) => onChangeEdition?.(a)}
        onChangeJour={(j) => onChangeJour?.(j)}
        onEnsemble={onEnsemble}
      />
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
          onAnalyse={() => onScene?.(etatSelection.sceneId)}
        />
      )}
    </div>
  );
}
