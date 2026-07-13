import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useRef, useState } from "react";
import * as THREE from "three";
import { monde } from "../logique/festival";
import type { Poi } from "../types/donnees";

const PLAZA = monde(50, 40);

function Kiosque({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[3.4, 2.2, 2.4]} />
        <meshStandardMaterial color="#232a3a" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.55, 0.75]} rotation={[0.28, 0, 0]} castShadow>
        <boxGeometry args={[3.9, 0.14, 1.9]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.25, 1.25]}>
        <boxGeometry args={[2.6, 0.5, 0.18]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} />
      </mesh>
      {[-1.5, 1.5].map((px) => (
        <mesh key={px} position={[px, 1.6, 1.55]}>
          <cylinderGeometry args={[0.06, 0.06, 2.4, 6]} />
          <meshStandardMaterial color="#3a4258" />
        </mesh>
      ))}
    </group>
  );
}

function FoodTruck() {
  return (
    <group>
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[4.4, 2.3, 2.1]} />
        <meshStandardMaterial color="#8f4f1d" roughness={0.7} />
      </mesh>
      <mesh position={[2.7, 0.95, 0]} castShadow>
        <boxGeometry args={[1.3, 1.5, 2.1]} />
        <meshStandardMaterial color="#6e3d16" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.7, 1.08]}>
        <boxGeometry args={[3.2, 0.9, 0.1]} />
        <meshStandardMaterial color="#ffd9a0" emissive="#c98500" emissiveIntensity={0.9} />
      </mesh>
      {[-1.4, 1.4, 2.7].map((px, i) => (
        <mesh key={i} position={[px, 0.42, i === 2 ? 0.9 : 1.0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.3, 12]} />
          <meshStandardMaterial color="#0c0f16" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Toilettes() {
  return (
    <group>
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[3.1, 2.6, 2.2]} />
        <meshStandardMaterial color="#33291f" roughness={0.75} />
      </mesh>
      <mesh position={[0, 2.72, 0]}>
        <boxGeometry args={[3.4, 0.24, 2.5]} />
        <meshStandardMaterial color="#241109" roughness={0.8} />
      </mesh>
      {[-0.85, 0, 0.85].map((px) => (
        <mesh key={px} position={[px, 1.2, 1.12]}>
          <boxGeometry args={[0.62, 1.9, 0.08]} />
          <meshStandardMaterial color="#ffb300" emissive="#a86a00" emissiveIntensity={0.5} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Secours() {
  return (
    <group>
      <mesh position={[0, 1.05, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[2.1, 2.1, 3.6, 3, 1]} />
        <meshStandardMaterial color="#e9ebf2" roughness={0.85} />
      </mesh>
      <group position={[0, 1.7, 1.86]}>
        <mesh>
          <boxGeometry args={[1.5, 0.42, 0.1]} />
          <meshStandardMaterial color="#d03b3b" emissive="#d03b3b" emissiveIntensity={1.2} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.42, 1.5, 0.1]} />
          <meshStandardMaterial color="#d03b3b" emissive="#d03b3b" emissiveIntensity={1.2} />
        </mesh>
      </group>
    </group>
  );
}

// Objets 3D des points d'interet, orientes vers l'esplanade, cliquables
// (les stands ouvrent leur carte, comme sur la carte 2D).
export function POI({ poi, onPoi }: { poi: Poi; onPoi: (p: Poi) => void }) {
  const [x, z] = monde(poi.x, poi.y);
  const rotationY = Math.atan2(PLAZA[0] - x, PLAZA[1] - z);
  const [survole, setSurvole] = useState(false);
  const refGroupe = useRef<THREE.Group>(null);
  // Tous les POI ouvrent désormais une analyse thématique (stands → scénarios,
  // toilettes → allocation, secours → anomalies), donc tous sont cliquables.
  const cliquable = true;

  useFrame((_, dt) => {
    if (refGroupe.current) {
      easing.damp(refGroupe.current.scale, "x", survole ? 1.07 : 1, 0.2, dt);
      refGroupe.current.scale.z = refGroupe.current.scale.y = refGroupe.current.scale.x;
    }
  });

  let objet = <Kiosque accent="#ff7a18" />;
  if (poi.type === "stand_nourriture") objet = <FoodTruck />;
  if (poi.type === "toilettes") objet = <Toilettes />;
  if (poi.type === "secourisme") objet = <Secours />;

  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <group
        ref={refGroupe}
        onClick={(e) => { e.stopPropagation(); onPoi(poi); }}
        onPointerOver={(e) => { e.stopPropagation(); setSurvole(true); document.body.style.cursor = cliquable ? "pointer" : "auto"; }}
        onPointerOut={() => { setSurvole(false); document.body.style.cursor = "auto"; }}
      >
        {objet}
      </group>
      <Html position={[0, 4.1, 0]} center distanceFactor={95} zIndexRange={[15, 0]}>
        <div className="c3d-etiquette c3d-etiquette-poi">{poi.nom}</div>
      </Html>
    </group>
  );
}
