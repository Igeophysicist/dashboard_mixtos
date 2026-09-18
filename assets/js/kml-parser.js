/**
 * kml-parser.js
 * Parser KML mínimo y autocontenido (sin librerías externas).
 * Soporta Point, LineString y Polygon (frontera exterior), que cubre
 * los archivos KML exportados desde Google Earth Pro usados en este
 * proyecto. Si en el futuro se agregan geometrías más complejas
 * (MultiGeometry con huecos, etc.) este es el único archivo a extender.
 *
 * Expone: window.KMLParser.parse(xmlString) -> Array<Placemark>
 * Placemark: { name, description, folderPath, type, latlngs }
 *   - type: "point" | "line" | "polygon"
 *   - latlngs: [lat, lng] para point; [[lat,lng], ...] para line/polygon
 */
(function (global) {
  function textOf(node, tag) {
    const el = node.querySelector(tag);
    return el ? el.textContent.trim() : "";
  }

  function parseCoordText(text) {
    // "lon,lat,alt lon,lat,alt ..." -> [[lat, lon], ...]
    return text
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((triplet) => {
        const [lon, lat] = triplet.split(",").map(Number);
        return [lat, lon];
      });
  }

  function folderPathOf(node) {
    const names = [];
    let current = node.parentElement;
    while (current) {
      if (current.tagName === "Folder") {
        const nameEl = current.querySelector(":scope > name");
        if (nameEl && nameEl.textContent.trim()) {
          names.unshift(nameEl.textContent.trim());
        }
      }
      current = current.parentElement;
    }
    return names;
  }

  function geometryOf(placemark) {
    const point = placemark.querySelector(":scope > Point > coordinates");
    if (point) {
      const [latlng] = parseCoordText(point.textContent);
      return { type: "point", latlngs: latlng };
    }
    const line = placemark.querySelector(":scope > LineString > coordinates");
    if (line) {
      return { type: "line", latlngs: parseCoordText(line.textContent) };
    }
    const polygon = placemark.querySelector(
      ":scope > Polygon > outerBoundaryIs > LinearRing > coordinates"
    );
    if (polygon) {
      return { type: "polygon", latlngs: parseCoordText(polygon.textContent) };
    }
    // MultiGeometry: toma la primera geometría soportada que encuentre
    const multi = placemark.querySelector(":scope > MultiGeometry");
    if (multi) {
      const p = multi.querySelector("Point > coordinates");
      if (p) return { type: "point", latlngs: parseCoordText(p.textContent)[0] };
      const l = multi.querySelector("LineString > coordinates");
      if (l) return { type: "line", latlngs: parseCoordText(l.textContent) };
      const pg = multi.querySelector(
        "Polygon > outerBoundaryIs > LinearRing > coordinates"
      );
      if (pg) return { type: "polygon", latlngs: parseCoordText(pg.textContent) };
    }
    return null;
  }

  function parse(xmlString) {
    const doc = new DOMParser().parseFromString(xmlString, "text/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      throw new Error("KML inválido: " + parseError.textContent.slice(0, 200));
    }

    const placemarks = Array.from(doc.querySelectorAll("Placemark"));
    const result = [];

    placemarks.forEach((pm) => {
      const geometry = geometryOf(pm);
      if (!geometry || !geometry.latlngs) return; // ignora placemarks sin geometría soportada

      result.push({
        id: pm.getAttribute("id") || null,
        name: textOf(pm, ":scope > name"),
        description: textOf(pm, ":scope > description"),
        folderPath: folderPathOf(pm),
        type: geometry.type,
        latlngs: geometry.latlngs,
      });
    });

    return result;
  }

  global.KMLParser = { parse };
})(window);
