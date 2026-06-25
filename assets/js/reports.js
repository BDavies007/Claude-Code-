/* reports.js — aggregations + CSV export. window.BGORS.reports.
   Pure functions over store data; no DOM here except the CSV download helper. */
(function (global) {
  "use strict";
  global.BGORS = global.BGORS || {};

  function inRange(dateStr, from, to) {
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
  }

  function round(n, dp) { var f = Math.pow(10, dp || 0); return Math.round(n * f) / f; }

  /* Compute uptime % for a set of operations rows.
     uptime = (1 - totalDowntime / (24 * numDays)) where numDays = distinct log entries. */
  function uptimeFromOps(ops) {
    if (!ops.length) return null;
    var totalDown = ops.reduce(function (a, o) { return a + (Number(o.downtimeHours) || 0); }, 0);
    var capacityHours = ops.length * 24;
    if (capacityHours === 0) return null;
    return round(Math.max(0, 100 * (1 - totalDown / capacityHours)), 1);
  }

  function rowUptime(op) {
    var down = Number(op.downtimeHours) || 0;
    return round(Math.max(0, 100 * (1 - down / 24)), 1);
  }

  /* summary(store, {from, to, siteId}) -> aggregate object for reports/dashboard. */
  function summary(store, filter) {
    filter = filter || {};
    var ops = store.all("operations").filter(function (o) {
      if (filter.siteId && o.siteId !== filter.siteId) return false;
      return inRange(o.date, filter.from, filter.to);
    });
    var tasks = store.all("tasks").filter(function (t) {
      return !filter.siteId || t.siteId === filter.siteId;
    });

    var totalOutput = ops.reduce(function (a, o) { return a + (Number(o.output) || 0); }, 0);
    var totalDowntime = ops.reduce(function (a, o) { return a + (Number(o.downtimeHours) || 0); }, 0);
    var days = {};
    ops.forEach(function (o) { days[o.date] = true; });
    var dayCount = Object.keys(days).length;
    var avgDaily = dayCount ? totalOutput / dayCount : 0;

    var doneTasks = tasks.filter(function (t) { return t.status === "Done"; }).length;
    var openTasks = tasks.filter(function (t) { return t.status !== "Done"; }).length;
    var completion = tasks.length ? round(100 * doneTasks / tasks.length, 1) : 0;

    return {
      from: filter.from || null,
      to: filter.to || null,
      siteId: filter.siteId || null,
      logCount: ops.length,
      dayCount: dayCount,
      totalOutput: Math.round(totalOutput),
      avgDailyOutput: Math.round(avgDaily),
      totalDowntime: round(totalDowntime, 1),
      uptime: uptimeFromOps(ops),
      taskTotal: tasks.length,
      taskDone: doneTasks,
      taskOpen: openTasks,
      taskCompletion: completion
    };
  }

  /* outputOverTime(store, filter) -> [{label, value}] aggregated by date. */
  function outputOverTime(store, filter) {
    filter = filter || {};
    var byDate = {};
    store.all("operations").forEach(function (o) {
      if (filter.siteId && o.siteId !== filter.siteId) return;
      if (!inRange(o.date, filter.from, filter.to)) return;
      byDate[o.date] = (byDate[o.date] || 0) + (Number(o.output) || 0);
    });
    return Object.keys(byDate).sort().map(function (d) {
      return { label: d.slice(5), value: byDate[d], date: d }; // label MM-DD
    });
  }

  /* outputBySite(store, filter) -> [{label, value, siteId}] */
  function outputBySite(store, filter) {
    filter = filter || {};
    var sites = store.all("sites");
    var byId = {};
    store.all("operations").forEach(function (o) {
      if (filter.siteId && o.siteId !== filter.siteId) return;
      if (!inRange(o.date, filter.from, filter.to)) return;
      byId[o.siteId] = (byId[o.siteId] || 0) + (Number(o.output) || 0);
    });
    return sites
      .filter(function (s) { return byId[s.id] != null; })
      .map(function (s) { return { label: s.name, value: byId[s.id], siteId: s.id }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  // ---- CSV ----
  function csvCell(v) {
    if (v == null) v = "";
    v = String(v);
    if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function toCSV(rows) {
    return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
  }

  /* buildReportCSV(store, filter) -> string. Includes a summary block + per-day ops. */
  function buildReportCSV(store, filter) {
    var sum = summary(store, filter);
    var siteName = filter.siteId ? (store.get("sites", filter.siteId) || {}).name : "All sites";
    var rows = [];
    rows.push(["Beyond Green — Operating & Reporting System"]);
    rows.push(["Report generated", new Date().toISOString()]);
    rows.push(["Site", siteName || ""]);
    rows.push(["Date from", sum.from || "(all)"]);
    rows.push(["Date to", sum.to || "(all)"]);
    rows.push([]);
    rows.push(["Metric", "Value"]);
    rows.push(["Total output", sum.totalOutput]);
    rows.push(["Avg daily output", sum.avgDailyOutput]);
    rows.push(["Total downtime (hrs)", sum.totalDowntime]);
    rows.push(["Uptime (%)", sum.uptime == null ? "n/a" : sum.uptime]);
    rows.push(["Log entries", sum.logCount]);
    rows.push(["Distinct days", sum.dayCount]);
    rows.push(["Tasks total", sum.taskTotal]);
    rows.push(["Tasks done", sum.taskDone]);
    rows.push(["Tasks open", sum.taskOpen]);
    rows.push(["Task completion (%)", sum.taskCompletion]);
    rows.push([]);
    rows.push(["Date", "Site", "Output", "Downtime (hrs)", "Uptime (%)", "Notes"]);

    var ops = store.all("operations").filter(function (o) {
      if (filter.siteId && o.siteId !== filter.siteId) return false;
      return inRange(o.date, filter.from, filter.to);
    }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

    var siteLookup = {};
    store.all("sites").forEach(function (s) { siteLookup[s.id] = s.name; });

    ops.forEach(function (o) {
      rows.push([o.date, siteLookup[o.siteId] || o.siteId, o.output, o.downtimeHours, rowUptime(o), o.notes || ""]);
    });

    return toCSV(rows);
  }

  /* downloadCSV — triggers a real file download via Blob. */
  function downloadCSV(filename, csv) {
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    var url = global.URL.createObjectURL(blob);
    var a = global.document.createElement("a");
    a.href = url;
    a.download = filename;
    global.document.body.appendChild(a);
    a.click();
    global.document.body.removeChild(a);
    setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
  }

  global.BGORS.reports = {
    summary: summary,
    outputOverTime: outputOverTime,
    outputBySite: outputBySite,
    rowUptime: rowUptime,
    uptimeFromOps: uptimeFromOps,
    buildReportCSV: buildReportCSV,
    downloadCSV: downloadCSV,
    toCSV: toCSV
  };
})(window);
