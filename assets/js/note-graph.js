(function () {
  "use strict";
  var dataEl = document.getElementById("note-graph-data");
  var svg = document.getElementById("note-graph-svg");
  if (!dataEl || !svg) return;

  var graph = JSON.parse(dataEl.textContent);
  var nodes = graph.nodes;
  var byId = {};
  nodes.forEach(function (n) { byId[n.id] = n; n.nb = {}; n.backlinks = []; });
  graph.links.forEach(function (l) {
    byId[l.source].nb[l.target] = true;
    byId[l.target].nb[l.source] = true;
    if (byId[l.target].backlinks.indexOf(l.source) < 0) byId[l.target].backlinks.push(l.source);
  });

  document.documentElement.classList.add("has-note-graph");
  var canHover = window.matchMedia("(hover: hover)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";

  function noteContent(id) {
    var src = document.getElementById("note-" + id);
    if (!src) return null;
    var body = src.querySelector(".note-body").cloneNode(true);
    body.querySelectorAll("[id]").forEach(function (el) { el.removeAttribute("id"); });
    return body;
  }

  /* ---------- graph layout: repulsion + edge springs + centering ---------- */
  function layout() {
    var N = nodes.length, ITER = 400, REPEL = 5200, LEN = 80, K = 0.06, GRAV = 0.012;
    nodes.forEach(function (n, i) {
      var a = (2 * Math.PI * i) / N;
      n.x = n.main ? 0 : Math.cos(a) * 90;
      n.y = n.main ? 0 : Math.sin(a) * 90;
      n.vx = 0; n.vy = 0;
    });
    for (var it = 0; it < ITER; it++) {
      var alpha = 1 - it / ITER;
      for (var i = 0; i < N; i++) {
        for (var j = i + 1; j < N; j++) {
          var a = nodes[i], b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = Math.max(dx * dx + dy * dy, 1), d = Math.sqrt(d2), f = REPEL / d2;
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        }
      }
      graph.links.forEach(function (l) {
        var s = byId[l.source], t = byId[l.target];
        var dx = t.x - s.x, dy = t.y - s.y, d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        var f = (d - LEN) * K;
        s.vx += (dx / d) * f; s.vy += (dy / d) * f;
        t.vx -= (dx / d) * f; t.vy -= (dy / d) * f;
      });
      nodes.forEach(function (n) {
        n.vx -= n.x * GRAV; n.vy -= n.y * GRAV;
        n.x += n.vx * alpha; n.y += n.vy * alpha;
        n.vx *= 0.5; n.vy *= 0.5;
      });
    }
  }

  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function drawGraph() {
    layout();
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (n) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    // Map layout coords into the SVG's pixel box (axes scaled independently) so
    // labels keep a constant on-screen size instead of shrinking with the graph.
    var W = svg.clientWidth || 360, H = svg.clientHeight || 280;
    var padX = 55, padTop = 34, padBottom = 22;
    var sx = (W - 2 * padX) / Math.max(maxX - minX, 1);
    var sy = (H - padTop - padBottom) / Math.max(maxY - minY, 1);
    nodes.forEach(function (n) { n.x = padX + (n.x - minX) * sx; n.y = padTop + (n.y - minY) * sy; });
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);

    var gLinks = el("g", { "class": "ng-links" }, svg);
    graph.links.forEach(function (l) {
      var s = byId[l.source], t = byId[l.target];
      l.el = el("line", { x1: s.x, y1: s.y, x2: t.x, y2: t.y }, gLinks);
    });
    var gNodes = el("g", { "class": "ng-nodes" }, svg);
    nodes.forEach(function (n) {
      var deg = Object.keys(n.nb).length;
      var r = n.main ? 9 : 4 + Math.sqrt(deg) * 1.6;
      var cls = "ng-node" + (n.main ? " is-main" : "") + (n.empty ? " is-empty" : "");
      var g = el("g", { "class": cls, transform: "translate(" + n.x + "," + n.y + ")", tabindex: "0", role: "button" }, gNodes);
      el("title", {}, g).textContent = n.title;
      el("circle", { r: r }, g);
      var label = el("text", { y: r + 10 }, g);
      label.textContent = n.short;
      n.el = g;
      g.addEventListener("mouseenter", function () { highlight(n.id); });
      g.addEventListener("mouseleave", function () { highlight(null); });
      g.addEventListener("click", function () { activate(n.id); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(n.id); } });
    });
  }

  function highlight(id) {
    svg.classList.toggle("is-dimmed", !!id);
    nodes.forEach(function (n) {
      n.el.classList.toggle("is-hl", !!id && (n.id === id || !!byId[id].nb[n.id]));
    });
    graph.links.forEach(function (l) {
      l.el.classList.toggle("is-hl", !!id && (l.source === id || l.target === id));
    });
  }

  /* ---------- reader panel ---------- */
  var reader = document.getElementById("note-reader");
  var rTitle = document.getElementById("note-reader-title");
  var rBody = document.getElementById("note-reader-body");
  var rBack = document.getElementById("note-reader-back");
  var rClose = document.getElementById("note-reader-close");
  var hint = rBody.innerHTML;
  var history = [], current = null;

  function setActive(id) {
    nodes.forEach(function (n) { n.el.classList.toggle("is-active", n.id === id); });
  }

  function openNote(id, push) {
    var n = byId[id];
    if (!n) return;
    if (n.main) { closeNote(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (push && current && current !== id) history.push(current);
    current = id;
    rTitle.textContent = n.title;
    rBody.innerHTML = "";
    var content = noteContent(id);
    if (content) rBody.appendChild(content);
    var back = n.backlinks.filter(function (b) { return !byId[b].main; });
    if (back.length) {
      var box = document.createElement("div");
      box.className = "note-backlinks";
      box.innerHTML = "<h4>Được nhắc đến trong</h4>";
      var ul = document.createElement("ul");
      back.forEach(function (b) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.className = "wikilink"; a.href = "#note-" + b; a.dataset.note = b;
        a.textContent = byId[b].title;
        li.appendChild(a); ul.appendChild(li);
      });
      box.appendChild(ul);
      rBody.appendChild(box);
    }
    rBody.scrollTop = 0;
    rBack.hidden = history.length === 0;
    rClose.hidden = false;
    setActive(id);
    if (!canHover) reader.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeNote() {
    history = []; current = null;
    rTitle.textContent = "Ghi chú";
    rBody.innerHTML = hint;
    rBack.hidden = true; rClose.hidden = true;
    setActive(null);
  }

  function activate(id) { hidePopover(true); openNote(id, true); }

  rBack.addEventListener("click", function () { if (history.length) openNote(history.pop(), false); });
  rClose.addEventListener("click", closeNote);

  /* ---------- hover preview ---------- */
  var pop = document.createElement("div");
  pop.className = "note-popover post-content";
  pop.hidden = true;
  document.body.appendChild(pop);
  var showTimer = null, hideTimer = null;

  function showPopover(link) {
    var id = link.dataset.note, n = byId[id];
    if (!n || n.main) return;
    pop.innerHTML = "";
    var h = document.createElement("div");
    h.className = "note-popover-title";
    h.textContent = n.title;
    pop.appendChild(h);
    var content = noteContent(id);
    if (content) pop.appendChild(content);
    var foot = document.createElement("div");
    foot.className = "note-popover-foot";
    foot.textContent = "Nhấp để mở trong khung bên cạnh";
    pop.appendChild(foot);
    pop.hidden = false;

    var r = link.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - pw - 8);
    var top = r.bottom + 8;
    if (top + ph > window.innerHeight - 8 && r.top - ph - 8 > 8) top = r.top - ph - 8;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function hidePopover(now) {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (now) { pop.hidden = true; highlight(null); return; }
    hideTimer = setTimeout(function () { pop.hidden = true; highlight(null); }, 180);
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a.wikilink");
    if (!a || !byId[a.dataset.note]) return;
    e.preventDefault();
    activate(a.dataset.note);
  });

  if (canHover) {
    document.addEventListener("mouseover", function (e) {
      var a = e.target.closest("a.wikilink");
      if (!a || pop.contains(a)) return;
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      highlight(a.dataset.note);
      showTimer = setTimeout(function () { showPopover(a); }, 200);
    });
    document.addEventListener("mouseout", function (e) {
      var a = e.target.closest("a.wikilink");
      if (a && !pop.contains(a) && !a.contains(e.relatedTarget)) hidePopover(false);
    });
    pop.addEventListener("mouseenter", function () { clearTimeout(hideTimer); });
    pop.addEventListener("mouseleave", function () { hidePopover(false); });
    window.addEventListener("scroll", function () { hidePopover(true); }, { passive: true });
  }

  drawGraph();
})();
