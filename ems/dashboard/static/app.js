/* Site EMS operator dashboard.
 *
 * Vanilla JS, no build step. Talks only to the documented backend endpoints
 * (/api/* and /ws/telemetry, resolved relative to the page location).
 *
 * Sign conventions (see ems/models.py):
 *   battery_kw  +ve = discharging, -ve = charging
 *   grid_kw     +ve = import,      -ve = export
 */
(function () {
  "use strict";

  // ------------------------------------------------------------ constants

  /** Maximum number of telemetry points kept on the main chart. */
  const MAX_POINTS = 288;
  /** Real-time refresh intervals (ms). */
  const KPI_INTERVAL_MS = 5000;
  const STATUS_INTERVAL_MS = 5000;
  const POLL_INTERVAL_MS = 2000;
  const FORECAST_INTERVAL_MS = 60000;
  const WS_BACKOFF_MIN_MS = 1000;
  const WS_BACKOFF_MAX_MS = 15000;
  /** Below this magnitude a flow is reported as idle (kW). */
  const IDLE_KW = 0.05;

  const MODE_LABELS = {
    optimised: "Optimised (MPC)",
    self_consumption: "Self-consumption",
    peak_shaving: "Peak shaving",
    tou_arbitrage: "Time-of-use arbitrage",
    idle: "Idle (battery off)",
  };

  // ------------------------------------------------------------ URL helpers

  /** Base path the app is served from, so API calls work behind a path prefix. */
  const BASE = (function () {
    const p = window.location.pathname;
    const idx = p.indexOf("/static/");
    return idx >= 0 ? p.slice(0, idx + 1) : p.slice(0, p.lastIndexOf("/") + 1);
  })();

  function apiUrl(path) {
    return BASE + path.replace(/^\//, "");
  }

  function wsUrl() {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + window.location.host + BASE + "ws/telemetry";
  }

  /** Error raised for non-2xx HTTP responses. */
  class ApiError extends Error {
    constructor(status, message) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  /**
   * Perform a JSON request against the backend.
   * @param {string} path  relative API path, e.g. "api/status"
   * @param {object} [body] JSON body; when present the request is a POST
   * @returns {Promise<any>}
   */
  async function api(path, body) {
    const init = body === undefined
      ? { headers: { Accept: "application/json" } }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
        };
    const res = await fetch(apiUrl(path), init);
    if (!res.ok) {
      let detail = res.statusText || "Request failed";
      try {
        const j = await res.json();
        if (j && j.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
      } catch (_) { /* non-JSON error body */ }
      throw new ApiError(res.status, detail);
    }
    return res.json();
  }

  // ------------------------------------------------------------ formatting

  const nf0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

  function isNum(v) {
    return typeof v === "number" && Number.isFinite(v);
  }

  /** Signed number with a true minus sign. */
  function signed(fmt, v) {
    const s = fmt.format(Math.abs(v));
    return v < 0 && Math.abs(v) >= 0.05 ? "−" + s : s;
  }

  function fmtKw(v, withSign) {
    if (!isNum(v)) return "--";
    const fmt = Math.abs(v) >= 100 ? nf0 : nf1;
    return (withSign ? signed(fmt, v) : fmt.format(Math.abs(v) < 0.05 ? 0 : v)) + " kW";
  }
  function fmtKwh(v) {
    if (!isNum(v)) return "--";
    return (Math.abs(v) >= 100 ? nf0 : nf1).format(v) + " kWh";
  }
  function fmtGbp(v) {
    if (!isNum(v)) return "--";
    return v < 0 ? "−" + gbp.format(-v) : gbp.format(v);
  }
  function fmtPct(v) {
    return isNum(v) ? nf1.format(v) + " %" : "--";
  }
  function fmtKg(v) {
    if (!isNum(v)) return "--";
    return Math.abs(v) >= 1000 ? nf2.format(v / 1000) + " t" : nf0.format(v) + " kg";
  }
  function fmtPrice(v) {
    return isNum(v) ? "£" + nf2.format(v) + "/kWh" : "--";
  }

  let timeZone = "UTC";
  let clockFmt = null;
  let axisFmt = null;

  /** (Re)build date formatters for the site's local time zone. */
  function setTimeZone(tz) {
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: tz }).format(new Date());
      timeZone = tz;
    } catch (_) {
      timeZone = "UTC";
    }
    clockFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone, weekday: "short", day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short",
    });
    axisFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
    });
  }
  setTimeZone("UTC");

  function parseTs(s) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }

  // ------------------------------------------------------------ DOM refs

  const $ = (id) => document.getElementById(id);
  const el = {
    siteName: $("site-name"),
    clock: $("sim-clock"),
    badge: $("mode-badge"),
    conn: $("conn"),
    connText: $("conn-text"),
    vPv: $("v-pv"), sPv: $("s-pv"),
    vLoad: $("v-load"),
    vEv: $("v-ev"),
    vBatt: $("v-batt"), sBatt: $("s-batt"),
    socBar: $("soc-bar"), socFill: $("soc-fill"), socText: $("soc-text"),
    vGrid: $("v-grid"), sGrid: $("s-grid"), sPrice: $("s-price"),
    modeSel: $("mode-select"),
    speedSel: $("speed-select"),
    playBtn: $("play-btn"),
    stepBtn: $("step-btn"),
    presetSel: $("preset-select"),
    resetBtn: $("reset-btn"),
    controlMsg: $("control-msg"),
    chartCanvas: $("power-chart"),
    chartFallback: $("chart-fallback"),
    decision: $("decision"),
    decisionMeta: $("decision-meta"),
    kpiList: $("kpi-list"),
    kpiMsg: $("kpi-msg"),
    kpiPeriod: $("kpi-period"),
    kSavings: $("k-savings"), kSavingsPct: $("k-savings-pct"),
    kCost: $("k-cost"), kCostBase: $("k-cost-base"),
    kPeak: $("k-peak"), kPeakBase: $("k-peak-base"),
    kSs: $("k-ss"), kSc: $("k-sc"),
    kCo2: $("k-co2"), kCo2Base: $("k-co2-base"),
    kCycles: $("k-cycles"), kThrough: $("k-through"),
    fcCanvas: $("forecast-chart"),
    fcMsg: $("fc-msg"),
  };

  // ------------------------------------------------------------ state

  const state = {
    status: null,
    stepSeconds: 300,
    points: [],          // Telemetry objects, oldest first
    lastTs: null,        // ms of newest point
    pending: 0,          // in-flight control requests (suppresses control sync)
    ws: null,
    wsLive: false,
    wsBackoff: WS_BACKOFF_MIN_MS,
    wsTimer: null,
    pollTimer: null,
    statusTimer: null,
    historyReloading: false,
    reloadingSite: false, // suppresses site-change detection while we reload ourselves
    renderQueued: false,
    msgTimer: null,
  };

  const hasChart = typeof window.Chart !== "undefined";
  let powerChart = null;
  let forecastChart = null;

  // ------------------------------------------------------------ colours

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /** Convert a CSS colour to an rgba() string with the given alpha. */
  function withAlpha(color, alpha) {
    const c = color.trim();
    const hex = /^#([0-9a-f]{6})$/i.exec(c);
    if (hex) {
      const n = parseInt(hex[1], 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }
    return c;
  }

  function palette() {
    return {
      pv: cssVar("--c-pv-fill"),
      load: cssVar("--c-load-fill"),
      ev: cssVar("--c-ev-fill"),
      batt: cssVar("--c-batt-fill"),
      grid: cssVar("--c-grid-fill"),
      price: cssVar("--c-price"),
      priceLine: cssVar("--c-price-line"),
      text: cssVar("--text-muted"),
      border: cssVar("--border"),
    };
  }

  // ------------------------------------------------------------ messages

  function showControlMsg(text, kind) {
    el.controlMsg.textContent = text;
    el.controlMsg.dataset.kind = kind || "info";
    clearTimeout(state.msgTimer);
    if (text) {
      state.msgTimer = setTimeout(() => { el.controlMsg.textContent = ""; }, 6000);
    }
  }

  function setConn(stateName, text) {
    el.conn.dataset.state = stateName;
    el.connText.textContent = text;
  }

  // ------------------------------------------------------------ status / tiles

  function renderTelemetryTiles(t) {
    if (!t) {
      for (const node of [el.vPv, el.vLoad, el.vEv, el.vBatt, el.vGrid]) node.textContent = "--";
      return;
    }
    el.vPv.textContent = fmtKw(t.pv_kw);
    el.sPv.textContent = isNum(t.pv_curtailed_kw) && t.pv_curtailed_kw > IDLE_KW
      ? fmtKw(t.pv_curtailed_kw) + " curtailed"
      : (t.pv_kw > IDLE_KW ? "Generating" : "No generation");
    el.vLoad.textContent = fmtKw(t.load_kw);
    el.vEv.textContent = fmtKw(t.ev_kw);

    el.vBatt.textContent = fmtKw(t.battery_kw, true);
    const bdir = t.battery_kw > IDLE_KW ? "discharging" : t.battery_kw < -IDLE_KW ? "charging" : "idle";
    el.sBatt.dataset.dir = bdir;
    el.sBatt.textContent = bdir === "discharging" ? "Discharging" : bdir === "charging" ? "Charging" : "Idle";

    const soc = isNum(t.battery_soc) ? Math.max(0, Math.min(1, t.battery_soc)) * 100 : null;
    el.socFill.style.width = soc === null ? "0" : soc.toFixed(1) + "%";
    el.socText.textContent = soc === null ? "-- %" : nf0.format(soc) + " %";
    el.socBar.setAttribute("aria-valuenow", soc === null ? "0" : soc.toFixed(0));
    el.socBar.setAttribute("aria-valuetext", soc === null ? "unknown" : nf0.format(soc) + " percent");

    el.vGrid.textContent = fmtKw(t.grid_kw, true);
    const gdir = t.grid_kw > IDLE_KW ? "import" : t.grid_kw < -IDLE_KW ? "export" : "idle";
    el.sGrid.dataset.dir = gdir;
    el.sGrid.textContent = gdir === "import" ? "Importing" : gdir === "export" ? "Exporting" : "Balanced";
    el.sPrice.textContent = "Import " + fmtPrice(t.import_price_gbp_per_kwh) +
      " · Export " + fmtPrice(t.export_price_gbp_per_kwh);
  }

  function renderClock(ms) {
    if (ms === null || ms === undefined) return;
    const d = new Date(ms);
    el.clock.textContent = clockFmt.format(d);
    el.clock.dateTime = d.toISOString();
  }

  function renderMode(mode) {
    el.badge.dataset.mode = mode || "";
    el.badge.textContent = MODE_LABELS[mode] || mode || "--";
  }

  function ensureSpeedOption(speed) {
    const val = String(Math.round(speed));
    if (![...el.speedSel.options].some((o) => o.value === val)) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = `Custom (${nf0.format(speed)}×)`;
      opt.dataset.custom = "1";
      el.speedSel.appendChild(opt);
    }
    el.speedSel.value = val;
  }

  function renderPlay(running) {
    el.playBtn.textContent = running ? "Pause" : "Play";
    el.playBtn.setAttribute("aria-pressed", running ? "true" : "false");
    el.playBtn.setAttribute("aria-label", running ? "Pause simulation" : "Run simulation");
  }

  function renderDecision(status) {
    const cmd = status.last_command;
    if (!cmd) {
      el.decision.textContent = "No decision yet — the controller has not run.";
      el.decisionMeta.textContent = "";
      return;
    }
    const reason = cmd.reason && cmd.reason.trim() ? cmd.reason.trim() : "No reason given.";
    if (el.decision.textContent !== reason) el.decision.textContent = reason;
    const parts = [];
    if (isNum(cmd.battery_kw)) {
      const dir = cmd.battery_kw > IDLE_KW ? "discharge" : cmd.battery_kw < -IDLE_KW ? "charge" : "hold";
      parts.push(`Battery setpoint ${fmtKw(cmd.battery_kw, true)} (${dir})`);
    }
    if (isNum(cmd.ev_kw_limit)) parts.push(`EV limit ${fmtKw(cmd.ev_kw_limit)}`);
    el.decisionMeta.textContent = parts.join(" · ");
  }

  /** Apply an EngineStatus payload to the whole UI. */
  function applyStatus(status) {
    if (!status) return;
    const prev = state.status;
    state.status = status;
    if (isNum(status.step_seconds) && status.step_seconds > 0) state.stepSeconds = status.step_seconds;
    el.siteName.textContent = status.site_name || status.site_id || "Site EMS";
    document.title = (status.site_name || "Site") + " · EMS";
    renderClock(parseTs(status.sim_time));
    renderMode(status.mode);
    renderDecision(status);
    if (status.latest) renderTelemetryTiles(status.latest);
    if (state.pending === 0) {
      if (MODE_LABELS[status.mode]) el.modeSel.value = status.mode;
      if (isNum(status.sim_speed)) ensureSpeedOption(status.sim_speed);
      renderPlay(!!status.running);
      if (status.site_id && [...el.presetSel.options].some((o) => o.value === status.site_id)) {
        el.presetSel.value = status.site_id;
      }
    }
    if (prev && !state.reloadingSite) {
      const prevTime = parseTs(prev.sim_time);
      const nowTime = parseTs(status.sim_time);
      if (prev.site_id !== status.site_id
          || (prevTime !== null && nowTime !== null && nowTime < prevTime)) {
        // Site changed or the sim clock went back: a reset, possibly by another client.
        reloadSite();
      }
    }
  }

  async function refreshStatus() {
    try {
      const status = await api("api/status");
      applyStatus(status);
      if (!state.wsLive) setConn("polling", "Polling");
      return status;
    } catch (err) {
      setConn("offline", "Offline");
      return null;
    }
  }

  // ------------------------------------------------------------ telemetry buffer

  function windowSize() {
    return Math.max(1, Math.min(MAX_POINTS, Math.ceil(86400 / state.stepSeconds)));
  }

  function setHistory(list) {
    const pts = (Array.isArray(list) ? list : [])
      .filter((t) => t && parseTs(t.timestamp) !== null)
      .sort((a, b) => parseTs(a.timestamp) - parseTs(b.timestamp));
    state.points = pts.slice(-windowSize());
    state.lastTs = state.points.length ? parseTs(state.points[state.points.length - 1].timestamp) : null;
    queueRender();
  }

  /** True when two telemetry samples carry the same measured values (a replay). */
  function sameSample(a, b) {
    if (!a || !b) return false;
    const keys = ["pv_kw", "load_kw", "ev_kw", "battery_kw", "battery_soc", "grid_kw"];
    return a.mode === b.mode && keys.every((k) => a[k] === b[k]);
  }

  /**
   * The simulation was restarted (possibly by another client): the sim clock went
   * back, so everything held for the old run is stale. Reload the whole site view.
   */
  function onClockRewind() {
    if (state.reloadingSite) return;
    reloadSite();
  }

  /**
   * Append a telemetry sample. Returns false if it indicates the sim clock went
   * backwards (e.g. a reset, here or from another client), in which case the site
   * view is reloaded. Exact replays of samples already held are ignored.
   */
  function appendTelemetry(t) {
    const ts = parseTs(t && t.timestamp);
    if (ts === null) return true;
    if (state.lastTs !== null && ts <= state.lastTs) {
      const held = state.points.find((p) => parseTs(p.timestamp) === ts);
      if (held && sameSample(held, t)) return true;  // duplicate delivery
      // Samples of one run arrive in order, so an older (or same-time but different)
      // sample can only come from a new run.
      onClockRewind();
      return false;
    }
    state.points.push(t);
    const max = windowSize();
    if (state.points.length > max) state.points.splice(0, state.points.length - max);
    state.lastTs = ts;
    queueRender();
    return true;
  }

  async function reloadHistory() {
    if (state.historyReloading) return;
    state.historyReloading = true;
    try {
      const list = await api(`api/history?limit=${windowSize()}`);
      setHistory(list);
      if (state.points.length) {
        const latest = state.points[state.points.length - 1];
        renderTelemetryTiles(latest);
      }
    } catch (err) {
      showControlMsg("Could not load history: " + err.message, "error");
    } finally {
      state.historyReloading = false;
    }
  }

  /** Merge newer samples from /api/history (used in polling mode). */
  async function catchUpHistory(latestTs) {
    const stepMs = state.stepSeconds * 1000;
    const missing = state.lastTs === null ? windowSize() : Math.round((latestTs - state.lastTs) / stepMs);
    if (missing <= 0) return;
    const limit = Math.min(windowSize(), missing + 1);
    const list = await api(`api/history?limit=${limit}`);
    for (const t of list) appendTelemetry(t);
  }

  // ------------------------------------------------------------ rendering (rAF batched)

  function queueRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    window.requestAnimationFrame(() => {
      state.renderQueued = false;
      renderPowerChart();
    });
  }

  function renderPowerChart() {
    if (!powerChart) return;
    const pts = state.points;
    const labels = new Array(pts.length);
    const pv = new Array(pts.length);
    const demand = new Array(pts.length);
    const batt = new Array(pts.length);
    const grid = new Array(pts.length);
    const soc = new Array(pts.length);
    const price = new Array(pts.length);
    let maxPrice = 0;
    for (let i = 0; i < pts.length; i++) {
      const t = pts[i];
      labels[i] = axisFmt.format(new Date(parseTs(t.timestamp)));
      pv[i] = t.pv_kw;
      demand[i] = t.load_kw + t.ev_kw;
      batt[i] = t.battery_kw;
      grid[i] = t.grid_kw;
      soc[i] = isNum(t.battery_soc) ? t.battery_soc * 100 : null;
      price[i] = t.import_price_gbp_per_kwh;
      if (isNum(price[i]) && price[i] > maxPrice) maxPrice = price[i];
    }
    const ds = powerChart.data.datasets;
    powerChart.data.labels = labels;
    ds[0].data = pv;
    ds[1].data = demand;
    ds[2].data = batt;
    ds[3].data = grid;
    ds[4].data = soc;
    ds[5].data = price;
    // Keep the price band in the lower ~40 % of the plot.
    powerChart.options.scales.yPrice.max = maxPrice > 0 ? maxPrice * 2.5 : 1;
    powerChart.update("none");
  }

  function tooltipLabel(ctx) {
    const v = ctx.parsed.y;
    const name = ctx.dataset.label;
    if (ctx.dataset.yAxisID === "ySoc") return `${name}: ${fmtPct(v)}`;
    if (ctx.dataset.yAxisID === "yPrice") return `${name}: ${fmtPrice(v)}`;
    return `${name}: ${fmtKw(v, true)}`;
  }

  function baseChartOptions(p) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      normalized: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: p.text, boxWidth: 12, boxHeight: 12, padding: 10, font: { size: 11 } },
        },
        tooltip: { callbacks: { label: tooltipLabel } },
      },
    };
  }

  function buildPowerChart() {
    if (!hasChart) {
      el.chartFallback.hidden = false;
      return;
    }
    const p = palette();
    const opts = baseChartOptions(p);
    opts.scales = {
      x: {
        ticks: { color: p.text, maxRotation: 0, autoSkip: true, autoSkipPadding: 16, maxTicksLimit: 8, font: { size: 11 } },
        grid: { color: withAlpha(p.border, 0.6), display: false },
      },
      y: {
        position: "left",
        title: { display: true, text: "kW", color: p.text, font: { size: 11 } },
        ticks: { color: p.text, font: { size: 11 } },
        grid: { color: p.border },
      },
      ySoc: {
        position: "right",
        min: 0,
        max: 100,
        title: { display: true, text: "SoC %", color: p.text, font: { size: 11 } },
        ticks: { color: p.text, stepSize: 25, font: { size: 11 } },
        grid: { drawOnChartArea: false },
      },
      yPrice: { display: false, min: 0, max: 1 },
    };
    powerChart = new window.Chart(el.chartCanvas, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "PV", yAxisID: "y", borderColor: p.pv, backgroundColor: withAlpha(p.pv, 0.15),
            fill: "origin", borderWidth: 2, pointRadius: 0, tension: 0.2, data: [] },
          { label: "Load + EV", yAxisID: "y", borderColor: p.load, backgroundColor: p.load,
            borderWidth: 2, pointRadius: 0, tension: 0.2, data: [] },
          { label: "Battery (+dis)", yAxisID: "y", borderColor: p.batt, backgroundColor: p.batt,
            borderWidth: 2, pointRadius: 0, tension: 0.2, data: [] },
          { label: "Grid (+imp)", yAxisID: "y", borderColor: p.grid, backgroundColor: p.grid,
            borderWidth: 2, pointRadius: 0, tension: 0.2, data: [] },
          { label: "SoC", yAxisID: "ySoc", borderColor: p.batt, backgroundColor: p.batt,
            borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, tension: 0.2, data: [] },
          { label: "Import price", yAxisID: "yPrice", borderColor: p.priceLine, backgroundColor: p.price,
            fill: "origin", stepped: "after", borderWidth: 1, pointRadius: 0, order: 10, data: [] },
        ],
      },
      options: opts,
    });
  }

  function buildForecastChart() {
    if (!hasChart) return;
    const p = palette();
    const opts = baseChartOptions(p);
    opts.plugins.legend.labels.padding = 8;
    opts.scales = {
      x: {
        ticks: { color: p.text, maxRotation: 0, autoSkip: true, autoSkipPadding: 14, maxTicksLimit: 6, font: { size: 10 } },
        grid: { display: false },
      },
      y: {
        ticks: { color: p.text, font: { size: 10 } },
        title: { display: true, text: "kW", color: p.text, font: { size: 10 } },
        grid: { color: p.border },
      },
      yPrice: { display: false, min: 0, max: 1 },
    };
    forecastChart = new window.Chart(el.fcCanvas, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "PV", yAxisID: "y", borderColor: p.pv, backgroundColor: withAlpha(p.pv, 0.15),
            fill: "origin", borderWidth: 1.5, pointRadius: 0, tension: 0.2, data: [] },
          { label: "Demand", yAxisID: "y", borderColor: p.load, backgroundColor: p.load,
            borderWidth: 1.5, pointRadius: 0, tension: 0.2, data: [] },
          { label: "Import price", yAxisID: "yPrice", borderColor: p.priceLine, backgroundColor: p.price,
            fill: "origin", stepped: "after", borderWidth: 1, pointRadius: 0, order: 10, data: [] },
        ],
      },
      options: opts,
    });
  }

  /** Re-apply theme colours to existing charts after a light/dark switch. */
  function recolourCharts() {
    const p = palette();
    for (const chart of [powerChart, forecastChart]) {
      if (!chart) continue;
      for (const ds of chart.data.datasets) {
        let c = null;
        if (ds.label === "PV") c = p.pv;
        else if (ds.label === "Load + EV" || ds.label === "Demand") c = p.load;
        else if (ds.label === "Battery (+dis)" || ds.label === "SoC") c = p.batt;
        else if (ds.label === "Grid (+imp)") c = p.grid;
        if (ds.label === "Import price") {
          ds.borderColor = p.priceLine;
          ds.backgroundColor = p.price;
        } else if (c) {
          ds.borderColor = c;
          ds.backgroundColor = ds.label === "PV" ? withAlpha(c, 0.15) : c;
        }
      }
      chart.options.plugins.legend.labels.color = p.text;
      for (const [id, scale] of Object.entries(chart.options.scales)) {
        if (id === "yPrice") continue;
        if (scale.ticks) scale.ticks.color = p.text;
        if (scale.title) scale.title.color = p.text;
        if (scale.grid && id === "y") scale.grid.color = p.border;
      }
      chart.update("none");
    }
  }

  // ------------------------------------------------------------ KPIs

  async function refreshKpis() {
    try {
      const k = await api("api/kpis?hours=24");
      el.kpiMsg.hidden = true;
      el.kpiList.dataset.stale = "false";
      renderKpis(k);
    } catch (err) {
      el.kpiList.dataset.stale = "true";
      el.kpiMsg.hidden = false;
      if (err instanceof ApiError && err.status === 409) {
        el.kpiMsg.textContent = "Collecting data… KPIs appear after the first control step.";
      } else {
        el.kpiMsg.textContent = "KPIs unavailable right now.";
      }
    }
  }

  function renderKpis(k) {
    el.kpiPeriod.textContent = isNum(k.hours) ? nf1.format(k.hours) + " h of data" : "";
    el.kSavings.textContent = fmtGbp(k.savings_gbp);
    el.kSavings.dataset.sign = !isNum(k.savings_gbp) ? "" : k.savings_gbp > 0.005 ? "pos" : k.savings_gbp < -0.005 ? "neg" : "";
    if (isNum(k.savings_gbp) && isNum(k.baseline_cost_gbp) && Math.abs(k.baseline_cost_gbp) > 1e-9) {
      el.kSavingsPct.textContent = "(" + nf1.format((k.savings_gbp / Math.abs(k.baseline_cost_gbp)) * 100) + " %)";
    } else {
      el.kSavingsPct.textContent = "";
    }
    el.kCost.textContent = fmtGbp(k.cost_gbp);
    el.kCostBase.textContent = "baseline " + fmtGbp(k.baseline_cost_gbp);
    el.kPeak.textContent = fmtKw(k.peak_import_kw);
    el.kPeakBase.textContent = "baseline " + fmtKw(k.baseline_peak_import_kw);
    el.kSs.textContent = fmtPct(k.self_sufficiency_pct);
    el.kSc.textContent = fmtPct(k.self_consumption_pct);
    el.kCo2.textContent = fmtKg(k.co2_kg);
    el.kCo2Base.textContent = "baseline " + fmtKg(k.baseline_co2_kg);
    el.kCycles.textContent = isNum(k.battery_equivalent_cycles) ? nf2.format(k.battery_equivalent_cycles) : "--";
    el.kThrough.textContent = fmtKwh(k.battery_throughput_kwh) + " discharged";
  }

  // ------------------------------------------------------------ forecast

  async function refreshForecast() {
    if (!forecastChart) {
      if (!hasChart) el.fcMsg.textContent = "Chart library unavailable.";
      return;
    }
    try {
      const f = await api("api/forecast?hours=24");
      const start = parseTs(f.start);
      const stepMs = (f.step_minutes || 15) * 60000;
      const n = Math.min(f.pv_kw.length, f.load_kw.length, f.import_price.length);
      const labels = new Array(n);
      let maxPrice = 0;
      for (let i = 0; i < n; i++) {
        labels[i] = axisFmt.format(new Date(start + i * stepMs));
        if (f.import_price[i] > maxPrice) maxPrice = f.import_price[i];
      }
      forecastChart.data.labels = labels;
      forecastChart.data.datasets[0].data = f.pv_kw.slice(0, n);
      forecastChart.data.datasets[1].data = f.load_kw.slice(0, n);
      forecastChart.data.datasets[2].data = f.import_price.slice(0, n);
      forecastChart.options.scales.yPrice.max = maxPrice > 0 ? maxPrice * 2.5 : 1;
      forecastChart.update("none");
      el.fcMsg.textContent = "Demand includes expected EV charging.";
    } catch (err) {
      el.fcMsg.textContent = "Forecast unavailable.";
    }
  }

  // ------------------------------------------------------------ live updates

  function startPolling() {
    if (state.pollTimer) return;
    const tick = async () => {
      const status = await refreshStatus();
      const latest = status && status.latest;
      const ts = latest ? parseTs(latest.timestamp) : null;
      if (ts !== null && (state.lastTs === null || ts > state.lastTs)) {
        try {
          await catchUpHistory(ts);
        } catch (_) {
          appendTelemetry(latest);
        }
      } else if (ts !== null && state.lastTs !== null && ts < state.lastTs) {
        onClockRewind();  // reset (here or by another client): latest is older than ours
      } else if (ts !== null && ts === state.lastTs && state.points.length
                 && !sameSample(state.points[state.points.length - 1], latest)) {
        onClockRewind();  // a new run has reached exactly our newest timestamp
      }
    };
    state.pollTimer = setInterval(tick, POLL_INTERVAL_MS);
    tick();
  }

  function stopPolling() {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  /**
   * Ask /api/health whether the server can accept WebSocket upgrades.
   * Older servers that do not report it are assumed to support it.
   * @returns {Promise<boolean>}
   */
  async function serverSupportsWebSocket() {
    try {
      const h = await api("api/health");
      return !(h && h.websocket === false);
    } catch (_) {
      return true;
    }
  }

  function connectWs() {
    clearTimeout(state.wsTimer);
    let ws;
    try {
      ws = new WebSocket(wsUrl());
    } catch (_) {
      scheduleReconnect();
      return;
    }
    state.ws = ws;
    ws.addEventListener("open", () => {
      state.wsLive = true;
      state.wsBackoff = WS_BACKOFF_MIN_MS;
      setConn("live", "Live");
      stopPolling();
      reloadHistory();   // fill any gap while disconnected
    });
    ws.addEventListener("message", (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      if (!msg || msg.type !== "telemetry" || !msg.data) return;
      const t = msg.data;
      if (appendTelemetry(t)) {
        renderTelemetryTiles(t);
        const ts = parseTs(t.timestamp);
        if (ts !== null) renderClock(ts + state.stepSeconds * 1000);
        if (t.mode && state.status && t.mode !== state.status.mode) renderMode(t.mode);
      }
    });
    ws.addEventListener("close", () => {
      if (state.ws !== ws) return;
      state.ws = null;
      state.wsLive = false;
      setConn("polling", "Polling");
      startPolling();
      scheduleReconnect();
    });
    ws.addEventListener("error", () => {
      // "close" follows; nothing else to do here.
    });
  }

  function scheduleReconnect() {
    clearTimeout(state.wsTimer);
    state.wsTimer = setTimeout(connectWs, state.wsBackoff);
    state.wsBackoff = Math.min(WS_BACKOFF_MAX_MS, state.wsBackoff * 2);
  }

  // ------------------------------------------------------------ controls

  /** Run a control request with busy state and error reporting. */
  async function control(button, fn) {
    state.pending++;
    if (button) button.disabled = true;
    try {
      const status = await fn();
      state.pending--;
      if (status) applyStatus(status);
      return status;
    } catch (err) {
      state.pending--;
      showControlMsg(err.message || "Request failed", "error");
      refreshStatus();
      return null;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindControls() {
    el.modeSel.addEventListener("change", async () => {
      const mode = el.modeSel.value;
      const s = await control(null, () => api("api/mode", { mode }));
      if (s) {
        showControlMsg("Mode set to " + (MODE_LABELS[mode] || mode) + ".");
        refreshKpis();
      }
    });

    el.speedSel.addEventListener("change", async () => {
      const speed = Number(el.speedSel.value);
      const s = await control(null, () => api("api/sim", { speed }));
      if (s) showControlMsg("Speed set to " + el.speedSel.selectedOptions[0].textContent + ".");
    });

    el.playBtn.addEventListener("click", async () => {
      const running = !(state.status && state.status.running);
      await control(el.playBtn, () => api("api/sim", { running }));
    });

    el.stepBtn.addEventListener("click", async () => {
      const steps = Math.max(1, Math.min(2016, Math.round(3600 / state.stepSeconds)));
      const s = await control(el.stepBtn, () => api("api/step", { steps }));
      if (s) {
        if (!state.wsLive) {
          const ts = s.latest ? parseTs(s.latest.timestamp) : null;
          if (ts !== null) {
            try { await catchUpHistory(ts); } catch (_) { reloadHistory(); }
          }
        }
        refreshKpis();
        refreshForecast();
      }
    });

    el.resetBtn.addEventListener("click", async () => {
      const preset = el.presetSel.value;
      const body = preset ? { preset } : {};
      state.reloadingSite = true;
      try {
        const s = await control(el.resetBtn, () => api("api/reset", body));
        if (s) {
          showControlMsg("Simulation reset" + (preset ? " to " + preset : "") + ".");
          await reloadSite();
        }
      } finally {
        state.reloadingSite = false;
      }
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", recolourCharts);
  }

  async function loadPresets() {
    try {
      const presets = await api("api/presets");
      el.presetSel.replaceChildren();
      for (const id of presets) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = id;
        el.presetSel.appendChild(opt);
      }
      if (state.status && presets.includes(state.status.site_id)) el.presetSel.value = state.status.site_id;
    } catch (_) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Current site";
      el.presetSel.replaceChildren(opt);
    }
  }

  async function loadConfig() {
    try {
      const cfg = await api("api/config");
      if (cfg && cfg.timezone) setTimeZone(cfg.timezone);
      if (cfg && cfg.name) el.siteName.textContent = cfg.name;
    } catch (_) { /* keep UTC */ }
  }

  /** Reload everything that depends on the site (after a reset). */
  async function reloadSite() {
    const nested = state.reloadingSite;
    state.reloadingSite = true;
    try {
      await loadConfig();
      await refreshStatus();
      state.points = [];
      state.lastTs = null;
      await reloadHistory();
      refreshKpis();
      refreshForecast();
    } finally {
      if (!nested) state.reloadingSite = false;
    }
  }

  // ------------------------------------------------------------ boot

  async function init() {
    renderPlay(false);
    bindControls();
    try {
      buildPowerChart();
      buildForecastChart();
    } catch (err) {
      el.chartFallback.hidden = false;
      powerChart = null;
      forecastChart = null;
    }
    await loadConfig();
    await refreshStatus();
    await loadPresets();
    await reloadHistory();
    refreshKpis();
    refreshForecast();
    if (await serverSupportsWebSocket()) {
      connectWs();
    } else {
      // The server cannot upgrade to WebSocket (no protocol library installed):
      // poll instead of attempting handshakes that are bound to fail.
      setConn("polling", "Polling");
      startPolling();
    }
    setInterval(refreshKpis, KPI_INTERVAL_MS);
    // Status (decision reason, run state) refresh; polling mode refreshes faster on its own.
    state.statusTimer = setInterval(() => { if (state.wsLive) refreshStatus(); }, STATUS_INTERVAL_MS);
    setInterval(refreshForecast, FORECAST_INTERVAL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
