const C = {
  scene: { 1: "#3987e5", 2: "#199e70", 3: "#c98500" },
  jours: ["#3987e5", "#199e70", "#c98500"],
  grav: { haute: "#d03b3b", moyenne: "#ec835a", basse: "#fab219" },
  seq: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
  axe: "#8b8ba0",
  grille: "#1e1e2a",
  texte: "#a9a9be",
  fondTooltip: "#15151f",
};

const POSITIONS = { 1: [50, 76], 2: [20, 30], 3: [80, 30] };
const STYLES_POI = {
  stand_boisson: ["diamond", "#c98500"],
  stand_nourriture: ["diamond", "#c98500"],
  stand_mixte: ["diamond", "#c98500"],
  toilettes: ["rect", "#6da7ec"],
  secourisme: ["pin", "#199e70"],
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

const graphs = {};
function graphe(id) {
  if (!graphs[id]) graphs[id] = echarts.init(document.getElementById(id));
  return graphs[id];
}
window.addEventListener("resize", () => Object.values(graphs).forEach((g) => g.resize()));

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

/* ================= Navigation ================= */

const initialisees = {};
const INIT = {
  accueil: initAccueil, programmation: initProgrammation, carte: initCarte,
  affluence: initAffluence, previsions: initPrevisions, anomalies: initAnomalies,
  allocation: initAllocation, recommandations: initRecommandations, scenarios: initScenarios,
};

function afficherPage(nom) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("actif", b.dataset.page === nom));
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("actif", p.id === "page-" + nom));
  fermerMenu();
  window.scrollTo({ top: 0, behavior: "instant" });
  if (!initialisees[nom]) { initialisees[nom] = true; INIT[nom](); }
  else requestAnimationFrame(() => Object.values(graphs).forEach((g) => g.resize()));
}

document.querySelectorAll(".nav-item").forEach((b) =>
  b.addEventListener("click", () => afficherPage(b.dataset.page)));

const sidebar = document.getElementById("sidebar");
const boutonMenu = document.getElementById("bouton-menu");
const voile = document.getElementById("voile");
boutonMenu.addEventListener("click", () => {
  sidebar.classList.add("ouvert");
  document.body.classList.add("menu-ouvert");
});
voile.addEventListener("click", fermerMenu);
function fermerMenu() {
  sidebar.classList.remove("ouvert");
  document.body.classList.remove("menu-ouvert");
}

/* ================= Accueil ================= */

