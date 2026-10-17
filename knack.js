(() => {
  "use strict";

  const S = window.Stage;
  if (!S) return;
  const { Spring, run, watch, evaluate } = S;
  const cfg = window.STAGE || {};
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const frozen = new URLSearchParams(location.search).has("static");
  const calm = () => still.matches || frozen;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const glyph = (name) => `<svg viewBox="0 0 24 24"><use href="#g-${name}"/></svg>`;

  const bar = $(".kbar");
  if (bar) {
    const dock = $(".kbar-dock", bar);
    const tiles = $$("a[data-sec]", dock);
    const ind = $(".kd-ind", dock);
    let ticking = false, current = null;
    const place = (a) => {
      tiles.forEach((t) => t.classList.toggle("on", t === a));
      dock.classList.toggle("has-on", !!a);
      if (a) ind.style.setProperty("--x", (a.offsetLeft + a.offsetWidth / 2 - 2) + "px");
    };
    const spy = () => {
      const line = innerHeight * 0.38;
      let pick = null;
      tiles.forEach((t) => {
        const sec = document.getElementById(t.dataset.sec);
        if (!sec) return;
        const r = sec.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) pick = t;
      });
      if (pick !== current) { current = pick; place(pick); }
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; bar.classList.toggle("scrolled", scrollY > 12); spy(); });
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", () => place(current));
    bar.classList.toggle("scrolled", scrollY > 12);
    spy();
    const clearMag = () => tiles.forEach((t) => t.classList.remove("mag-1", "mag-2"));
    if (!calm() && matchMedia("(hover: hover)").matches) {
      tiles.forEach((t, i) => t.addEventListener("pointerenter", () => {
        clearMag();
        t.classList.add("mag-1");
        if (tiles[i - 1]) tiles[i - 1].classList.add("mag-2");
        if (tiles[i + 1]) tiles[i + 1].classList.add("mag-2");
      }));
      dock.addEventListener("pointerleave", clearMag);
    }
  }

  function radioGroup(items, pick) {
    const check = (on) => items.forEach((b) => {
      b.setAttribute("aria-checked", b === on ? "true" : "false");
      b.tabIndex = b === on ? 0 : -1;
    });
    check(items.find((b) => b.getAttribute("aria-checked") === "true") || items[0]);
    items.forEach((b, n) => {
      b.addEventListener("click", () => { check(b); pick(b); });
      b.addEventListener("keydown", (e) => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const to = items[(n + d + items.length) % items.length];
        to.focus();
        check(to);
        pick(to);
      });
    });
  }

  const L = Object.assign({
    label: "Knack",
    items: [],
    demo: "",
    maths: "Maths",
    copy: "Copy",
    open: "Open",
    copied: (t) => `Copied ${t}`,
    opened: (t) => `Opening ${t}`,
    empty: "No tool by that name."
  }, cfg.launcher || {});

  function score(q, item) {
    const n = item.title.toLowerCase();
    if (n.startsWith(q)) return 300 - n.length;
    if (n.split(/[\s&]+/).some((w) => w.startsWith(q))) return 200 - n.length;
    const keys = (item.keys || "").split(/\s+/);
    if (keys.includes(q)) return 180 - n.length * 0.1;
    if (q.length >= 2 && keys.some((k) => k.startsWith(q))) return 150 - n.length * 0.1;
    if (q.length < 3) return null;
    let at = -1, gaps = 0;
    for (const ch of q) {
      const next = n.indexOf(ch, at + 1);
      if (next < 0) return null;
      gaps += next - at - 1;
      at = next;
    }
    return gaps > 8 ? null : 100 - gaps - n.length * 0.1;
  }
  const fmtNum = (v) => parseFloat(v.toPrecision(12)).toLocaleString("en-US", { maximumFractionDigits: 10 });

  function results(query, limit = 3) {
    const q = query.trim();
    if (!q) return [];
    const rows = [];
    const v = evaluate(q);
    if (v !== null) rows.push({ id: "calc", title: fmtNum(v), raw: String(parseFloat(v.toPrecision(12))), sub: `${L.maths} · ${q}`, glyph: "calc", trailing: L.copy, kind: "calc" });
    const lq = q.toLowerCase();
    L.items.map((item) => ({ item, s: score(lq, item) }))
      .filter((m) => m.s !== null)
      .sort((a, b) => b.s - a.s || a.item.title.localeCompare(b.item.title))
      .slice(0, limit)
      .forEach(({ item }) => rows.push({ id: "t:" + item.title, title: item.title, sub: item.sub || "Tool", glyph: item.glyph, trailing: L.open, kind: "item" }));
    return rows.slice(0, limit);
  }

  $$('[data-stage="tools-launcher"]').forEach((panel) => {
    const input = $(".lp-input", panel);
    const list = $(".lp-list", panel);
    const box = $(".lp-results", panel);
    const status = $(".lp-label", panel);
    const verb = $(".lp-verb", panel);
    const emptyEl = $(".lp-empty", panel);
    const idleEmpty = emptyEl.textContent;
    const section = panel.closest("section") || document;
    let rows = [], sel = 0, els = new Map(), statusTimer = 0, auto = 0, touched = false;

    function fill(li, r) {
      $(".lp-t", li).textContent = r.title;
      $(".lp-s", li).textContent = r.sub;
      $(".lp-tr", li).textContent = r.trailing || "";
    }
    function rowEl(r) {
      const li = document.createElement("li");
      li.className = "lp-row";
      li.setAttribute("role", "option");
      li.innerHTML = `<span class="lp-ico sym">${glyph(r.glyph)}</span><span class="lp-tx"><span class="lp-t"></span><span class="lp-s"></span></span><span class="lp-tr"></span>`;
      fill(li, r);
      return li;
    }
    function render() {
      rows = results(input.value);
      sel = Math.min(sel, Math.max(0, rows.length - 1));
      const next = new Map();
      rows.forEach((r) => {
        let li = els.get(r.id);
        if (li) fill(li, r);
        else {
          li = rowEl(r);
          li.id = "lp-" + r.id.replace(/[^a-z0-9]/gi, "-");
          li.addEventListener("mousedown", (e) => e.preventDefault());
          li.addEventListener("click", () => { sel = rows.findIndex((x) => x.id === r.id); mark(); activate(); });
          if (!calm()) li.classList.add("enter");
        }
        next.set(r.id, li);
        list.appendChild(li);
      });
      els.forEach((li, id) => { if (!next.has(id)) li.remove(); });
      els = next;
      requestAnimationFrame(() => requestAnimationFrame(() => $$(".enter", list).forEach((li) => li.classList.remove("enter"))));
      emptyEl.textContent = input.value.trim() ? L.empty : idleEmpty;
      box.classList.toggle("empty", !rows.length);
      mark();
    }
    function mark() {
      box.style.setProperty("--sel", sel);
      rows.forEach((r, n) => {
        const li = els.get(r.id);
        li.classList.toggle("sel", n === sel);
        li.setAttribute("aria-selected", n === sel ? "true" : "false");
      });
      const r = rows[sel];
      if (verb) verb.textContent = r ? r.trailing : L.open;
      if (r) input.setAttribute("aria-activedescendant", els.get(r.id).id); else input.removeAttribute("aria-activedescendant");
    }
    function say(text) {
      clearTimeout(statusTimer);
      status.textContent = text;
      status.classList.add("flash");
      statusTimer = setTimeout(() => { status.textContent = L.label; status.classList.remove("flash"); }, 2000);
    }
    function activate() {
      const r = rows[sel];
      if (!r) return;
      if (r.kind === "calc") {
        if (navigator.clipboard) navigator.clipboard.writeText(r.raw).catch(() => {});
        say(L.copied(r.title));
      } else say(L.opened(r.title));
    }
    function stopAuto() { clearTimeout(auto); auto = 0; }
    function typeIn(text, focus) {
      stopAuto();
      if (calm()) { input.value = text; render(); if (focus) input.focus({ preventScroll: true }); return; }
      input.value = "";
      render();
      let n = 0;
      const step = () => {
        input.value = text.slice(0, ++n);
        render();
        if (n < text.length) auto = setTimeout(step, 70 + Math.random() * 60);
        else { auto = 0; if (focus) input.focus({ preventScroll: true }); }
      };
      auto = setTimeout(step, 120);
    }

    status.textContent = L.label;
    input.addEventListener("input", () => { touched = true; stopAuto(); sel = 0; render(); });
    input.addEventListener("focus", () => { touched = true; stopAuto(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!rows.length) return;
        sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
        mark();
      } else if (e.key === "Enter") { e.preventDefault(); activate(); }
      else if (e.key === "Escape") { input.value = ""; sel = 0; render(); }
    });
    $$(".chip-q", section).forEach((b) => b.addEventListener("click", () => { touched = true; sel = 0; typeIn(b.dataset.q, true); }));

    if (frozen && L.demo) input.value = L.demo;
    render();
    watch(panel, () => {
      if (touched || input.value || !L.demo) return;
      touched = true;
      if (calm()) { input.value = L.demo; render(); return; }
      auto = setTimeout(() => typeIn(L.demo, false), 450);
    }, null, 0.6);
  });

  $$('[data-stage="convert"]').forEach((section) => {
    const stage = $(".cv-stage", section);
    const fit = stage.parentNode;
    const file = $(".cv-file", stage);
    const cursor = $(".cursor", stage);
    const status = $(".cv-status", section);
    const nameEl = $(".cv-name", file), sizeEl = $(".cv-size", file), deltaEl = $(".cv-delta", file), extEl = $(".cv-ext", file);
    const fmtEl = $(".cv-fmt", stage);
    const pills = $$(".seg-b", section);
    const resetBtn = $(".cv-reset", section);
    const FMT = {
      jpg: { ext: "jpg", label: "JPG", size: "812 KB", delta: "−74%", up: false, note: "Same photo, a quarter of the size." },
      png: { ext: "png", label: "PNG", size: "5.6 MB", delta: "+81%", up: true, note: "PNG is lossless, so it comes out larger." },
      webp: { ext: "webp", label: "WebP", size: "538 KB", delta: "−83%", up: false, note: "WebP is the smallest of the three." }
    };
    const LAYOUT = {
      wide: { w: 600, h: 300, others: [[50, 112], [50, 214]], home: { x: 160, y: 166 }, park: { x: 455, y: 144 }, parkScale: 0.94, zone: { x: 320, y: 14, w: 270, h: 270 } },
      narrow: { w: 340, h: 470, others: [[58, 124], [282, 124]], home: { x: 170, y: 126 }, park: { x: 170, y: 332 }, parkScale: 0.84, zone: { x: 10, y: 222, w: 320, h: 238 } }
    };
    let lay = LAYOUT.wide, narrow = null, scale = 1, parked = false, fmt = "jpg", shown = null, drag = null;
    let interacted = false, demoed = false, timers = [], workT = 0;
    const f = { x: new Spring(lay.home.x), y: new Spring(lay.home.y), s: new Spring(1), r: new Spring(0) };
    const c = { x: new Spring(0), y: new Spring(0) };
    const paint = () => { file.style.transform = `translate(${f.x.x}px, ${f.y.x}px) rotate(${f.r.x}deg) scale(${f.s.x})`; };
    const paintCursor = () => { cursor.style.transform = `translate(${c.x.x}px, ${c.y.x}px)`; };
    const go = () => run({ springs: Object.values(f), render: paint });
    const tune = (r, d) => Object.values(f).forEach((s) => s.tune(r, d));
    const say = (t) => { if (status) status.textContent = t; };
    const cancelDemo = () => { timers.forEach(clearTimeout); timers = []; cursor.classList.remove("on"); };
    const over = (x, y) => { const z = lay.zone; return x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h; };
    const local = (e) => { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; };

    function fitStage() {
      const n = fit.clientWidth < 540;
      if (n !== narrow) {
        narrow = n;
        lay = n ? LAYOUT.narrow : LAYOUT.wide;
        stage.classList.toggle("narrow", n);
        stage.style.width = lay.w + "px";
        stage.style.height = lay.h + "px";
        fit.style.maxWidth = lay.w + "px";
        fit.style.setProperty("--h", lay.h);
        $$(".cv-other", stage).forEach((el, i) => { el.style.left = lay.others[i][0] + "px"; el.style.top = lay.others[i][1] + "px"; });
        const slot = $(".cv-slot", stage);
        slot.style.left = lay.home.x + "px";
        slot.style.top = (lay.home.y - 16) + "px";
        const d = parked ? lay.park : lay.home;
        f.x.jump(d.x); f.y.jump(d.y); f.s.jump(parked ? lay.parkScale : 1);
        paint();
      }
      scale = Math.min(1, fit.clientWidth / lay.w);
      fit.style.setProperty("--s", scale);
    }

    function show(key) {
      shown = key;
      const F = key && FMT[key];
      nameEl.textContent = F ? `IMG_2041.${F.ext}` : "IMG_2041.HEIC";
      sizeEl.textContent = F ? F.size : "3.1 MB";
      extEl.textContent = F ? F.label.toUpperCase() : "HEIC";
      deltaEl.textContent = F ? F.delta : "";
      deltaEl.classList.toggle("up", !!(F && F.up));
      file.setAttribute("aria-label", F
        ? `IMG_2041.${F.ext}, ${F.size}, converted. Press to send it back.`
        : "IMG_2041.HEIC, 3.1 MB. Drag it onto Knack, or press to convert it.");
    }
    function convertTo(key) {
      clearTimeout(workT);
      const F = FMT[key];
      stage.classList.remove("working", "done");
      const finish = () => {
        stage.classList.remove("working");
        stage.classList.add("done");
        show(key);
        say(`Saved IMG_2041.${F.ext} next to the original. ${F.note}`);
      };
      if (calm()) { finish(); return; }
      void stage.offsetWidth;
      stage.classList.add("working");
      say(`Converting to ${F.label}…`);
      workT = setTimeout(finish, 950);
    }
    function settle(toZone, vx = 0, vy = 0) {
      const was = parked;
      parked = toZone;
      stage.classList.remove("hot");
      file.classList.remove("lifted");
      stage.classList.toggle("parked", toZone);
      const d = toZone ? lay.park : lay.home;
      const sc = toZone ? lay.parkScale : 1;
      if (calm()) { f.x.jump(d.x); f.y.jump(d.y); f.s.jump(sc); f.r.jump(0); paint(); }
      else {
        toZone ? tune(0.42, 0.62) : tune(0.45, 0.85);
        f.x.to(d.x, vx); f.y.to(d.y, vy); f.s.to(sc); f.r.to(0);
        go();
      }
      if (toZone && (!was || shown !== fmt)) convertTo(fmt);
      if (!toZone) {
        clearTimeout(workT);
        stage.classList.remove("working", "done");
        show(null);
      }
    }

    file.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      interacted = true;
      cancelDemo();
      const p = local(e);
      drag = { dx: p.x - f.x.x, dy: p.y - f.y.x, moved: false, start: p, hist: [{ ...p, t: e.timeStamp }] };
      file.setPointerCapture(e.pointerId);
      file.classList.add("dragging");
    });
    file.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = local(e);
      if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        file.classList.add("lifted");
        tune(0.3, 0.75);
        f.s.to(1.06);
      }
      drag.hist.push({ ...p, t: e.timeStamp });
      if (drag.hist.length > 5) drag.hist.shift();
      const h = drag.hist, a = h[0], b = h[h.length - 1], dt = Math.max(1, b.t - a.t) / 1000;
      f.x.jump(p.x - drag.dx); f.y.jump(p.y - drag.dy);
      f.r.to(clamp(((b.x - a.x) / dt) * 0.012, -12, 12) - 3);
      stage.classList.toggle("hot", over(f.x.x, f.y.x));
      paint();
      go();
    });
    const end = (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      file.classList.remove("dragging");
      if (!d.moved) return;
      const h = d.hist, a = h[0], b = h[h.length - 1], dt = Math.max(1, b.t - a.t) / 1000;
      const fresh = e.timeStamp - b.t < 80;
      const hit = over(f.x.x, f.y.x);
      settle(hit, fresh ? (b.x - a.x) / dt : 0, fresh ? (b.y - a.y) / dt : 0);
      if (!hit) say("Back in Downloads. Drop it on Knack to convert it.");
      file.dataset.dragged = "1";
      setTimeout(() => delete file.dataset.dragged, 0);
    };
    file.addEventListener("pointerup", end);
    file.addEventListener("pointercancel", end);
    file.addEventListener("click", () => {
      if (file.dataset.dragged) return;
      interacted = true;
      cancelDemo();
      if (parked) { settle(false); say("Back in Downloads, still a HEIC."); return; }
      tune(0.45, 0.85);
      f.s.to(1.06);
      go();
      timers.push(setTimeout(() => settle(true), calm() ? 0 : 180));
    });
    radioGroup(pills, (b) => {
      fmt = b.dataset.fmt;
      fmtEl.textContent = FMT[fmt].label;
      if (parked) convertTo(fmt);
      else say(`It will be saved as ${FMT[fmt].label}. Drag the photo onto Knack.`);
    });
    resetBtn.addEventListener("click", () => {
      interacted = true;
      cancelDemo();
      settle(false);
      say("Reset. Drag the photo onto Knack.");
    });

    function demo() {
      if (demoed || interacted || calm()) return;
      demoed = true;
      const H = lay.home, P = lay.park;
      const at = (ms, fn) => timers.push(setTimeout(fn, ms));
      const move = (x, y, resp = 0.5) => { c.x.tune(resp, 0.9).to(x); c.y.tune(resp, 0.9).to(y); run({ springs: [c.x, c.y], render: paintCursor }); };
      c.x.jump(H.x + 110); c.y.jump(H.y + 120); paintCursor();
      cursor.classList.add("on");
      say("Watch: drag, drop, done.");
      move(H.x + 8, H.y - 6);
      at(650, () => { file.classList.add("lifted"); tune(0.3, 0.75); f.s.to(1.06); go(); });
      at(950, () => {
        tune(0.6, 0.85);
        const mx = (H.x + P.x) / 2, my = Math.min(H.y, P.y) - 40;
        f.x.to(mx); f.y.to(my); f.r.to(-6); go();
        move(mx + 8, my - 6, 0.6);
      });
      at(1500, () => {
        tune(0.45, 0.8);
        f.x.to(P.x); f.y.to(P.y + 4); f.r.to(3); go();
        move(P.x + 8, P.y - 2, 0.45);
        stage.classList.add("hot");
      });
      at(2250, () => { settle(true); move(P.x + 60, P.y + 70, 0.6); });
      at(3400, () => cursor.classList.remove("on"));
    }

    fitStage();
    show(null);
    if (frozen) settle(true);
    paint();
    addEventListener("resize", fitStage);
    watch(stage, () => {
      if (calm()) { if (!interacted && !parked) settle(true); return; }
      timers.push(setTimeout(demo, 600));
    }, () => { if (!interacted && !demoed) cancelDemo(); }, 0.6);
  });

  $$('[data-stage="cutout"]').forEach((section) => {
    const co = $(".co", section);
    const handle = $(".co-handle", co);
    const p = new Spring(50, 0.45, 0.85);
    let interacted = false, dragging = false, timers = [];
    const paint = () => {
      const v = clamp(p.x, 0, 100);
      co.style.setProperty("--p", v.toFixed(2));
      co.classList.toggle("lo", v < 18);
      co.classList.toggle("hi", v > 82);
      const n = Math.round(v);
      handle.setAttribute("aria-valuenow", n);
      handle.setAttribute("aria-valuetext", `${n}% original, ${100 - n}% cutout`);
    };
    const set = (v, animate) => {
      v = clamp(v, 0, 100);
      if (!animate || calm()) { p.jump(v); paint(); return; }
      p.to(v);
      run({ springs: [p], render: paint });
    };
    const pos = (e) => { const r = co.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
    const take = () => { interacted = true; timers.forEach(clearTimeout); timers = []; p.tune(0.45, 0.85); };

    co.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      take();
      dragging = true;
      co.classList.add("dragging");
      co.setPointerCapture(e.pointerId);
      set(pos(e), e.target !== handle && !handle.contains(e.target));
    });
    co.addEventListener("pointermove", (e) => { if (dragging) set(pos(e), false); });
    const up = () => { dragging = false; co.classList.remove("dragging"); };
    co.addEventListener("pointerup", up);
    co.addEventListener("pointercancel", up);
    handle.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 10 : 5;
      const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, PageDown: -20, PageUp: 20 }[e.key];
      let v = null;
      if (d !== undefined) v = p.target + d;
      else if (e.key === "Home") v = 0;
      else if (e.key === "End") v = 100;
      if (v === null) return;
      e.preventDefault();
      take();
      set(v, true);
    });
    paint();
    watch(co, () => {
      if (interacted || calm() || timers.length) return;
      p.tune(0.75, 0.9);
      const at = (ms, v) => timers.push(setTimeout(() => { if (!interacted) set(v, true); }, ms));
      at(350, 22);
      at(1350, 80);
      at(2450, 50);
      timers.push(setTimeout(() => p.tune(0.45, 0.85), 3400));
    }, null, 0.6);
  });

  $$('[data-stage="finder"]').forEach((section) => {
    const fd = $(".fd", section);
    const grid = $(".fd-grid", fd);
    const menu = $(".cm:not(.cm-sub)", fd);
    const sub = $(".cm-sub", fd);
    const svc = $(".cm-services", menu);
    const picker = $(".fd-pick", fd);
    const pickList = $(".fd-pick-list", picker);
    const pickFile = $(".fd-pick-file", picker);
    const cursor = $(".cursor", fd);
    const status = $(".fd-status", section);
    const acts = $$("[data-act]", sub);
    const ICON = {
      photo: '<span class="fi fi-photo"></span>',
      beach: '<span class="fi fi-beach"></span>',
      receipt: '<span class="fi fi-receipt"><i></i><i></i><i></i><i></i></span>',
      poster: '<span class="fi fi-poster"></span>',
      pdf: '<span class="fi fi-pdf"><i></i><i></i><i></i><em>PDF</em></span>',
      cut: '<span class="fi fi-cut"></span>',
      txt: '<span class="fi fi-txt"><i></i><i></i><i></i><i></i><em>TXT</em></span>'
    };
    const IMAGE_TOOLS = [["Image Converter", "convert"], ["Image Compressor", "compress"], ["AI Background Remover", "cutout"], ["Image Upscaler", "upscale"], ["Text Extractor", "ocr"], ["Smart Crop", "crop"]];
    const PDF_TOOLS = [["PDF Toolkit", "pdf"], ["Text Extractor", "ocr"], ["Image Converter", "convert"]];
    const split = (name) => { const i = name.lastIndexOf("."); return [name.slice(0, i), name.slice(i + 1).toLowerCase()]; };
    const RESULT = {
      cutout: (b) => ({ name: `${b}-cutout.png`, kind: "cut", msg: "with a transparent background" }),
      compress: (b, e, k) => ({ name: `${b}-compressed.${e === "heic" ? "jpg" : e}`, kind: k, msg: "at a fraction of the size" }),
      text: (b) => ({ name: `${b}.txt`, kind: "txt", msg: "with every line of text in it" }),
      convert: (b, e, k) => ({ name: `${b}.${e === "jpg" ? "png" : "jpg"}`, kind: k, msg: "next to the original" })
    };
    let target = null, inView = false, pausedUntil = 0, loop = 0, timers = [], scripting = false;
    const c = { x: new Spring(0), y: new Spring(0) };
    const paintCursor = () => { cursor.style.transform = `translate(${c.x.x}px, ${c.y.x}px)`; };
    const say = (t) => { status.textContent = t; };
    const rel = (el) => { const a = el.getBoundingClientRect(), b = fd.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; };
    const mid = (el) => { const r = rel(el); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
    const files = () => $$(".fd-file", grid);

    function select(btn) { files().forEach((f) => f.classList.toggle("sel", f === btn)); }
    function enableFor(btn) {
      const isPdf = btn.dataset.kind === "pdf";
      acts.forEach((a) => {
        const ok = !isPdf || a.dataset.act === "text" || a.dataset.act === "open";
        a.disabled = !ok;
      });
    }
    function place(el, x, y) {
      const W = fd.clientWidth, H = fd.clientHeight;
      const w = el.offsetWidth, h = el.offsetHeight;
      el.style.left = clamp(x, 6, W - 6 - w) + "px";
      el.style.top = clamp(y, 6, H - 6 - h) + "px";
    }
    function openMenu(btn, at, withSub) {
      closeAll(false);
      target = btn;
      select(btn);
      enableFor(btn);
      btn.setAttribute("aria-expanded", "true");
      menu.hidden = false;
      if (!calm()) { menu.classList.remove("enter"); void menu.offsetWidth; menu.classList.add("enter"); }
      sub.style.visibility = "hidden";
      sub.hidden = false;
      const sw = sub.offsetWidth;
      sub.hidden = true;
      sub.style.visibility = "";
      const W = fd.clientWidth, mw = menu.offsetWidth;
      const x = at.x + mw + sw - 3 > W - 6 && W - 6 - mw - sw + 3 >= 6 ? W - 6 - mw - sw + 3 : at.x;
      place(menu, x, at.y);
      if (withSub) openSub();
    }
    function openSub() {
      svc.classList.add("hl");
      svc.setAttribute("aria-expanded", "true");
      sub.hidden = false;
      const W = fd.clientWidth;
      const s = rel(svc);
      const mw = sub.offsetWidth;
      let x = menu.offsetLeft + menu.offsetWidth - 3, y = s.y - 5;
      if (x + mw > W - 6) {
        x = menu.offsetLeft - mw + 3;
        if (x < 6) x = W - 6 - mw;
      }
      place(sub, x, y);
    }
    function closeSub() {
      sub.hidden = true;
      svc.classList.remove("hl");
      svc.setAttribute("aria-expanded", "false");
      acts.forEach((a) => a.classList.remove("hl"));
    }
    function closeAll(deselect = true) {
      closeSub();
      menu.hidden = true;
      picker.hidden = true;
      files().forEach((f) => f.removeAttribute("aria-expanded"));
      if (deselect) select(null);
    }
    function addResult(src, act, animate = true) {
      const old = $(".fd-new", grid);
      if (old) old.closest("li").remove();
      const [b, e] = split(src.dataset.name);
      const r = RESULT[act](b, e, src.dataset.kind);
      const li = document.createElement("li");
      li.innerHTML = `<button type="button" class="fd-file fd-new" data-name="${r.name}" data-kind="${r.kind}" aria-haspopup="menu">${ICON[r.kind] || ICON.photo}<span class="fd-n"></span></button>`;
      $(".fd-n", li).textContent = r.name;
      if (!animate || calm()) $(".fd-file", li).style.animation = "none";
      src.closest("li").after(li);
      select(null);
      say(`Saved ${r.name} ${r.msg}.`);
      return $(".fd-file", li);
    }
    function perform(act) {
      const src = target;
      if (!src) return;
      closeAll(false);
      if (act === "open") { showPicker(src); return; }
      if (calm()) { addResult(src, act); return; }
      src.classList.add("busy");
      say("Knack is on it…");
      timers.push(setTimeout(() => { src.classList.remove("busy"); addResult(src, act); }, 750));
    }
    function showPicker(src) {
      const tools = src.dataset.kind === "pdf" ? PDF_TOOLS : src.dataset.kind === "txt" ? [["Text Extractor", "ocr"]] : IMAGE_TOOLS;
      pickFile.textContent = src.dataset.name;
      pickList.innerHTML = "";
      tools.forEach(([name, g]) => {
        const li = document.createElement("li");
        li.innerHTML = `<button type="button">${glyph(g)}<span></span></button>`;
        $("span", li).textContent = name;
        $("button", li).addEventListener("click", () => {
          picker.hidden = true;
          select(null);
          say(`Knack opens ${name} with ${src.dataset.name}.`);
        });
        pickList.appendChild(li);
      });
      picker.hidden = false;
      say(`${tools.length} tools fit ${src.dataset.name}. Pick one.`);
      const first = $("button", pickList);
      if (first && !scripting) first.focus({ preventScroll: true });
    }
    function userTook() {
      pausedUntil = Date.now() + 12000;
      if (scripting) stopScript();
      clearTimeout(loop);
      if (inView && !calm()) loop = setTimeout(script, 12100);
    }
    function stopScript() {
      scripting = false;
      timers.forEach(clearTimeout);
      timers = [];
      cursor.classList.remove("on");
      files().forEach((f) => f.classList.remove("busy"));
    }

    grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".fd-file");
      if (!btn) return;
      userTook();
      const keyboard = e.detail === 0;
      const r = rel(btn);
      const b = fd.getBoundingClientRect();
      const at = keyboard ? { x: r.x + r.w * 0.6, y: r.y + r.h * 0.5 } : { x: e.clientX - b.left + 2, y: e.clientY - b.top + 2 };
      openMenu(btn, at, keyboard);
      say("Open Services to see Knack's actions.");
      if (keyboard) { const first = acts.find((a) => !a.disabled); if (first) first.focus({ preventScroll: true }); }
    });
    grid.addEventListener("contextmenu", (e) => {
      const btn = e.target.closest(".fd-file");
      if (!btn) return;
      e.preventDefault();
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: e.clientX, clientY: e.clientY, detail: 1 }));
    });
    svc.addEventListener("mouseenter", () => { if (!scripting) openSub(); });
    svc.addEventListener("click", () => {
      userTook();
      openSub();
      const first = acts.find((a) => !a.disabled);
      if (first) first.focus({ preventScroll: true });
    });
    $$(".cm-i[aria-disabled]", menu).forEach((el) => el.addEventListener("mouseenter", () => { if (!scripting) closeSub(); }));
    acts.forEach((a) => a.addEventListener("click", () => { userTook(); perform(a.dataset.act); }));
    sub.addEventListener("keydown", (e) => {
      const live = acts.filter((a) => !a.disabled);
      const i = live.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = (i + (e.key === "ArrowDown" ? 1 : -1) + live.length) % live.length;
        live[n].focus({ preventScroll: true });
      } else if (e.key === "ArrowLeft") { e.preventDefault(); closeSub(); svc.focus({ preventScroll: true }); }
    });
    fd.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const t = target;
      closeAll();
      if (t) t.focus({ preventScroll: true });
    });
    document.addEventListener("pointerdown", (e) => {
      if (scripting || menu.hidden && picker.hidden) return;
      if (e.target.closest(".cm, .fd-pick, .fd-file")) return;
      closeAll();
    });

    function script() {
      if (!inView || calm()) return;
      if (document.hidden || Date.now() < pausedUntil) { loop = setTimeout(script, 1000); return; }
      scripting = true;
      closeAll();
      const old = $(".fd-new", grid);
      if (old) old.closest("li").remove();
      const photo = files()[0];
      const at = (ms, fn) => timers.push(setTimeout(fn, ms));
      const move = (p, resp = 0.5) => { c.x.tune(resp, 0.9).to(p.x); c.y.tune(resp, 0.9).to(p.y); run({ springs: [c.x, c.y], render: paintCursor }); };
      c.x.jump(fd.clientWidth * 0.82); c.y.jump(fd.clientHeight * 0.9); paintCursor();
      cursor.classList.add("on");
      say("Right-click a photo, then Services.");
      const fi = mid($(".fi", photo));
      move(fi);
      at(800, () => openMenu(photo, { x: fi.x + 3, y: fi.y + 3 }, false));
      at(1250, () => move(mid(svc), 0.45));
      at(1750, openSub);
      at(2100, () => { const s = mid(svc); move({ x: rel(acts[0]).x + 30, y: s.y }, 0.4); });
      at(2450, () => { acts[0].classList.add("hl"); move({ x: rel(acts[0]).x + 60, y: mid(acts[0]).y }, 0.35); });
      at(3100, () => { scripting = false; perform("cutout"); scripting = true; });
      at(3300, () => move({ x: fd.clientWidth * 0.86, y: fd.clientHeight * 0.88 }, 0.7));
      at(4300, () => cursor.classList.remove("on"));
      at(7200, () => { scripting = false; loop = setTimeout(script, 600); });
    }

    if (frozen) {
      const photo = files()[0];
      requestAnimationFrame(() => {
        const fi = mid($(".fi", photo));
        openMenu(photo, { x: fi.x + 3, y: fi.y + 3 }, true);
        acts[0].classList.add("hl");
        const a = rel(acts[0]);
        c.x.jump(a.x + 70); c.y.jump(a.y + a.h / 2); paintCursor();
        cursor.classList.add("on");
        say("Right-click → Services → Remove Background in Knack.");
      });
    } else if (still.matches) {
      addResult(files()[0], "cutout", false);
    }
    watch(fd, () => {
      if (inView) return;
      inView = true;
      clearTimeout(loop);
      loop = setTimeout(script, 700);
    }, () => {
      inView = false;
      clearTimeout(loop);
      if (scripting) { stopScript(); closeAll(); }
    }, 0.45);
  });

  $$('[data-stage="stats"]').forEach((section) => {
    const mb = $(".mb", section);
    const procsEl = $(".mb-procs", mb);
    const line = $(".spark-line", mb), area = $(".spark-area", mb);
    const memBar = $(".m-mem", mb);
    const PROCS = [
      { n: "Safari", v: 9.4, c: "linear-gradient(#5ac8fa, #1a7cf0)" },
      { n: "Xcode", v: 6.1, c: "linear-gradient(#6aa8ff, #2f5fd8)" },
      { n: "WindowServer", v: 3.8, c: "linear-gradient(#a1a1aa, #5f5f68)" },
      { n: "Music", v: 2.2, c: "linear-gradient(#ff6a85, #f5264d)" },
      { n: "Knack", v: 1.1, img: "screenshots/icon.png" }
    ];
    const st = { cpu: 23, mem: 61, down: 2.4, up: 180 };
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const hist = [];
    for (let i = 0; i < 60; i++) hist.push(clamp(24 + Math.sin(i / 4.2) * 9 + Math.sin(i / 1.7) * 5 + (rnd() - 0.5) * 10, 4, 90));
    hist[59] = st.cpu;

    PROCS.forEach((p, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="pi"></span><span class="pn"></span><span class="pb"><u></u></span><span class="pv"></span>`;
      const pi = $(".pi", li);
      if (p.img) pi.outerHTML = `<img class="pi" src="${p.img}" alt="" width="16" height="16" loading="lazy" />`;
      else pi.style.background = p.c;
      $(".pn", li).textContent = p.n;
      p.el = li;
      li.style.setProperty("--r", i);
      procsEl.appendChild(li);
    });
    const fmtRate = (mbs) => (mbs < 1 ? `${Math.round(mbs * 1000)} KB/s` : `${mbs.toFixed(1)} MB/s`);
    const setAll = (cls, t) => $$(cls, mb).forEach((el) => { el.textContent = t; });

    function paint() {
      setAll(".v-cpu", `${Math.round(st.cpu)}%`);
      setAll(".v-mem", `${Math.round(st.mem)}%`);
      setAll(".v-down", fmtRate(st.down));
      setAll(".v-up", `${Math.round(st.up)} KB/s`);
      setAll(".v-memgb", `${(16 * st.mem / 100).toFixed(1)} of 16 GB`);
      memBar.style.width = `${st.mem.toFixed(1)}%`;
      const pts = hist.map((v, i) => `${(i * 240 / 59).toFixed(1)},${(54 - v / 100 * 50).toFixed(1)}`).join(" ");
      line.setAttribute("points", pts);
      area.setAttribute("points", `0,56 ${pts} 240,56`);
      const ranked = [...PROCS].sort((a, b) => b.v - a.v);
      const top = Math.max(12, ranked[0].v);
      ranked.forEach((p, r) => {
        p.el.style.setProperty("--r", r);
        $(".pb u", p.el).style.width = `${(p.v / top * 100).toFixed(1)}%`;
        $(".pv", p.el).textContent = `${p.v.toFixed(1)}%`;
      });
    }
    function step() {
      st.cpu = clamp(st.cpu + (Math.random() - 0.5) * 16 + (26 - st.cpu) * 0.18, 6, 78);
      st.mem = clamp(st.mem + (Math.random() - 0.5) * 2.4 + (61 - st.mem) * 0.1, 52, 74);
      st.down = clamp(st.down * Math.exp((Math.random() - 0.5) * 0.9) + (2.4 - st.down) * 0.08, 0.15, 9.8);
      st.up = clamp(st.up * Math.exp((Math.random() - 0.5) * 0.8) + (180 - st.up) * 0.1, 30, 900);
      PROCS.forEach((p) => { p.v = Math.max(0.2, p.v * Math.exp((Math.random() - 0.5) * 0.7)); });
      const sum = PROCS.reduce((s, p) => s + p.v, 0), want = st.cpu * 0.82;
      PROCS.forEach((p) => { p.v = p.v * want / sum; });
      hist.shift();
      hist.push(st.cpu);
      paint();
    }
    paint();
    let timer = 0, inView = false;
    const tick = () => {
      if (!inView || calm()) return;
      if (!document.hidden) step();
      timer = setTimeout(tick, 1000);
    };
    watch(mb, () => {
      if (inView) return;
      inView = true;
      if (calm()) return;
      mb.classList.add("ticking");
      clearTimeout(timer);
      timer = setTimeout(tick, 600);
    }, () => { inView = false; mb.classList.remove("ticking"); clearTimeout(timer); }, 0.2);
  });

  $$('[data-stage="tidy"]').forEach((section) => {
    const desk = $(".td-desk", section);
    const go = $(".td-go", section);
    const undo = $(".td-undo", section);
    const status = $(".td-status", section);
    const count = $(".td-count", section);
    const badge = status.querySelector(".tier");
    const FOLDERS = ["Images", "Documents", "Installers", "Archives", "Music"];
    const FILES = [
      { n: "Screenshot 09.41.png", k: "shot", g: 0 },
      { n: "Invoice-0931.pdf", k: "pdf", g: 1 },
      { n: "Figma.dmg", k: "dmg", g: 2 },
      { n: "IMG_3381.jpg", k: "beach", g: 0 },
      { n: "photos.zip", k: "zip", g: 3 },
      { n: "Midnight.mp3", k: "song", g: 4 },
      { n: "Brief.docx", k: "doc", g: 1 },
      { n: "Banner.png", k: "poster", g: 0 },
      { n: "Docker.dmg", k: "dmg", g: 2 },
      { n: "Notes.pdf", k: "pdf", g: 1 },
      { n: "backup.zip", k: "zip", g: 3 },
      { n: "Screenshot 10.02.png", k: "shot", g: 0 }
    ];
    const ROT = [-4, 3, 0, 5, -3, 4, -5, 2, -2, 3, 6, -4];
    const JIT = [[1, -3], [-2, 4], [2, -1], [-1, 3], [2, 2], [-2, -3], [1, 3], [-2, -2], [2, 3], [-1, -4], [1, 2], [-2, 1]];
    const ICON = {
      shot: '<span class="fi fi-shot"></span>',
      beach: '<span class="fi fi-beach"></span>',
      poster: '<span class="fi fi-poster"></span>',
      pdf: '<span class="fi fi-pdf"><i></i><i></i><i></i><em>PDF</em></span>',
      doc: '<span class="fi fi-doc"><i></i><i></i><i></i><em>DOC</em></span>',
      dmg: '<span class="fi fi-dmg"></span>',
      zip: '<span class="fi fi-zip"></span>',
      song: '<span class="fi fi-song"></span>'
    };
    const totals = FOLDERS.map((_, g) => FILES.filter((f) => f.g === g).length);
    let sorted = false, played = false, interacted = false, narrow = null, timers = [];

    const fileEls = FILES.map((f) => {
      const el = document.createElement("div");
      el.className = "tf";
      el.innerHTML = `${ICON[f.k]}<span class="fd-n"></span>`;
      $(".fd-n", el).textContent = f.n;
      desk.appendChild(el);
      return el;
    });
    const folderEls = FOLDERS.map((name) => {
      const el = document.createElement("div");
      el.className = "tfo";
      el.innerHTML = `<span class="fold"><b>0</b></span><span class="fd-n"></span>`;
      $(".fd-n", el).textContent = name;
      desk.appendChild(el);
      return el;
    });

    function spots() {
      const n = desk.clientWidth < 560;
      const cols = n ? 3 : 6, rows = n ? 4 : 2;
      const scatter = FILES.map((_, i) => {
        const cx = i % cols, cy = Math.floor(i / cols);
        const x = (cx + 0.5) / cols * 100 + JIT[i][0] * (n ? 1 : 1.4);
        const y = n ? 14 + cy * 23 + JIT[i][1] : (cy === 0 ? 28 : 72) + JIT[i][1] * 1.5;
        return [x, y];
      });
      const homes = n
        ? [[20, 30], [50, 30], [80, 30], [35, 68], [65, 68]]
        : [[14, 50], [32, 50], [50, 50], [68, 50], [86, 50]];
      return { n, scatter, homes };
    }
    function layout(animate) {
      const L = spots();
      narrow = L.n;
      const quick = !animate || calm();
      fileEls.forEach((el, i) => {
        const f = FILES[i];
        const [x, y] = sorted ? L.homes[f.g] : L.scatter[i];
        el.style.setProperty("--x", x.toFixed(2));
        el.style.setProperty("--y", y.toFixed(2));
        el.style.setProperty("--rot", sorted ? "0deg" : ROT[i] + "deg");
        el.style.setProperty("--sc", sorted ? 0.3 : 1);
        el.style.setProperty("--dl", quick ? "0s" : (sorted ? 0.22 + i * 0.05 : i * 0.03) + "s");
        el.classList.toggle("gone", sorted);
      });
      folderEls.forEach((el, g) => {
        const [x, y] = L.homes[g];
        el.style.setProperty("--x", x);
        el.style.setProperty("--y", y);
        el.style.setProperty("--dl", quick ? "0s" : (sorted ? g * 0.06 : 0.3 + g * 0.04) + "s");
        el.classList.toggle("on", sorted);
      });
    }
    function counts(animate) {
      timers.forEach(clearTimeout);
      timers = [];
      const nums = folderEls.map((el) => $(".fold b", el));
      if (!sorted) { nums.forEach((b) => { b.textContent = "0"; }); return; }
      if (!animate || calm()) { nums.forEach((b, g) => { b.textContent = totals[g]; }); return; }
      const got = FOLDERS.map(() => 0);
      FILES.forEach((f, i) => {
        timers.push(setTimeout(() => { got[f.g]++; nums[f.g].textContent = got[f.g]; }, (0.22 + i * 0.05 + 0.38) * 1000));
      });
    }
    function say(t) {
      status.textContent = "";
      if (badge) status.append(badge, " ");
      status.append(t);
    }
    function apply(on, animate = true) {
      sorted = on;
      layout(animate);
      counts(animate);
      go.disabled = on;
      undo.disabled = !on;
      count.textContent = on ? "5 folders" : "12 items";
      say(on ? "12 files sorted into 5 folders by type. Undo puts every one back." : "Back where they were. Nothing lost.");
    }

    go.addEventListener("click", () => { interacted = true; apply(true); undo.focus({ preventScroll: true }); });
    undo.addEventListener("click", () => { interacted = true; apply(false); go.focus({ preventScroll: true }); });
    addEventListener("resize", () => { if ((desk.clientWidth < 560) !== narrow) layout(false); });

    layout(false);
    if (frozen) apply(true, false);
    watch(desk, () => {
      if (played || interacted) return;
      played = true;
      if (calm()) { apply(true, false); return; }
      setTimeout(() => { if (!interacted) apply(true); }, 700);
    }, null, 0.5);
  });

  $$(".tools-filter").forEach((group) => {
    const cards = $$(".tool-grid .feature-card");
    radioGroup($$(".seg-b", group), (b) => {
      const show = b.dataset.show;
      cards.forEach((card) => {
        const on = show === "all" || card.dataset.tier === show;
        const was = !card.hidden;
        card.hidden = !on;
        if (on && !was && !calm()) { card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash"); }
      });
    });
  });
})();
