import { useCallback, useEffect, useState } from "react";

// Timeline : lecture a 2100 ms par creneau (3x plus lent que le rythme initial
// de 700 ms, pour laisser le temps de lire les donnees en direct), pas de boucle,
// remise a zero au changement de jour.
const INTERVALLE_LECTURE = 2100;

export function useCreneau(creneaux: number[], jour: number) {
  const [idx, setIdx] = useState(0);
  const [lecture, setLecture] = useState(false);

  useEffect(() => {
    setIdx(0);
    setLecture(false);
  }, [jour]);

  useEffect(() => {
    if (!lecture) return;
    const minuterie = setInterval(() => {
      setIdx((i) => {
        if (i >= creneaux.length - 1) {
          setLecture(false);
          return i;
        }
        return i + 1;
      });
    }, INTERVALLE_LECTURE);
    return () => clearInterval(minuterie);
  }, [lecture, creneaux.length]);

  const basculeLecture = useCallback(() => {
    setIdx((i) => (i >= creneaux.length - 1 ? 0 : i));
    setLecture((l) => !l);
  }, [creneaux.length]);

  return { idx, setIdx, lecture, basculeLecture, creneau: creneaux[idx] ?? creneaux[0] };
}

// Petite interpolation pour les compteurs affiches (transition douce, ~300 ms).
export function useNombreAmorti(cible: number): number {
  const [valeur, setValeur] = useState(cible);
  useEffect(() => {
    let vivant = true;
    const depart = valeur;
    const debut = performance.now();
    const duree = 300;
    function pas(t: number) {
      if (!vivant) return;
      const p = Math.min((t - debut) / duree, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setValeur(depart + (cible - depart) * e);
      if (p < 1) requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible]);
  return valeur;
}
