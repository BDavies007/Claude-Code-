/* charts.js — hand-written canvas line + bar charts. window.BGORS.charts.
   No chart libraries. Handles empty data, axes, labels and scaling. */
(function (global) {
  "use strict";
  global.BGORS = global.BGORS || {};

  var COLORS = {
    line: "#198754",
    fill: "rgba(25, 135, 84, 0.12)",
    bar: "#20c997",
    barAlt: "#198754",
    axis: "#9fb3ab",
    grid: "#e4ece8",
    text: "#4a5b56",
    ink: "#1b2b27"
  };

  // Setup a canvas for crisp rendering on HiDPI. Returns {ctx, w, h}.
  function setup(canvas, cssHeight) {
    var ratio = global.devicePixelRatio || 1;
    var cssWidth = canvas.clientWidth || canvas.parentNode.clientWidth || 600;
    var h = cssHeight || 260;
    canvas.style.height = h + "px";
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(h * ratio);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssWidth, h);
    return { ctx: ctx, w: cssWidth, h: h };
  }

  function emptyMessage(ctx, w, h, msg) {
    ctx.fillStyle = COLORS.text;
    ctx.font = "14px -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(msg || "No data to display", w / 2, h / 2);
  }

  // "Nice" axis maximum so the top gridline is a round number.
  function niceMax(value) {
    if (value <= 0) return 1;
    var exp = Math.floor(Math.log10(value));
    var base = Math.pow(10, exp);
    var frac = value / base;
    var nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
    return nice * base;
  }

  function fmtShort(n) {
    var abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
    return String(Math.round(n));
  }

  /* lineChart(canvas, data, opts)
     data: [{ label: string, value: number }]  */
  function lineChart(canvas, data, opts) {
    opts = opts || {};
    var s = setup(canvas, opts.height);
    var ctx = s.ctx, w = s.w, h = s.h;
    if (!data || !data.length) { emptyMessage(ctx, w, h, opts.empty); return; }

    var padL = 52, padR = 14, padT = 14, padB = 34;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;

    var max = niceMax(Math.max.apply(null, data.map(function (d) { return d.value; })) || 1);
    var steps = 4;

    // grid + y labels
    ctx.font = "11px -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textBaseline = "middle";
    for (var i = 0; i <= steps; i++) {
      var y = padT + plotH * (i / steps);
      var val = max * (1 - i / steps);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "right";
      ctx.fillText(fmtShort(val), padL - 8, y);
    }

    var n = data.length;
    var xAt = function (idx) { return padL + (n === 1 ? plotW / 2 : plotW * idx / (n - 1)); };
    var yAt = function (v) { return padT + plotH * (1 - v / max); };

    // area fill
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(data[0].value));
    data.forEach(function (d, idx) { ctx.lineTo(xAt(idx), yAt(d.value)); });
    ctx.lineTo(xAt(n - 1), padT + plotH);
    ctx.lineTo(xAt(0), padT + plotH);
    ctx.closePath();
    ctx.fillStyle = COLORS.fill;
    ctx.fill();

    // line
    ctx.beginPath();
    data.forEach(function (d, idx) {
      var x = xAt(idx), y = yAt(d.value);
      if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    // points (only if not too dense)
    if (n <= 40) {
      ctx.fillStyle = COLORS.line;
      data.forEach(function (d, idx) {
        ctx.beginPath(); ctx.arc(xAt(idx), yAt(d.value), 2.5, 0, Math.PI * 2); ctx.fill();
      });
    }

    // x labels (subset)
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    var maxLabels = Math.max(2, Math.floor(plotW / 70));
    var stepIdx = Math.max(1, Math.ceil(n / maxLabels));
    for (var k = 0; k < n; k += stepIdx) {
      ctx.fillText(data[k].label, xAt(k), padT + plotH + 8);
    }
    // always show last label
    if ((n - 1) % stepIdx !== 0) ctx.fillText(data[n - 1].label, xAt(n - 1), padT + plotH + 8);

    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.beginPath();
    ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(w - padR, padT + plotH);
    ctx.stroke();
  }

  /* barChart(canvas, data, opts)
     data: [{ label: string, value: number }] */
  function barChart(canvas, data, opts) {
    opts = opts || {};
    var s = setup(canvas, opts.height);
    var ctx = s.ctx, w = s.w, h = s.h;
    if (!data || !data.length) { emptyMessage(ctx, w, h, opts.empty); return; }

    var padL = 52, padR = 14, padT = 14, padB = 50;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;

    var max = niceMax(Math.max.apply(null, data.map(function (d) { return d.value; })) || 1);
    var steps = 4;

    ctx.font = "11px -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textBaseline = "middle";
    for (var i = 0; i <= steps; i++) {
      var y = padT + plotH * (i / steps);
      var val = max * (1 - i / steps);
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = COLORS.text; ctx.textAlign = "right";
      ctx.fillText(fmtShort(val), padL - 8, y);
    }

    var n = data.length;
    var slot = plotW / n;
    var barW = Math.min(46, slot * 0.62);

    data.forEach(function (d, idx) {
      var x = padL + slot * idx + (slot - barW) / 2;
      var bh = plotH * (d.value / max);
      var y = padT + plotH - bh;
      ctx.fillStyle = idx % 2 ? COLORS.barAlt : COLORS.bar;
      ctx.fillRect(x, y, barW, bh);

      // value label above bar
      ctx.fillStyle = COLORS.ink;
      ctx.font = "10px -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      if (bh > 14) ctx.fillText(fmtShort(d.value), x + barW / 2, y - 2);

      // x label (rotated if long)
      ctx.fillStyle = COLORS.text;
      ctx.save();
      ctx.translate(x + barW / 2, padT + plotH + 6);
      var label = d.label.length > 12 ? d.label.slice(0, 11) + "…" : d.label;
      if (slot < 70) {
        ctx.rotate(-Math.PI / 5);
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(label, 0, 6);
      } else {
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(label, 0, 0);
      }
      ctx.restore();
    });

    ctx.strokeStyle = COLORS.axis;
    ctx.beginPath();
    ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(w - padR, padT + plotH);
    ctx.stroke();
  }

  global.BGORS.charts = { lineChart: lineChart, barChart: barChart, fmtShort: fmtShort };
})(window);
