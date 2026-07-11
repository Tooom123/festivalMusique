import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useMemo } from "react";

// Post-traitement sobre : bloom sur les seuls materiaux tres emissifs
// (halos, ecrans, enseignes) + legere vignette. Desactive sur ecrans
// tactiles pour preserver les 60 fps.
export function Effects() {
  const actif = useMemo(() => {
    try {
      return window.matchMedia("(pointer: fine)").matches;
    } catch {
      return true;
    }
  }, []);

  if (!actif) return null;

  return (
    <EffectComposer>
      <Bloom intensity={0.55} luminanceThreshold={1} mipmapBlur />
      <Vignette eskil={false} offset={0.18} darkness={0.55} />
    </EffectComposer>
  );
}
