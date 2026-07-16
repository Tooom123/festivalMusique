const C = {
  scene: { 1: "#e63419", 2: "#ff7a18", 3: "#ffb300" },
  jours: ["#e63419", "#ff7a18", "#ffb300"],
  grav: { haute: "#e02718", moyenne: "#ff7a18", basse: "#ffb300" },
  seq: ["#3a1207", "#6b1e08", "#a8300c", "#e63419", "#ff5a12", "#ff9a3c", "#ffce5c"],
  axe: "#9c7a6d",
  grille: "#2a1610",
  texte: "#c9a99b",
  fondTooltip: "#1a0d08",
  froid: "#5aa0d6",
};

const POSITIONS = { 1: [50, 76], 2: [20, 30], 3: [80, 30] };
const STYLES_POI = {
  stand_boisson: ["diamond", "#ff7a18"],
  stand_nourriture: ["diamond", "#ff7a18"],
  stand_mixte: ["diamond", "#ff7a18"],
  toilettes: ["rect", "#ffb300"],
  secourisme: ["pin", "#e02718"],
};
const LIBELLES_VARIABLES = {
  lag1: "affluence créneau -1", lag2: "affluence créneau -2", heure: "heure",
  popularite: "popularité artiste", capacite: "capacité scène", scene_id: "scène",
  soir: "soirée", actif: "scène active", popularite_suivante: "popularité set suivant",
};
const ORDRE_SCENARIOS = ["base", "scenes_dj_rock_agrandies", "horaires_decales", "securite_renforcee"];

const NOMS_SCENES = {};
const CAPACITES = {};
DONNEES.scenes.forEach((s) => { NOMS_SCENES[s.scene_id] = s.nom; CAPACITES[s.scene_id] = s.capacite; });

