import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Props {
  cible: [number, number] | null;
  declencheur: number;
}

// Navigation type carte 3D : rotation (clic gauche), pan (clic droit),
// zoom molette / pincement, inclinaison bornee pour ne jamais passer sous le
// sol. La selection d'une scene recentre la camera en douceur (interrompu des
// que l'utilisateur reprend la main).
export function CameraRig({ cible, declencheur }: Props) {
  const refControles = useRef<any>(null);
  const finRecentrage = useRef(0);
  const { camera } = useThree();
  const direction = useRef(new THREE.Vector3());

  useEffect(() => {
    if (cible) finRecentrage.current = performance.now() + 1500;
  }, [cible, declencheur]);

  useFrame((_, dt) => {
    const controles = refControles.current;
    if (!controles) return;
    if (cible && performance.now() < finRecentrage.current) {
      easing.damp3(controles.target, [cible[0], 2.5, cible[1]], 0.45, dt);
      direction.current.subVectors(camera.position, controles.target).setY(0);
      if (direction.current.lengthSq() < 1) direction.current.set(0, 0, 1);
      direction.current.normalize();
      easing.damp3(
        camera.position,
        [
          cible[0] + direction.current.x * 52,
          Math.max(30, Math.min(camera.position.y, 55)),
          cible[1] + direction.current.z * 52,
        ],
        0.6,
        dt,
      );
    }
    controles.update();
  });

  return (
    <OrbitControls
      ref={refControles}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      minDistance={26}
      maxDistance={240}
      minPolarAngle={0.12}
      maxPolarAngle={1.32}
      target={[0, 0, 4]}
      onStart={() => { finRecentrage.current = 0; }}
    />
  );
}
