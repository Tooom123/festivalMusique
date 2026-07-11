import { useMemo } from "react";
import * as THREE from "three";
import { monde, POSITIONS } from "../logique/festival";
import { courbeEntre, geometrieRuban } from "../logique/geometrie";
import type { Poi } from "../types/donnees";

const PLAZA: [number, number] = monde(50, 40);
const ENTREE: [number, number] = monde(50, 2);

// Reseau de chemins fixes : entree -> esplanade -> scenes / points d'interet,
// plus les liaisons directes entre scenes (empruntees par les flux).
export function Paths({ pois }: { pois: Poi[] }) {
  const rubans = useMemo(() => {
    const geometries: { geo: THREE.BufferGeometry; teinte: string }[] = [];

    const principal = (a: [number, number], b: [number, number], largeur: number) =>
      geometries.push({ geo: geometrieRuban(courbeEntre(a, b, 0.05, 0.1), largeur), teinte: "#1e2534" });

    principal(ENTREE, PLAZA, 5.2);
    Object.values(POSITIONS).forEach((p) => principal(PLAZA, monde(...p), 3.4));

    const paires: [number, number][] = [
      [1, 2],
      [1, 3],
      [2, 3],
    ];
    paires.forEach(([a, b]) =>
      geometries.push({
        geo: geometrieRuban(
          courbeEntre(monde(...POSITIONS[a]), monde(...POSITIONS[b]), 0.05), 2.6),
        teinte: "#1a202d",
      }),
    );

    pois.forEach((p) =>
      geometries.push({
        geo: geometrieRuban(courbeEntre(PLAZA, monde(p.x, p.y), 0.04, 0.06), 1.3),
        teinte: "#181e2a",
      }),
    );

    return geometries;
  }, [pois]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLAZA[0], 0.04, PLAZA[1]]}>
        <circleGeometry args={[9, 36]} />
        <meshStandardMaterial color="#20283a" roughness={0.95} />
      </mesh>
      {rubans.map((r, i) => (
        <mesh key={i} geometry={r.geo} receiveShadow>
          <meshStandardMaterial color={r.teinte} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}
