import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Bruit deterministe partage (memes valeurs a chaque rendu).
function pseudo(n: number): number {
  const s = Math.sin(n * 91.7) * 47758.13;
  return s - Math.floor(s);
}

// Texture de flamme (degrade radial chaud a alpha) generee une fois au chargement.
function textureFlamme(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 40, 2, 32, 38, 30);
  grad.addColorStop(0, "rgba(255,240,180,1)");
  grad.addColorStop(0.35, "rgba(255,150,30,0.95)");
  grad.addColorStop(0.7, "rgba(220,40,10,0.55)");
  grad.addColorStop(1, "rgba(120,10,0,0)");
  g.fillStyle = grad;
  // Forme de flamme : goutte pointant vers le haut.
  g.beginPath();
  g.moveTo(32, 4);
  g.bezierCurveTo(52, 26, 52, 52, 32, 60);
  g.bezierCurveTo(12, 52, 12, 26, 32, 4);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

interface Flamme {
  x: number;
  z: number;
  base: number;
  phase: number;
  vitesse: number;
}

// Nappe de flammes qui montent, vacillent et retombent en boucle. Chaque flamme
// est un plan additif texture, oriente vers la camera (billboard sur Y).
function Flammes({ flammes }: { flammes: Flamme[] }) {
  const ref = useRef<THREE.Group>(null);
  const texture = useMemo(textureFlamme, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const cam = state.camera;
    if (!ref.current) return;
    ref.current.children.forEach((enfant, i) => {
      const f = flammes[i];
      const cycle = (t * f.vitesse + f.phase) % 1; // 0 -> 1 : naissance -> extinction
      const m = enfant as THREE.Mesh;
      // Montee + retombee, vacillement horizontal.
      m.position.y = f.base + cycle * (7 + f.phase * 3);
      m.position.x = f.x + Math.sin(t * 5 + f.phase * 9) * 0.6;
      m.position.z = f.z + Math.cos(t * 4 + f.phase * 7) * 0.6;
      // Taille : gonfle puis s'eteint.
      const s = (0.5 + 2.4 * Math.sin(cycle * Math.PI)) * (0.8 + f.phase * 0.5);
      m.scale.set(s, s * 1.7, s);
      // Billboard : face a la camera mais reste vertical.
      m.rotation.y = Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.sin(cycle * Math.PI) * 0.9;
    });
  });

  return (
    <group ref={ref}>
      {flammes.map((f, i) => (
        <mesh key={i} position={[f.x, f.base, f.z]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={texture}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

// Ambiance infernale AUTOUR du site : sol de lave sombre, mares de magma,
// FLAMMES vivantes, pics rocheux menacants et colonnes de feu lointaines.
// Purement decoratif (aucune interaction, aucune logique metier).
export function Enfer() {
  const refMares = useRef<THREE.Group>(null);
  const refColonnes = useRef<THREE.Group>(null);

  // Mares de magma en large couronne autour du site.
  const mares = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const a = (i / 30) * Math.PI * 2 + pseudo(i) * 0.25;
        const r = 165 + pseudo(i * 3.3) * 120;
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r * 0.9,
          taille: 5 + pseudo(i * 5.1) * 11,
          phase: pseudo(i * 7.7) * Math.PI * 2,
        };
      }),
    [],
  );

  // Flammes reparties sur deux anneaux : proche (autour du perimetre) et lointain
  // (sur les mares de magma). Beaucoup de petites langues de feu = mur de flammes.
  const flammes = useMemo<Flamme[]>(() => {
    const out: Flamme[] = [];
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + pseudo(i * 1.3) * 0.5;
      const proche = pseudo(i * 2.9) > 0.4;
      const r = proche ? 112 + pseudo(i) * 26 : 165 + pseudo(i * 3.3) * 110;
      out.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r * 0.9,
        base: -0.2,
        phase: pseudo(i * 4.1),
        vitesse: 0.5 + pseudo(i * 6.2) * 0.7,
      });
    }
    return out;
  }, []);

  // Pics rocheux noirs, dechiquetes, plantes autour du site : silhouette evil.
  const pics = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const a = (i / 26) * Math.PI * 2 + pseudo(i * 3.1) * 0.4;
        const r = 118 + pseudo(i * 5.5) * 55;
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r * 0.9,
          h: 10 + pseudo(i * 8.2) * 26,
          large: 2.5 + pseudo(i * 2.6) * 4,
          incline: (pseudo(i * 9.1) - 0.5) * 0.5,
        };
      }),
    [],
  );

  // Colonnes de feu lointaines (piliers incandescents a l'horizon).
  const colonnes = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 + pseudo(i * 2.2) * 0.4;
        const r = 230 + pseudo(i * 4.4) * 90;
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r * 0.9,
          h: 24 + pseudo(i * 6.6) * 40,
          phase: pseudo(i * 9.9) * Math.PI * 2,
        };
      }),
    [],
  );

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
      {/* Immense sol de lave refroidie, tres sombre */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#160604" roughness={1} />
      </mesh>

      {/* Anneau de magma diffus (lueur rouge globale sous l'horizon) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <ringGeometry args={[110, 440, 64]} />
        <meshBasicMaterial
          color="#6a1206"
          transparent
          opacity={0.6}
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
            <meshStandardMaterial color="#ff5a12" emissive="#ff3a08" emissiveIntensity={1.3} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* Pics rocheux dechiquetes (silhouette menacante) */}
      {pics.map((p, i) => (
        <mesh
          key={i}
          position={[p.x, p.h / 2 - 0.4, p.z]}
          rotation={[p.incline, i, p.incline]}
          castShadow
        >
          <coneGeometry args={[p.large, p.h, 5, 1]} />
          <meshStandardMaterial color="#0e0503" roughness={1} />
        </mesh>
      ))}

      {/* Mur de flammes vivantes */}
      <Flammes flammes={flammes} />

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

      {/* Lueurs rouges diffuses qui teintent toute la scene (flammes) */}
      <pointLight position={[0, 8, -140]} color="#ff3a10" intensity={2.6} distance={520} decay={1.4} />
      <pointLight position={[-150, 5, 40]} color="#ff5010" intensity={2} distance={430} decay={1.5} />
      <pointLight position={[150, 5, 40]} color="#ff5010" intensity={2} distance={430} decay={1.5} />
      <pointLight position={[0, 5, 150]} color="#ff4410" intensity={1.8} distance={430} decay={1.5} />
    </group>
  );
}
