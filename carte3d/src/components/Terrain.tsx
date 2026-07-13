import { Html, Line } from "@react-three/drei";
import { useMemo, useState } from "react";
import { monde } from "../logique/festival";

// Sol, enceinte du site et portique d'entree. Style sombre type carte de nuit.
// Le portique est cliquable : il ouvre l'analyse transport & billetterie.
export function Terrain({ onEntree }: { onEntree?: () => void }) {
  const [survoleEntree, setSurvoleEntree] = useState(false);
  const coins = useMemo(() => {
    const c = [monde(-3, -1), monde(103, -1), monde(103, 95), monde(-3, 95), monde(-3, -1)];
    return c.map(([x, z]) => [x, 0.06, z] as [number, number, number]);
  }, []);

  const [ex, ez] = monde(50, 2);

  const herbes = useMemo(
    () => [
      { pos: [-46, -38] as const, rayon: 17 },
      { pos: [47, -42] as const, rayon: 14 },
      { pos: [-50, 34] as const, rayon: 12 },
      { pos: [52, 30] as const, rayon: 15 },
      { pos: [4, -52] as const, rayon: 11 },
    ],
    [],
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]} receiveShadow>
        <planeGeometry args={[250, 230]} />
        <meshStandardMaterial color="#0d1119" roughness={1} metalness={0} />
      </mesh>

      {herbes.map((h, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[h.pos[0], 0.02, h.pos[1]]}>
          <circleGeometry args={[h.rayon, 28]} />
          <meshStandardMaterial color="#101a14" roughness={1} />
        </mesh>
      ))}

      <Line points={coins} color="#7a4a30" transparent opacity={0.4} lineWidth={1.5} />

      <group
        position={[ex, 0, ez]}
        onClick={(e) => { e.stopPropagation(); onEntree?.(); }}
        onPointerOver={(e) => { e.stopPropagation(); setSurvoleEntree(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setSurvoleEntree(false); document.body.style.cursor = "auto"; }}
      >
        {[-5, 5].map((dx) => (
          <mesh key={dx} position={[dx, 2.6, 0]} castShadow>
            <boxGeometry args={[0.7, 5.2, 0.7]} />
            <meshStandardMaterial color="#241109" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 5.4, 0]}>
          <boxGeometry args={[11.4, 0.9, 0.9]} />
          <meshStandardMaterial
            color="#ff7a18"
            emissive="#ff5a12"
            emissiveIntensity={survoleEntree ? 2.4 : 1.6}
            roughness={0.4}
          />
        </mesh>
        <Html position={[0, 7.2, 0]} center distanceFactor={90} zIndexRange={[10, 0]}>
          <div className="c3d-etiquette c3d-etiquette-entree">Entrée · transport</div>
        </Html>
      </group>
    </group>
  );
}
