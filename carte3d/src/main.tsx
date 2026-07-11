import { useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import type { ApiCarte3D, OptionsMontage } from "./types/donnees";

// Point d'entree : expose window.Carte3D.monte(element, options) pour que le
// site (vanilla JS) puisse monter la carte, changer de jour et la demonter,
// sans rien changer a sa propre logique.
function monte(element: HTMLElement, options: OptionsMontage): ApiCarte3D {
  const racine = createRoot(element);
  let changeJour: ((j: number) => void) | null = null;

  function Pont() {
    const [jour, setJour] = useState(options.jour ?? 2);
    changeJour = setJour;
    return (
      <App
        donnees={options.donnees}
        jour={jour}
        onScene={options.onScene}
        onPoi={options.onPoi}
      />
    );
  }

  racine.render(<Pont />);

  return {
    setJour: (j: number) => changeJour?.(j),
    demonte: () => racine.unmount(),
  };
}

declare global {
  interface Window {
    Carte3D: { monte: typeof monte };
  }
}

window.Carte3D = { monte };

export { monte };
