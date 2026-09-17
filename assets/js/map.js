/**
 * map.js
 * Encapsula el mapa Leaflet: renderizado de proyectos geolocalizados,
 * resaltado al seleccionar y sincronización con el resto del dashboard.
 */
(function (global) {
  let map = null;
  let layerGroup = null;
  let markersById = new Map();
  let onMarkerSelect = () => {};

  function colorFor(grupo) {
    return (global.AppData.GRUPO_INFO[grupo] || {}).color || "#5c6866";
  }

  function initMap(elementId) {
    map = L.map(elementId, {
      zoomControl: false,
      attributionControl: true,
    }).setView([23.6, -102.5], 5); // México, vista inicial

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_3p6e_1_05085f2e9c153726a8905c91", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    layerGroup = L.layerGroup().addTo(map);
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
      layer.on("click", () => onMarkerSelect(project.id));
      layer.addTo(layerGroup);
      markersById.set(project.id, layer);
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 });
    }

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

  global.AppMap = {
    initMap,
    renderProjects,
    highlight,
    invalidateSize,
    setOnMarkerSelect: (fn) => (onMarkerSelect = fn),
  };
})(window);
