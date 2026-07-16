import { Html, Line } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";
import { monde } from "../logique/festival";

// Bruit deterministe (aucun alea entre rendus) pour deformer le perimetre.
function pseudo(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

// Perimetre irregulier du site : polygone ferme dont le rayon varie par angle
// (site organique, non carre). Centre sur l'esplanade, en coordonnees monde.
function perimetreIrregulier(): [number, number][] {
  const [cx, cz] = monde(50, 45);
  const n = 46;
  const rayonBase = 92;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Somme de quelques harmoniques + bruit pour une bordure sinueuse mais lisse.
    const ondul =
      1 +
      0.16 * Math.sin(a * 3 + 1.7) +
      0.1 * Math.sin(a * 5 + 4.2) +
      0.06 * Math.cos(a * 8 + 0.5) +
      0.09 * (pseudo(i * 1.7) - 0.5);
    const r = rayonBase * ondul;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r * 0.86]);
  }
  return pts;
}

// Sol, enceinte irreguliere du site et portique d'entree, sur fond d'enfer.
// Le portique est cliquable : il ouvre l'analyse transport & billetterie.
export function Terrain({ onEntree }: { onEntree?: () => void }) {
  const [survoleEntree, setSurvoleEntree] = useState(false);

  const contour = useMemo(perimetreIrregulier, []);

  // Ligne d'enceinte (fermee) posee au sol.
  const ligne = useMemo(
    () => [...contour, contour[0]].map(([x, z]) => [x, 0.12, z] as [number, number, number]),
    [contour],
  );

  // Sol du site = surface pleine du polygone irregulier (Shape extrude a plat).
  const geoSol = useMemo(() => {
    const forme = new THREE.Shape();
    contour.forEach(([x, z], i) => (i === 0 ? forme.moveTo(x, z) : forme.lineTo(x, z)));
    forme.closePath();
    const g = new THREE.ShapeGeometry(forme);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [contour]);

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
      {/* Sol du site (forme organique) */}
      <mesh geometry={geoSol} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color="#2a1a12" roughness={1} metalness={0} />
      </mesh>

      {herbes.map((h, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[h.pos[0], 0.04, h.pos[1]]}>
          <circleGeometry args={[h.rayon, 28]} />
          <meshStandardMaterial color="#33200f" roughness={1} />
        </mesh>
      ))}

      {/* Enceinte lumineuse (braise) qui souligne la forme irreguliere */}
      <Line points={ligne} color="#ff6a1e" transparent opacity={0.6} lineWidth={2} />

      {/* Halo de cliquabilite, identique a celui des POI (voir POI.tsx) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ex, 0.08, ez]}>
        <circleGeometry args={[7, 40]} />
        <meshBasicMaterial
          color="#ffd24a"
          transparent
          opacity={survoleEntree ? 0.42 : 0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

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
          <div className="c3d-etiquette c3d-etiquette-entree" onClick={() => onEntree?.()}>
            <span className="c3d-poi-picto" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="6" y1="20" x2="6" y2="13" /><line x1="12" y1="20" x2="12" y2="5" />
                <line x1="18" y1="20" x2="18" y2="10" />
              </svg>
            </span>
            Entrée — Transport
            <span className="c3d-poi-chevron" aria-hidden="true">›</span>
          </div>
        </Html>
      </group>
    </group>
  );
}
