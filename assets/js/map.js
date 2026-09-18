/**
 * map.js
 * Encapsula el mapa Leaflet: renderizado de proyectos geolocalizados,
 * resaltado al seleccionar y sincronización con el resto del dashboard.
 */
(function (global) {
  // ------------------------------------------------------------------
  // AJUSTES DE ZOOM (edita estos dos valores para cambiar el comportamiento)
  // ------------------------------------------------------------------
  // Nivel de zoom a partir del cual aparece el nombre del proyecto junto
  // al marcador. Súbelo (p. ej. 10) si quieres que los nombres aparezcan
  // solo con más zoom (menos abarrotado); bájalo (p. ej. 6) para que
  // aparezcan antes. Valores típicos de Leaflet: 0 (mundo) a ~18 (calle).
  const LABEL_MIN_ZOOM = 8;

  // Caja que cubre aproximadamente todo México (suroeste y noreste).
  // Se usa como "mínimo" al encuadrar el mapa: la vista inicial (y cada
  // vez que se entra a la pestaña Mapa) siempre mostrará al menos esta
  // área, aunque los proyectos filtrados estén muy agrupados. Si tus
  // proyectos alguna vez incluyen ubicaciones fuera de México, la vista
  // se amplía automáticamente para incluirlos (fitBounds ya lo hace).
  const MEXICO_BOUNDS = [
    [14.3, -118.5], // suroeste
    [32.8, -86.5], // noreste
  ];
  // ------------------------------------------------------------------

  let map = null;
  let layerGroup = null;
  let markersById = new Map();
  let onMarkerSelect = () => {};
  let lastFitBounds = null;

  function colorFor(grupo) {
    return (global.AppData.GRUPO_INFO[grupo] || {}).color || "#5c6866";
  }

  function initMap(elementId) {
    map = L.map(elementId, {
      zoomControl: false,
      attributionControl: true,
    }).fitBounds(MEXICO_BOUNDS);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_3p6e_1_05085f2e9c153726a8905c91", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    layerGroup = L.layerGroup().addTo(map);

    // Muestra/oculta los nombres de proyecto según el zoom actual cada
    // vez que el usuario hace zoom (rueda, pellizco o botones +/-).
    map.on("zoomend", updateLabelVisibility);

    return map;
  }

  function popupHtml(project) {
    return `
      <div class="map-popup">
        <div class="map-popup__title">${project.nombre}</div>
        <div class="map-popup__meta">${project.ubicacion || project.tecnologia || ""}</div>
        <div class="map-popup__link" data-open-detail="${project.id}">Ver ficha completa</div>
      </div>`;
  }

  /** Abre o cierra la etiqueta (tooltip permanente) de cada marcador según LABEL_MIN_ZOOM */
  function updateLabelVisibility() {
    if (!map) return;
    const shouldShow = map.getZoom() >= LABEL_MIN_ZOOM;
    markersById.forEach((layer) => {
      if (!layer.getTooltip || !layer.getTooltip()) return;
      if (shouldShow) layer.openTooltip();
      else layer.closeTooltip();
    });
  }

  function renderProjects(projects) {
    layerGroup.clearLayers();
    markersById.clear();
    const bounds = [];

    projects.forEach((project) => {
      if (!project.geo) return;
      const color = colorFor(project.grupo);
      let layer;

      if (project.geo.type === "point") {
        const [lat, lng] = project.geo.latlngs;
        layer = L.circleMarker([lat, lng], {
          radius: 8,
          weight: 2,
          color: "#ffffff",
          fillColor: color,
          fillOpacity: 0.95,
        });
        bounds.push([lat, lng]);
      } else if (project.geo.type === "polygon") {
        layer = L.polygon(project.geo.latlngs, {
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.25,
        });
        project.geo.latlngs.forEach((p) => bounds.push(p));
      } else if (project.geo.type === "line") {
        layer = L.polyline(project.geo.latlngs, { color, weight: 3 });
        project.geo.latlngs.forEach((p) => bounds.push(p));
      }
      if (!layer) return;

      layer.bindPopup(popupHtml(project), { closeButton: true });
      // Etiqueta con el nombre del proyecto, oculta hasta que se alcanza
      // LABEL_MIN_ZOOM (ver updateLabelVisibility). "permanent: true" es
      // lo que la mantiene fija junto al marcador en vez de requerir hover.
      layer.bindTooltip(project.nombre, {
        permanent: true,
        direction: "top",
        offset: [0, -8],
        className: "project-label",
        interactive: false,
      });
      layer.on("click", () => onMarkerSelect(project.id));
      layer.addTo(layerGroup);
      markersById.set(project.id, layer);

      // Geometrías adicionales del mismo proyecto (p. ej. un polígono de
      // referencia vinculado por nombre desde otro KML, ver data.js:
      // KML_SOURCES). Se dibujan con el mismo color/clic que el marcador
      // principal, pero sin etiqueta propia para no duplicar el nombre.
      (project.geoAreas || []).forEach((area) => {
        let areaLayer;
        if (area.type === "polygon") {
          areaLayer = L.polygon(area.latlngs, { color, weight: 2, fillColor: color, fillOpacity: 0.18 });
        } else if (area.type === "line") {
          areaLayer = L.polyline(area.latlngs, { color, weight: 3, dashArray: "4 3" });
        }
        if (!areaLayer) return;
        areaLayer.bindPopup(popupHtml(project), { closeButton: true });
        areaLayer.on("click", () => onMarkerSelect(project.id));
        areaLayer.addTo(layerGroup);
        area.latlngs.forEach((p) => bounds.push(p));
      });
    });

    // Encuadre: siempre incluye al menos todo México, y se amplía para
    // cubrir también los proyectos filtrados si caen fuera de esa área.
    lastFitBounds = L.latLngBounds(MEXICO_BOUNDS);
    if (bounds.length) lastFitBounds.extend(bounds);

    // Las etiquetas parten ocultas (LABEL_MIN_ZOOM > zoom de país) hasta
    // que el usuario se acerca.
    updateLabelVisibility();

    // delega el clic en "ver ficha completa" dentro del popup
    map.off("popupopen").on("popupopen", (e) => {
      const el = e.popup.getElement();
      const btn = el && el.querySelector("[data-open-detail]");
      if (btn) {
        btn.addEventListener("click", () => {
          onMarkerSelect(btn.getAttribute("data-open-detail"));
        });
      }
    });
  }

  function highlight(projectId) {
    const layer = markersById.get(projectId);
    if (!layer) return false;
    if (layer.getLatLng) {
      map.setView(layer.getLatLng(), Math.max(map.getZoom(), 11), { animate: true });
    } else if (layer.getBounds) {
      map.fitBounds(layer.getBounds(), { padding: [40, 40] });
    }
    layer.openPopup();
    return true;
  }

  function invalidateSize() {
    if (map) map.invalidateSize();
  }

  /**
   * Vuelve a encuadrar el mapa con el último cálculo de bounds.
   * Necesario en móvil: la pestaña Mapa arranca oculta (display:none),
   * y Leaflet no puede calcular un encuadre correcto sobre un contenedor
   * con tamaño cero. Se llama justo después de invalidateSize() cuando
   * el usuario entra a esa pestaña (ver app.js -> switchTab).
   */
  function refit() {
    if (!map) return;
    map.invalidateSize();
    if (lastFitBounds) {
      map.fitBounds(lastFitBounds, { padding: [24, 24] });
    }
  }

  global.AppMap = {
    initMap,
    renderProjects,
    highlight,
    invalidateSize,
    refit,
    setOnMarkerSelect: (fn) => (onMarkerSelect = fn),
  };
})(window);
