/**
 * ui.js
 * Renderizado de todas las piezas de interfaz que no son mapa ni charts:
 * KPIs, lista/tarjetas de proyectos, panel de detalle y hoja de filtros.
 */
(function (global) {
  const GRUPO_INFO = global.AppData.GRUPO_INFO;
  const fmtInt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
  const fmtMoney = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 1,
    notation: "compact",
  });

  function badgeClass(grupo) {
    return (GRUPO_INFO[grupo] || {}).css || "";
  }

  // ---------------------------------------------------------------- KPIs
  function renderKPIs(elId, projects) {
    const total = projects.length;
    const geolocalizados = projects.filter((p) => p.geo).length;
    const capacidadTotal = projects.reduce((sum, p) => sum + (p.capacidadNum || 0), 0);
    const capexTotal = projects.reduce((sum, p) => sum + (p.capexNum || 0), 0);
    const avances = projects.map((p) => p.globalPct).filter((v) => v !== null);
    const avancePromedio = avances.length ? avances.reduce((a, b) => a + b, 0) / avances.length : null;
    const enRiesgo = projects.filter((p) => p.grupo === "C").length;

    const cards = [
      { label: "Proyectos", value: fmtInt.format(total), meta: `${geolocalizados} de ${total} en mapa`, cls: "" },
      {
        label: "Capacidad total",
        value: capacidadTotal ? `${fmtInt.format(capacidadTotal)} MW` : "—",
        meta: "Suma de capacidad reportada",
        cls: "accent",
      },
      {
        label: "CAPEX total",
        value: capexTotal ? fmtMoney.format(capexTotal) : "—",
        meta: "Suma de inversión reportada",
        cls: "accent",
      },
      {
        label: "Avance global promedio",
        value: avancePromedio !== null ? `${avancePromedio.toFixed(1)}%` : "—",
        meta: "Trámites y permisos",
        cls: "",
      },
      {
        label: "En riesgo",
        value: fmtInt.format(enRiesgo),
        meta: "Proyectos en grupo C",
        cls: "risk",
      },
    ];

    document.getElementById(elId).innerHTML = cards
      .map(
        (c) => `
      <div class="kpi ${c.cls ? "kpi--" + c.cls : ""}">
        <div class="kpi__label">${c.label}</div>
        <div class="kpi__value tabular">${c.value}</div>
        <div class="kpi__meta">${c.meta}</div>
      </div>`
      )
      .join("");
  }

  // --------------------------------------------------------- Lista/tarjetas
  function progressRow(label, pct) {
    if (pct === null || pct === undefined) return "";
    return `
      <div class="pbar">
        <span class="pbar__label">${label}</span>
        <span class="pbar__track"><span class="pbar__fill" style="width:${Math.min(pct, 100)}%"></span></span>
        <span class="pbar__val tabular">${pct}%</span>
      </div>`;
  }

  function projectCardHtml(p) {
    const grupoInfo = GRUPO_INFO[p.grupo];
    return `
      <div class="pcard ${p.geo ? "" : "pcard--nogeo"}" data-id="${p.id}">
        <div class="pcard__top">
          <div>
            <div class="pcard__title">${p.nombre}</div>
            <div class="pcard__sub">${[p.socio, p.ubicacion].filter(Boolean).join(" · ")}</div>
          </div>
          ${grupoInfo ? `<span class="badge badge--${grupoInfo.css}">${grupoInfo.label}</span>` : ""}
        </div>
        <div class="pcard__meta">
          ${p.tecnologia ? `<span><b>${p.tecnologia}</b></span>` : ""}
          ${p.capacidad ? `<span>${p.capacidad}</span>` : ""}
          ${p.capex ? `<span>${p.capex}</span>` : ""}
        </div>
        <div class="pcard__bars">
          ${progressRow("Parque", p.parquePct)}
          ${progressRow("LT", p.ltPct)}
          ${progressRow("Global", p.globalPct)}
        </div>
        ${!p.geo ? `<div class="geo-flag">Sin ubicación vinculada en el KML</div>` : ""}
      </div>`;
  }

  function renderProjectList(elId, countElId, projects, onSelect) {
    const container = document.getElementById(elId);
    document.getElementById(countElId).textContent = `${projects.length} proyecto${
      projects.length === 1 ? "" : "s"
    }`;

    if (!projects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">Sin resultados</div>
          <div>Ajusta o limpia los filtros para ver proyectos.</div>
        </div>`;
      return;
    }

    container.innerHTML = projects.map(projectCardHtml).join("");
    container.querySelectorAll(".pcard").forEach((card) => {
      card.addEventListener("click", () => onSelect(card.getAttribute("data-id")));
    });
  }

  // ------------------------------------------------------------ Detalle
  const DETAIL_FIELDS = [
    { section: "Datos generales", items: [
      ["socio", "Socio"], ["tecnologia", "Tecnología"], ["ubicacion", "Ubicación"], ["capacidad", "Capacidad"],
    ]},
    { section: "Almacenamiento", items: [
      ["bess", "Almacenamiento (BESS)"], ["horasAlmacenamiento", "Horas de almacenamiento"],
    ]},
    { section: "Programa", items: [
      ["inicioConstruccion", "Inicio de construcción"], ["finConstruccion", "COD"], ["firmaContrato", "Firma de contrato"],
    ]},
    { section: "Financiero", items: [
      ["capex", "CAPEX (USD)"],
    ]},
  ];

  function detailField(p, key, label) {
    const value = p[key];
    if (value === null || value === undefined || value === "") return "";
    return `<div><div class="detail-field__label">${label}</div><div class="detail-field__value">${value}</div></div>`;
  }

  function renderDetail(elId, p) {
    const grupoInfo = GRUPO_INFO[p.grupo];
    const sections = DETAIL_FIELDS.map((sec) => {
      const fields = sec.items.map(([key, label]) => detailField(p, key, label)).filter(Boolean).join("");
      if (!fields) return "";
      return `<div class="detail__section-title">${sec.section}</div><div class="detail-grid">${fields}</div>`;
    }).join("");

    document.getElementById(elId).innerHTML = `
      <div class="detail__head">
        <button class="detail__close" data-close-detail aria-label="Cerrar">&times;</button>
        ${grupoInfo ? `<span class="detail__badge badge--${grupoInfo.css}">${grupoInfo.label}</span>` : ""}
        <div class="detail__title">${p.nombre}</div>
        <div class="detail__sub">${[p.socio, p.ubicacion].filter(Boolean).join(" · ")}</div>
      </div>
      <div class="detail__body">
        <div class="detail__section-title">Avance</div>
        <div class="detail-progress">
          ${progressRow("Parque", p.parquePct)}
          ${progressRow("LT", p.ltPct)}
          ${progressRow("Global", p.globalPct)}
        </div>
        ${sections}
        ${p.geo ? `<button class="detail__mapbtn" data-view-on-map="${p.id}">Ver en el mapa</button>` : ""}
      </div>`;
  }

  // ------------------------------------------------------------ Filtros
  function renderFilterOptions(elId, options, state, onToggle) {
    const LABELS = { tecnologia: "Tecnología", ubicacion: "Ubicación", socio: "Socio", grupo: "Grupo de atención" };
    const GRUPO_LABELS = { A: "A · En orden", B: "B · En seguimiento", C: "C · En riesgo" };

    const groups = Object.keys(options).map((field) => {
      const chips = options[field]
        .map((value) => {
          const active = state[field].has(value);
          const text = field === "grupo" ? GRUPO_LABELS[value] || value : value;
          return `<button class="chip ${active ? "is-active" : ""}" data-field="${field}" data-value="${value}">${text}</button>`;
        })
        .join("");
      return `
        <div class="filter-group">
          <div class="filter-group__title">${LABELS[field] || field}</div>
          <div class="chip-row">${chips}</div>
        </div>`;
    });

    document.getElementById(elId).innerHTML = groups.join("");
    document.getElementById(elId).querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        onToggle(chip.getAttribute("data-field"), chip.getAttribute("data-value"));
      });
    });
  }

  function showToast(elId, message) {
    const el = document.getElementById(elId);
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-visible"), 4000);
  }

  global.AppUI = { renderKPIs, renderProjectList, renderDetail, renderFilterOptions, showToast };
})(window);
