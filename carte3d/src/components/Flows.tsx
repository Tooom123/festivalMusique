import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { largeurFlux, monde, POSITIONS } from "../logique/festival";
import { courbeEntre, geometrieRuban, textureDefilante } from "../logique/geometrie";
import type { LigneFlux } from "../types/donnees";
import { Visitors } from "./Visitors";

// Flux de foule entre scenes : ruban lumineux defilant (sens du deplacement)
// + marcheurs. Largeur = meme formule que la carte 2D. Trois emplacements
// stables pour des transitions douces entre creneaux.
function FluxAnime({ flux, slot }: { flux: LigneFlux | null; slot: number }) {
  const refMat = useRef<THREE.MeshBasicMaterial>(null);
  const texture = useMemo(() => textureDefilante(), []);
  const dernier = useRef<LigneFlux | null>(null);
  if (flux) dernier.current = flux;
  const actif = dernier.current;

  const cle = actif ? `${actif.scene_origine}-${actif.scene_destination}` : "aucun";

  const { geometrie, courbe } = useMemo(() => {
    if (!actif) return { geometrie: null, courbe: null };
    const c = courbeEntre(
      monde(...POSITIONS[actif.scene_origine]),
      monde(...POSITIONS[actif.scene_destination]),
      0.22,
    );
    return { geometrie: geometrieRuban(c, largeurFlux(actif.nb)), courbe: c };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, actif?.nb]);

  useEffect(() => {
    if (refMat.current) refMat.current.opacity = 0;
  }, [cle]);

  useFrame((_, dt) => {
    if (!refMat.current) return;
    easing.damp(refMat.current, "opacity", flux ? 0.5 : 0, 0.45, dt);
    texture.offset.x -= dt * (0.3 + (actif?.nb ?? 0) / 1200);
  });

  if (!geometrie || !courbe || !actif) return null;

  return (
    <group>
      <mesh geometry={geometrie}>
        <meshBasicMaterial
          ref={refMat}
          map={texture}
          color="#ffb060"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Visitors
        courbe={courbe}
        nombre={flux ? Math.min(Math.ceil(flux.nb / 15), 110) : 0}
        vitesse={0.05}
        dispersion={Math.max(largeurFlux(actif.nb) * 0.34, 0.5)}
        maximum={110}
        graine={slot * 4099 + 17}
      />
    </group>
  );
}

export function Flows({ flux }: { flux: LigneFlux[] }) {
  const tries = useMemo(() => [...flux].sort((a, b) => b.nb - a.nb), [flux]);
  return (
    <group>
      {[0, 1, 2].map((slot) => (
        <FluxAnime key={slot} slot={slot} flux={tries[slot] ?? null} />
      ))}
    </group>
  );
}
