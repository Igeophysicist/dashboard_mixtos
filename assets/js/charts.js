/**
 * charts.js
 * Gráficos ejecutivos del panel de resumen, construidos con Chart.js.
 * Cada función recibe el arreglo de proyectos YA FILTRADO y redibuja.
 */
(function (global) {
  const instances = {};
  const GRUPO_INFO = global.AppData.GRUPO_INFO;

  // Registra el plugin que dibuja los valores directamente sobre el
  // gráfico (rueda y barras), para que sean visibles siempre y no solo
  // al tocar/hacer clic. Si el script del CDN no cargó por algún motivo,
  // los gráficos siguen funcionando, solo sin las etiquetas fijas.
  if (global.ChartDataLabels) {
    Chart.register(global.ChartDataLabels);
  }

  function destroy(key) {
    if (instances[key]) {
      instances[key].destroy();
      delete instances[key];
    }
  }

  function countBy(projects, keyFn) {
    const map = new Map();
    projects.forEach((p) => {
      const k = keyFn(p) || "Sin dato";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return map;
  }

  function renderGrupoChart(canvasId, projects) {
    destroy(canvasId);
    const counts = { A: 0, B: 0, C: 0 };
    projects.forEach((p) => {
      if (counts[p.grupo] !== undefined) counts[p.grupo]++;
    });
    const ctx = document.getElementById(canvasId);
    instances[canvasId] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["(A)", "(B)", "(C)"],
        datasets: [
          {
            data: [counts.A, counts.B, counts.C],
            backgroundColor: [GRUPO_INFO.A.color, GRUPO_INFO.B.color, GRUPO_INFO.C.color],
            borderWidth: 0,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 }, padding: 12 } },
          // Muestra el número dentro de cada segmento de forma permanente.
          datalabels: {
            color: "#ffffff",
            font: { weight: "700", size: 13 },
            formatter: (value) => (value > 0 ? value : ""),
          },
        },
      },
    });
  }

  function renderTecnologiaChart(canvasId, projects) {
    destroy(canvasId);
    const counts = countBy(projects, (p) => p.tecnologia);
    const labels = Array.from(counts.keys());
    const data = Array.from(counts.values());
    const ctx = document.getElementById(canvasId);
    instances[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{ data, backgroundColor: "#2e534f", borderRadius: 4, maxBarThickness: 26 }],
      },
      options: {
        maintainAspectRatio: false,
        indexAxis: "y",
        layout: { padding: { right: 22 } },
        plugins: {
          legend: { display: false },
          // Muestra el número al final de cada barra de forma permanente.
          datalabels: {
            anchor: "end",
            align: "end",
            clamp: true,
            color: "#3d4a47",
            font: { weight: "700", size: 11.5 },
            formatter: (value) => value,
          },
        },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#eef1f0" } },
          y: { grid: { display: false } },
        },
      },
    });
  }

  function renderRanking(listId, projects, onSelect) {
    const list = document.getElementById(listId);
    const top = [...projects]
      .filter((p) => p.parquePct !== null)
      .sort((a, b) => b.parquePct - a.parquePct)
      .slice(0, 12);

    if (!top.length) {
      list.innerHTML = `<li style="color:var(--ink-500); font-size:13px;">Sin datos de avance disponibles.</li>`;
      return;
    }

    list.innerHTML = top
      .map(
        (p, i) => `
      <li data-id="${p.id}">
        <span class="ranking__rank">${i + 1}</span>
        <span class="ranking__name">${p.nombre}</span>
        <span class="ranking__bar"><span style="width:${Math.min(p.parquePct, 100)}%; background:${
          (GRUPO_INFO[p.grupo] || {}).color || "#2e534f"
        }"></span></span>
        <span class="ranking__pct tabular">${p.parquePct}%</span>
      </li>`
      )
      .join("");

    list.querySelectorAll("li[data-id]").forEach((li) => {
      li.addEventListener("click", () => onSelect(li.getAttribute("data-id")));
    });
  }

  global.AppCharts = { renderGrupoChart, renderTecnologiaChart, renderRanking };
})(window);
