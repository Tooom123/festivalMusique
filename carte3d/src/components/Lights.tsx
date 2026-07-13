// Eclairage nocturne facon Hellfest : hemisphere chaude (lueur de braise) +
// lumiere directionnelle ambree avec ombres douces ; le reste vient des
// materiaux emissifs (scenes, halos, enseignes, portique).
export function Lights() {
  return (
    <group>
      <hemisphereLight args={["#6a3a24", "#1a0d08", 1.05]} />
      <ambientLight intensity={0.42} color="#ffd2ad" />
      <directionalLight
        position={[70, 95, 45]}
        intensity={1.15}
        color="#ffe6cc"
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