function initAccueil() {
  const conteneur = document.getElementById("headliners");
  [1, 2, 3].forEach((jour) => {
    const prog = DONNEES.programmation
      .filter((p) => p.jour === jour)
      .sort((a, b) => b.popularite - a.popularite || b.heure_debut - a.heure_debut)
      .slice(0, 3);
    const carte = document.createElement("div");
    carte.className = "jour-carte revele";
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

  const observateur = new IntersectionObserver((entrees) => {
    entrees.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); observateur.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll(".revele").forEach((el) => observateur.observe(el));

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
}

/* ================= Programmation ================= */

function initProgrammation() {
  creerSegments("seg-prog", [1, 2, 3].map((j) => ({ label: jourLong(j), valeur: j })), dessineProgrammation, 0);
  dessineProgrammation(1);
}

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
      type: "value", min: 16 * 60, max: 24 * 60, interval: 60,
      axisLabel: { color: C.axe, formatter: (v) => heureTexte(v) },
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
              align: "center", verticalAlign: "middle", fill: "#fff", fontSize: 12, fontWeight: 600,
              overflow: "truncate", width: rect.width - 12 } },
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

/* ================= Carte du site ================= */

let jourCarte = 2;
let editionCarte = null;
let carte3dApi = null;
let clicCarte2dLie = false;

function editionCourante() {
  return DONNEES.cartes_editions.find((e) => e.annee === editionCarte)
    || DONNEES.cartes_editions[DONNEES.cartes_editions.length - 1];
}

function initCarte() {
  const editions = DONNEES.cartes_editions;
  editionCarte = editions[editions.length - 1].annee;

  creerSegments("seg-edition", editions.map((e) => ({
    label: e.type === "prediction" ? e.annee + " · Prédiction" : String(e.annee),
    valeur: e.annee,
  })), (a) => { editionCarte = a; changeEditionCarte(a); }, editions.length - 1);

  creerSegments("seg-carte", [1, 2, 3].map((j) => ({ label: jourLong(j), valeur: j })),
    (j) => { jourCarte = j; changeJourCarte(j); }, 1);

  document.getElementById("detail-fermer").addEventListener("click", () => {
    document.getElementById("panneau-detail").hidden = true;
  });

  monteCarte();
}

function monteCarte() {
  if (window.Carte3D) {
    try {
      carte3dApi = Carte3D.monte(document.getElementById("graph-carte"), {
        donnees: {
          scenes: DONNEES.scenes,
          pois: DONNEES.pois,
          jours_long: DONNEES.jours_long,
          editions: DONNEES.cartes_editions,
        },
        edition: editionCarte,
        jour: jourCarte,
        onScene: (id) => montrerProgrammeScene(id),
        onPoi: (p) => montrerDetailPoi(p),
      });
      majInfosCarte();
      return;
    } catch (e) {
      console.error("Carte 3D indisponible, repli sur la carte 2D", e);
      carte3dApi = null;
    }
  }
  dessineCarte2D();
}

function changeEditionCarte(a) {
  if (carte3dApi) { carte3dApi.setEdition(a); majInfosCarte(); }
  else dessineCarte2D();
}

function changeJourCarte(jour) {
  if (carte3dApi) { carte3dApi.setJour(jour); majInfosCarte(); }
  else dessineCarte2D();
}

function majInfosCarte() {
  const ed = editionCourante();
  const aff = ed.affluence.filter((a) => a.jour === jourCarte);
  const pic = Math.max(...aff.map((a) => a.nb_visiteurs));
  const nbAnos = ed.anomalies.filter((a) => a.jour === jourCarte).length;
  const badge = ed.type === "prediction"
    ? `<span class="carte-badge pred">Prédiction ${ed.annee}</span>`
    : `<span class="carte-badge hist">Déroulé réel ${ed.annee}</span>`;
  document.getElementById("kpi-carte").innerHTML =
    `${badge}<span><b>${fmt(pic)}</b> pic du jour</span><span><b>${nbAnos}</b> anomalies</span>`;
  document.getElementById("panneau-detail").hidden = true;
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
      lineStyle: { color: "rgba(79,124,255,0.45)", curveness: 0.12 },
      effect: mouvementReduit ? { show: false } : { show: true, period: 3.2, trailLength: 0.3, symbolSize: 4, color: "#9db8ff" },
      data: fluxData },
    { id: "pois", type: "scatter", z: 3, cursor: "pointer", data: poisData },
    { id: "scenes", type: "scatter", z: 5, cursor: "pointer", data: scenesData },
    { id: "anoms", type: "scatter", z: 6, symbol: "triangle", symbolSize: 15,
      itemStyle: { color: C.grav.haute, borderColor: "#08080d", borderWidth: 1 }, data: anomsData },
  ];
}

