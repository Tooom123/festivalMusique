import { Html } from "@react-three/drei";
import { useMemo, type ReactNode } from "react";
import { monde } from "../logique/festival";
import {
  RESTAURATION,
  SANITAIRES,
  SECOURS,
  SECURITE,
  ZONES,
  type Installation,
} from "../logique/installations";

const PLAZA = monde(50, 40);

// Rotation Y pour orienter un objet vers l'esplanade (comme les POI nommes).
function versPlaza(x: number, z: number): number {
  return Math.atan2(PLAZA[0] - x, PLAZA[1] - z);
}

// Petit stand de restauration : caisson + auvent colore. Alterne nourriture / boisson.
function Stand({ boisson }: { boisson: boolean }) {
  const accent = boisson ? "#3987e5" : "#c98500";
  return (
    <group>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[2.6, 1.8, 1.9]} />
        <meshStandardMaterial color="#232a3a" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.05, 0.6]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[3, 0.12, 1.5]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.0, 1.0]}>
        <boxGeometry args={[2, 0.4, 0.12]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

// Bloc sanitaire : cabine haute et etroite, bandeau bleu, portes.
function BlocSanitaire() {
  return (
    <group>
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[2.2, 2.1, 1.7]} />
        <meshStandardMaterial color="#2b5a94" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.18, 0]}>
        <boxGeometry args={[2.45, 0.18, 1.95]} />
        <meshStandardMaterial color="#1c3d66" roughness={0.85} />
      </mesh>
      {[-0.55, 0.55].map((px) => (
        <mesh key={px} position={[px, 0.95, 0.87]}>
          <boxGeometry args={[0.5, 1.5, 0.06]} />
          <meshStandardMaterial color="#6da7ec" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// Poste de secours : tente claire + croix rouge lumineuse.
function PosteSecours() {
  return (
    <group>
      <mesh position={[0, 1.0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[1.8, 1.8, 3.1, 3, 1]} />
        <meshStandardMaterial color="#e9ebf2" roughness={0.85} />
      </mesh>
      <group position={[0, 1.55, 1.6]}>
        <mesh>
          <boxGeometry args={[1.2, 0.34, 0.1]} />
          <meshStandardMaterial color="#d03b3b" emissive="#d03b3b" emissiveIntensity={1.2} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.34, 1.2, 0.1]} />
          <meshStandardMaterial color="#d03b3b" emissive="#d03b3b" emissiveIntensity={1.2} />
        </mesh>
      </group>
    </group>
  );
}

// Poste de securite : petite guerite sombre + bandeau lumineux.
function PosteSecurite() {
  return (
    <group>
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[1.5, 1.7, 1.5]} />
        <meshStandardMaterial color="#1c2333" roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <boxGeometry args={[1.7, 0.16, 1.7]} />
        <meshStandardMaterial color="#4f7cff" emissive="#4f7cff" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

// Place une liste d'installations 2D (x, y en 0-100) orientees vers l'esplanade.
function Groupe({ items, rendu }: { items: Installation[]; rendu: (i: number) => ReactNode }) {
  const places = useMemo(
    () => items.map((it) => {
      const [x, z] = monde(it.x, it.y);
      return { x, z, rot: versPlaza(x, z) };
    }),
    [items],
  );
  return (
    <group>
      {places.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]}>
          {rendu(i)}
        </group>
      ))}
    </group>
  );
}

// Toutes les installations du site (decor, non cliquables) + etiquettes de zone
// qui reprennent les comptes affiches sur la page Allocation.
export function Installations() {
  return (
    <group>
      <Groupe items={RESTAURATION} rendu={(i) => <Stand boisson={i % 2 === 0} />} />
      <Groupe items={SANITAIRES} rendu={() => <BlocSanitaire />} />
      <Groupe items={SECOURS} rendu={() => <PosteSecours />} />
      <Groupe items={SECURITE} rendu={() => <PosteSecurite />} />

      {ZONES.map((z) => {
        const [x, zz] = monde(z.x, z.y);
        return (
          <Html key={z.nom} position={[x, 3.2, zz]} center distanceFactor={110} zIndexRange={[12, 0]}>
            <div className="c3d-zone">
              {z.nom} <span>{z.compte}</span>
            </div>
          </Html>
        );
      })}
    </group>
  );
}
