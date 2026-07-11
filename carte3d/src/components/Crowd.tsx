import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { EtatScene } from "../hooks/useFestivalData";
import { monde, rayonFoule } from "../logique/festival";
import { aleatoire } from "../logique/geometrie";

const PLAZA = monde(50, 40);
const MAX_PAR_SCENE = 1000;
const TEINTES = ["#cfd3e0", "#9aa2b8", "#6e7890", "#b9c2d6", "#8891ab"];

// La foule devant chaque scene : un point par ~22 festivaliers (InstancedMesh).
// Le nombre et l'etalement suivent l'affluence reelle, la disposition est
// deterministe pour rester stable d'un creneau a l'autre.
export function Crowd({ scenes }: { scenes: EtatScene[] }) {
  const refMesh = useRef<THREE.InstancedMesh>(null);
  const matrice = useMemo(() => new THREE.Matrix4(), []);

  const disposition = useMemo(() => {
    return scenes.map((s) => {
      const alea = aleatoire(s.sceneId * 977);
      const points = Array.from({ length: MAX_PAR_SCENE }, () => {
        const r = Math.sqrt(alea());
        const angle = alea() * Math.PI * 2;
        return {
          u: r * Math.cos(angle),
          v: r * Math.sin(angle),
          taille: 0.75 + alea() * 0.5,
        };
      }).sort((a, b) => a.u * a.u + a.v * a.v - (b.u * b.u + b.v * b.v));

      const dir = new THREE.Vector2(PLAZA[0] - s.position[0], PLAZA[1] - s.position[1]).normalize();
      const lateral = new THREE.Vector2(-dir.y, dir.x);
      return { points, dir, lateral };
    });
  }, [scenes.map((s) => s.sceneId).join(",")]);

  const compteurs = useRef(scenes.map(() => 0));
  const couleursFaites = useRef(false);

  useFrame((_, dt) => {
    const mesh = refMesh.current;
    if (!mesh) return;

    if (!couleursFaites.current) {
      const couleur = new THREE.Color();
      for (let i = 0; i < MAX_PAR_SCENE * scenes.length; i++) {
        couleur.set(TEINTES[i % TEINTES.length]);
        mesh.setColorAt(i, couleur);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      couleursFaites.current = true;
    }

    scenes.forEach((s, si) => {
      const cible = Math.min(Math.round(s.nb / 22), MAX_PAR_SCENE);
      const etatCompteur = { n: compteurs.current[si] };
      easing.damp(etatCompteur, "n", cible, 0.5, dt);
      compteurs.current[si] = etatCompteur.n;

      const visibles = Math.round(etatCompteur.n);
      const rayon = rayonFoule(s.nb);
      const d = disposition[si];
      const cx = s.position[0] + d.dir.x * (rayon * 0.62 + 7);
      const cz = s.position[1] + d.dir.y * (rayon * 0.62 + 7);

      for (let i = 0; i < MAX_PAR_SCENE; i++) {
        const idx = si * MAX_PAR_SCENE + i;
        if (i < visibles) {
          const p = d.points[i];
          const px = cx + d.lateral.x * p.u * rayon + d.dir.x * p.v * rayon * 0.72;
          const pz = cz + d.lateral.y * p.u * rayon + d.dir.y * p.v * rayon * 0.72;
          matrice.makeScale(p.taille, p.taille, p.taille);
          matrice.setPosition(px, 0.34 * p.taille, pz);
        } else {
          matrice.makeScale(0, 0, 0);
        }
        mesh.setMatrixAt(idx, matrice);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={refMesh}
      args={[undefined, undefined, MAX_PAR_SCENE * scenes.length]}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.32, 6, 5]} />
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  );
}
