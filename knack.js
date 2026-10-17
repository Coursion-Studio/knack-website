(() => {
  "use strict";

  const S = window.Stage;
  if (!S) return;
  const { Spring, run, watch } = S;
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

  $$(".fan").forEach((fan) => {
    const items = $$(".fan-item", fan);
    const n = items.length;
    if (n < 2) return;
    const NS = "http://www.w3.org/2000/svg";
    const arc = document.createElementNS(NS, "svg");
    arc.setAttribute("class", "fan-arc");
    arc.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path");
    arc.appendChild(path);
    fan.prepend(arc);
    const small = matchMedia("(max-width: 720px)");
    function lay() {
      const narrow = small.matches;
      const vw = document.documentElement.clientWidth;
      const tile = narrow ? 40 : 56;
      const step = narrow ? 52 : 118;
      const W = Math.min((step * (n - 1)) / 2, vw / 2 - tile / 2 - (narrow ? 8 : 24));
      const y0 = narrow ? 30 : 36, depth = narrow ? 78 : 92;
      const yAt = (x) => y0 + depth * (1 - (x / W) * (x / W));
      items.forEach((el, i) => {
        const x = -W + (2 * W * i) / (n - 1);
        const slope = (-2 * depth * x) / (W * W);
        el.style.setProperty("--x", x.toFixed(1));
        el.style.setProperty("--y", yAt(x).toFixed(1));
        el.style.setProperty("--r", ((Math.atan(slope) * 180) / Math.PI * 0.35).toFixed(2) + "deg");
      });
      const off = tile / 2 - 28;
      const pts = [];
      for (let k = 0; k <= 48; k++) {
        const x = -W * 1.06 + (2.12 * W * k) / 48;
        pts.push(`${x.toFixed(1)},${(yAt(x) + off).toFixed(1)}`);
      }
      path.setAttribute("d", "M" + pts.join(" L"));
    }
    lay();
    addEventListener("resize", lay);
  });

  const CATS = [
    ["all", "All", "#C75CEB"], ["pro", "Pro", "#FF528C"], ["ai", "AI", "#A87AFF"], ["image", "Image", "#5CA8FF"],
    ["pdf", "PDF", "#FF754D"], ["audio", "Audio", "#4DD98C"], ["video", "Video", "#9E6BFF"],
    ["utility", "Utility", "#33D9D9"], ["productivity", "Productivity", "#FFB847"]
  ];
  const TOOLS = (cfg.launcher && cfg.launcher.items) || [];
  const springEase = (() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--spring").trim();
    try { document.documentElement.animate([], { easing: v }); return v; } catch (e) { return "cubic-bezier(0.2, 0.9, 0.3, 1.05)"; }
  })();

  function score(q, item) {
    const n = item.title.toLowerCase();
    if (n.startsWith(q)) return 300 - n.length;
    if (n.split(/[\s&]+/).some((w) => w.startsWith(q))) return 200 - n.length;
    const keys = (item.keys || "").split(/\s+/);
    if (keys.includes(q)) return 180 - n.length * 0.1;
    if (q.length >= 2 && keys.some((k) => k.startsWith(q))) return 150 - n.length * 0.1;
    if (q.length >= 3 && item.tagline && item.tagline.toLowerCase().includes(q)) return 120 - n.length * 0.1;
    return null;
  }

  $$('[data-stage="home-search"]').forEach((section) => {
    const hw = $(".hw", section);
    const input = $(".hw-input", section);
    const grid = $(".hw-grid", section);
    const catsEl = $(".hw-cats", section);
    const scroller = $(".hw-scroll", section);
    const empty = $(".hw-empty", section);
    const status = $(".hw-status", section);
    const L = Object.assign({ demo: "", opened: (t) => `In Knack, ${t} opens`, empty: "No tools match." }, cfg.launcher || {});
    let cat = "all", auto = 0, touched = false;
    const inCat = (t, c) => c === "all" || (c === "pro" ? t.tier === "pro" : t.cats.includes(c));
    const say = (t) => { status.textContent = t; };

    const cards = TOOLS.map((t) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hw-card";
      b.style.setProperty("--tc", t.color);
      b.innerHTML = `<span class="hw-tile">${glyph(t.glyph)}</span><span class="hw-tag${t.tier === "pro" ? " pro" : ""}"></span><b></b><span class="hw-tl"></span><span class="hw-go" aria-hidden="true">→</span>`;
      const primary = CATS.find((c) => c[0] === t.cats[0]);
      $(".hw-tag", b).textContent = t.tier === "pro" ? "Pro" : primary[1];
      $("b", b).textContent = t.title;
      $(".hw-tl", b).textContent = t.tagline;
      b.setAttribute("aria-label", `${t.title}, ${t.tier === "pro" ? "Pro" : "free"}. ${t.tagline}`);
      b.addEventListener("click", () => openTool(t, b));
      li.appendChild(b);
      grid.appendChild(li);
      return { t, li, b };
    });

    const chips = CATS.map(([id, label, color]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hw-cat";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", id === "all" ? "true" : "false");
      b.dataset.cat = id;
      b.style.setProperty("--cc", color);
      b.append(label + " ");
      const s = document.createElement("span");
      s.textContent = TOOLS.filter((t) => inCat(t, id)).length;
      b.appendChild(s);
      catsEl.appendChild(b);
      return b;
    });
    const setCat = (id) => {
      cat = id;
      chips.forEach((b) => {
        const on = b.dataset.cat === id;
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
    };
    radioGroup(chips, (b) => { touched = true; stopAuto(); cat = b.dataset.cat; apply(true); });

    function openTool(t, b) {
      b.classList.remove("flash");
      void b.offsetWidth;
      if (!calm()) b.classList.add("flash");
      say(L.opened(t.title) + ".");
    }

    function apply(animate) {
      const raw = input.value.trim();
      const q = raw.toLowerCase();
      let list = cards.filter((c) => inCat(c.t, cat));
      if (q) list = list.map((c) => ({ c, s: score(q, c.t) })).filter((m) => m.s !== null).sort((a, b) => b.s - a.s).map((m) => m.c);
      const show = new Set(list);
      const motion = animate && !calm() && !!grid.animate;
      scroller.scrollTop = 0;
      const first = new Map();
      if (motion) {
        const box = grid.getBoundingClientRect();
        cards.forEach((c) => {
          if (c.li.hidden) return;
          const r = c.li.getBoundingClientRect();
          first.set(c, r);
          if (show.has(c)) return;
          const g = c.li.cloneNode(true);
          g.className = "hw-ghost";
          g.setAttribute("aria-hidden", "true");
          g.style.cssText = `left:${r.left - box.left}px;top:${r.top - box.top}px;width:${r.width}px;height:${r.height}px`;
          $("button", g).tabIndex = -1;
          grid.appendChild(g);
          g.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(0.86)" }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" }).onfinish = () => g.remove();
        });
      }
      cards.forEach((c) => { c.li.hidden = !show.has(c); });
      list.forEach((c) => grid.appendChild(c.li));
      if (motion) {
        list.forEach((c, i) => {
          const f = first.get(c);
          if (f) {
            const r = c.li.getBoundingClientRect();
            const dx = f.left - r.left, dy = f.top - r.top;
            if (dx || dy) c.li.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 600, easing: springEase });
          } else {
            c.li.animate([{ opacity: 0, transform: "scale(0.9)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: Math.min(i, 8) * 30, easing: springEase, fill: "backwards" });
          }
        });
      }
      empty.hidden = list.length > 0;
      empty.textContent = L.empty;
      const label = CATS.find((c) => c[0] === cat)[1];
      const n = list.length;
      if (q) say(`${n} ${n === 1 ? "tool matches" : "tools match"} “${raw}”${cat === "all" ? "" : " in " + label}.`);
      else if (cat === "all") say("23 tools. Type to filter, or pick a category.");
      else say(`${n} ${label} tool${n === 1 ? "" : "s"}.`);
    }

    function stopAuto() { clearTimeout(auto); auto = 0; }
    function typeIn(text, focus) {
      stopAuto();
      if (calm()) { input.value = text; apply(false); if (focus) input.focus({ preventScroll: true }); return; }
      input.value = "";
      apply(true);
      let n = 0;
      const step = () => {
        input.value = text.slice(0, ++n);
        apply(true);
        if (n < text.length) auto = setTimeout(step, 90 + Math.random() * 70);
        else { auto = 0; if (focus) input.focus({ preventScroll: true }); }
      };
      auto = setTimeout(step, 160);
    }

    input.addEventListener("input", () => { touched = true; stopAuto(); apply(true); });
    input.addEventListener("focus", () => { touched = true; stopAuto(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const firstVisible = Array.from(grid.children).find((li) => !li.hidden && !li.classList.contains("hw-ghost"));
        const hit = cards.find((x) => x.li === firstVisible);
        if (hit) openTool(hit.t, hit.b);
      } else if (e.key === "Escape" && input.value) { e.preventDefault(); input.value = ""; apply(true); }
    });
    $$(".chip-q", section).forEach((b) => b.addEventListener("click", () => {
      touched = true;
      setCat("all");
      typeIn(b.dataset.q, true);
    }));

    if (frozen && L.demo) input.value = L.demo;
    apply(false);
    watch(hw, () => {
      if (touched || input.value || !L.demo) return;
      touched = true;
      if (calm()) { input.value = L.demo; apply(false); return; }
      auto = setTimeout(() => typeIn(L.demo, false), 450);
    }, null, 0.6);
  });

  $$('[data-stage="convert"]').forEach((section) => {
    const ic = $(".ic", section);
    const list = $(".ic-files", ic);
    const go = $(".ic-go", ic);
    const clear = $(".ic-clear", ic);
    const status = $(".ic-status", section);
    const count = $(".ic-count", ic);
    const fmts = $$(".ic-fmt", ic);
    const range = $(".ic-range", ic);
    const qv = $(".ic-qv", ic);
    const qBox = $(".ic-q", ic);
    const pdfRow = $(".ic-pdf", ic);
    const rs = $(".ic-rs", ic);
    const sw = { resize: $(".ic-resize", ic), meta: $(".ic-meta", ic), combine: $(".ic-combine", ic) };
    const SRC = [
      { base: "IMG_2041", ext: "HEIC", mb: 3.1, kind: "heic", px: 4032, t: "t-sunset" },
      { base: "IMG_2042", ext: "HEIC", mb: 2.8, kind: "heic", px: 4032, t: "t-beach" },
      { base: "Screenshot", ext: "png", mb: 1.4, kind: "png", px: 2880, t: "t-shot" }
    ];
    const RATIO = {
      png: { heic: 1.81, png: 0.97 }, jpeg: { heic: 0.26, png: 0.55 }, heic: { heic: 0.98, png: 0.3 }, tiff: { heic: 3.9, png: 2.4 },
      gif: { heic: 0.42, png: 0.38 }, bmp: { heic: 5.2, png: 3.1 }, webp: { heic: 0.17, png: 0.32 }, pdf: { heic: 0.3, png: 0.62 }
    };
    const EXT = { png: "png", jpeg: "jpg", heic: "heic", tiff: "tiff", gif: "gif", bmp: "bmp", webp: "webp", pdf: "pdf" };
    const LABEL = { png: "PNG", jpeg: "JPEG", heic: "HEIC", tiff: "TIFF", gif: "GIF", bmp: "BMP", webp: "WebP", pdf: "PDF" };
    const LOSSY = ["jpeg", "heic", "webp"];
    let fmt = "jpeg", quality = 90, files = [], running = false, timers = [], ran = false, interacted = false;
    const on = (b) => b.getAttribute("aria-checked") === "true";
    const say = (t) => { status.textContent = t; };
    const qf = (q) => (0.25 + 0.75 * Math.pow(q / 100, 2.2)) / (0.25 + 0.75 * Math.pow(0.9, 2.2));
    const fmtSize = (mb) => (mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(10, Math.round(mb * 100) * 10)} KB`);
    const combined = () => fmt === "pdf" && on(sw.combine);
    function outSize(s) {
      let r = RATIO[fmt][s.kind];
      if (LOSSY.includes(fmt)) r *= qf(quality);
      if (on(sw.resize)) r *= Math.pow(Math.min(1, 2048 / s.px), 2) * 1.06;
      return s.mb * r;
    }

    function tile(s) {
      const li = document.createElement("li");
      li.className = "ic-file";
      li.innerHTML = `<span class="ic-thumb ${s.t}"><span class="ic-ring"><svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="14"/><circle cx="17" cy="17" r="14"/></svg></span><span class="ic-ok" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#0b1a10" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 12.5 4 4 8-8.5"/></svg></span></span><span class="ic-n"></span><span class="ic-m"><span class="ic-sz"></span><span class="ic-d" hidden></span></span>`;
      li.src = s;
      pending(li);
      return li;
    }
    function pending(li) {
      const s = li.src;
      li.classList.remove("working", "done");
      $(".ic-n", li).textContent = `${s.base}.${s.ext}`;
      $(".ic-sz", li).textContent = fmtSize(s.mb);
      $(".ic-d", li).hidden = true;
    }
    function finished(li, i) {
      const s = li.src;
      li.classList.remove("working");
      li.classList.add("done");
      const d = $(".ic-d", li);
      if (combined()) {
        $(".ic-n", li).textContent = `Page ${i + 1} of ${SRC[0].base}.pdf`;
        $(".ic-sz", li).textContent = "";
        d.hidden = true;
        return;
      }
      const out = outSize(s);
      const pct = Math.round((out / s.mb - 1) * 100);
      $(".ic-n", li).textContent = `${s.base}.${EXT[fmt]}`;
      $(".ic-sz", li).textContent = fmtSize(out);
      d.textContent = (pct > 0 ? "+" : "−") + Math.abs(pct) + "%";
      d.classList.toggle("up", pct > 0);
      d.hidden = false;
    }
    const addLi = document.createElement("li");
    addLi.innerHTML = '<button type="button" class="ic-add"><b aria-hidden="true">+</b>Add</button>';
    function render() {
      list.innerHTML = "";
      files.forEach((li) => list.appendChild(li));
      list.appendChild(addLi);
      const total = files.reduce((a, li) => a + li.src.mb, 0);
      count.textContent = files.length ? `${files.length} images · ${total.toFixed(1)} MB` : "No files";
      go.disabled = !files.length || running;
    }
    function reset() {
      timers.forEach(clearTimeout);
      timers = [];
      running = false;
      files.forEach(pending);
      go.textContent = "Convert";
      go.disabled = !files.length;
    }
    function summary() {
      if (combined()) return `Saved ${SRC[0].base}.pdf with ${files.length} pages next to the originals.`;
      const before = files.reduce((a, li) => a + li.src.mb, 0);
      const after = files.reduce((a, li) => a + outSize(li.src), 0);
      return `Saved ${files.length} ${LABEL[fmt]} copies next to the originals: ${fmtSize(before)} in, ${fmtSize(after)} out.`;
    }
    function convert() {
      if (running || !files.length) return;
      reset();
      running = true;
      ran = true;
      go.textContent = "Converting…";
      go.disabled = true;
      say(`Converting ${files.length} images to ${LABEL[fmt]}…`);
      const finish = () => { running = false; go.textContent = "Convert"; go.disabled = false; say(summary()); };
      if (calm()) { files.forEach(finished); finish(); return; }
      files.forEach((li, i) => {
        timers.push(setTimeout(() => li.classList.add("working"), i * 280));
        timers.push(setTimeout(() => finished(li, i), i * 280 + 950));
      });
      timers.push(setTimeout(finish, (files.length - 1) * 280 + 1000));
    }
    function changed(msg) {
      interacted = true;
      reset();
      say(msg || `Press Convert to make ${LABEL[fmt]} copies.`);
    }
    function syncFormat() {
      qBox.hidden = !LOSSY.includes(fmt);
      pdfRow.hidden = fmt !== "pdf";
    }

    radioGroup(fmts, (b) => { fmt = b.dataset.f; syncFormat(); changed(); });
    range.addEventListener("input", () => {
      quality = +range.value;
      qv.textContent = quality + "%";
      range.style.setProperty("--v", ((quality - 10) / 90) * 100 + "%");
      changed();
    });
    Object.values(sw).forEach((b) => b.addEventListener("click", () => {
      b.setAttribute("aria-checked", on(b) ? "false" : "true");
      rs.textContent = on(sw.resize) ? "Longest side 2048 px" : "Off";
      changed();
    }));
    go.addEventListener("click", () => { interacted = true; convert(); });
    clear.addEventListener("click", () => {
      interacted = true;
      reset();
      const gone = files;
      files = [];
      go.disabled = true;
      count.textContent = "No files";
      const done = () => { render(); say("Cleared. Press Add to bring the sample photos back."); };
      if (calm()) { done(); return; }
      gone.forEach((li) => li.classList.add("out"));
      setTimeout(done, 260);
    });
    $("button", addLi).addEventListener("click", () => {
      interacted = true;
      if (files.length) { say("In Knack, Add opens a file picker. You can also drop images on the window."); return; }
      files = SRC.map(tile);
      render();
      say(`Added 3 photos. Press Convert to make ${LABEL[fmt]} copies.`);
    });

    files = SRC.map(tile);
    syncFormat();
    render();
    if (frozen) convert();
    watch(ic, () => {
      if (ran || interacted) return;
      if (calm()) { convert(); return; }
      setTimeout(() => { if (!ran && !interacted) convert(); }, 700);
    }, null, 0.5);
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
    const IMAGE_TOOLS = [["AI Background Remover", "cutout"], ["Image Converter", "convert"], ["Image Compressor", "compress"], ["Image Upscaler", "upscale"], ["Photo Enhance", "enhance"], ["Smart Crop", "crop"], ["Text Extractor", "ocr"], ["Colorize B&W", "colorize"], ["Document Scanner", "scan"], ["Face Restoration", "face"], ["Portrait Depth", "depth"], ["Color Palette", "palette"], ["App Icon Generator", "appicon"]];
    const PDF_TOOLS = [["PDF Toolkit", "pdf"], ["Text Extractor", "ocr"]];
    const split = (name) => { const i = name.lastIndexOf("."); return [name.slice(0, i), name.slice(i + 1).toLowerCase()]; };
    const RESULT = {
      cutout: (b) => ({ name: `${b}-cutout.png`, kind: "cut", tool: "AI Background Remover" }),
      compress: (b, e, k) => ({ name: `${b}-compressed.${e === "heic" ? "jpg" : e}`, kind: k, tool: "Image Compressor" }),
      text: (b) => ({ name: `${b}-ocr.txt`, kind: "txt", tool: "Text Extractor" }),
      convert: (b, e, k) => ({ name: e === "png" ? `${b} (1).png` : `${b}.png`, kind: k, tool: "Image Converter" })
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
      const kind = btn.dataset.kind;
      acts.forEach((a) => {
        const ok = kind === "txt" ? false : kind === "pdf" ? a.dataset.act === "text" || a.dataset.act === "open" : true;
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
      say(`Knack opened ${r.tool} and saved ${r.name}.`);
      return $(".fd-file", li);
    }
    function perform(act) {
      const src = target;
      if (!src) return;
      closeAll(false);
      if (act === "open") { showPicker(src); return; }
      if (calm()) { addResult(src, act); return; }
      src.classList.add("busy");
      say(`Knack comes forward on ${RESULT[act]("", "", "").tool} and starts…`);
      timers.push(setTimeout(() => { src.classList.remove("busy"); addResult(src, act); }, 750));
    }
    function showPicker(src) {
      const tools = src.dataset.kind === "pdf" ? PDF_TOOLS : IMAGE_TOOLS;
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
    const sb = $(".sb", section);
    const itemsEl = $(".sb-items", sb);
    const pop = $(".sb-pop", sb);
    const popIn = $(".sb-pop-in", sb);
    const status = $(".sb-status", section);
    const styles = $$(".sb-styles .seg-b", section);
    const M = [
      { id: "cpu", label: "CPU", name: "CPU", icon: "cpu", w: 320, h: 460 },
      { id: "mem", label: "MEM", name: "Memory", icon: "mem", w: 320, h: 560 },
      { id: "down", label: "NET↓", name: "Net ↓", icon: "down", w: 320, h: 240 },
      { id: "bat", label: "BAT", name: "Battery", icon: "bat", w: 300, h: 240 }
    ];
    const st = { cpu: 30, user: 18, sys: 12, perf: 41, eff: 22, mem: 64, down: 6.5, up: 0.42, bat: 84 };
    const CPU_PROCS = [
      { n: "Safari", v: 9.4, c: "linear-gradient(#5ac8fa, #1a7cf0)" },
      { n: "Xcode", v: 6.1, c: "linear-gradient(#6aa8ff, #2f5fd8)" },
      { n: "WindowServer", v: 3.8, c: "linear-gradient(#a1a1aa, #5f5f68)" },
      { n: "Music", v: 2.2, c: "linear-gradient(#ff6a85, #f5264d)" },
      { n: "Knack", v: 1.1, img: "screenshots/icon.png" }
    ];
    const MEM_PROCS = [
      { n: "Safari", v: 2.4, c: "linear-gradient(#5ac8fa, #1a7cf0)" },
      { n: "Xcode", v: 1.9, c: "linear-gradient(#6aa8ff, #2f5fd8)" },
      { n: "WindowServer", v: 0.64, c: "linear-gradient(#a1a1aa, #5f5f68)" },
      { n: "Music", v: 0.41, c: "linear-gradient(#ff6a85, #f5264d)" },
      { n: "Knack", v: 0.18, img: "screenshots/icon.png" }
    ];
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const series = (base, a, b, lo, hi) => Array.from({ length: 60 }, (_, i) => clamp(base + Math.sin(i / 4.2) * a + Math.sin(i / 1.7) * b + (rnd() - 0.5) * b * 2, lo, hi));
    const H = { cpu: series(30, 9, 5, 4, 95), perf: series(40, 12, 6, 2, 98), eff: series(22, 6, 4, 2, 90), down: series(5.5, 2.2, 1.4, 0.2, 12), up: series(0.5, 0.2, 0.15, 0.05, 2) };
    let style = "textRow", openId = null, user = false, inView = false, demoT = 0, demoI = 0, tickT = 0;
    const say = (t) => { status.textContent = t; };
    const pct = (v) => `${Math.round(v)}%`;
    const rate = (mb) => (mb < 1 ? `${Math.round(mb * 1000)} KB/s` : `${mb.toFixed(1)} MB/s`);
    const gb = (v) => (v < 1 ? `${Math.round(v * 1024)} MB` : `${v.toFixed(1)} GB`);
    const value = (id) => (id === "cpu" ? pct(st.cpu) : id === "mem" ? pct(st.mem) : id === "down" ? rate(st.down) : pct(st.bat));
    const icon = (p) => (p.img ? `<img class="pi" src="${p.img}" alt="" width="16" height="16" />` : `<span class="pi" style="background:${p.c}"></span>`);
    const head = (m) => `<p class="pp-h">${glyph(m.icon)}${m.name}</p>`;
    const bar = (label, v, color) => `<div class="pp-bar"><div><span>${label}</span><b>${pct(v)}</b></div><i><u style="width:${clamp(v, 0, 100).toFixed(1)}%;background:${color}"></u></i></div>`;
    const kv = (k, v) => `<div class="pp-kv"><span>${k}</span><b>${v}</b></div>`;
    function chart(list, colors, max) {
      const pts = (h) => h.map((v, i) => `${(i * 288 / 59).toFixed(1)},${(42 - (v / max) * 38).toFixed(1)}`).join(" ");
      const p0 = pts(list[0]);
      let svgs = `<svg class="pp-chart" viewBox="0 0 288 44" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="pp-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colors[0]}" stop-opacity=".4"/><stop offset="1" stop-color="${colors[0]}" stop-opacity="0"/></linearGradient></defs><polygon fill="url(#pp-g)" points="0,44 ${p0} 288,44"/><polyline fill="none" stroke="${colors[0]}" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke" points="${p0}"/>`;
      list.slice(1).forEach((h, i) => { svgs += `<polyline fill="none" stroke="${colors[i + 1]}" stroke-width="1.2" stroke-linejoin="round" vector-effect="non-scaling-stroke" points="${pts(h)}"/>`; });
      return svgs + "</svg>";
    }
    function procs(arr, fmt) {
      return [...arr].sort((a, b) => b.v - a.v).map((p) => `<div class="pp-row">${icon(p)}<span class="pn">${p.n}</span><span class="pv">${fmt(p.v)}</span></div>`).join("");
    }
    function build(m) {
      if (m.id === "cpu") {
        return head(m) + `<div class="pp-big">${pct(st.cpu)}</div>` + chart([H.cpu, H.perf, H.eff], ["#FF3D88", "#FF8C8C", "#66D98C"], 100) +
          `<div class="pp-stats"><div><span class="pp-k">User</span><span class="pp-v" style="color:#6BB8FF">${pct(st.user)}</span></div><div><span class="pp-k">System</span><span class="pp-v" style="color:#FF8C6B">${pct(st.sys)}</span></div></div>` +
          bar("Performance", st.perf, "#FF8C8C") + bar("Efficiency", st.eff, "#66D98C") +
          `<div class="pp-div"></div><p class="pp-sec">TOP PROCESSES <span>by CPU</span></p>` + procs(CPU_PROCS, (v) => `${v.toFixed(1)}%`);
      }
      if (m.id === "mem") {
        const used = 16 * st.mem / 100, cached = (16 - used) * 0.7;
        return head(m) + `<div class="pp-big">${used.toFixed(1)} GB<small>/ 16 GB · ${pct(st.mem)}</small></div>` +
          `<div class="pp-bar"><i><u style="width:${st.mem.toFixed(1)}%;background:#33D9D9"></u></i></div><div style="height:8px"></div>` +
          kv("App", gb(used * 0.6)) + kv("Wired", gb(used * 0.22)) + kv("Compressed", gb(used * 0.18)) + kv("Cached Files", gb(cached)) + kv("Free", gb(16 - used - cached)) +
          bar("Pressure", st.mem * 0.55, "#4DD98C") +
          `<div class="pp-div"></div>` + kv("Page Ins", "1.4 GB") + kv("Page Outs", "0 bytes") + kv("Swap", "0 bytes") +
          `<div class="pp-div"></div><p class="pp-sec">TOP PROCESSES <span>by memory</span></p>` + procs(MEM_PROCS, gb);
      }
      if (m.id === "down") {
        return head(m) + `<div class="pp-net" style="color:#4DD98C">${glyph("down")}<span>Down</span><b>${rate(st.down)}</b></div><div class="pp-net" style="color:#5CA8FF">${glyph("up")}<span>Up</span><b>${rate(st.up)}</b></div>` +
          chart([H.down, H.up], ["#4DD98C", "#5CA8FF"], 12);
      }
      return head(m) + `<div class="pp-big">${pct(st.bat)}</div>` + bar("Charge", st.bat, "var(--success)") + `<div style="height:8px"></div>` + kv("Power", "On battery") + kv("Remaining", "6:12");
    }

    function updateItems() {
      M.forEach((m) => {
        if (!m.el) return;
        $(".sb-v", m.el).textContent = value(m.id);
        m.el.setAttribute("aria-label", `${m.name} ${value(m.id)}`);
        m.el.classList.toggle("open", m.id === openId);
        m.el.setAttribute("aria-expanded", m.id === openId ? "true" : "false");
      });
    }
    function renderItems() {
      itemsEl.classList.toggle("stack", style.endsWith("Stack"));
      itemsEl.innerHTML = "";
      M.forEach((m) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sb-item";
        b.setAttribute("aria-haspopup", "dialog");
        b.innerHTML = (style.startsWith("icon") ? glyph(m.icon) : `<span class="sb-l">${m.label}</span>`) + '<span class="sb-v"></span>';
        b.addEventListener("click", () => {
          user = true;
          clearTimeout(demoT);
          if (openId === m.id) close(); else open(m.id);
        });
        itemsEl.appendChild(b);
        m.el = b;
      });
      updateItems();
      if (openId) place();
    }
    function place() {
      const m = M.find((x) => x.id === openId);
      const W = sb.clientWidth;
      const w = Math.min(m.w, W - 16);
      const a = m.el.getBoundingClientRect(), s = sb.getBoundingClientRect();
      const cx = a.left - s.left + a.width / 2;
      const left = clamp(cx - w / 2, 8, W - w - 8);
      pop.style.setProperty("--w", w + "px");
      pop.style.setProperty("--h", m.h + "px");
      pop.style.setProperty("--ax", (cx - left) + "px");
      pop.style.left = left + "px";
    }
    function open(id) {
      const m = M.find((x) => x.id === id);
      openId = id;
      pop.hidden = false;
      pop.setAttribute("aria-label", `${m.name} details`);
      popIn.innerHTML = build(m);
      place();
      if (!calm()) { pop.classList.remove("enter"); void pop.offsetWidth; pop.classList.add("enter"); }
      updateItems();
      say(id === "cpu" ? "CPU: load, cores and the busiest processes." : id === "mem" ? "Memory: what is using it and how much pressure it is under." : id === "down" ? "Network: download and upload speed." : "Battery: charge and time remaining.");
    }
    function close() {
      openId = null;
      pop.hidden = true;
      updateItems();
      say("Click a menu bar item to open its detail.");
    }
    function demo() {
      clearTimeout(demoT);
      if (user || !inView || calm()) return;
      if (!document.hidden) { open(["cpu", "mem", "down"][demoI % 3]); demoI++; }
      demoT = setTimeout(demo, 2900);
    }
    function step() {
      st.cpu = clamp(st.cpu + (Math.random() - 0.5) * 16 + (30 - st.cpu) * 0.18, 6, 80);
      st.user = st.cpu * 0.6; st.sys = st.cpu * 0.4;
      st.perf = clamp(st.cpu * 1.35 + (Math.random() - 0.5) * 8, 2, 99);
      st.eff = clamp(st.cpu * 0.7 + (Math.random() - 0.5) * 8, 2, 95);
      st.mem = clamp(st.mem + (Math.random() - 0.5) * 2.4 + (64 - st.mem) * 0.1, 54, 76);
      st.down = clamp(st.down * Math.exp((Math.random() - 0.5) * 0.8) + (6.5 - st.down) * 0.08, 0.15, 12);
      st.up = clamp(st.up * Math.exp((Math.random() - 0.5) * 0.8) + (0.42 - st.up) * 0.1, 0.03, 2);
      st.bat = clamp(st.bat - 0.02, 5, 100);
      CPU_PROCS.forEach((p) => { p.v = Math.max(0.2, p.v * Math.exp((Math.random() - 0.5) * 0.7)); });
      const sum = CPU_PROCS.reduce((a, p) => a + p.v, 0);
      CPU_PROCS.forEach((p) => { p.v = p.v * st.cpu * 0.8 / sum; });
      [["cpu", st.cpu], ["perf", st.perf], ["eff", st.eff], ["down", st.down], ["up", st.up]].forEach(([k, v]) => { H[k].shift(); H[k].push(v); });
      updateItems();
      if (openId) popIn.innerHTML = build(M.find((x) => x.id === openId));
    }
    const tick = () => {
      if (!inView || calm()) return;
      if (!document.hidden) step();
      tickT = setTimeout(tick, 1000);
    };

    radioGroup(styles, (b) => { style = b.dataset.style; renderItems(); say(`${b.textContent}. The same style applies to every item.`); });
    sb.addEventListener("keydown", (e) => { if (e.key === "Escape" && openId) { const m = M.find((x) => x.id === openId); close(); m.el.focus(); } });
    addEventListener("resize", () => { if (openId) place(); });
    renderItems();
    if (calm()) open("cpu");
    watch(sb, () => {
      if (inView) return;
      inView = true;
      if (calm()) return;
      clearTimeout(tickT);
      tickT = setTimeout(tick, 800);
      demoT = setTimeout(demo, 600);
    }, () => { inView = false; clearTimeout(tickT); clearTimeout(demoT); }, 0.3);
  });

  $$('[data-stage="tidy"]').forEach((section) => {
    const desk = $(".td-desk", section);
    const go = $(".td-go", section);
    const undo = $(".td-undo", section);
    const status = $(".td-status", section);
    const count = $(".td-count", section);
    const badge = status.querySelector(".tier");
    const modeBtns = $$(".td-modes .seg-b", section);
    const MODES = {
      type: { key: "g", folders: ["Images", "Documents", "Apps & Installers", "Archives", "Audio"] },
      month: { key: "m", folders: ["2026-08", "2026-09", "2026-10"] },
      size: { key: "z", folders: ["Small (<1 MB)", "Medium (1–25 MB)", "Large (25 MB+)"] }
    };
    const FILES = [
      { n: "Screenshot 09.41.png", k: "shot", g: 0, m: 2, z: 1 },
      { n: "Invoice-0931.pdf", k: "pdf", g: 1, m: 1, z: 0 },
      { n: "Figma.dmg", k: "dmg", g: 2, m: 0, z: 2 },
      { n: "IMG_3381.jpg", k: "beach", g: 0, m: 2, z: 1 },
      { n: "photos.zip", k: "zip", g: 3, m: 1, z: 2 },
      { n: "Midnight.mp3", k: "song", g: 4, m: 0, z: 1 },
      { n: "Brief.docx", k: "doc", g: 1, m: 2, z: 0 },
      { n: "Banner.png", k: "poster", g: 0, m: 1, z: 1 },
      { n: "Docker.dmg", k: "dmg", g: 2, m: 2, z: 2 },
      { n: "Notes.pdf", k: "pdf", g: 1, m: 1, z: 0 },
      { n: "backup.zip", k: "zip", g: 3, m: 0, z: 2 },
      { n: "Screenshot 10.02.png", k: "shot", g: 0, m: 2, z: 0 }
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
    let mode = "type", applied = false, played = false, interacted = false, narrow = null;

    const fileEls = FILES.map((f) => {
      const el = document.createElement("div");
      el.className = "tf";
      el.innerHTML = `${ICON[f.k]}<span class="fd-n"></span>`;
      $(".fd-n", el).textContent = f.n;
      desk.appendChild(el);
      return el;
    });
    const folderEls = [0, 1, 2, 3, 4].map(() => {
      const el = document.createElement("div");
      el.className = "tfo";
      el.innerHTML = '<span class="fold"><b>0</b></span><span class="fd-n"></span>';
      desk.appendChild(el);
      return el;
    });

    function homes(n, small) {
      if (small && n === 5) return [[20, 30], [50, 30], [80, 30], [35, 70], [65, 70]];
      if (small) return [[20, 46], [50, 46], [80, 46]];
      const step = n === 5 ? 19 : 25;
      return Array.from({ length: n }, (_, i) => [50 + (i - (n - 1) / 2) * step, 50]);
    }
    function layout(animate) {
      const small = desk.clientWidth < 560;
      narrow = small;
      const M = MODES[mode];
      const nF = M.folders.length;
      const spots = homes(nF, small);
      const cols = small ? 3 : 6;
      const quick = !animate || calm();
      fileEls.forEach((el, i) => {
        const f = FILES[i];
        const cx = i % cols, cy = Math.floor(i / cols);
        const sx = (cx + 0.5) / cols * 100 + JIT[i][0] * (small ? 1 : 1.4);
        const sy = small ? 14 + cy * 23 + JIT[i][1] : (cy === 0 ? 26 : 74) + JIT[i][1] * 1.5;
        const [x, y] = applied ? spots[f[M.key]] : [sx, sy];
        el.style.setProperty("--x", x.toFixed(2));
        el.style.setProperty("--y", y.toFixed(2));
        el.style.setProperty("--rot", applied ? "0deg" : ROT[i] + "deg");
        el.style.setProperty("--sc", applied ? 0.3 : 1);
        el.style.setProperty("--dl", quick ? "0s" : (applied ? 0.1 + i * 0.05 : i * 0.03) + "s");
        el.classList.toggle("gone", applied);
      });
      folderEls.forEach((el, g) => {
        const used = g < nF;
        const [x, y] = used ? spots[g] : [50, 50];
        el.style.setProperty("--x", x);
        el.style.setProperty("--y", y);
        el.style.setProperty("--dl", quick ? "0s" : g * 0.05 + "s");
        el.classList.toggle("plan", used && !applied);
        el.classList.toggle("on", used && applied);
        if (used) {
          $(".fd-n", el).textContent = M.folders[g];
          $(".fold b", el).textContent = FILES.filter((f) => f[M.key] === g).length;
        }
      });
    }
    function say(t) {
      status.textContent = "";
      if (badge) status.append(badge, " ");
      status.append(t);
    }
    function sync(msg) {
      const nF = MODES[mode].folders.length;
      go.disabled = applied;
      undo.disabled = !applied;
      modeBtns.forEach((b) => { b.disabled = applied; });
      count.textContent = applied ? `${nF} folders` : "Preview · 12 moves · 2.2 GB";
      say(msg || (applied ? `Moved 12 files into ${nF} folders. Undo puts every one back.` : `Preview · 12 moves into ${nF} folders. Nothing has moved yet.`));
    }
    function apply(on, animate = true, msg) {
      applied = on;
      layout(animate);
      sync(msg);
    }

    radioGroup(modeBtns, (b) => {
      interacted = true;
      mode = b.dataset.mode;
      layout(true);
      sync();
    });
    go.addEventListener("click", () => { interacted = true; apply(true); undo.focus({ preventScroll: true }); });
    undo.addEventListener("click", () => { interacted = true; apply(false, true, "Undone. Every file is back where it was."); go.focus({ preventScroll: true }); });
    addEventListener("resize", () => { if ((desk.clientWidth < 560) !== narrow) layout(false); });

    layout(false);
    sync();
    if (frozen) apply(true, false);
    watch(desk, () => {
      if (played || interacted) return;
      played = true;
      if (calm()) { apply(true, false); return; }
      setTimeout(() => { if (!interacted) apply(true); }, 1400);
    }, null, 0.5);
  });

  $$(".tool-grid .feature-card").forEach((card) => {
    const name = card.querySelector("h3").firstChild.textContent.trim();
    const t = TOOLS.find((x) => x.title === name);
    if (t) card.style.setProperty("--tc", t.color);
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
