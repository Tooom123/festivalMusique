import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Bruit deterministe partage (memes valeurs a chaque rendu).
function pseudo(n: number): number {
  const s = Math.sin(n * 91.7) * 47758.13;
  return s - Math.floor(s);
}

// Ambiance infernale AUTOUR du site : vaste sol de lave sombre, mares de magma
// incandescentes, failles rougeoyantes et colonnes de feu lointaines qui
// pulsent. Purement decoratif (aucune interaction, aucune logique metier).
export function Enfer() {
  const refMares = useRef<THREE.Group>(null);
  const refColonnes = useRef<THREE.Group>(null);

  // Mares de magma disposees en large couronne autour du site (bien au-dela
  // du perimetre, ~92) pour rester un decor de fond et ne pas gener la lecture.
  const mares = Array.from({ length: 30 }, (_, i) => {
    const a = (i / 30) * Math.PI * 2 + pseudo(i) * 0.25;
    const r = 165 + pseudo(i * 3.3) * 120;
    return {
      x: Math.cos(a) * r,
      z: Math.sin(a) * r * 0.9,
      taille: 5 + pseudo(i * 5.1) * 11,
      phase: pseudo(i * 7.7) * Math.PI * 2,
    };
  });

  // Colonnes de feu lointaines (piliers incandescents a l'horizon).
  const colonnes = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + pseudo(i * 2.2) * 0.4;
    const r = 210 + pseudo(i * 4.4) * 80;
    return {
      x: Math.cos(a) * r,
      z: Math.sin(a) * r * 0.9,
      h: 24 + pseudo(i * 6.6) * 40,
      phase: pseudo(i * 9.9) * Math.PI * 2,
    };
  });

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (refMares.current) {
      refMares.current.children.forEach((m, i) => {
        const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.1 + 0.6 * Math.sin(t * 1.3 + mares[i].phase);
      });
    }
    if (refColonnes.current) {
      refColonnes.current.children.forEach((c, i) => {
        const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.6 + 0.9 * Math.sin(t * 2 + colonnes[i].phase);
        c.scale.y = 1 + 0.12 * Math.sin(t * 1.7 + colonnes[i].phase);
      });
    }
  });

  return (
    <group>
      {/* Immense sol de lave refroidie, tres sombre, sous et autour du site */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#1a0805" roughness={1} />
      </mesh>

      {/* Anneau de magma diffus sous l'horizon (lueur rouge globale) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <ringGeometry args={[135, 420, 64]} />
        <meshBasicMaterial
          color="#5a1206"
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Mares de magma incandescentes */}
      <group ref={refMares}>
        {mares.map((m, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[m.x, -0.35, m.z]}>
            <circleGeometry args={[m.taille, 26]} />
            <meshStandardMaterial
              color="#ff5a12"
              emissive="#ff3a08"
              emissiveIntensity={1.3}
              roughness={0.5}
            />
          </mesh>
        ))}
      </group>

      {/* Colonnes de feu lointaines */}
      <group ref={refColonnes}>
        {colonnes.map((c, i) => (
          <mesh key={i} position={[c.x, c.h / 2, c.z]}>
            <cylinderGeometry args={[2.4, 5.5, c.h, 8, 1, true]} />
            <meshStandardMaterial
              color="#ff6a12"
              emissive="#ff3606"
              emissiveIntensity={1.8}
              transparent
              opacity={0.82}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Lueur rouge diffuse qui teinte toute l'ambiance depuis le sol */}
      <pointLight position={[0, 8, -140]} color="#ff3a10" intensity={2.4} distance={520} decay={1.4} />
      <pointLight position={[-160, 6, 60]} color="#ff5010" intensity={1.6} distance={420} decay={1.5} />
      <pointLight position={[160, 6, 60]} color="#ff5010" intensity={1.6} distance={420} decay={1.5} />
    </group>
  );
}
