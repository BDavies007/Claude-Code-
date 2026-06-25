/* seed.js — deterministic-ish sample data generator. window.BGORS.seed.
   Generates several sites, ~60-90 days of operations logs, and a dozen tasks. */
(function (global) {
  "use strict";
  global.BGORS = global.BGORS || {};

  // Small seeded PRNG (mulberry32) so demo data is stable across reloads.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isoDate(d) { return d.toISOString().slice(0, 10); }
  function daysAgo(n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; }

  function build() {
    var rnd = mulberry32(20260625);
    var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    var range = function (min, max) { return min + rnd() * (max - min); };

    var siteDefs = [
      { name: "Helios Solar Farm",        type: "Solar Farm",      location: "Devon, UK",        cap: 48,  unit: "MW",  base: 220000, status: "Active" },
      { name: "Pennine Wind Park",        type: "Wind",            location: "Cumbria, UK",      cap: 36,  unit: "MW",  base: 180000, status: "Active" },
      { name: "Thameside Recycling",      type: "Recycling Plant", location: "London, UK",       cap: 120, unit: "t/day", base: 95,  status: "Active" },
      { name: "Mercia EV Hub",            type: "EV Charging",     location: "Birmingham, UK",   cap: 2.4, unit: "MW",  base: 5200,   status: "Active" },
      { name: "Severn Battery Storage",   type: "Battery Storage", location: "Bristol, UK",      cap: 50,  unit: "MWh", base: 41000,  status: "Maintenance" },
      { name: "Anglia Solar Array",       type: "Solar Farm",      location: "Norfolk, UK",      cap: 22,  unit: "MW",  base: 98000,  status: "Active" },
      { name: "Clyde Wind Cluster",       type: "Wind",            location: "Glasgow, UK",      cap: 60,  unit: "MW",  base: 310000, status: "Offline" }
    ];

    var sites = siteDefs.map(function (s, i) {
      return {
        id: "site_" + (i + 1),
        name: s.name,
        type: s.type,
        location: s.location,
        capacity: s.cap,
        capacityUnit: s.unit,
        status: s.status,
        commissionedDate: isoDate(daysAgo(Math.floor(range(400, 2000))))
      };
    });

    // Operations: ~75 days per active/maintenance site.
    var operations = [];
    var DAYS = 78;
    sites.forEach(function (site, si) {
      var def = siteDefs[si];
      if (site.status === "Offline") return; // offline sites produce no recent logs
      for (var d = DAYS; d >= 0; d--) {
        // Weekend / weather variation
        var date = daysAgo(d);
        var dow = date.getDay();
        var seasonal = 1 + 0.15 * Math.sin((DAYS - d) / 9);
        var noise = range(0.78, 1.18);
        var weekendDip = (def.type === "EV Charging" && (dow === 0 || dow === 6)) ? 0.7 : 1;
        var output = Math.round(def.base * seasonal * noise * weekendDip);

        // occasional downtime
        var downtime = 0;
        var roll = rnd();
        if (site.status === "Maintenance" && roll < 0.22) downtime = +range(2, 8).toFixed(1);
        else if (roll < 0.08) downtime = +range(0.5, 5).toFixed(1);
        if (downtime > 0) output = Math.round(output * (1 - downtime / 24));

        operations.push({
          id: "op_" + site.id + "_" + d,
          siteId: site.id,
          date: isoDate(date),
          output: output,
          downtimeHours: downtime,
          notes: downtime > 0 ? pick(["Inverter fault", "Scheduled maintenance", "Grid curtailment", "Sensor recalibration", "Weather stoppage"]) : ""
        });
      }
    });

    var assignees = ["A. Okafor", "M. Reyes", "S. Patel", "J. Nakamura", "L. Fischer", "T. Bennett"];
    var taskTitles = [
      ["Replace faulty inverter string", "High"],
      ["Quarterly turbine gearbox inspection", "Medium"],
      ["Investigate output dip on south array", "High"],
      ["Calibrate weather station sensors", "Low"],
      ["Battery cell balancing check", "Critical"],
      ["Restore Clyde Wind Cluster to service", "Critical"],
      ["Update SCADA firmware", "Medium"],
      ["Vegetation management around panels", "Low"],
      ["EV charger payment terminal fix", "High"],
      ["Annual fire-safety audit", "Medium"],
      ["Recycling line throughput optimisation", "Medium"],
      ["Replace damaged perimeter fencing", "Low"],
      ["Grid connection compliance review", "High"]
    ];
    var statuses = ["Open", "In Progress", "Done"];
    var tasks = taskTitles.map(function (t, i) {
      var site = pick(sites);
      var status = (t[1] === "Critical") ? pick(["Open", "In Progress"]) : pick(statuses);
      return {
        id: "task_" + (i + 1),
        siteId: site.id,
        title: t[0],
        priority: t[1],
        status: status,
        assignee: pick(assignees),
        dueDate: isoDate(daysAgo(-Math.floor(range(-10, 30)))) // some past, some future
      };
    });

    return { sites: sites, operations: operations, tasks: tasks, meta: { seeded: true, seededAt: new Date().toISOString() } };
  }

  function seedIfEmpty(store) {
    var meta = store.getMeta();
    if (meta.seeded && store.all("sites").length) return false;
    if (store.all("sites").length) return false;
    store.replaceAll(build());
    return true;
  }

  function reseed(store) {
    store.replaceAll(build());
    return true;
  }

  global.BGORS.seed = { build: build, seedIfEmpty: seedIfEmpty, reseed: reseed };
})(window);