function dessineCarte2D() {
  const jour = jourCarte;
  const ed = editionCourante();
  const creneaux = [...new Set(ed.affluence.filter((a) => a.jour === jour).map((a) => a.creneau))].sort((a, b) => a - b);
  const g = graphe("graph-carte");
  if (!clicCarte2dLie) {
    g.on("click", (params) => {
      if (params.seriesId === "scenes") montrerProgrammeScene(params.data.sceneId);
      if (params.seriesId === "pois") montrerDetailPoi(params.data.poi);
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
        lineStyle: { color: "#2b2b3d" },
        itemStyle: { color: "#4a4a60" },
        checkpointStyle: { color: "#4f7cff", borderColor: "rgba(79,124,255,0.35)", symbolSize: 14 },
        progress: { lineStyle: { color: "#4f7cff" }, itemStyle: { color: "#4f7cff" } },
        controlStyle: { color: "#d7d7e4", borderColor: "#4a4a60" },
      },
      tooltip: {
        ...tooltipBase(),
        formatter: (pa) => {
          if (pa.seriesId === "scenes") {
            return `<b>${NOMS_SCENES[pa.data.sceneId]}</b><br>${fmt(pa.data.nb)} visiteurs<br>` +
              `Occupation : ${Math.round(pa.data.taux * 100)} %<br>Capacité : ${fmt(CAPACITES[pa.data.sceneId])}<br>` +
              `<i>Cliquer pour voir le programme</i>`;
          }
          if (pa.seriesId === "pois") {
            const p = pa.data.poi;
            return DONNEES.menus[p.type] ? `<b>${p.nom}</b><br><i>Cliquer pour voir la carte</i>` : `<b>${p.nom}</b>`;
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

  majInfosCarte();
}

function montrerProgrammeScene(sceneId) {
  const ed = editionCourante();
  document.getElementById("detail-titre").textContent =
    `${NOMS_SCENES[sceneId]} · ${jourLong(jourCarte)}`;
  if (ed.type === "prediction") {
    const prog = ed.programmation
      .filter((p) => p.jour === jourCarte && p.scene_id === sceneId)
      .sort((a, b) => a.heure_debut - b.heure_debut);
    document.getElementById("detail-corps").innerHTML =
      "<table><thead><tr><th>Horaire</th><th>Artiste</th><th>Notoriété</th></tr></thead><tbody>" +
      prog.map((p) => `<tr><td>${heureTexte(p.heure_debut)} – ${heureTexte(p.heure_fin)}</td>` +
        `<td>${p.artiste}</td><td>${p.popularite}/10</td></tr>`).join("") +
      "</tbody></table>";
  } else {
    document.getElementById("detail-corps").innerHTML =
      `<p style="color:var(--texte-2)">Édition passée : l'affluence est rejouée d'après ` +
      `l'historique ${ed.annee}. La programmation d'époque n'est pas conservée.</p>`;
  }
  const panneau = document.getElementById("panneau-detail");
  panneau.hidden = false;
  panneau.scrollIntoView({ behavior: mouvementReduit ? "instant" : "smooth", block: "nearest" });
}

function montrerDetailPoi(poi) {
  const menu = DONNEES.menus[poi.type];
  document.getElementById("detail-titre").textContent = poi.nom;
  document.getElementById("detail-corps").innerHTML = menu
    ? "<table><thead><tr><th>Produit</th><th>Prix</th></tr></thead><tbody>" +
      menu.map((l) => `<tr><td>${l[0]}</td><td>${l[1].toFixed(2).replace(".", ",")} €</td></tr>`).join("") +
      "</tbody></table>"
    : `<p style="color:var(--texte-2)">Point d'intérêt du site.</p>`;
  const panneau = document.getElementById("panneau-detail");
  panneau.hidden = false;
  panneau.scrollIntoView({ behavior: mouvementReduit ? "instant" : "smooth", block: "nearest" });
}

/* ================= Affluence ================= */

function initAffluence() {
  creerSegments("seg-affluence", [1, 2, 3].map((j) => ({ label: jourLong(j), valeur: j })), dessineAffluence, 0);
  dessineAffluence(1);
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
      itemStyle: { borderColor: "#0d0e16", borderWidth: 2, borderRadius: 3 },
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
          itemStyle: { color: a === 2026 ? "#3987e5" : "#31415f", borderRadius: [6, 6, 0, 0] },
        })) },
      { name: "Prévision combinée (tendance + billetterie)", type: "scatter", symbol: "diamond", symbolSize: 16,
        itemStyle: { color: "#e66767", borderColor: "#0d0e16", borderWidth: 1.5 },
        data: annees.map((a) => (a === 2026 ? combinee2026 : null)) },
    ],
  });
}

