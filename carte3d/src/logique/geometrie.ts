import * as THREE from "three";

// Ruban plat le long d'une courbe (chemins et flux). Triangle strip indexe,
// UV longitudinaux pour faire defiler une texture dans le sens du trajet.
export function geometrieRuban(
  courbe: THREE.Curve<THREE.Vector3>,
  largeur: number,
  segments = 48,
): THREE.BufferGeometry {
  const points = courbe.getPoints(segments);
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const haut = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const cote = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const p = points[i];
    dir.subVectors(points[Math.min(i + 1, segments)], points[Math.max(i - 1, 0)]).normalize();
    cote.crossVectors(dir, haut).normalize().multiplyScalar(largeur / 2);
    positions.set([p.x - cote.x, p.y, p.z - cote.z], i * 6);
    positions.set([p.x + cote.x, p.y, p.z + cote.z], i * 6 + 3);
    const t = i / segments;
    uvs.set([t, 0], i * 4);
    uvs.set([t, 1], i * 4 + 2);
  }

  const indices: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Courbe au sol entre deux points, legerement bombee vers le centre du site
// (equivalent de la curveness des lignes de flux en 2D).
export function courbeEntre(
  a: [number, number],
  b: [number, number],
  hauteur = 0.1,
  courbure = 0.14,
): THREE.QuadraticBezierCurve3 {
  const va = new THREE.Vector3(a[0], hauteur, a[1]);
  const vb = new THREE.Vector3(b[0], hauteur, b[1]);
  const milieu = va.clone().add(vb).multiplyScalar(0.5);
  const controle = milieu.add(
    new THREE.Vector3(0, hauteur, 10).sub(milieu).multiplyScalar(courbure),
  );
  return new THREE.QuadraticBezierCurve3(va, controle, vb);
}

// Bande lumineuse defilante pour visualiser le sens des flux.
export function textureDefilante(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 8;
  const ctx = c.getContext("2d")!;
  const degrade = ctx.createLinearGradient(0, 0, 128, 0);
  degrade.addColorStop(0.0, "rgba(157,184,255,0)");
  degrade.addColorStop(0.72, "rgba(157,184,255,0.25)");
  degrade.addColorStop(0.92, "rgba(200,218,255,0.95)");
  degrade.addColorStop(1.0, "rgba(157,184,255,0)");
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, 128, 8);
  const tx = new THREE.CanvasTexture(c);
  tx.wrapS = THREE.RepeatWrapping;
  tx.wrapT = THREE.ClampToEdgeWrapping;
  tx.repeat.set(2.5, 1);
  return tx;
}

// Generateur pseudo-aleatoire deterministe : la disposition de la foule
// reste stable d'un rendu a l'autre pour une meme scene.
export function aleatoire(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
