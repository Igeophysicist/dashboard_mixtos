/**
 * charts.js
 * Gráficos ejecutivos del panel de resumen, construidos con Chart.js.
 * Cada función recibe el arreglo de proyectos YA FILTRADO y redibuja.
 */
(function (global) {
  const instances = {};
  const GRUPO_INFO = global.AppData.GRUPO_INFO;

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
        labels: ["En orden (A)", "En seguimiento (B)", "En riesgo (C)"],
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
        plugins: { legend: { display: false } },
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
      .filter((p) => p.globalPct !== null)
      .sort((a, b) => b.globalPct - a.globalPct)
      .slice(0, 6);

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
        <span class="ranking__bar"><span style="width:${Math.min(p.globalPct, 100)}%; background:${
          (GRUPO_INFO[p.grupo] || {}).color || "#2e534f"
        }"></span></span>
        <span class="ranking__pct tabular">${p.globalPct}%</span>
      </li>`
      )
      .join("");

    list.querySelectorAll("li[data-id]").forEach((li) => {
      li.addEventListener("click", () => onSelect(li.getAttribute("data-id")));
    });
  }

  global.AppCharts = { renderGrupoChart, renderTecnologiaChart, renderRanking };
})(window);
