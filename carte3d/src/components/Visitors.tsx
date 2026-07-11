import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { aleatoire } from "../logique/geometrie";

const TEINTES = ["#d7dbe8", "#a7afc4", "#7d879f", "#c2cadd"];

interface Props {
  courbe: THREE.Curve<THREE.Vector3>;
  nombre: number;
  vitesse: number;
  dispersion: number;
  maximum: number;
  graine: number;
}

// Petits marcheurs instancies qui suivent une courbe (chemins et flux).
// Le sens de deplacement rend la direction du flux immediatement lisible.
export function Visitors({ courbe, nombre, vitesse, dispersion, maximum, graine }: Props) {
  const refMesh = useRef<THREE.InstancedMesh>(null);
  const matrice = useMemo(() => new THREE.Matrix4(), []);
  const compteur = useRef(0);
  const couleursFaites = useRef(false);

  const marcheurs = useMemo(() => {
    const alea = aleatoire(graine);
    return Array.from({ length: maximum }, () => ({
      t: alea(),
      ecart: (alea() - 0.5) * 2,
      allure: 0.75 + alea() * 0.6,
      taille: 0.8 + alea() * 0.4,
    }));
  }, [graine, maximum]);

  const point = useMemo(() => new THREE.Vector3(), []);
  const suivant = useMemo(() => new THREE.Vector3(), []);
  const perpendiculaire = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const mesh = refMesh.current;
    if (!mesh) return;

    if (!couleursFaites.current) {
      const c = new THREE.Color();
      for (let i = 0; i < maximum; i++) {
        c.set(TEINTES[i % TEINTES.length]);
        mesh.setColorAt(i, c);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      couleursFaites.current = true;
    }

    const etat = { n: compteur.current };
    easing.damp(etat, "n", Math.min(nombre, maximum), 0.5, dt);
    compteur.current = etat.n;
    const visibles = Math.round(etat.n);

    for (let i = 0; i < maximum; i++) {
      const m = marcheurs[i];
      if (i < visibles) {
        m.t = (m.t + dt * vitesse * m.allure) % 1;
        courbe.getPointAt(m.t, point);
        courbe.getPointAt(Math.min(m.t + 0.01, 1), suivant);
        perpendiculaire.subVectors(suivant, point).setY(0).normalize();
        perpendiculaire.set(-perpendiculaire.z, 0, perpendiculaire.x);
        const px = point.x + perpendiculaire.x * m.ecart * dispersion;
        const pz = point.z + perpendiculaire.z * m.ecart * dispersion;
        matrice.makeScale(m.taille, m.taille, m.taille);
        matrice.setPosition(px, 0.42 * m.taille, pz);
      } else {
        matrice.makeScale(0, 0, 0);
      }
      mesh.setMatrixAt(i, matrice);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={refMesh} args={[undefined, undefined, maximum]} frustumCulled={false}>
      <capsuleGeometry args={[0.2, 0.45, 2, 6]} />
      <meshStandardMaterial roughness={0.85} />
    </instancedMesh>
  );
}
