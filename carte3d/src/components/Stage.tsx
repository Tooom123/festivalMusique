import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useNombreAmorti } from "../hooks/useCreneau";
import type { EtatScene } from "../hooks/useFestivalData";
import { COULEURS_SCENES, fmt, monde, rayonFoule } from "../logique/festival";

const PLAZA = monde(50, 40);

interface Props {
  etat: EtatScene;
  selectionnee: boolean;
  onSelect: (sceneId: number) => void;
}

// Une scene du festival : plateforme, mur ecran, toit, enceintes, faisceaux.
// L'affluence pilote le halo au sol (rayon + couleur statut) et la luminosite
// de l'ecran ; l'identite de la scene garde sa couleur de palette.
export function Stage({ etat, selectionnee, onSelect }: Props) {
  const [x, z] = etat.position;
  const teinte = COULEURS_SCENES[etat.sceneId];
  const rotationY = Math.atan2(PLAZA[0] - x, PLAZA[1] - z);

  const refHalo = useRef<THREE.Mesh>(null);
  const refMatHalo = useRef<THREE.MeshStandardMaterial>(null);
  const refEcran = useRef<THREE.MeshStandardMaterial>(null);
  const refFaisceaux = useRef<THREE.Group>(null);
  const refAnomalie = useRef<THREE.Mesh>(null);
  const [survolee, setSurvolee] = useState(false);

  const couleurCible = useMemo(() => new THREE.Color(etat.couleur), [etat.couleur]);
  const nbAffiche = useNombreAmorti(etat.nb);

  useFrame((s, dt) => {
    const rayonCible = rayonFoule(etat.nb) + 3;
    if (refHalo.current) {
      easing.damp(refHalo.current.scale, "x", rayonCible, 0.4, dt);
      easing.damp(refHalo.current.scale, "y", rayonCible, 0.4, dt);
      const pulsation = etat.taux >= 1 ? 1 + 0.05 * Math.sin(s.clock.elapsedTime * 5) : 1;
      refHalo.current.scale.x *= pulsation;
      refHalo.current.scale.y *= pulsation;
    }
    if (refMatHalo.current) {
      easing.dampC(refMatHalo.current.color, couleurCible, 0.35, dt);
      easing.dampC(refMatHalo.current.emissive, couleurCible, 0.35, dt);
    }
    if (refEcran.current) {
      easing.damp(refEcran.current, "emissiveIntensity", 0.9 + etat.taux * 1.1, 0.4, dt);
    }
    if (refFaisceaux.current) {
      refFaisceaux.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.45) * 0.5;
    }
    if (refAnomalie.current) {
      const k = 1 + 0.18 * Math.sin(s.clock.elapsedTime * 6);
      refAnomalie.current.scale.setScalar(k);
      refAnomalie.current.rotation.y += dt * 1.6;
    }
  });

  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <mesh ref={refHalo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 3]}>
        <ringGeometry args={[0.85, 1, 48]} />
        <meshStandardMaterial
          ref={refMatHalo}
          color={etat.couleur}
          emissive={etat.couleur}
          emissiveIntensity={1.9}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group
        onClick={(e) => { e.stopPropagation(); onSelect(etat.sceneId); }}
        onDoubleClick={(e) => { e.stopPropagation(); onSelect(etat.sceneId); }}
        onPointerOver={(e) => { e.stopPropagation(); setSurvolee(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setSurvolee(false); document.body.style.cursor = "auto"; }}
      >
        <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[18, 1.4, 11]} />
          <meshStandardMaterial color={survolee || selectionnee ? "#242c40" : "#1a2030"} roughness={0.85} />
        </mesh>

        <mesh position={[0, 5.9, -4.6]} castShadow>
          <boxGeometry args={[17, 9, 0.8]} />
          <meshStandardMaterial color="#12161f" roughness={0.8} />
        </mesh>

        <mesh position={[0, 6.1, -4.1]}>
          <planeGeometry args={[13.5, 5.4]} />
          <meshStandardMaterial
            ref={refEcran}
            color="#0a0d14"
            emissive={teinte}
            emissiveIntensity={1.2}
            roughness={0.35}
          />
        </mesh>

        {[[-8.4, 5.2], [8.4, 5.2], [-8.4, -4.4], [8.4, -4.4]].map(([px, pz], i) => (
          <mesh key={i} position={[px, 5.7, pz]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 10, 8]} />
            <meshStandardMaterial color="#2a3145" roughness={0.6} metalness={0.4} />
          </mesh>
        ))}

        <mesh position={[0, 11, 0.4]} rotation={[-0.05, 0, 0]} castShadow>
          <boxGeometry args={[19.4, 0.7, 12.6]} />
          <meshStandardMaterial color="#151a26" roughness={0.8} />
        </mesh>

        <mesh position={[0, 10.6, 6.4]}>
          <boxGeometry args={[19.4, 0.28, 0.28]} />
          <meshStandardMaterial color={teinte} emissive={teinte} emissiveIntensity={2.4} />
        </mesh>

        {[-8.2, 8.2].map((px) => (
          <mesh key={px} position={[px, 3.6, 2.2]} castShadow>
            <boxGeometry args={[1.7, 4.4, 1.7]} />
            <meshStandardMaterial color="#0f1320" roughness={0.9} />
          </mesh>
        ))}
      </group>

      <group ref={refFaisceaux} position={[0, 10.4, 0.5]}>
        {[-4.5, 4.5].map((px) => (
          <mesh key={px} position={[px, -4.6, 2.4]} rotation={[0.5, 0, px > 0 ? -0.28 : 0.28]}>
            <coneGeometry args={[2.6, 13, 20, 1, true]} />
            <meshBasicMaterial
              color={teinte}
              transparent
              opacity={0.05 + etat.taux * 0.09}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {etat.aAnomalie && (
        <mesh ref={refAnomalie} position={[0, 15.6, 0]}>
          <coneGeometry args={[1.5, 2.6, 4]} />
          <meshStandardMaterial color="#d03b3b" emissive="#d03b3b" emissiveIntensity={2.6} />
        </mesh>
      )}

      <Html position={[0, 13.6, 0]} center distanceFactor={110} zIndexRange={[20, 0]}>
        <div
          className={"c3d-etiquette c3d-etiquette-scene" + (selectionnee ? " active" : "")}
          onClick={() => onSelect(etat.sceneId)}
        >
          <div className="c3d-scene-haut">
            <span className="c3d-nom">{etat.nom}</span>
            <span className="c3d-nombre" style={{ color: etat.couleur }}>
              {fmt(nbAffiche)}
            </span>
          </div>
          {etat.artiste && <div className="c3d-scene-artiste">{etat.artiste}</div>}
        </div>
      </Html>
    </group>
  );
}
