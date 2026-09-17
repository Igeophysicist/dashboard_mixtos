# Panel Ejecutivo de Proyectos

Dashboard ejecutivo, geoespacial y responsivo (mobile-first) para el
seguimiento de proyectos de infraestructura. Publicable directamente en
GitHub Pages, sin build step: HTML/CSS/JS planos.

## Por qué este rediseño

La versión anterior era una tabla HTML de una sola columna con un
`<select>`, pensada para un solo proyecto a la vez. Para un uso
ejecutivo (varios proyectos, consulta mayormente desde celular,
necesidad de mapa) esa arquitectura no escalaba: no había manera de
comparar proyectos, filtrar, ver el conjunto agregado ni ubicarlos en
el mapa. Se rediseñó desde cero conservando únicamente la fuente de
datos (`dataparsedprueba.json`) y los colores/identidad de marca
originales (teal, oro, arena).

## Estructura de carpetas

```
/
├── index.html                 punto de entrada, único HTML
├── assets/
│   ├── css/
│   │   └── styles.css         sistema de diseño completo
│   └── js/
│       ├── kml-parser.js      parser KML propio (sin dependencias)
│       ├── data.js            carga JSON+KML, normaliza, vincula
│       ├── map.js             mapa Leaflet
│       ├── charts.js          gráficos Chart.js
│       ├── filters.js         estado y lógica de filtros
│       ├── ui.js               KPIs, tarjetas, panel de detalle
│       └── app.js             orquestador (conecta todo)
└── data/
    ├── dataparsedprueba.json  fuente de datos ejecutiva (única fuente de verdad)
    └── ENTRADA_PROYECTOS.kml  geometrías de proyectos
```

Cada módulo JS es independiente y solo se comunica a través de un
objeto global (`window.AppData`, `window.AppMap`, etc.), así que se
puede editar o reemplazar uno sin tocar los demás — por ejemplo, si
más adelante cambias de Leaflet a otra librería de mapas, solo se
reescribe `map.js`.

## Tecnologías

- **Sin build step / sin framework**: HTML, CSS y JavaScript planos.
  Es la opción correcta para un sitio que se actualiza únicamente
  editando archivos de datos y se publica en GitHub Pages — un
  proyecto React/Vue añadiría un paso de compilación sin aportar
  beneficio aquí.
- **Leaflet** (mapa) y **Chart.js** (gráficos), cargados por CDN.
  Ambas son ligeras, muy usadas y no requieren licencia.
- **Parser KML propio** (`kml-parser.js`, ~100 líneas) en vez de una
  librería externa (p. ej. `leaflet-omnivore`): los KML de este
  proyecto usan solo `Point`, `LineString` y `Polygon` simples, así
  que un parser propio es más ligero, no depende de un tercero y es
  fácil de auditar. Si en el futuro necesitas geometrías más
  complejas (huecos en polígonos, `MultiGeometry` anidada), ese es el
  único archivo a extender.

## Estrategia de vinculación JSON ↔ KML

El JSON sigue siendo la única fuente de verdad para los datos
ejecutivos. El o los KML solo aportan geometría. La vinculación es
automática, por nombre:

1. Cada proyecto en el JSON tiene `TÍTULO 2` (con `TÍTULO 1` como
   respaldo si el primero falta).
2. Cada `Placemark` del KML tiene `<name>`.
3. Ambos valores se normalizan (mayúsculas, sin acentos, sin
   puntuación redundante, espacios colapsados) y se comparan.
4. Si coinciden, el proyecto queda geolocalizado. Si no, el proyecto
   se sigue mostrando en KPIs, gráficos y listado — simplemente no
   aparece en el mapa, y se muestra un aviso (toast) con el detalle
   en la consola del navegador.

**Esto significa que el único requisito para que un proyecto nuevo
aparezca en el mapa es que su nombre en el KML coincida con
`TÍTULO 2` del JSON.** No hace falta mantener un ID paralelo. Para
agregar más archivos KML, súmalos al arreglo `KML_SOURCES` en
`assets/js/data.js`.

> Nota: el JSON de ejemplo incluido (`dataparsedprueba.json`) usa dos
> proyectos reales del KML (`SAN PEDRO SOLAR` y `SUNORA`) como
> demostración funcional de la vinculación. Reemplázalo por tu JSON
> real conservando la misma estructura de claves.

## Filtros

Los filtros se generan dinámicamente a partir de los datos: un campo
(Tecnología, Ubicación, Socio) solo aparece como filtro si tiene más
de un valor distinto en el dataset actual, para no mostrar controles
inútiles. El filtro por Grupo de atención siempre aparece si hay al
menos un proyecto clasificado. La búsqueda de texto libre cubre
nombre, socio, ubicación y tecnología.

## Experiencia móvil vs. escritorio

- **Móvil (`<900px`)**: tres pestañas (Resumen, Mapa, Proyectos) con
  barra inferior fija, hoja de filtros deslizable desde abajo y panel
  de detalle tipo bottom-sheet.
- **Escritorio (`≥900px`)**: una sola página de scroll continuo
  (KPIs → analítica → mapa → listado completo), panel de filtros
  como popover y panel de detalle deslizado desde la derecha.

## Publicar en GitHub Pages

1. Sube esta carpeta completa (manteniendo la estructura) a la raíz
   de tu repositorio.
2. Settings → Pages → Deploy from branch → selecciona la rama y
   carpeta `/ (root)`.
3. Listo — no hay paso de build.

## Actualizar datos

Edita únicamente `data/dataparsedprueba.json` (y el/los KML si
cambian ubicaciones), conservando exactamente las mismas claves.
El resto de la aplicación no requiere cambios.

## Probar en local antes de publicar

Como la app usa `fetch()` para cargar el JSON y el KML, **no
funciona abriendo `index.html` con doble clic** (bloqueo CORS de
`file://`). Sirve la carpeta con un servidor local, por ejemplo:

```bash
cd carpeta-del-proyecto
python3 -m http.server 8000
```

y abre `http://localhost:8000/index.html`.

## Extensiones sugeridas para más adelante

- Exportar el listado filtrado a Excel/CSV.
- Filtro por rango de fechas una vez que `Inicio de Construcción`
  / `Fin de Construcción` tengan fechas reales (el código ya intenta
  parsear fechas en formato `AAAA-MM-DD` o `DD/MM/AAAA`).
- Capa de agrupación (clustering) en el mapa si el número de
  proyectos crece mucho más allá de unas cuantas decenas.