function dessineBilletterie() {
  document.getElementById("billetterie-panneau").innerHTML = DONNEES.prevision_edition
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

function initPrevisions() {
  const m = DONNEES.metriques;
  const retenuForet = m.modele_retenu === "foret aleatoire";
  const nomRetenu = retenuForet ? "forêt aléatoire" : "régression linéaire";
  const nomAutre = retenuForet ? "régression linéaire" : "forêt aléatoire";
  const maeAutre = retenuForet ? m.mae_lineaire : m.mae_foret;
  const gainHistorique = (1 - m.mae_retenue / m.mae_sans_historique) * 100;

  document.getElementById("kpi-previsions").innerHTML =
    carteKpi("MAE modèle retenu", m.mae_retenue.toFixed(1),
      `${nomRetenu} · R² ${m.r2_retenu.toFixed(3)}`, "positif") +
    carteKpi(`MAE ${nomAutre}`, maeAutre.toFixed(1), "comparatif") +
    carteKpi("MAE modèle naïf", m.mae_naif.toFixed(1), "créneau précédent") +
    carteKpi("Apport de l'historique", `-${gainHistorique.toFixed(0)} %`,
      `MAE ${m.mae_sans_historique.toFixed(0)} → ${m.mae_retenue.toFixed(0)} grâce aux éditions 2022-2025`,
      "positif");

  dessineEditions();
  dessineBilletterie();
  creerSegments("seg-previsions", [1, 2, 3].map((s) => ({ label: NOMS_SCENES[s], valeur: s })), dessinePrevisions, 0);
  dessinePrevisions(1);

  const imp = [...DONNEES.importances].sort((a, b) => b.importance - a.importance);
  graphe("graph-importances").setOption({
    tooltip: { ...tooltipBase(), valueFormatter: (v) => v.toFixed(3) },
    grid: { left: 170, right: 30, top: 10, bottom: 30 },
    xAxis: { type: "value", ...axesBase() },
    yAxis: { type: "category", inverse: true,
      data: imp.map((i) => LIBELLES_VARIABLES[i.variable] || i.variable),
      axisLabel: { color: C.texte, fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: "bar", barWidth: "55%",
      itemStyle: { color: "#3987e5", borderRadius: [0, 5, 5, 0] },
      data: imp.map((i) => i.importance) }],
  });
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
        lineStyle: { width: 2.5, color: "#3987e5" }, itemStyle: { color: "#3987e5" },
        data: lignes.map((l) => l.nb_visiteurs) },
      { name: "Prévu", type: "line", smooth: 0.25, showSymbol: false,
        lineStyle: { width: 2.5, color: "#e66767", type: "dashed" }, itemStyle: { color: "#e66767" },
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

  const types = [...new Set(al.lignes.map((l) => l.type))].sort();
  creerSegments("seg-allocation", types.map((t) => ({ label: t, valeur: t })), dessineAllocation, 0);
  dessineAllocation(types[0]);

  dessineDimensionnement();
  dessineTransport();
}

const LIBELLES_DOMAINE = { securite: "Sécurité", food: "Food", sanitaire: "Sanitaire",
                           medical: "Médical", transport: "Transport" };

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
        itemStyle: { color: "#3987e5", borderRadius: [3, 3, 0, 0] },
        data: flux.map((f) => f.arrivees) },
      { name: "Départs", type: "bar", barWidth: "40%",
        itemStyle: { color: "#c98500", borderRadius: [3, 3, 0, 0] },
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
       <span class="dim-nombre" style="color:#c98500">${fmt(t.pic_departs)}</span>
       <span class="dim-note">personnes à évacuer à la clôture (~minuit)</span></div>
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
  document.getElementById("dimensionnement-ideal").innerHTML = dim.ideal
    .sort((a, b) => b.ideal - a.ideal)
    .map((d) => {
      const economie = d.reference - d.ideal;
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
        <span class="dim-note">${economie > 0
          ? `agents (soit ${economie} de moins que le pic ${fmt(d.reference)})`
          : `agents (le juste besoin de pointe)`}</span>
        ${repartition}
      </div>`;
    })
    .join("");
}

function dessineAllocation(type) {
  const lignes = DONNEES.allocation.lignes.filter((l) => l.type === type);
  const creneaux = [...new Set(lignes.map((l) => l.creneau))].sort((a, b) => a - b);
  const heures = creneaux.map(heureTexte);

  graphe("graph-allocation").setOption({
    tooltip: { ...tooltipBase(), trigger: "axis" },
    legend: legendeBase(),
    grid: { left: 48, right: 16, top: 42, bottom: 30 },
    xAxis: { type: "category", data: heures, ...axesBase(), splitLine: { show: false } },
    yAxis: { type: "value", name: "Personnel alloué", nameTextStyle: { color: C.axe }, ...axesBase() },
    series: [1, 2, 3].map((s) => ({
      name: NOMS_SCENES[s], type: "bar", stack: "total", barWidth: "58%",
      itemStyle: { color: C.scene[s] },
      data: creneaux.map((cr) => {
        const l = lignes.find((x) => x.creneau === cr && x.scene_id === s);
        return l ? l.alloue : 0;
      }),
    })),
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
      { name: "Besoin", type: "bar", barWidth: "26%", itemStyle: { color: "#9ec5f4", borderRadius: [5, 5, 0, 0] },
        data: parScene.map((p) => p.besoin) },
      { name: "Alloué", type: "bar", barWidth: "26%", itemStyle: { color: "#3987e5", borderRadius: [5, 5, 0, 0] },
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
      itemStyle: { color: "#3987e5", borderRadius: [6, 6, 0, 0] },
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
      itemStyle: { color: "#199e70", borderRadius: [6, 6, 0, 0] },
      data: synthese.map((s) => s.cout_personnel) }],
  });

  graphe("graph-couverture").setOption({
    tooltip: { ...tooltipBase(),
      formatter: (pa) => `${noms[pa.value[0]]} · run ${pa.data.run + 1}<br>Couverture : ${(pa.value[1] * 100).toFixed(1)} %` },
    grid: { left: 64, right: 16, top: 16, bottom: 46 },
    xAxis: { type: "category", data: noms, ...axesBase(),
      axisLabel: { color: C.axe, fontSize: 10.5, interval: 0, width: 110, overflow: "break" },
      splitLine: { show: false } },
    yAxis: { type: "value", min: (v) => v.min - 0.002, max: (v) => v.max + 0.002,
      axisLabel: { color: C.axe, formatter: (v) => (v * 100).toFixed(1) + " %" }, ...axesBase() },
    series: [{ type: "scatter", symbolSize: 12,
      itemStyle: { color: "#9d5cff", opacity: 0.85, borderColor: "rgba(255,255,255,0.4)", borderWidth: 1 },
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
}

/* ================= Démarrage ================= */

initialisees.accueil = true;
initAccueil();
