/* app.js — router, view rendering, modal & form handling, event wiring.
   Initialised on DOMContentLoaded. Depends on store, seed, charts, reports. */
(function (global) {
  "use strict";
  var BG = global.BGORS;
  var store = BG.store, seed = BG.seed, charts = BG.charts, reports = BG.reports;

  var ROUTES = ["dashboard", "sites", "operations", "tasks", "reports"];
  var SITE_TYPES = ["Solar Farm", "Wind", "Recycling Plant", "EV Charging", "Battery Storage"];
  var SITE_STATUS = ["Active", "Maintenance", "Offline"];
  var PRIORITIES = ["Low", "Medium", "High", "Critical"];
  var TASK_STATUS = ["Open", "In Progress", "Done"];

  var root, modalOverlay, modalBody, modalTitle, toastRegion;
  var lastFocused = null;
  var resizeRedraw = null;

  // ---------- small DOM helpers ----------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function") node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtNum(n) { return (Number(n) || 0).toLocaleString("en-GB"); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function toast(msg, isError) {
    var t = el("div", { class: "toast" + (isError ? " error" : ""), role: "status", text: msg });
    toastRegion.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity .3s"; }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }

  function siteName(id) { var s = store.get("sites", id); return s ? s.name : "(unknown site)"; }

  // ---------- Modal ----------
  function openModal(title, contentNode, onMount) {
    lastFocused = document.activeElement;
    modalTitle.textContent = title;
    modalBody.innerHTML = "";
    modalBody.appendChild(contentNode);
    modalOverlay.hidden = false;
    document.addEventListener("keydown", modalKeydown, true);
    if (onMount) onMount();
    var focusable = modalBody.querySelector("input, select, textarea, button");
    if (focusable) focusable.focus();
  }
  function closeModal() {
    if (modalOverlay.hidden) return;
    modalOverlay.hidden = true;
    modalBody.innerHTML = "";
    document.removeEventListener("keydown", modalKeydown, true);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  function modalKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
    if (e.key === "Tab") {
      // focus trap
      var f = modalBody.parentNode.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function confirmDialog(message, onConfirm) {
    var body = el("div", null, [
      el("p", { text: message }),
      el("div", { class: "modal-actions" }, [
        el("button", { class: "btn secondary", type: "button", onclick: closeModal, text: "Cancel" }),
        el("button", {
          class: "btn danger", type: "button", text: "Delete",
          onclick: function () { closeModal(); onConfirm(); }
        })
      ])
    ]);
    openModal("Please confirm", body);
  }

  // ---------- Form field builder ----------
  function fieldText(name, label, value, attrs) {
    attrs = attrs || {};
    var input = el("input", Object.assign({
      type: attrs.type || "text", id: "f_" + name, name: name, value: value == null ? "" : value
    }, attrs.input || {}));
    return { wrap: el("div", { class: "field" }, [
      el("label", { for: "f_" + name, text: label }), input,
      el("div", { class: "error-text", id: "err_" + name, "aria-live": "polite" })
    ]), input: input };
  }
  function fieldSelect(name, label, value, options) {
    var sel = el("select", { id: "f_" + name, name: name });
    options.forEach(function (o) {
      var opt = el("option", { value: o, text: o });
      if (o === value) opt.selected = true;
      sel.appendChild(opt);
    });
    return { wrap: el("div", { class: "field" }, [
      el("label", { for: "f_" + name, text: label }), sel,
      el("div", { class: "error-text", id: "err_" + name })
    ]), input: sel };
  }
  function fieldTextarea(name, label, value) {
    var ta = el("textarea", { id: "f_" + name, name: name }, [value || ""]);
    return { wrap: el("div", { class: "field" }, [
      el("label", { for: "f_" + name, text: label }), ta,
      el("div", { class: "error-text", id: "err_" + name })
    ]), input: ta };
  }
  function setError(name, msg) {
    var err = document.getElementById("err_" + name);
    var input = document.getElementById("f_" + name);
    if (err) err.textContent = msg || "";
    if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  // ========================================================================
  // VIEWS
  // ========================================================================

  function render() {
    var route = (location.hash.replace(/^#\//, "") || "dashboard").split("?")[0];
    if (ROUTES.indexOf(route) === -1) route = "dashboard";
    setActiveNav(route);
    root.innerHTML = "";
    resizeRedraw = null; // clear any previous redraw hook
    closeMobileNav();
    if (route === "dashboard") viewDashboard();
    else if (route === "sites") viewSites();
    else if (route === "operations") viewOperations();
    else if (route === "tasks") viewTasks();
    else if (route === "reports") viewReports();
    document.getElementById("main").focus();
  }

  function setActiveNav(route) {
    var links = document.querySelectorAll(".primary-nav a");
    Array.prototype.forEach.call(links, function (a) {
      a.classList.toggle("active", a.getAttribute("data-route") === route);
      if (a.getAttribute("data-route") === route) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function viewHeader(title, subtitle, actions) {
    return el("div", { class: "view-header" }, [
      el("div", null, [el("h1", { text: title }), subtitle ? el("p", { class: "subtitle", text: subtitle }) : null]),
      actions ? el("div", { class: "btn-row" }, actions) : null
    ]);
  }

  function emptyState(msg) { return el("div", { class: "empty-state", text: msg }); }

  // ---------- DASHBOARD ----------
  function viewDashboard() {
    // current period = last 30 days
    var to = todayISO();
    var fromD = new Date(); fromD.setDate(fromD.getDate() - 29);
    var from = fromD.toISOString().slice(0, 10);

    var sites = store.all("sites");
    var activeSites = sites.filter(function (s) { return s.status === "Active"; }).length;
    var sum = reports.summary(store, { from: from, to: to });
    var openTasks = store.all("tasks").filter(function (t) { return t.status !== "Done"; }).length;

    root.appendChild(viewHeader("Dashboard", "Operations overview — last 30 days"));

    var kpis = el("div", { class: "grid kpi-grid" }, [
      kpiCard("Active sites", activeSites, sites.length + " total"),
      kpiCard("Total output (30d)", fmtNum(sum.totalOutput), sum.dayCount + " days logged"),
      kpiCard("Open tasks", openTasks, store.all("tasks").length + " total"),
      kpiCard("Average uptime", sum.uptime == null ? "—" : sum.uptime + "%", "last 30 days")
    ]);
    root.appendChild(kpis);

    var lineCanvas = el("canvas", { "aria-label": "Total output over time" });
    var barCanvas = el("canvas", { "aria-label": "Output by site" });
    var chartsGrid = el("div", { class: "grid charts-grid" }, [
      el("div", { class: "card chart-card" }, [el("h2", { text: "Total output over time" }),
        el("div", { class: "chart-wrap" }, [lineCanvas])]),
      el("div", { class: "card chart-card" }, [el("h2", { text: "Output by site (30d)" }),
        el("div", { class: "chart-wrap" }, [barCanvas])])
    ]);
    root.appendChild(chartsGrid);

    var lineData = reports.outputOverTime(store, { from: from, to: to });
    var barData = reports.outputBySite(store, { from: from, to: to });

    var draw = function () {
      charts.lineChart(lineCanvas, lineData, { height: 240, empty: "No output logged yet" });
      charts.barChart(barCanvas, barData, { height: 240, empty: "No output logged yet" });
    };
    resizeRedraw = draw;
    requestAnimationFrame(draw);

    // recent activity
    root.appendChild(el("div", { class: "card" }, [
      el("h2", { text: "Recent activity" }),
      buildActivity()
    ]));
  }

  function kpiCard(label, value, sub) {
    return el("div", { class: "card kpi" }, [
      el("span", { class: "kpi-label", text: label }),
      el("span", { class: "kpi-value", text: String(value) }),
      el("span", { class: "kpi-sub", text: sub || "" })
    ]);
  }

  function buildActivity() {
    var items = [];
    store.all("operations").forEach(function (o) {
      items.push({ date: o.date, kind: "op", dot: "#198754",
        text: "Logged " + fmtNum(o.output) + " output at " + siteName(o.siteId) +
              (o.downtimeHours ? " (" + o.downtimeHours + "h downtime)" : "") });
    });
    store.all("tasks").forEach(function (t) {
      items.push({ date: t.dueDate, kind: "task", dot: "#2563eb",
        text: t.title + " — " + t.status + " @ " + siteName(t.siteId) });
    });
    items.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    items = items.slice(0, 8);
    if (!items.length) return emptyState("No activity yet.");
    var ul = el("ul", { class: "activity-list" });
    items.forEach(function (it) {
      ul.appendChild(el("li", null, [
        el("span", { class: "activity-dot", html: "&#9679;", style: "color:" + it.dot }),
        el("span", { class: "when", text: it.date }),
        el("span", { text: it.text })
      ]));
    });
    return ul;
  }

  // ---------- SITES ----------
  function viewSites() {
    root.appendChild(viewHeader("Sites & Assets", "Manage your portfolio of green assets", [
      el("button", { class: "btn", type: "button", onclick: function () { siteModal(null); },
        html: "&#43; Add site" })
    ]));
    var sites = store.all("sites");
    if (!sites.length) { root.appendChild(emptyState("No sites yet. Add your first site.")); return; }

    var rows = sites.map(function (s) {
      return el("tr", null, [
        el("td", null, [el("strong", { text: s.name })]),
        el("td", { text: s.type }),
        el("td", { text: s.location }),
        el("td", { class: "num", text: fmtNum(s.capacity) + " " + (s.capacityUnit || "") }),
        el("td", null, [el("span", { class: "badge status-" + s.status, text: s.status })]),
        el("td", { text: s.commissionedDate || "—" }),
        el("td", { class: "actions" }, [
          el("button", { class: "btn small secondary", type: "button", text: "Edit",
            onclick: function () { siteModal(s.id); } }),
          el("button", { class: "btn small danger", type: "button", text: "Delete",
            onclick: function () { deleteSite(s); } })
        ])
      ]);
    });

    root.appendChild(tableWrap(
      ["Name", "Type", "Location", "Capacity", "Status", "Commissioned", ""],
      rows, [null, null, null, "num", null, null, "actions"]
    ));
  }

  function siteModal(id) {
    var s = id ? store.get("sites", id) : null;
    var fName = fieldText("name", "Name", s ? s.name : "", { input: { required: "required", maxlength: "80" } });
    var fType = fieldSelect("type", "Type", s ? s.type : SITE_TYPES[0], SITE_TYPES);
    var fLoc = fieldText("location", "Location", s ? s.location : "");
    var fCap = fieldText("capacity", "Capacity", s ? s.capacity : "", { type: "number", input: { step: "any", min: "0" } });
    var fUnit = fieldText("capacityUnit", "Unit", s ? s.capacityUnit : "MW");
    var fStatus = fieldSelect("status", "Status", s ? s.status : "Active", SITE_STATUS);
    var fDate = fieldText("commissionedDate", "Commissioned", s ? s.commissionedDate : "", { type: "date" });

    var form = el("form", { class: "modal-form", novalidate: "novalidate" }, [
      fName.wrap,
      el("div", { class: "form-grid" }, [fType.wrap, fStatus.wrap]),
      fLoc.wrap,
      el("div", { class: "form-grid" }, [fCap.wrap, fUnit.wrap]),
      fDate.wrap,
      el("div", { class: "modal-actions" }, [
        el("button", { class: "btn secondary", type: "button", text: "Cancel", onclick: closeModal }),
        el("button", { class: "btn", type: "submit", text: id ? "Save changes" : "Add site" })
      ])
    ]);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = fName.input.value.trim();
      var cap = fCap.input.value;
      var ok = true;
      setError("name", ""); setError("capacity", "");
      if (!name) { setError("name", "Name is required."); ok = false; }
      if (cap === "" || isNaN(Number(cap)) || Number(cap) < 0) { setError("capacity", "Enter a non-negative number."); ok = false; }
      if (!ok) return;
      var data = {
        name: name, type: fType.input.value, location: fLoc.input.value.trim(),
        capacity: Number(cap), capacityUnit: fUnit.input.value.trim() || "",
        status: fStatus.input.value, commissionedDate: fDate.input.value || ""
      };
      if (id) { store.update("sites", id, data); toast("Site updated."); }
      else { store.create("sites", data); toast("Site added."); }
      closeModal();
    });

    openModal(id ? "Edit site" : "Add site", form);
  }

  function deleteSite(s) {
    confirmDialog('Delete "' + s.name + '"? This also removes its operations logs and tasks.', function () {
      store.deleteSite(s.id);
      toast("Site deleted.");
    });
  }

  // ---------- OPERATIONS ----------
  var opsFilter = { siteId: "", from: "", to: "" };

  function viewOperations() {
    root.appendChild(viewHeader("Operations Log", "Daily output and downtime records", [
      el("button", { class: "btn", type: "button", onclick: function () { opModal(null); }, html: "&#43; Add entry" })
    ]));

    if (!store.all("sites").length) { root.appendChild(emptyState("Add a site first, then log operations.")); return; }

    var siteOptions = ["All sites"].concat(store.all("sites").map(function (s) { return s.name; }));
    var sel = el("select", { id: "opf_site", "aria-label": "Filter by site" });
    sel.appendChild(el("option", { value: "", text: "All sites" }));
    store.all("sites").forEach(function (s) {
      var o = el("option", { value: s.id, text: s.name });
      if (s.id === opsFilter.siteId) o.selected = true;
      sel.appendChild(o);
    });
    var fromInput = el("input", { type: "date", id: "opf_from", value: opsFilter.from, "aria-label": "From date" });
    var toInput = el("input", { type: "date", id: "opf_to", value: opsFilter.to, "aria-label": "To date" });

    var filters = el("div", { class: "filters no-print" }, [
      el("div", { class: "field" }, [el("label", { for: "opf_site", text: "Site" }), sel]),
      el("div", { class: "field" }, [el("label", { for: "opf_from", text: "From" }), fromInput]),
      el("div", { class: "field" }, [el("label", { for: "opf_to", text: "To" }), toInput]),
      el("button", { class: "btn secondary", type: "button", text: "Clear", onclick: function () {
        opsFilter = { siteId: "", from: "", to: "" }; render();
      } })
    ]);
    function applyFilter() {
      opsFilter = { siteId: sel.value, from: fromInput.value, to: toInput.value };
      renderOpsTable(tableHost);
    }
    sel.addEventListener("change", applyFilter);
    fromInput.addEventListener("change", applyFilter);
    toInput.addEventListener("change", applyFilter);
    root.appendChild(filters);

    var tableHost = el("div");
    root.appendChild(tableHost);
    renderOpsTable(tableHost);
  }

  function renderOpsTable(host) {
    host.innerHTML = "";
    var ops = store.all("operations").filter(function (o) {
      if (opsFilter.siteId && o.siteId !== opsFilter.siteId) return false;
      if (opsFilter.from && o.date < opsFilter.from) return false;
      if (opsFilter.to && o.date > opsFilter.to) return false;
      return true;
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

    var count = el("p", { class: "muted", text: ops.length + " entr" + (ops.length === 1 ? "y" : "ies") });
    host.appendChild(count);

    if (!ops.length) { host.appendChild(emptyState("No matching operations entries.")); return; }

    var rows = ops.slice(0, 400).map(function (o) {
      return el("tr", null, [
        el("td", { text: o.date }),
        el("td", { text: siteName(o.siteId) }),
        el("td", { class: "num", text: fmtNum(o.output) }),
        el("td", { class: "num", text: (Number(o.downtimeHours) || 0) + "h" }),
        el("td", { class: "num", text: reports.rowUptime(o) + "%" }),
        el("td", { text: o.notes || "—" }),
        el("td", { class: "actions" }, [
          el("button", { class: "btn small secondary", type: "button", text: "Edit",
            onclick: function () { opModal(o.id); } }),
          el("button", { class: "btn small danger", type: "button", text: "Delete",
            onclick: function () { deleteOp(o); } })
        ])
      ]);
    });
    host.appendChild(tableWrap(
      ["Date", "Site", "Output", "Downtime", "Uptime", "Notes", ""],
      rows, [null, null, "num", "num", "num", null, "actions"]
    ));
    if (ops.length > 400) host.appendChild(el("p", { class: "muted", text: "Showing first 400 of " + ops.length + " entries." }));
  }

  function opModal(id) {
    var o = id ? store.get("operations", id) : null;
    var sites = store.all("sites");
    var siteSel = el("select", { id: "f_siteId", name: "siteId", required: "required" });
    sites.forEach(function (s) {
      var opt = el("option", { value: s.id, text: s.name });
      if (o && o.siteId === s.id) opt.selected = true;
      siteSel.appendChild(opt);
    });
    var siteField = el("div", { class: "field" }, [
      el("label", { for: "f_siteId", text: "Site" }), siteSel, el("div", { class: "error-text", id: "err_siteId" })
    ]);

    var fDate = fieldText("date", "Date", o ? o.date : todayISO(), { type: "date", input: { required: "required" } });
    var fOut = fieldText("output", "Output", o ? o.output : "", { type: "number", input: { step: "any", min: "0" } });
    var fDown = fieldText("downtimeHours", "Downtime (hours)", o ? o.downtimeHours : "0", { type: "number", input: { step: "any", min: "0", max: "24" } });
    var fNotes = fieldTextarea("notes", "Notes", o ? o.notes : "");

    var form = el("form", { class: "modal-form", novalidate: "novalidate" }, [
      siteField,
      el("div", { class: "form-grid" }, [fDate.wrap, fOut.wrap]),
      fDown.wrap,
      fNotes.wrap,
      el("div", { class: "modal-actions" }, [
        el("button", { class: "btn secondary", type: "button", text: "Cancel", onclick: closeModal }),
        el("button", { class: "btn", type: "submit", text: id ? "Save changes" : "Add entry" })
      ])
    ]);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      setError("siteId", ""); setError("date", ""); setError("output", ""); setError("downtimeHours", "");
      if (!siteSel.value) { setError("siteId", "Select a site."); ok = false; }
      if (!fDate.input.value) { setError("date", "Date is required."); ok = false; }
      var out = fOut.input.value;
      if (out === "" || isNaN(Number(out)) || Number(out) < 0) { setError("output", "Enter a non-negative number."); ok = false; }
      var down = Number(fDown.input.value || 0);
      if (isNaN(down) || down < 0 || down > 24) { setError("downtimeHours", "Downtime must be 0–24 hours."); ok = false; }
      if (!ok) return;
      var data = { siteId: siteSel.value, date: fDate.input.value, output: Number(out),
        downtimeHours: down, notes: fNotes.input.value.trim() };
      if (id) { store.update("operations", id, data); toast("Entry updated."); }
      else { store.create("operations", data); toast("Entry added."); }
      closeModal();
    });

    if (!sites.length) { toast("Add a site first.", true); return; }
    openModal(id ? "Edit operations entry" : "Add operations entry", form);
  }

  function deleteOp(o) {
    confirmDialog("Delete operations entry for " + siteName(o.siteId) + " on " + o.date + "?", function () {
      store.remove("operations", o.id); toast("Entry deleted.");
    });
  }

  // ---------- TASKS ----------
  var taskFilter = { status: "", siteId: "" };

  function viewTasks() {
    root.appendChild(viewHeader("Tasks & Issues", "Track maintenance work and incidents", [
      el("button", { class: "btn", type: "button", onclick: function () { taskModal(null); }, html: "&#43; Add task" })
    ]));

    if (!store.all("sites").length) { root.appendChild(emptyState("Add a site first, then create tasks.")); return; }

    var statusSel = el("select", { id: "tf_status", "aria-label": "Filter by status" });
    ["All statuses"].forEach(function () {});
    statusSel.appendChild(el("option", { value: "", text: "All statuses" }));
    TASK_STATUS.forEach(function (st) {
      var o = el("option", { value: st, text: st }); if (st === taskFilter.status) o.selected = true; statusSel.appendChild(o);
    });
    var siteSel = el("select", { id: "tf_site", "aria-label": "Filter by site" });
    siteSel.appendChild(el("option", { value: "", text: "All sites" }));
    store.all("sites").forEach(function (s) {
      var o = el("option", { value: s.id, text: s.name }); if (s.id === taskFilter.siteId) o.selected = true; siteSel.appendChild(o);
    });

    var filters = el("div", { class: "filters no-print" }, [
      el("div", { class: "field" }, [el("label", { for: "tf_status", text: "Status" }), statusSel]),
      el("div", { class: "field" }, [el("label", { for: "tf_site", text: "Site" }), siteSel]),
      el("button", { class: "btn secondary", type: "button", text: "Clear", onclick: function () {
        taskFilter = { status: "", siteId: "" }; render();
      } })
    ]);
    function apply() { taskFilter = { status: statusSel.value, siteId: siteSel.value }; renderTaskTable(host); }
    statusSel.addEventListener("change", apply);
    siteSel.addEventListener("change", apply);
    root.appendChild(filters);

    var host = el("div");
    root.appendChild(host);
    renderTaskTable(host);
  }

  function renderTaskTable(host) {
    host.innerHTML = "";
    var tasks = store.all("tasks").filter(function (t) {
      if (taskFilter.status && t.status !== taskFilter.status) return false;
      if (taskFilter.siteId && t.siteId !== taskFilter.siteId) return false;
      return true;
    });
    var prioOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    var statusOrder = { Open: 0, "In Progress": 1, Done: 2 };
    tasks.sort(function (a, b) {
      if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
      return prioOrder[a.priority] - prioOrder[b.priority];
    });

    if (!tasks.length) { host.appendChild(emptyState("No matching tasks.")); return; }

    var rows = tasks.map(function (t) {
      var statusClass = "tstat-" + t.status.replace(/\s+/g, "");
      var nextStatus = t.status === "Open" ? "In Progress" : t.status === "In Progress" ? "Done" : "Open";
      return el("tr", null, [
        el("td", null, [el("strong", { text: t.title })]),
        el("td", { text: siteName(t.siteId) }),
        el("td", null, [el("span", { class: "badge prio-" + t.priority, text: t.priority })]),
        el("td", null, [el("span", { class: "badge " + statusClass, text: t.status })]),
        el("td", { text: t.assignee || "—" }),
        el("td", { text: t.dueDate || "—" }),
        el("td", { class: "actions" }, [
          el("button", { class: "btn small secondary", type: "button", text: "→ " + nextStatus,
            title: "Advance status", onclick: function () { store.update("tasks", t.id, { status: nextStatus }); toast("Status: " + nextStatus); } }),
          el("button", { class: "btn small secondary", type: "button", text: "Edit",
            onclick: function () { taskModal(t.id); } }),
          el("button", { class: "btn small danger", type: "button", text: "Delete",
            onclick: function () { deleteTask(t); } })
        ])
      ]);
    });
    host.appendChild(tableWrap(
      ["Title", "Site", "Priority", "Status", "Assignee", "Due", ""],
      rows, [null, null, null, null, null, null, "actions"]
    ));
  }

  function taskModal(id) {
    var t = id ? store.get("tasks", id) : null;
    var sites = store.all("sites");
    var siteSel = el("select", { id: "f_siteId", name: "siteId" });
    sites.forEach(function (s) {
      var opt = el("option", { value: s.id, text: s.name }); if (t && t.siteId === s.id) opt.selected = true; siteSel.appendChild(opt);
    });
    var siteField = el("div", { class: "field" }, [
      el("label", { for: "f_siteId", text: "Site" }), siteSel, el("div", { class: "error-text", id: "err_siteId" })
    ]);

    var fTitle = fieldText("title", "Title", t ? t.title : "", { input: { required: "required", maxlength: "120" } });
    var fPrio = fieldSelect("priority", "Priority", t ? t.priority : "Medium", PRIORITIES);
    var fStatus = fieldSelect("status", "Status", t ? t.status : "Open", TASK_STATUS);
    var fAssignee = fieldText("assignee", "Assignee", t ? t.assignee : "");
    var fDue = fieldText("dueDate", "Due date", t ? t.dueDate : "", { type: "date" });

    var form = el("form", { class: "modal-form", novalidate: "novalidate" }, [
      fTitle.wrap,
      siteField,
      el("div", { class: "form-grid" }, [fPrio.wrap, fStatus.wrap]),
      el("div", { class: "form-grid" }, [fAssignee.wrap, fDue.wrap]),
      el("div", { class: "modal-actions" }, [
        el("button", { class: "btn secondary", type: "button", text: "Cancel", onclick: closeModal }),
        el("button", { class: "btn", type: "submit", text: id ? "Save changes" : "Add task" })
      ])
    ]);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      setError("title", ""); setError("siteId", "");
      var title = fTitle.input.value.trim();
      if (!title) { setError("title", "Title is required."); ok = false; }
      if (!siteSel.value) { setError("siteId", "Select a site."); ok = false; }
      if (!ok) return;
      var data = { title: title, siteId: siteSel.value, priority: fPrio.input.value,
        status: fStatus.input.value, assignee: fAssignee.input.value.trim(), dueDate: fDue.input.value || "" };
      if (id) { store.update("tasks", id, data); toast("Task updated."); }
      else { store.create("tasks", data); toast("Task added."); }
      closeModal();
    });

    if (!sites.length) { toast("Add a site first.", true); return; }
    openModal(id ? "Edit task" : "Add task", form);
  }

  function deleteTask(t) {
    confirmDialog('Delete task "' + t.title + '"?', function () {
      store.remove("tasks", t.id); toast("Task deleted.");
    });
  }

  // ---------- REPORTS ----------
  var reportFilter = null;

  function viewReports() {
    // default range = last 30 days
    if (!reportFilter) {
      var d = new Date(); d.setDate(d.getDate() - 29);
      reportFilter = { from: d.toISOString().slice(0, 10), to: todayISO(), siteId: "" };
    }

    root.appendChild(viewHeader("Reports", "Generate summaries and export data"));

    var fromInput = el("input", { type: "date", id: "rf_from", value: reportFilter.from, "aria-label": "From date" });
    var toInput = el("input", { type: "date", id: "rf_to", value: reportFilter.to, "aria-label": "To date" });
    var siteSel = el("select", { id: "rf_site", "aria-label": "Site" });
    siteSel.appendChild(el("option", { value: "", text: "All sites" }));
    store.all("sites").forEach(function (s) {
      var o = el("option", { value: s.id, text: s.name }); if (s.id === reportFilter.siteId) o.selected = true; siteSel.appendChild(o);
    });

    var resultHost = el("div");

    var filters = el("div", { class: "filters no-print" }, [
      el("div", { class: "field" }, [el("label", { for: "rf_from", text: "From" }), fromInput]),
      el("div", { class: "field" }, [el("label", { for: "rf_to", text: "To" }), toInput]),
      el("div", { class: "field" }, [el("label", { for: "rf_site", text: "Site" }), siteSel]),
      el("button", { class: "btn", type: "button", text: "Generate", onclick: function () {
        reportFilter = { from: fromInput.value, to: toInput.value, siteId: siteSel.value };
        renderReport(resultHost);
      } }),
      el("button", { class: "btn secondary", type: "button", text: "Export CSV", onclick: function () {
        reportFilter = { from: fromInput.value, to: toInput.value, siteId: siteSel.value };
        var csv = reports.buildReportCSV(store, reportFilter);
        var sitePart = reportFilter.siteId ? siteName(reportFilter.siteId).replace(/[^a-z0-9]+/gi, "-") : "all-sites";
        reports.downloadCSV("bg-ors-report_" + sitePart + "_" + (reportFilter.from || "start") + "_" + (reportFilter.to || "end") + ".csv", csv);
        toast("CSV exported.");
      } }),
      el("button", { class: "btn secondary", type: "button", text: "Print", onclick: function () { global.print(); } })
    ]);
    root.appendChild(filters);
    root.appendChild(resultHost);
    renderReport(resultHost);
  }

  function renderReport(host) {
    host.innerHTML = "";
    var sum = reports.summary(store, reportFilter);
    var label = reportFilter.siteId ? siteName(reportFilter.siteId) : "All sites";

    host.appendChild(el("div", { class: "report-meta" }, [
      el("strong", { text: label }), document.createTextNode(
        "  ·  " + (reportFilter.from || "start") + " to " + (reportFilter.to || "end") +
        "  ·  generated " + new Date().toLocaleString("en-GB"))
    ]));

    host.appendChild(el("div", { class: "grid summary-grid" }, [
      kpiCard("Total output", fmtNum(sum.totalOutput), sum.logCount + " log entries"),
      kpiCard("Avg daily output", fmtNum(sum.avgDailyOutput), sum.dayCount + " days"),
      kpiCard("Total downtime", sum.totalDowntime + "h", "across range"),
      kpiCard("Uptime", sum.uptime == null ? "—" : sum.uptime + "%", "weighted by logs"),
      kpiCard("Task completion", sum.taskCompletion + "%", sum.taskDone + "/" + sum.taskTotal + " done"),
      kpiCard("Open tasks", sum.taskOpen, "in range scope")
    ]));

    var canvas = el("canvas", { "aria-label": "Output over time for selected range" });
    host.appendChild(el("div", { class: "card chart-card" }, [
      el("h2", { text: "Output over time" }),
      el("div", { class: "chart-wrap" }, [canvas])
    ]));
    var data = reports.outputOverTime(store, reportFilter);
    var draw = function () { charts.lineChart(canvas, data, { height: 260, empty: "No data in this range" }); };
    resizeRedraw = draw;
    requestAnimationFrame(draw);

    // by-site bar chart too
    var bySiteData = reports.outputBySite(store, reportFilter);
    if (!reportFilter.siteId && bySiteData.length > 1) {
      var bcanvas = el("canvas", { "aria-label": "Output by site" });
      host.appendChild(el("div", { class: "card chart-card" }, [
        el("h2", { text: "Output by site" }),
        el("div", { class: "chart-wrap" }, [bcanvas])
      ]));
      var prevDraw = draw;
      resizeRedraw = function () { prevDraw(); charts.barChart(bcanvas, bySiteData, { height: 260 }); };
      requestAnimationFrame(function () { charts.barChart(bcanvas, bySiteData, { height: 260 }); });
    }
  }

  // ---------- shared table builder ----------
  function tableWrap(headers, rows, colClasses) {
    colClasses = colClasses || [];
    var thead = el("thead", null, [el("tr", null, headers.map(function (h, i) {
      return el("th", { class: colClasses[i] === "num" ? "num" : "" , text: h });
    }))]);
    var tbody = el("tbody", null, rows);
    return el("div", { class: "table-wrap" }, [el("table", null, [thead, tbody])]);
  }

  // ---------- nav (mobile) ----------
  function closeMobileNav() {
    var nav = document.getElementById("primary-nav");
    var toggle = document.getElementById("nav-toggle");
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }

  // ---------- init ----------
  function init() {
    root = document.getElementById("view-root");
    modalOverlay = document.getElementById("modal-overlay");
    modalBody = document.getElementById("modal-body");
    modalTitle = document.getElementById("modal-title");
    toastRegion = document.getElementById("toast-region");

    // seed on first run
    seed.seedIfEmpty(store);

    // routing
    window.addEventListener("hashchange", render);
    if (!location.hash) location.hash = "#/dashboard";

    // re-render on any data change so all views stay consistent
    store.on("change", function () { render(); });

    // modal close wiring
    document.getElementById("modal-close").addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", function (e) { if (e.target === modalOverlay) closeModal(); });

    // mobile nav toggle
    var toggle = document.getElementById("nav-toggle");
    var nav = document.getElementById("primary-nav");
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // reset demo data
    document.getElementById("reset-demo").addEventListener("click", function () {
      confirmDialog("Reset all data back to the demo sample? Your current changes will be lost.", function () {
        seed.reseed(store);
        toast("Demo data reset.");
      });
    });

    // redraw charts on resize (debounced)
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (!resizeRedraw) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (resizeRedraw) resizeRedraw(); }, 150);
    });

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  BG.app = { render: render }; // expose for debugging
})(window);
