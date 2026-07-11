// Eclairage nocturne : hemisphere froide + lune directionnelle avec ombres
// douces, le reste vient des materiaux emissifs (scenes, halos, enseignes).
export function Lights() {
  return (
    <group>
      <hemisphereLight args={["#27324d", "#05070a", 0.75]} />
      <ambientLight intensity={0.14} />
      <directionalLight
        position={[70, 95, 45]}
        intensity={0.85}
        color="#cdd6f5"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-far={320}
        shadow-bias={-0.0004}
      />
    </group>
  );
}