const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function heureTexte(m) {
  m = Math.round(m) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + "h" + String(m % 60).padStart(2, "0");
}
function fmt(n) { return Math.round(n).toLocaleString("fr-FR"); }
function jourCourt(j) { return DONNEES.jours_court[String(j)]; }
function jourLong(j) { return DONNEES.jours_long[String(j)]; }
function slug(nom) {
  return nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function couleurTaux(t) {
  if (t >= 1.0) return "#d03b3b";
  if (t >= 0.9) return "#ec835a";
  if (t >= 0.7) return "#fab219";
  return "#0ca30c";
}
function creneauxDuJour(jour) {
  return [...new Set(DONNEES.affluence.filter((a) => a.jour === jour).map((a) => a.creneau))].sort((a, b) => a - b);
}

function axesBase() {
  return {
    axisLine: { lineStyle: { color: "#33334a" } },
    axisTick: { show: false },
    axisLabel: { color: C.axe, fontSize: 11 },
    splitLine: { lineStyle: { color: C.grille } },
  };
}
function tooltipBase() {
  return {
    backgroundColor: C.fondTooltip,
    borderColor: "rgba(255,255,255,0.14)",
    textStyle: { color: "#fff", fontSize: 12.5 },
  };
}
function legendeBase() {
  return { top: 0, left: 0, textStyle: { color: C.texte, fontSize: 12 }, itemWidth: 16, itemHeight: 3, icon: "rect" };
}

function carteKpi(libelle, valeur, note, classe) {
  return `<div class="kpi"><div class="k-libelle">${libelle}</div>` +
    `<div class="k-valeur">${valeur}</div>` +
    (note ? `<div class="k-note ${classe || ""}">${note}</div>` : "") + `</div>`;
}

function creerSegments(id, options, surChange, idxActif) {
  const c = document.getElementById(id);
  c.innerHTML = "";
  options.forEach((o, i) => {
    const b = document.createElement("button");
    b.className = "segment" + (i === (idxActif || 0) ? " actif" : "");
    b.textContent = o.label;
    b.addEventListener("click", () => {
      c.querySelectorAll(".segment").forEach((x) => x.classList.remove("actif"));
      b.classList.add("actif");
      surChange(o.valeur);
    });
    c.appendChild(b);
  });
}

function animeCompteurs(conteneur) {
  conteneur.querySelectorAll("[data-compte]").forEach((el) => {
    const cible = parseFloat(el.dataset.compte);
    const suffixe = el.dataset.suffixe || "";
    if (mouvementReduit) { el.textContent = fmt(cible) + suffixe; return; }
    const debut = performance.now();
    const duree = 900;
    function pas(t) {
      const p = Math.min((t - debut) / duree, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(cible * e) + suffixe;
      if (p < 1) requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
  });
}

/* ================= Drawer d'analyse ================= */

// Chaque cle d'analyse -> gabarit HTML, titres, et fonction d'init a lancer une
// fois le contenu injecte dans le drawer. `contexte` porte la scene cliquee.
const ANALYSES = {
  ensemble: { gabarit: "gabarit-ensemble", surtitre: "Le festival", titre: "Vue d'ensemble",
              init: initEnsemble },
  affluence: { gabarit: "gabarit-affluence", surtitre: "Scène", titre: "Affluence & prévision",
               init: initAffluence },
  previsions: { gabarit: "gabarit-previsions", surtitre: "Modèles", titre: "Prévision de l'édition",
                init: initPrevisionsEdition },
  anomalies: { gabarit: "gabarit-anomalies", surtitre: "Poste de secours", titre: "Anomalies & anticipation",
               init: initAnomalies },
  allocation: { gabarit: "gabarit-allocation", surtitre: "Sanitaires & équipes", titre: "Allocation des ressources",
                init: initAllocation },
  transport: { gabarit: "gabarit-transport", surtitre: "Entrée du site", titre: "Transport & billetterie",
               init: initTransport },
  scenarios: { gabarit: "gabarit-scenarios", surtitre: "Stands & food", titre: "Scénarios & coûts",
               init: initScenarios },
};

// Registre des instances ECharts. Les conteneurs vivent dans le drawer et sont
// recrees a chaque ouverture : on dispose l'ancienne instance avant d'en refaire.
const graphs = {};
function graphe(id) {
  const el = document.getElementById(id);
  if (graphs[id] && graphs[id].getDom() !== el) { graphs[id].dispose(); delete graphs[id]; }
  if (!graphs[id]) graphs[id] = echarts.init(el);
  return graphs[id];
}
window.addEventListener("resize", () =>
  Object.values(graphs).forEach((g) => { try { g.resize(); } catch (e) {} }));

const drawer = document.getElementById("drawer");
const drawerVoile = document.getElementById("drawer-voile");
const drawerCorps = document.getElementById("drawer-corps");
let analyseCourante = null;

function ouvrirDrawer(cle, contexte) {
  const conf = ANALYSES[cle];
  if (!conf) return;
  contexte = contexte || {};

  // Contenu neuf : on jette les anciennes instances ECharts et on clone le gabarit.
  Object.keys(graphs).forEach((id) => { graphs[id].dispose(); delete graphs[id]; });
  drawerCorps.innerHTML = "";
  const gabarit = document.getElementById(conf.gabarit);
  drawerCorps.appendChild(gabarit.content.cloneNode(true));

  const surtitre = contexte.nomScene || conf.surtitre;
  document.getElementById("drawer-surtitre").textContent = surtitre;
  document.getElementById("drawer-titre").textContent = conf.titre;

  analyseCourante = cle;
  conf.init(contexte);

  document.body.classList.add("drawer-ouvert");
  drawer.setAttribute("aria-hidden", "false");
  drawerCorps.scrollTop = 0;
  requestAnimationFrame(() =>
    Object.values(graphs).forEach((g) => { try { g.resize(); } catch (e) {} }));
}

function fermerDrawer() {
  document.body.classList.remove("drawer-ouvert");
  drawer.setAttribute("aria-hidden", "true");
  analyseCourante = null;
}

document.getElementById("drawer-fermer").addEventListener("click", fermerDrawer);
drawerVoile.addEventListener("click", fermerDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("drawer-ouvert")) fermerDrawer();
});

/* ================= Vue d'ensemble ================= */

function initEnsemble() {
  const conteneur = document.getElementById("headliners");
  [1, 2, 3].forEach((jour) => {
    const prog = DONNEES.programmation
      .filter((p) => p.jour === jour)
      .sort((a, b) => b.popularite - a.popularite || b.heure_debut - a.heure_debut)
      .slice(0, 3);
    const carte = document.createElement("div");
    carte.className = "jour-carte";
    carte.innerHTML = `<div class="jour-nom">${jourLong(jour)}</div>` +
      `<div class="jour-note">${fmt(DONNEES.kpi.visiteurs_par_jour[String(jour)])} festivaliers attendus</div>` +
      `<div class="artistes">` + prog.map((p, i) => {
        const initiales = p.artiste.split(/\s+/).map((m) => m[0]).join("").slice(0, 3).toUpperCase();
        return `<div class="artiste ${i === 0 ? "grand" : ""} genre-${p.genre}">
          <div class="fond-genre"></div>
          <span class="initiales" aria-hidden="true">${initiales}</span>
          <img src="photos/${slug(p.artiste)}.jpg" alt="" loading="lazy" onerror="this.remove()">
          <div class="voile-bas"></div>
          <div class="infos"><span class="nom">${p.artiste}</span>
          <span class="heure">${heureTexte(p.heure_debut)} · ${NOMS_SCENES[p.scene_id]}</span></div>
        </div>`;
      }).join("") + `</div>`;
    conteneur.appendChild(carte);
  });

  const m = DONNEES.metriques;
  const k = DONNEES.kpi;
  document.getElementById("kpi-accueil").innerHTML =
    carteKpi("Visiteurs sur 3 jours", `<span data-compte="${k.visiteurs_total}">0</span>`, "entrées simulées") +
    carteKpi("Pic d'affluence", `<span data-compte="${k.pic_affluence}">0</span>`, "sur une scène / créneau") +
    carteKpi("Anomalies détectées", `<span data-compte="${k.nb_anomalies}">0</span>`, `dont ${k.nb_anomalies_hautes} de gravité haute`) +
    carteKpi("Erreur de prévision (MAE)", `<span data-compte="${Math.round(m.mae_retenue)}">0</span>`, `R² = ${m.r2_retenu.toFixed(2)}`) +
    carteKpi("Couverture des besoins", `${DONNEES.allocation.couverture_ajustee.toFixed(0)} %`, "après réallocation");
  animeCompteurs(document.getElementById("kpi-accueil"));

  const creneaux = creneauxDuJour(1);
  const heures = creneaux.map(heureTexte);
  const seriesJours = [1, 2, 3].map((jour, i) => ({
    name: jourCourt(jour),
    type: "line",
    smooth: 0.3,
    showSymbol: false,
    lineStyle: { width: 2.5 },
    itemStyle: { color: C.jours[i] },
    emphasis: { focus: "series" },
    data: creneaux.map((cr) => DONNEES.affluence
      .filter((a) => a.jour === jour && a.creneau === cr)
      .reduce((s, a) => s + a.nb_visiteurs, 0)),
  }));
  graphe("graph-affluence-totale").setOption({
    tooltip: { ...tooltipBase(), trigger: "axis" },
    legend: legendeBase(),
    grid: { left: 56, right: 16, top: 42, bottom: 30 },
    xAxis: { type: "category", data: heures, boundaryGap: false, ...axesBase(), splitLine: { show: false } },
    yAxis: { type: "value", name: "Visiteurs présents", nameTextStyle: { color: C.axe }, ...axesBase() },
    series: seriesJours,
  });

  const gravites = ["haute", "moyenne", "basse"];
  graphe("graph-anomalies-jour").setOption({
    tooltip: { ...tooltipBase(), trigger: "axis" },
    legend: legendeBase(),
    grid: { left: 40, right: 16, top: 42, bottom: 30 },
    xAxis: { type: "category", data: [1, 2, 3].map(jourCourt), ...axesBase(), splitLine: { show: false } },
    yAxis: { type: "value", ...axesBase() },
    series: gravites.map((g) => ({
      name: g, type: "bar", stack: "total", barWidth: "42%",
      itemStyle: { color: C.grav[g], borderRadius: g === "basse" ? [4, 4, 0, 0] : 0 },
      data: [1, 2, 3].map((jour) => DONNEES.anomalies.filter((a) => a.jour === jour && a.gravite === g).length),
    })),
  });

  // Programmation (segment jour) intégrée à la vue d'ensemble.
  creerSegments("seg-prog", [1, 2, 3].map((j) => ({ label: jourLong(j), valeur: j })), dessineProgrammation, 0);
  dessineProgrammation(1);
}

/* ================= Programmation ================= */

function dessineProgrammation(jour) {
  const prog = DONNEES.programmation.filter((p) => p.jour === jour);
  const ordresY = [3, 2, 1];
  const nomsY = ordresY.map((s) => NOMS_SCENES[s]);
  const donnees = prog.map((p) => ({
    value: [ordresY.indexOf(p.scene_id), p.heure_debut, p.heure_fin, p.artiste, p.popularite],
    itemStyle: { color: C.scene[p.scene_id] },
  }));

  graphe("graph-gantt").setOption({
    tooltip: {
      ...tooltipBase(),
      formatter: (pa) => `<b>${pa.value[3]}</b><br>${heureTexte(pa.value[1])} – ${heureTexte(pa.value[2])}<br>Notoriété : ${pa.value[4]}/10`,
    },
    grid: { left: 96, right: 24, top: 16, bottom: 34 },
    xAxis: {
      type: "value", min: 16 * 60, max: 24 * 60, interval: 120,
      axisLabel: { color: C.axe, fontSize: 10, hideOverlap: true,
                   formatter: (v) => heureTexte(v) },
      splitLine: { lineStyle: { color: C.grille } }, axisLine: { show: false }, axisTick: { show: false },
    },
    yAxis: {
      type: "category", data: nomsY,
      axisLabel: { color: C.texte, fontSize: 12.5, fontWeight: 600 },
      axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
    },
    series: [{
      type: "custom",
      data: donnees,
      renderItem: (params, api) => {
        const cat = api.value(0);
        const debut = api.coord([api.value(1), cat]);
        const fin = api.coord([api.value(2), cat]);
        const hauteur = api.size([0, 1])[1] * 0.6;
        const rect = echarts.graphic.clipRectByRect(
          { x: debut[0] + 2, y: debut[1] - hauteur / 2, width: fin[0] - debut[0] - 4, height: hauteur },
          { x: params.coordSys.x, y: params.coordSys.y, width: params.coordSys.width, height: params.coordSys.height });
        if (!rect) return null;
        return {
          type: "group",
          children: [
            { type: "rect", shape: { ...rect, r: 7 }, style: api.style({ stroke: "#08080d", lineWidth: 2 }) },
            { type: "text", style: { text: api.value(3), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
              align: "center", verticalAlign: "middle", fill: "#fff", fontSize: 10.5, fontWeight: 600,
              overflow: "break", lineHeight: 12, width: rect.width - 6 } },
          ],
        };
      },
    }],
  }, true);

  const heures = [...new Set(prog.map((p) => p.heure_debut))].sort((a, b) => a - b);
  const ordresColonnes = [1, 2, 3];
  let html = "<table><thead><tr><th>Heure</th>" +
    ordresColonnes.map((s) => `<th>${NOMS_SCENES[s]}</th>`).join("") + "</tr></thead><tbody>";
  heures.forEach((h) => {
    html += `<tr><td>${heureTexte(h)}</td>` + ordresColonnes.map((s) => {
      const c = prog.find((p) => p.scene_id === s && p.heure_debut === h);
      return `<td>${c ? c.artiste : "—"}</td>`;
    }).join("") + "</tr>";
  });
  document.getElementById("table-prog").innerHTML = html + "</tbody></table>";
}

/* ================= Carte du site (fond permanent) ================= */

// La carte 3D occupe tout l'écran et pilote la navigation : cliquer une scène
// ou un décor ouvre l'analyse thématique correspondante dans le drawer.
// Mapping type de POI -> clé d'analyse (voir ANALYSES). Un type non listé (les
// stands de nourriture/boisson/mixte) tombe sur les scénarios & coûts.
const POI_VERS_ANALYSE = {
  secourisme: "anomalies",
  toilettes: "allocation",
  stand_boisson: "scenarios",
  stand_nourriture: "scenarios",
  stand_mixte: "scenarios",
  entree: "transport",
};

let jourCarte = 2;
let editionCarte = null;
let carte3dApi = null;
let clicCarte2dLie = false;

function editionCourante() {
  return DONNEES.cartes_editions.find((e) => e.annee === editionCarte)
    || DONNEES.cartes_editions[DONNEES.cartes_editions.length - 1];
}

// Clic sur une scène : on ouvre l'analyse affluence/prévision filtrée sur la scène.
function ouvreAnalyseScene(sceneId) {
  ouvrirDrawer("affluence", { sceneId, nomScene: NOMS_SCENES[sceneId] });
}

// Clic sur un décor / POI : route vers l'analyse thématique.
function ouvreAnalysePoi(poi) {
  const cle = POI_VERS_ANALYSE[poi.type] || "scenarios";
  ouvrirDrawer(cle, { nomPoi: poi.nom });
}

function monteCarte() {
  const editions = DONNEES.cartes_editions;
  editionCarte = editions[editions.length - 1].annee;

  if (window.Carte3D) {
    try {
      carte3dApi = Carte3D.monte(document.getElementById("carte-plein"), {
        donnees: {
          scenes: DONNEES.scenes,
          pois: DONNEES.pois,
          jours_long: DONNEES.jours_long,
          editions: DONNEES.cartes_editions,
        },
        edition: editionCarte,
        jour: jourCarte,
        onScene: (id) => ouvreAnalyseScene(id),
        onPoi: (p) => ouvreAnalysePoi(p),
        onEnsemble: () => ouvrirDrawer("ensemble"),
        onEntree: () => ouvrirDrawer("transport", { nomPoi: "Entrée du site" }),
      });
      return;
    } catch (e) {
      console.error("Carte 3D indisponible, repli sur la carte 2D", e);
      carte3dApi = null;
    }
  }
  monteCarte2D();
}

// Repli 2D (WebGL indisponible) : carte ECharts plein hôte + sélecteurs superposés.
function monteCarte2D() {
  const hote = document.getElementById("carte-plein");
  hote.innerHTML =
    `<div id="graph-carte-2d"></div>
     <button class="c3d-bouton-ensemble" id="btn-ensemble-2d">
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
       <span>Vue d'ensemble</span>
     </button>
     <div class="c3d-selecteurs">
       <span class="c3d-badge-edition" id="badge-edition-2d"></span>
       <div class="segments segments-edition" id="seg-edition"></div>
       <div class="segments" id="seg-carte"></div>
     </div>`;
  document.getElementById("btn-ensemble-2d").addEventListener("click", () => ouvrirDrawer("ensemble"));

  const editions = DONNEES.cartes_editions;
  creerSegments("seg-edition", editions.map((e) => ({
    label: e.type === "prediction" ? e.annee + " · Préd." : String(e.annee),
    valeur: e.annee,
  })), (a) => { editionCarte = a; dessineCarte2D(); }, editions.length - 1);
  creerSegments("seg-carte", [1, 2, 3].map((j) => ({ label: jourCourt(j), valeur: j })),
    (j) => { jourCarte = j; dessineCarte2D(); }, 1);

  dessineCarte2D();
}

function majBadge2D() {
  const ed = editionCourante();
  const badge = document.getElementById("badge-edition-2d");
  if (!badge) return;
  badge.className = "c3d-badge-edition " + (ed.type === "prediction" ? "pred" : "hist");
  badge.textContent = ed.type === "prediction" ? `Prédiction ${ed.annee}` : `Réel ${ed.annee}`;
}

function seriesCarte(jour, creneau) {
  const ed = editionCourante();
  const aff = ed.affluence.filter((a) => a.jour === jour && a.creneau === creneau);
  const scenesData = aff.map((a) => {
    const taux = a.nb_visiteurs / CAPACITES[a.scene_id];
    return {
      value: POSITIONS[a.scene_id],
      sceneId: a.scene_id, nb: a.nb_visiteurs, taux,
      symbolSize: 14 + 1.5 * Math.sqrt(Math.max(a.nb_visiteurs, 0)),
      itemStyle: { color: couleurTaux(taux), opacity: 0.88,
        borderColor: "rgba(255,255,255,0.4)", borderWidth: 1.5 },
      label: { show: true, formatter: NOMS_SCENES[a.scene_id] + "\n" + fmt(a.nb_visiteurs),
        color: "#fff", fontWeight: 700, fontSize: 12, lineHeight: 16, align: "center" },
    };
  });
  const anomsData = ed.anomalies
    .filter((a) => a.jour === jour && a.creneau === creneau && POSITIONS[a.scene_id])
    .map((a) => ({ value: [POSITIONS[a.scene_id][0], POSITIONS[a.scene_id][1] + 12], type: a.type, gravite: a.gravite }));
  const fluxData = ed.flux
    .filter((f) => f.jour === jour && f.creneau === creneau)
    .map((f) => ({
      coords: [POSITIONS[f.scene_origine], POSITIONS[f.scene_destination]],
      lineStyle: { width: 1.5 + Math.min(f.nb / 40, 6) },
      nb: f.nb,
    }));
  const poisData = DONNEES.pois.map((p) => ({
    value: [p.x, p.y], poi: p,
    symbol: STYLES_POI[p.type][0],
    symbolSize: p.type === "secourisme" ? 16 : 11,
    itemStyle: { color: STYLES_POI[p.type][1], borderColor: "rgba(255,255,255,0.4)", borderWidth: 1 },
    label: { show: true, position: "bottom", formatter: p.nom, color: C.axe, fontSize: 10 },
  }));

  return [
    { id: "enclos", type: "line", silent: true, showSymbol: false, z: 1,
      lineStyle: { color: "rgba(255,255,255,0.13)", width: 1.5 },
      data: [[1, 2], [99, 2], [99, 92], [1, 92], [1, 2]] },
    { id: "entree", type: "scatter", silent: true, symbolSize: 0, z: 1,
      label: { show: true, formatter: "Entrée", color: C.axe, fontSize: 11, position: "bottom" },
      data: [[50, 2]] },
    { id: "flux", type: "lines", coordinateSystem: "cartesian2d", z: 2, silent: true,
      lineStyle: { color: "rgba(255,122,24,0.45)", curveness: 0.12 },
      effect: mouvementReduit ? { show: false } : { show: true, period: 3.2, trailLength: 0.3, symbolSize: 4, color: "#ffb300" },
      data: fluxData },
    { id: "pois", type: "scatter", z: 3, cursor: "pointer", data: poisData },
    { id: "scenes", type: "scatter", z: 5, cursor: "pointer", data: scenesData },
    { id: "anoms", type: "scatter", z: 6, symbol: "triangle", symbolSize: 15,
      itemStyle: { color: C.grav.haute, borderColor: "#0a0505", borderWidth: 1 }, data: anomsData },
  ];
}

function dessineCarte2D() {
  const jour = jourCarte;
  const ed = editionCourante();
  const creneaux = [...new Set(ed.affluence.filter((a) => a.jour === jour).map((a) => a.creneau))].sort((a, b) => a - b);
  const g = graphe("graph-carte-2d");
  if (!clicCarte2dLie) {
    g.on("click", (params) => {
      if (params.seriesId === "scenes") ouvreAnalyseScene(params.data.sceneId);
      if (params.seriesId === "pois") ouvreAnalysePoi(params.data.poi);
    });
    clicCarte2dLie = true;
  }
  g.clear();
  g.setOption({
    baseOption: {
      timeline: {
        axisType: "category",
        data: creneaux.map(heureTexte),
        autoPlay: false,
        playInterval: 2100,
        loop: false,
        bottom: 4, left: 30, right: 30,
        label: { color: C.axe, fontSize: 10 },
        lineStyle: { color: "#3a2016" },
        itemStyle: { color: "#6b3f2a" },
        checkpointStyle: { color: "#ff7a18", borderColor: "rgba(255,122,24,0.35)", symbolSize: 14 },
        progress: { lineStyle: { color: "#ff7a18" }, itemStyle: { color: "#ff7a18" } },
        controlStyle: { color: "#f7ece6", borderColor: "#6b3f2a" },
      },
      tooltip: {
        ...tooltipBase(),
        formatter: (pa) => {
          if (pa.seriesId === "scenes") {
            return `<b>${NOMS_SCENES[pa.data.sceneId]}</b><br>${fmt(pa.data.nb)} visiteurs<br>` +
              `Occupation : ${Math.round(pa.data.taux * 100)} %<br>Capacité : ${fmt(CAPACITES[pa.data.sceneId])}<br>` +
              `<i>Cliquer pour l'affluence & la prévision</i>`;
          }
          if (pa.seriesId === "pois") {
            return `<b>${pa.data.poi.nom}</b><br><i>Cliquer pour l'analyse</i>`;
          }
          if (pa.seriesId === "anoms") return `Anomalie : ${pa.data.type} (${pa.data.gravite})`;
          return "";
        },
      },
      grid: { left: 10, right: 10, top: 6, bottom: 64 },
      xAxis: { show: false, type: "value", min: -4, max: 104 },
      yAxis: { show: false, type: "value", min: -10, max: 100 },
      series: seriesCarte(jour, creneaux[0]),
    },
    options: creneaux.map((cr) => ({ series: seriesCarte(jour, cr) })),
  }, true);

  majBadge2D();
}

/* ================= Affluence & prévision (clic sur une scène) ================= */

function initAffluence(contexte) {
  contexte = contexte || {};
  // Intro adaptée à la scène cliquée.
  if (contexte.nomScene) {
    document.getElementById("affluence-intro").innerHTML =
      `Fréquentation observée par scène, issue de la simulation à événements discrets. ` +
      `Vous avez cliqué <b>${contexte.nomScene}</b> — sa prévision par créneau de 30 min ` +
      `pour le dimanche est présélectionnée ci-dessous.`;
  }

  creerSegments("seg-affluence", [1, 2, 3].map((j) => ({ label: jourLong(j), valeur: j })), dessineAffluence, 0);
  dessineAffluence(1);

  // Bloc prévision par scène/créneau (déplacé ici : la scène est le point d'entrée).
  const m = DONNEES.metriques;
  const retenuForet = m.modele_retenu === "foret aleatoire";
  const nomRetenu = retenuForet ? "forêt aléatoire" : "régression linéaire";
  document.getElementById("kpi-previsions").innerHTML =
    carteKpi("MAE modèle retenu", m.mae_retenue.toFixed(1), `${nomRetenu} · R² ${m.r2_retenu.toFixed(3)}`, "positif") +
    carteKpi("MAE modèle naïf", m.mae_naif.toFixed(1), "créneau précédent") +
    carteKpi("Apport de l'historique",
      `-${((1 - m.mae_retenue / m.mae_sans_historique) * 100).toFixed(0)} %`,
      `grâce aux éditions 2022-2025`, "positif");

  const scenePref = contexte.sceneId || 1;
  const idxScene = [1, 2, 3].indexOf(scenePref);
  creerSegments("seg-previsions", [1, 2, 3].map((s) => ({ label: NOMS_SCENES[s], valeur: s })),
    dessinePrevisions, idxScene >= 0 ? idxScene : 0);
  dessinePrevisions(scenePref);

  const imp = [...DONNEES.importances].sort((a, b) => b.importance - a.importance);
  graphe("graph-importances").setOption({
    tooltip: { ...tooltipBase(), valueFormatter: (v) => v.toFixed(3) },
    grid: { left: 170, right: 30, top: 10, bottom: 30 },
    xAxis: { type: "value", ...axesBase() },
    yAxis: { type: "category", inverse: true,
      data: imp.map((i) => LIBELLES_VARIABLES[i.variable] || i.variable),
      axisLabel: { color: C.texte, fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: "bar", barWidth: "55%",
      itemStyle: { color: C.accent || "#e63419", borderRadius: [0, 5, 5, 0] },
      data: imp.map((i) => i.importance) }],
  });
}

function dessineAffluence(jour) {
  const creneaux = creneauxDuJour(jour);
  const heures = creneaux.map(heureTexte);

  graphe("graph-affluence-scenes").setOption({
    tooltip: { ...tooltipBase(), trigger: "axis" },
    legend: legendeBase(),
    grid: { left: 56, right: 16, top: 42, bottom: 30 },
    xAxis: { type: "category", data: heures, boundaryGap: false, ...axesBase(), splitLine: { show: false } },
    yAxis: { type: "value", name: "Visiteurs présents", nameTextStyle: { color: C.axe }, ...axesBase() },
    series: [1, 2, 3].map((s) => ({
      name: NOMS_SCENES[s], type: "line", smooth: 0.3, showSymbol: false,
      lineStyle: { width: 2.5 }, itemStyle: { color: C.scene[s] },
      emphasis: { focus: "series" },
      data: creneaux.map((cr) => {
        const l = DONNEES.affluence.find((a) => a.jour === jour && a.creneau === cr && a.scene_id === s);
        return l ? l.nb_visiteurs : 0;
      }),
    })),
  }, true);

  const ordresY = [3, 2, 1];
  const donneesHeat = [];
  let tauxMax = 0;
  ordresY.forEach((s, yi) => creneaux.forEach((cr, xi) => {
    const l = DONNEES.affluence.find((a) => a.jour === jour && a.creneau === cr && a.scene_id === s);
    const taux = l ? l.nb_visiteurs / CAPACITES[s] : 0;
    tauxMax = Math.max(tauxMax, taux);
    donneesHeat.push([xi, yi, Math.round(taux * 100) / 100]);
  }));

  graphe("graph-heatmap").setOption({
    tooltip: { ...tooltipBase(),
      formatter: (pa) => `${NOMS_SCENES[ordresY[pa.value[1]]]} · ${heures[pa.value[0]]}<br>Occupation : ${Math.round(pa.value[2] * 100)} %` },
    grid: { left: 96, right: 90, top: 16, bottom: 30 },
    xAxis: { type: "category", data: heures, ...axesBase(), splitLine: { show: false }, axisLine: { show: false } },
    yAxis: { type: "category", data: ordresY.map((s) => NOMS_SCENES[s]),
      axisLabel: { color: C.texte, fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: {
      min: 0, max: Math.max(1, Math.ceil(tauxMax * 10) / 10),
      orient: "vertical", right: 6, top: "center", itemHeight: 130,
      inRange: { color: C.seq }, textStyle: { color: C.axe, fontSize: 10 },
      formatter: (v) => Math.round(v * 100) + " %",
    },
    series: [{ type: "heatmap", data: donneesHeat,
      itemStyle: { borderColor: "#0a0505", borderWidth: 2, borderRadius: 3 },
      emphasis: { itemStyle: { borderColor: "#fff", borderWidth: 1 } } }],
  }, true);
}

/* ================= Prévisions ================= */

function dessineEditions() {
  const parAnnee = {};
  DONNEES.historique_editions.forEach((l) => {
    parAnnee[l.annee] = (parAnnee[l.annee] || 0) + l.visiteurs;
  });
  const somme = (champ) => DONNEES.prevision_edition.reduce((s, l) => s + l[champ], 0);
  const reel2026 = somme("visiteurs_reels");
  const combinee2026 = somme("prevision_combinee");
  const annees = [...Object.keys(parAnnee).map(Number).sort(), 2026];
  const detailJour = (annee) => {
    if (annee === 2026) {
      return DONNEES.prevision_edition
        .map((l) => `${jourCourt(l.jour)} : ${fmt(l.visiteurs_reels)}`)
        .join("<br>");
    }
    return DONNEES.historique_editions
      .filter((l) => l.annee === annee)
      .map((l) => `${jourCourt(l.jour)} : ${fmt(l.visiteurs)}`)
      .join("<br>");
  };

  graphe("graph-editions").setOption({
    tooltip: { ...tooltipBase(),
      formatter: (pa) => {
        const annee = annees[pa.dataIndex];
        if (pa.seriesName.startsWith("Prévision")) {
          return `<b>Prévision combinée 2026</b> : ${fmt(combinee2026)}<br>` +
            DONNEES.prevision_edition
              .map((l) => `${jourCourt(l.jour)} : tendance ${fmt(l.prevision_tendance)}`
                + ` · billetterie ${fmt(l.prevision_billetterie)}`
                + ` → combinée ${fmt(l.prevision_combinee)} (écart ${l.erreur_combinee_pct.toFixed(1)} %)`)
              .join("<br>");
        }
        return `<b>Édition ${annee}</b> : ${fmt(pa.value)} entrées<br>${detailJour(annee)}`;
      } },
    legend: legendeBase(),
    grid: { left: 64, right: 16, top: 42, bottom: 30 },
    xAxis: { type: "category", data: annees.map(String), ...axesBase(), splitLine: { show: false } },
    yAxis: { type: "value", name: "Entrées sur 3 jours", nameTextStyle: { color: C.axe },
      ...axesBase(), axisLabel: { color: C.axe, fontSize: 11, formatter: (v) => fmt(v / 1000) + " k" } },
    series: [
      { name: "Fréquentation réelle", type: "bar", barWidth: "46%",
        data: annees.map((a) => ({
          value: a === 2026 ? reel2026 : parAnnee[a],
          itemStyle: { color: a === 2026 ? "#ff7a18" : "#5a3220", borderRadius: [6, 6, 0, 0] },
        })) },
      { name: "Prévision combinée (tendance + billetterie)", type: "scatter", symbol: "diamond", symbolSize: 16,
        itemStyle: { color: "#ffce5c", borderColor: "#0a0505", borderWidth: 1.5 },
        data: annees.map((a) => (a === 2026 ? combinee2026 : null)) },
    ],
  });
}

function dessineBilletterie(idCible) {
  const cible = document.getElementById(idCible || "billetterie-panneau");
  if (!cible) return;
  cible.innerHTML = DONNEES.prevision_edition
    .map((l) => {
      const pct = Math.round(l.part_vendue * 100);
      const classe = pct >= 90 ? "haut" : pct >= 65 ? "moyen" : "bas";
      return `<div class="billet-ligne">
        <span class="billet-jour">${jourLong(l.jour)}</span>
        <div class="billet-barre"><i class="billet-${classe}" style="width:${pct}%"></i></div>
        <span class="billet-pct">${pct}%</span>
        <span class="billet-proj">≈ ${fmt(l.prevision_billetterie)} attendus</span>
      </div>`;
    })
    .join("");
}

// Prévision de l'édition (tendance + billetterie) — ouverte depuis la Vue d'ensemble.
function initPrevisionsEdition() {
  dessineEditions();
  dessineBilletterie();
}

function dessinePrevisions(sceneId) {
  const lignes = DONNEES.previsions
    .filter((p) => p.scene_id === sceneId)
    .sort((a, b) => a.creneau - b.creneau);
  const heures = lignes.map((l) => heureTexte(l.creneau));

  graphe("graph-previsions").setOption({
    tooltip: { ...tooltipBase(), trigger: "axis", valueFormatter: (v) => fmt(v) },
    legend: legendeBase(),
    grid: { left: 56, right: 16, top: 42, bottom: 30 },
    xAxis: { type: "category", data: heures, boundaryGap: false, ...axesBase(), splitLine: { show: false } },
    yAxis: { type: "value", name: "Visiteurs", nameTextStyle: { color: C.axe }, ...axesBase() },
    series: [
      { name: "Observé", type: "line", smooth: 0.25, showSymbol: false,
        lineStyle: { width: 2.5, color: "#ff7a18" }, itemStyle: { color: "#ff7a18" },
        data: lignes.map((l) => l.nb_visiteurs) },
      { name: "Prévu", type: "line", smooth: 0.25, showSymbol: false,
        lineStyle: { width: 2.5, color: "#5aa0d6", type: "dashed" }, itemStyle: { color: "#5aa0d6" },
        data: lignes.map((l) => l.prevision) },
    ],
  }, true);
}

/* ================= Anomalies ================= */

const SYMBOLES_TYPES = {
  surcharge: "diamond", surcharge_critique: "diamond", mouvement_foule: "circle",
  comportement_atypique: "roundRect",
};

function initAnomalies() {
  const m = DONNEES.metriques;
  const compte = (g) => DONNEES.anomalies.filter((a) => a.gravite === g).length;
  document.getElementById("kpi-anomalies").innerHTML =
    carteKpi("Gravité haute", compte("haute"), "surcharges critiques, foules", "negatif") +
    carteKpi("Gravité moyenne", compte("moyenne"), "surcharges, pannes") +
    carteKpi("Gravité basse", compte("basse"), "comportements atypiques") +
    carteKpi("Mouvements de foule retrouvés", `${Math.round(m.foules_retrouvees)}/${Math.round(m.foules_injectees)}`,
      "rappel mesuré contre les incidents injectés", "positif");

  creerSegments("seg-anomalies", [1, 2, 3].map((j) => ({ label: jourLong(j), valeur: j })), dessineAnomalies, 0);
  dessineAnomalies(1);

  dessineAnticipation();
}

function dessineAnticipation() {
  const a = DONNEES.anticipation;
  document.getElementById("kpi-anticipation").innerHTML =
    carteKpi("Surcharges anticipées", a.predites,
      "annoncées avant le festival", "positif") +
    carteKpi("Confirmées le jour J", `${a.correctes}/${a.predites}`,
      "alertes qui se sont réalisées", "positif") +
    carteKpi("Précision", `${Math.round(a.precision * 100)} %`,
      "quand on alerte, on a raison", "positif") +
    carteKpi("Rappel", `${Math.round(a.rappel * 100)} %`,
      "des surcharges réelles anticipées", "positif");

  const lignes = [...a.alertes].sort((x, y) => x.creneau - y.creneau);
  document.getElementById("table-anticipation").innerHTML =
    "<table><thead><tr><th>Heure</th><th>Scène</th><th>Occupation prévue</th>"
    + "<th>Occupation réelle</th><th>Alerte</th></tr></thead><tbody>"
    + lignes.map((l) => {
        const prevu = Math.round(l.taux_prevu * 100);
        const reel = Math.round(l.taux_reel * 100);
        const badge = l.realise
          ? `<span class="tag tag-ok">confirmée</span>`
          : `<span class="tag tag-neutre">non survenue</span>`;
        return `<tr><td>${heureTexte(l.creneau)}</td><td>${NOMS_SCENES[l.scene_id]}</td>`
          + `<td>${prevu} %</td><td>${reel} %</td><td>${badge}</td></tr>`;
      }).join("")
    + "</tbody></table>";
}

function dessineAnomalies(jour) {
  const anos = DONNEES.anomalies.filter((a) => a.jour === jour).sort((a, b) => a.creneau - b.creneau);
  const creneaux = creneauxDuJour(jour);
  const heures = creneaux.map(heureTexte);
  const nomScene = (id) => NOMS_SCENES[id] || "Hors scène";
  const categoriesY = [...new Set(anos.map((a) => nomScene(a.scene_id)))];

  graphe("graph-anomalies").setOption({
    tooltip: { ...tooltipBase(),
      formatter: (pa) => `<b>${pa.data.type}</b><br>${pa.value[1]} · ${pa.value[0]}<br>Gravité ${pa.data.gravite} · source ${pa.data.source}` },
    legend: legendeBase(),
    grid: { left: 110, right: 20, top: 42, bottom: 30 },
    xAxis: { type: "category", data: heures, ...axesBase(), splitLine: { show: false } },
    yAxis: { type: "category", data: categoriesY,
      axisLabel: { color: C.texte, fontSize: 12 },
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { color: C.grille } } },
    series: ["haute", "moyenne", "basse"].map((g) => ({
      name: g, type: "scatter", symbolSize: 13,
      itemStyle: { color: C.grav[g], borderColor: "rgba(255,255,255,0.35)", borderWidth: 1 },
      data: anos.filter((a) => a.gravite === g).map((a) => ({
        value: [heureTexte(a.creneau), nomScene(a.scene_id)],
        symbol: SYMBOLES_TYPES[a.type] || "rect",
        type: a.type, gravite: a.gravite, source: a.source,
      })),
    })),
  }, true);

  document.getElementById("table-anomalies").innerHTML =
    "<table><thead><tr><th>Heure</th><th>Scène</th><th>Type</th><th>Gravité</th><th>Source</th></tr></thead><tbody>" +
    anos.map((a) => `<tr><td>${heureTexte(a.creneau)}</td><td>${nomScene(a.scene_id)}</td>` +
      `<td>${a.type}</td><td><span class="tag tag-${a.gravite}">${a.gravite}</span></td><td>${a.source}</td></tr>`).join("") +
    "</tbody></table>";
}

/* ================= Allocation ================= */

function initAllocation() {
  const al = DONNEES.allocation;
  const delta = (al.couverture_ajustee - al.couverture_figee).toFixed(1);
  document.getElementById("kpi-allocation").innerHTML =
    carteKpi("Besoins prévus couverts", al.couverture_initiale.toFixed(1) + " %", "allocation initiale") +
    carteKpi("Besoins ajustés, allocation figée", al.couverture_figee.toFixed(1) + " %", "sans réaction aux anomalies", "negatif") +
    carteKpi("Après réallocation", al.couverture_ajustee.toFixed(1) + " %", `+${delta} pts de couverture`, "positif");

  const jours = [...new Set(al.lignes.map((l) => l.jour))].sort((a, b) => a - b);
  const types = [...new Set(al.lignes.map((l) => l.type))].sort();
  allocEtat = { jour: jours[0], type: types[0] };
  creerSegments("seg-allocation-jour", jours.map((j) => ({ label: jourLong(j), valeur: j })),
    (j) => { allocEtat.jour = j; dessineAllocation(); }, 0);
  creerSegments("seg-allocation", types.map((t) => ({ label: t, valeur: t })),
    (t) => { allocEtat.type = t; dessineAllocation(); }, 0);
  dessineAllocation();

  dessineDimensionnement();
}

/* ================= Transport & billetterie (clic sur l'entrée) ================= */

function initTransport() {
  dessineTransport();
  dessineBilletterie("billetterie-panneau-t");
}

const LIBELLES_DOMAINE = { securite: "Sécurité", food: "Food", sanitaire: "Sanitaire",
                           medical: "Médical", transport: "Transport" };

// Selection courante du panneau Allocation (jour + domaine).
let allocEtat = { jour: 1, type: "food" };

function dessineTransport() {
  const t = DONNEES.transport;
  const flux = [...t.flux].sort((a, b) => a.creneau - b.creneau);
  const heures = flux.map((f) => heureTexte(f.creneau));
  const debit = t.debit_creneau;

  graphe("graph-transport").setOption({
    tooltip: { ...tooltipBase(), axisPointer: { type: "shadow" },
      formatter: (pa) => {
        const l = pa.map((p) => `${p.marker}${p.seriesName} : ${fmt(p.value)}`).join("<br>");
        return `${pa[0].axisValue}<br>${l}`;
      } },
    legend: { data: ["Arrivées", "Départs"], top: 0, right: 4, textStyle: { color: C.texte },
      itemWidth: 12, itemHeight: 12, itemGap: 16 },
    grid: { left: 44, right: 16, top: 34, bottom: 30 },
    xAxis: { type: "category", data: heures, ...axesBase(), splitLine: { show: false } },
    yAxis: { type: "value", ...axesBase(),
      axisLabel: { color: C.axe, fontSize: 11, formatter: (v) => fmt(v) },
      splitLine: { lineStyle: { color: C.grille } } },
    series: [
      { name: "Arrivées", type: "bar", barWidth: "40%", barGap: "0%",
        itemStyle: { color: "#5aa0d6", borderRadius: [3, 3, 0, 0] },
        data: flux.map((f) => f.arrivees) },
      { name: "Départs", type: "bar", barWidth: "40%",
        itemStyle: { color: "#ff7a18", borderRadius: [3, 3, 0, 0] },
        data: flux.map((f) => f.departs),
        markLine: { silent: true, symbol: "none",
          lineStyle: { color: C.texte, type: "dashed", width: 1 },
          label: { color: C.texte, fontSize: 10, position: "insideStartTop",
            formatter: `Débit flotte : ${fmt(debit)}/30 min` },
          data: [{ yAxis: debit }] } },
    ],
  });

  document.getElementById("transport-resume").innerHTML =
    `<div class="dim-ligne"><span class="dim-domaine">Pic de départs</span>
       <span class="dim-nombre" style="color:#ff7a18">${fmt(t.pic_departs)}</span>
       <span class="dim-note">personnes à évacuer à la clôture (~minuit),
       ${jourLong(t.jour).replace(/ 2026$/, "")} — le jour le plus chargé</span></div>
     <div class="dim-ligne"><span class="dim-domaine">Flotte idéale</span>
       <span class="dim-nombre">${fmt(t.flotte_ideale)}</span>
       <span class="dim-note">navettes</span></div>
     <div class="dim-ligne"><span class="dim-domaine">Personnel</span>
       <span class="dim-nombre">${fmt(t.staff_ideal)}</span>
       <span class="dim-note">agents transport (2 par navette)</span></div>
     <p class="sous-note" style="margin-top:14px"><strong>Pourquoi ${fmt(t.flotte_ideale)} navettes&nbsp;?</strong>
     ${fmt(t.pic_departs)} départs × ${Math.round(t.part_navette * 100)} % en navette =
     ${fmt(t.partants_navette)} personnes à évacuer, en ${fmt(t.fenetre_evac_h)} h (${fmt(t.fenetre_evac_h * 2)} rotations
     de ${fmt(t.capacite_navette)} places) → ${fmt(t.partants_navette)} ÷ ${fmt(t.capacite_navette * t.fenetre_evac_h * 2)}
     ≈ ${fmt(t.flotte_ideale)}.</p>
     <p class="sous-note" style="margin-top:8px"><strong>Le ${Math.round(t.part_navette * 100)} %</strong> est une
     hypothèse de report modal (le reste vient en voiture, à pied ou en transports en commun) : c'est le
     paramètre à ajuster selon l'implantation réelle du site et l'offre de parking.</p>`;
}

function dessineDimensionnement() {
  const dim = DONNEES.dimensionnement;
  const niveaux = dim.niveaux;
  const couleurNiveau = (c) => (c >= 0.999 ? "#0ca30c" : c >= 0.9 ? "#fab219" : "#d03b3b");

  graphe("graph-dimensionnement").setOption({
    tooltip: { ...tooltipBase(),
      formatter: (pa) => {
        const n = niveaux[pa.dataIndex];
        return `<b>${n.niveau_pct} % de l'effectif de pointe</b><br>`
          + `Couverture : ${(n.couverture_globale * 100).toFixed(1)} %<br>`
          + `${n.creneaux_decouverts} créneau(x) à découvert`;
      } },
    grid: { left: 52, right: 16, top: 20, bottom: 46 },
    xAxis: { type: "category", data: niveaux.map((n) => n.niveau_pct + " %"),
      name: "Effectif déployé", nameLocation: "middle", nameGap: 32,
      nameTextStyle: { color: C.axe }, ...axesBase(), splitLine: { show: false } },
    yAxis: { type: "value", min: 0, max: 100, axisLabel: { color: C.axe, formatter: "{value} %" },
      name: "Couverture", nameTextStyle: { color: C.axe }, ...axesBase() },
    series: [{
      type: "bar", barWidth: "52%",
      data: niveaux.map((n) => ({
        value: Math.round(n.couverture_globale * 1000) / 10,
        itemStyle: { color: couleurNiveau(n.couverture_globale), borderRadius: [6, 6, 0, 0] },
      })),
      markLine: {
        silent: true, symbol: "none",
        lineStyle: { color: "#3ecf6a", type: "dashed", width: 2 },
        label: { formatter: "Objectif : 100 % couvert", color: "#3ecf6a", fontSize: 11,
                 fontWeight: 600, position: "insideStartBottom" },
        data: [{ yAxis: 100 }],
      },
    }],
  });

  const inst = dim.installations || {};
  const dispo = (dim && DONNEES.allocation.disponible) || {};
  const dispoMax = (t) => Math.max(0, ...(dispo[t] || [0]));
  document.getElementById("dimensionnement-ideal").innerHTML = dim.ideal
    .sort((a, b) => b.ideal - a.ideal)
    .map((d) => {
      const deploye = dispoMax(d.type);
      const noteDispo = deploye
        ? `agents (pic prévu ${fmt(d.reference)} ; on en déploie jusqu'à ${fmt(deploye)})`
        : `agents (pic prévu ${fmt(d.reference)})`;
      const i = inst[d.type];
      let repartition = "";
      if (i && i.nombre) {
        const parInstall = Math.round(d.ideal / i.nombre);
        repartition = `<span class="dim-repartition">répartis sur ≈ ${i.nombre} ${i.libelle}
          (~${parInstall}/installation)</span>`;
      } else if (i) {
        repartition = `<span class="dim-repartition">${i.libelle}</span>`;
      }
      return `<div class="dim-ligne">
        <span class="dim-domaine">${LIBELLES_DOMAINE[d.type] || d.type}</span>
        <span class="dim-nombre">${fmt(d.ideal)}</span>
        <span class="dim-note">${noteDispo}</span>
        ${repartition}
      </div>`;
    })
    .join("");
}

function dessineAllocation() {
  const { jour, type } = allocEtat;
  const lignes = DONNEES.allocation.lignes.filter((l) => l.type === type && l.jour === jour);
  const creneaux = [...new Set(lignes.map((l) => l.creneau))].sort((a, b) => a - b);
  const heures = creneaux.map(heureTexte);

  const dispo = DONNEES.allocation.disponible || {};
  const dispoMap = {};
  (dispo._creneaux || []).forEach((c, i) => { dispoMap[c] = (dispo[type] || [])[i]; });
  const dispoData = creneaux.map((c) => dispoMap[c] ?? null);

  graphe("graph-allocation").setOption({
    tooltip: { ...tooltipBase(), trigger: "axis" },
    legend: legendeBase(),
    grid: { left: 48, right: 16, top: 42, bottom: 30 },
    xAxis: { type: "category", data: heures, ...axesBase(), splitLine: { show: false } },
    yAxis: { type: "value", name: "Personnel", nameTextStyle: { color: C.axe },
      boundaryGap: [0, "14%"], ...axesBase() },
    series: [
      ...[1, 2, 3].map((s) => ({
        name: NOMS_SCENES[s], type: "bar", stack: "total", barWidth: "58%",
        itemStyle: { color: C.scene[s] },
        data: creneaux.map((cr) => {
          const l = lignes.find((x) => x.creneau === cr && x.scene_id === s);
          return l ? l.alloue : 0;
        }),
      })),
      { name: "Effectif disponible", type: "line", step: "middle", symbol: "none",
        lineStyle: { color: C.texte, type: "dashed", width: 1.5 },
        data: dispoData, z: 5 },
    ],
  }, true);

  const parScene = [1, 2, 3].map((s) => ({
    nom: NOMS_SCENES[s],
    besoin: lignes.filter((l) => l.scene_id === s).reduce((a, l) => a + l.besoin, 0),
    alloue: lignes.filter((l) => l.scene_id === s).reduce((a, l) => a + l.alloue, 0),
  }));

  graphe("graph-besoin-alloue").setOption({
    tooltip: { ...tooltipBase(), trigger: "axis" },
    legend: legendeBase(),
    grid: { left: 48, right: 16, top: 42, bottom: 30 },
    xAxis: { type: "category", data: parScene.map((p) => p.nom), ...axesBase(), splitLine: { show: false } },
    yAxis: { type: "value", name: "Personnel (cumul)", nameTextStyle: { color: C.axe }, ...axesBase() },
    series: [
      { name: "Besoin", type: "bar", barWidth: "26%", itemStyle: { color: "#7a4a30", borderRadius: [5, 5, 0, 0] },
        data: parScene.map((p) => p.besoin) },
      { name: "Alloué", type: "bar", barWidth: "26%", itemStyle: { color: "#ff7a18", borderRadius: [5, 5, 0, 0] },
        data: parScene.map((p) => p.alloue) },
    ],
  }, true);
}

/* ================= Recommandations ================= */

function initRecommandations() {
  const etiquettes = { critique: "Critique", eleve: "Élevé", moyen: "À surveiller", info: "Décision", ok: "Validé" };
  document.getElementById("liste-recos").innerHTML = DONNEES.recommandations.map((r) =>
    `<div class="reco reco-${r.gravite}">
      <div class="r-tete"><span class="badge">${etiquettes[r.gravite] || "Info"}</span>
      <span class="r-titre">${r.titre}</span></div>
      <div class="r-detail">${r.detail}</div>
    </div>`).join("");
}

/* ================= Scénarios ================= */

function initScenarios() {
  const synthese = ORDRE_SCENARIOS.map((n) => DONNEES.scenarios.synthese.find((s) => s.scenario === n));
  const base = synthese.find((s) => s.scenario === "base");
  const meilleur = [...synthese].sort((a, b) => a.taux_surcharge - b.taux_surcharge)[0];
  const ecartCout = meilleur.cout_personnel - base.cout_personnel;
  const libelle = (n) => n.replace(/_/g, " ");

  document.getElementById("kpi-scenarios").innerHTML =
    carteKpi("Meilleure configuration", libelle(meilleur.scenario), "sur le critère surcharge", "positif") +
    carteKpi("Créneaux en surcharge", (meilleur.taux_surcharge * 100).toFixed(1) + " %",
      `${((meilleur.taux_surcharge - base.taux_surcharge) * 100).toFixed(1)} pts vs base`, "positif") +
    carteKpi("Pic d'occupation", meilleur.pic_occupation.toFixed(2),
      `${(meilleur.pic_occupation - base.pic_occupation).toFixed(2)} vs base`, "positif") +
    carteKpi("Coût du personnel", fmt(meilleur.cout_personnel) + " €",
      Math.abs(ecartCout) < 1 ? "identique à la base" : `${ecartCout > 0 ? "+" : ""}${fmt(ecartCout)} € vs base`,
      Math.abs(ecartCout) < 1 ? "" : "negatif");

  const noms = synthese.map((s) => libelle(s.scenario));

  graphe("graph-surcharge").setOption({
    tooltip: { ...tooltipBase(), valueFormatter: (v) => v.toFixed(1) + " %" },
    grid: { left: 48, right: 16, top: 16, bottom: 46 },
    xAxis: { type: "category", data: noms, ...axesBase(),
      axisLabel: { color: C.axe, fontSize: 10.5, interval: 0, width: 110, overflow: "break" },
      splitLine: { show: false } },
    yAxis: { type: "value", axisLabel: { color: C.axe, formatter: "{value} %" }, ...axesBase() },
    series: [{ type: "bar", barWidth: "46%",
      itemStyle: { color: "#e63419", borderRadius: [6, 6, 0, 0] },
      data: synthese.map((s) => Math.round(s.taux_surcharge * 1000) / 10) }],
  });

  graphe("graph-cout").setOption({
    tooltip: { ...tooltipBase(), valueFormatter: (v) => fmt(v) + " €" },
    grid: { left: 64, right: 16, top: 16, bottom: 46 },
    xAxis: { type: "category", data: noms, ...axesBase(),
      axisLabel: { color: C.axe, fontSize: 10.5, interval: 0, width: 110, overflow: "break" },
      splitLine: { show: false } },
    yAxis: { type: "value", ...axesBase(), axisLabel: { color: C.axe, fontSize: 11, formatter: (v) => fmt(v / 1000) + " k€" } },
    series: [{ type: "bar", barWidth: "46%",
      itemStyle: { color: "#ffb300", borderRadius: [6, 6, 0, 0] },
      data: synthese.map((s) => s.cout_personnel) }],
  });

  graphe("graph-couverture").setOption({
    tooltip: { ...tooltipBase(),
      formatter: (pa) => `${noms[pa.value[0]]} · run ${pa.data.run + 1}<br>Couverture : ${(pa.value[1] * 100).toFixed(1)} %` },
    grid: { left: 64, right: 16, top: 16, bottom: 46 },
    xAxis: { type: "category", data: noms, ...axesBase(),
      axisLabel: { color: C.axe, fontSize: 10.5, interval: 0, width: 110, overflow: "break" },
      splitLine: { show: false } },
    yAxis: { type: "value", scale: true,
      min: (v) => Math.floor((v.min - 0.002) * 1000) / 1000,
      max: (v) => Math.ceil((v.max + 0.002) * 1000) / 1000,
      axisLabel: { color: C.axe, formatter: (v) => (v * 100).toFixed(1) + " %" }, ...axesBase() },
    series: [{ type: "scatter", symbolSize: 12,
      itemStyle: { color: "#ff9a3c", opacity: 0.85, borderColor: "rgba(255,255,255,0.4)", borderWidth: 1 },
      data: DONNEES.scenarios.details.map((d) => ({
        value: [ORDRE_SCENARIOS.indexOf(d.scenario), d.couverture_besoins], run: d.run })) }],
  });

  document.getElementById("table-scenarios").innerHTML =
    "<table><thead><tr><th>Scénario</th><th>Créneaux en surcharge</th><th>Pic d'occupation</th>" +
    "<th>Couverture besoins</th><th>Coût personnel (3 j)</th></tr></thead><tbody>" +
    synthese.map((s) => `<tr><td>${libelle(s.scenario)}</td>` +
      `<td>${(s.taux_surcharge * 100).toFixed(1)} %</td><td>${s.pic_occupation.toFixed(2)}</td>` +
      `<td>${(s.couverture_besoins * 100).toFixed(1)} %</td><td>${fmt(s.cout_personnel)} €</td></tr>`).join("") +
    "</tbody></table>";

  // Recommandations intégrées à la fin du panneau scénarios.
  initRecommandations();
}

/* ================= Démarrage ================= */

// La carte 3D est le cœur du site : on la monte plein écran au chargement.
// Les analyses s'ouvrent ensuite dans le drawer via les clics sur la carte.
monteCarte();
