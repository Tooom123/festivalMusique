const NIVEAUX = [
  { seuil: "< 70 %", couleur: "#0ca30c" },
  { seuil: "70–90 %", couleur: "#fab219" },
  { seuil: "90–100 %", couleur: "#ec835a" },
  { seuil: "> 100 %", couleur: "#d03b3b" },
];

// Legende des seuils d'occupation (memes seuils que la carte 2D).
export function Legende() {
  return (
    <div className="c3d-legende">
      <div className="c3d-legende-niveaux">
        {NIVEAUX.map((n) => (
          <span key={n.seuil}>
            <i style={{ background: n.couleur }} />{n.seuil}
          </span>
        ))}
      </div>
    </div>
  );
}
