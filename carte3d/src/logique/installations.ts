// Couche procedurale des installations du site, a l'echelle reelle d'un festival de
// 50 000 personnes : ~24 points de restauration, ~30 blocs sanitaires, 6 postes de
// secours, postes de securite. Purement visuel (aucune logique metier) : sert a
// rendre credible la carte et a montrer les effectifs de l'allocation "en vrai".
// Positions deterministes (aucun alea) pour rester identiques d'un rendu a l'autre.

export type Installation = { x: number; y: number };
export type Zone = { nom: string; x: number; y: number; compte: string };

// Grille reguliere de `nx * ny` items centree sur (cx, cy), pas (dx, dy).
function grille(cx: number, cy: number, nx: number, ny: number, dx: number, dy: number): Installation[] {
  const items: Installation[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      items.push({
        x: cx + (i - (nx - 1) / 2) * dx,
        y: cy + (j - (ny - 1) / 2) * dy,
      });
    }
  }
  return items;
}

// Restauration : deux villages pres de l'entree + de part et d'autre de l'esplanade
// + une rangee derriere l'esplanade, vers la grande scene. ~24 stands.
export const RESTAURATION: Installation[] = [
  ...grille(37, 19, 3, 2, 6, 6),   // village entree ouest (6)
  ...grille(63, 19, 3, 2, 6, 6),   // village entree est (6)
  ...grille(28, 46, 2, 2, 6, 7),   // ouest esplanade (4)
  ...grille(72, 46, 2, 2, 6, 7),   // est esplanade (4)
  ...grille(50, 60, 4, 1, 7, 0),   // rangee vers la grande scene (4)
];

// Sanitaires : blocs regroupes sur le pourtour du site. ~30 blocs.
export const SANITAIRES: Installation[] = [
  ...grille(9, 58, 2, 3, 4, 6),    // bord ouest (6)
  ...grille(91, 58, 2, 3, 4, 6),   // bord est (6)
  ...grille(11, 20, 2, 2, 4, 6),   // sud-ouest (4)
  ...grille(89, 20, 2, 2, 4, 6),   // sud-est (4)
  ...grille(30, 86, 3, 1, 5, 0),   // nord-ouest (3)
  ...grille(70, 86, 3, 1, 5, 0),   // nord-est (3)
  ...grille(50, 30, 4, 1, 5, 0),   // proche esplanade (4)
];

// Postes de secours : un par scene, un a l'entree, deux en milieu de site. 6 postes.
export const SECOURS: Installation[] = [
  { x: 41, y: 66 },   // proche grande scene (Rap)
  { x: 12, y: 40 },   // proche scene DJ
  { x: 88, y: 40 },   // proche scene Rock
  { x: 44, y: 12 },   // proche entree
  { x: 24, y: 55 },   // milieu ouest
  { x: 76, y: 55 },   // milieu est
];

// Postes de securite : entree + quatre coins + fronts de scene. Petits postes.
export const SECURITE: Installation[] = [
  { x: 43, y: 6 }, { x: 57, y: 6 },       // controle entree
  { x: 6, y: 10 }, { x: 94, y: 10 },      // coins sud
  { x: 6, y: 84 }, { x: 94, y: 84 },      // coins nord
  { x: 50, y: 68 },                       // front grande scene
  { x: 14, y: 24 }, { x: 86, y: 24 },     // fronts scenes DJ / Rock
];

// Etiquettes de zone : reprennent les comptes affiches sur la page Allocation
// (24 points de restauration, 30 blocs sanitaires, 6 postes de secours).
// Placees a l'ecart des points d'analyse cliquables (points_interet) pour ne pas
// se chevaucher : ce sont de simples reperes de decor, sans interaction.
export const ZONES: Zone[] = [
  { nom: "Restauration", x: 50, y: 14, compte: "~24 stands" },
  { nom: "Sanitaires", x: 9, y: 70, compte: "~30 blocs" },
  { nom: "Postes de secours", x: 24, y: 58, compte: "6 postes" },
];
