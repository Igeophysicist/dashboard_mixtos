/**
 * data.js
 * Carga el JSON de proyectos y el/los KML, los vincula por nombre
 * normalizado y expone un arreglo único de proyectos enriquecidos.
 *
 * ESTRATEGIA DE VINCULACIÓN JSON <-> KML
 * ---------------------------------------------------------------
 * Cada proyecto en el JSON tiene "TÍTULO 2" (y "TÍTULO 1" como respaldo).
 * Cada Placemark del KML tiene <name>. Se vinculan comparando ambos
 * valores normalizados (mayúsculas, sin acentos, sin espacios/puntuación
 * redundante). Esto es intencional: así el JSON sigue siendo la única
 * fuente de verdad para los datos ejecutivos, y el KML sólo aporta
 * geometría. Mientras el nombre del proyecto coincida (aunque sea con
 * acentos/mayúsculas distintas) entre ambos archivos, la vinculación es
 * automática — no se requiere mantener IDs paralelos.
 *
 * Para agregar más archivos KML en el futuro, súmalos a KML_SOURCES.
 */

const DATA_SOURCES = {
  json: "data/dataparsedprueba.json",
};

const KML_SOURCES = [
  "data/ENTRADA_PROYECTOS.kml", "data/AREAS_REFERENCIA.kml",
  // Para agregar una capa KML adicional (p. ej. polígonos de referencia
  // por proyecto), solo súmala aquí. Si sus Placemark usan el mismo
  // <name> que un proyecto, se vincula automáticamente y se dibuja junto
  // al punto de ese proyecto (ver "geoAreas" más abajo).
  // "data/OTRA_CAPA.kml",
];

const GRUPO_INFO = {
  A: { label: "En orden", short: "A", css: "a", color: "#1e7a52" },
  B: { label: "En seguimiento", short: "B", css: "b", color: "#a3781a" },
  C: { label: "En riesgo", short: "C", css: "c", color: "#b83b3b" },
};

function normalizeName(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toUpperCase()
    .replace(/[.,;:()"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parsePercent(value) {
  return parseNumber(value); // los % ya vienen como texto "81.6%"
}

function parseDateFlexible(value) {
  if (!value || typeof value !== "string") return null;
  const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = value.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = "20" + y;
    const date = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${res.status})`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${res.status})`);
  return res.text();
}

/**
 * Construye un índice normalizado nombre -> [placemarks] a partir de
 * varios KML. Un mismo nombre de proyecto puede tener MÁS DE UN
 * placemark si aparece en distintos archivos KML — típicamente un punto
 * (ubicación) en uno y un polígono (área de referencia) en otro. Por eso
 * el índice guarda un arreglo por nombre en vez de un solo placemark.
 */
async function buildGeoIndex(kmlUrls) {
  const index = new Map();
  const warnings = [];

  for (const url of kmlUrls) {
    let placemarks = [];
    try {
      const xml = await fetchText(url);
      placemarks = window.KMLParser.parse(xml);
    } catch (err) {
      warnings.push(`No se pudo leer ${url}: ${err.message}`);
      continue;
    }
    placemarks.forEach((pm) => {
      const key = normalizeName(pm.name);
      if (!key) return;
      const existing = index.get(key) || [];
      // Solo se avisa si hay dos geometrías del MISMO tipo con el mismo
      // nombre (eso sí es un duplicado real y ambiguo). Un punto + un
      // polígono compartiendo nombre es el caso esperado, no un error.
      if (existing.some((p) => p.type === pm.type)) {
        warnings.push(`Geometría "${pm.type}" duplicada en KML para "${pm.name}".`);
      }
      existing.push(pm);
      index.set(key, existing);
    });
  }

  return { index, warnings };
}

/** Carga y ensambla todo el dataset de la aplicación */
async function loadDataset() {
  const [rawProjects, geo] = await Promise.all([
    fetchJSON(DATA_SOURCES.json),
    buildGeoIndex(KML_SOURCES),
  ]);

  const warnings = [...geo.warnings];
  const projects = Object.keys(rawProjects).map((id) => {
    const raw = rawProjects[id];
    const nombre = raw["TÍTULO 2"] || raw["TÍTULO 1"] || `Proyecto ${id}`;
    const key = normalizeName(nombre) || normalizeName(raw["TÍTULO 1"]);
    const matches = geo.index.get(key) || [];

    // Geometría principal: preferimos el punto (marcador + etiqueta del
    // nombre); si el proyecto solo tiene un polígono, ese se usa como
    // principal. El resto de geometrías (p. ej. un polígono adicional
    // de referencia) se guarda aparte en "geoAreas" y se dibuja también
    // en el mapa, pero sin duplicar el marcador/etiqueta principal.
    const primary = matches.find((m) => m.type === "point") || matches[0] || null;
    const areas = matches.filter((m) => m !== primary);

    if (!primary) {
      warnings.push(`Sin geometría en KML para el proyecto "${nombre}".`);
    }

    return {
      id,
      raw,
      nombre,
      socio: raw["Socio"] || "",
      tecnologia: raw["Tecnología"] || "",
      ubicacion: raw["Ubicación"] || "",
      capacidad: raw["Capacidad"] || "",
      capacidadNum: parseNumber(raw["Capacidad"]),
      bess: raw["Almacenamiento (BESS)"] || "",
      horasAlmacenamiento: raw["Horas de Almacenamiento"] ?? null,
      inicioConstruccion: raw["Inicio de Construcción"] || "",
      inicioConstruccionFecha: parseDateFlexible(raw["Inicio de Construcción"]),
      finConstruccion: raw["Fin de Construcción"] || "",
      finConstruccionFecha: parseDateFlexible(raw["Fin de Construcción"]),
      firmaContrato: raw["Fecha firma de contrato"] || "",
      firmaContratoFecha: parseDateFlexible(raw["Fecha firma de contrato"]),
      capex: raw["CAPEX"] || "",
      capexNum: parseNumber(raw["CAPEX"]),
      parque: raw["Parque"] || "",
      parquePct: parsePercent(raw["Parque"]),
      lt: raw["LT"] || "",
      ltPct: parsePercent(raw["LT"]),
      global: raw["Global"] || "",
      globalPct: parsePercent(raw["Global"]),
      grupo: raw["Grupo de atención"] || "",
      geo: primary
        ? { type: primary.type, latlngs: primary.latlngs, folderPath: primary.folderPath }
        : null,
      geoAreas: areas.map((a) => ({ type: a.type, latlngs: a.latlngs, folderPath: a.folderPath })),
    };
  });

  return { projects, warnings };
}

window.AppData = {
  loadDataset,
  normalizeName,
  parseNumber,
  GRUPO_INFO,
};
