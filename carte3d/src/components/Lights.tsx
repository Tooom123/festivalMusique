// Eclairage nocturne facon Hellfest : hemisphere chaude (lueur de braise) +
// lumiere directionnelle ambree avec ombres douces ; le reste vient des
// materiaux emissifs (scenes, halos, enseignes, portique).
export function Lights() {
  return (
    <group>
      <hemisphereLight args={["#4a2418", "#0a0503", 0.75]} />
      <ambientLight intensity={0.16} color="#ffb37a" />
      <directionalLight
        position={[70, 95, 45]}
        intensity={0.85}
        color="#ffd0a0"
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
