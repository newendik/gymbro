/* GymBro — клиентская логика: программы, тренировки, статистика, профиль. */
(() => {
  "use strict";

  /* ================= Метаданные ================= */
  const GOAL_META = {
    power:   { label: "Силовые",        icon: "i-barbell", desc: "Периодизация: тяжёлые / средние / лёгкие недели" },
    fitness: { label: "Фитнес",         icon: "i-heart",   desc: "Много повторов, короткий отдых — тонус" },
    custom:  { label: "Своя программа", icon: "i-pencil",  desc: "Собираешь сам: упражнения, подходы, повторы" },
  };
  const EQUIP_META = {
    full_gym: { label: "Полный зал", icon: "i-building", desc: "Штанги, тренажёры, блоки" },
    dumbbell: { label: "Гантели",    icon: "i-dumbbell", desc: "Гантели и собственный вес" },
    home:     { label: "Дома",       icon: "i-home",     desc: "Свой вес, гантели, резинки" },
  };
  const EX_EQUIP_LABEL = { full_gym: "Полный зал", dumbbell: "Гантели", no_equipment: "Свой вес", band: "Резинки" };
  const MUSCLE_COLOR = {
    "Грудь": "#EF4444", "Спина": "#6366F1", "Плечи": "#F59E0B", "Квадрицепс": "#0EA5E9",
    "Бицепс бедра": "#8B5CF6", "Ягодицы": "#EC4899", "Бицепс": "#10B981",
    "Трицепс": "#3B82F6", "Пресс": "#F97316", "Икры": "#64748B",
  };
  const DAYS_HINT = {
    2: "Верх / Низ — два сбалансированных дня.",
    3: "Жим · Тяга · Ноги — золотой стандарт.",
    4: "Четыре фокусных дня: грудь, спина, ноги, плечи.",
    5: "Пять дней — каждая группа отдельно.",
    6: "Максимальная частота: шесть узких дней.",
  };

  const KEYS = {
    plans: "gymbro.plans",
    settings: "gymbro.settings",
    profile: "gymbro.profile",
    history: "gymbro.history",
  };

  /* ================= Состояние ================= */
  const state = {
    exercises: [], exMap: new Map(),
    programs: [],
    plans: [],
    history: [],
    profile: { name: "", age: "", height: "", weight: "" },
    plan: null,
    day: 0,
    view: "days",
    catalogSel: null,
    catalogQ: "",
    catalogTag: "all",
    settings: { theme: "system", anim: true },
    wiz: { step: 0, draft: { goal: null, days_per_week: 3, equipment: "full_gym", title: "" }, busy: false },
    build: null,
    buildDay: 0,
    pick: { q: "", muscle: "all" },
    guideTab: "ios",
    workout: null,
    screen: "home",
  };

  /* ================= DOM ================= */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const dom = {
    screens: {
      home: $("#screen-home"), catalog: $("#screen-catalog"), stats: $("#screen-stats"),
      profile: $("#screen-profile"), plan: $("#screen-plan"), build: $("#screen-build"),
      workout: $("#screen-workout"),
    },
    tabbar: $("#tabbar"),
    homeGreeting: $("#home-greeting"), homeHero: $("#home-hero"), homeMetrics: $("#home-metrics"),
    plansList: $("#plans-list"), plansCount: $("#plans-count"), plansSection: $("#plans-section"),
    homeEmpty: $("#home-empty"),
    catalogScroll: $("#catalog-scroll"), catalogAbTitle: $("#catalog-ab-title"), catalogBack: $("#btn-catalog-back"),
    statsScroll: $("#stats-scroll"), statTotal: $("#stat-total"), statStreak: $("#stat-streak"),
    statVolume: $("#stat-volume"), statsBars: $("#stats-bars"), statsPrs: $("#stats-prs"),
    statsHistory: $("#stats-history"), statsEmpty: $("#stats-empty"),
    profileAvatar: $("#profile-avatar"), profileName: $("#profile-name"), profileSub: $("#profile-sub"),
    profileAge: $("#profile-age"), profileHeight: $("#profile-height"), profileWeight: $("#profile-weight"),
    profileBmi: $("#profile-bmi"), profileBmiNote: $("#profile-bmi-note"),
    planAbTitle: $("#plan-ab-title"), planHero: $("#plan-hero"), dayTabs: $("#day-tabs"),
    waveTabs: $("#wave-tabs"), planScroll: $("#plan-scroll"), planViewToggle: $("#plan-view-toggle"),
    workoutAbTitle: $("#workout-ab-title"), workoutSub: $("#workout-sub"),
    workoutTimer: $("#workout-timer"), workoutScroll: $("#workout-scroll"),
    buildTitle: $("#build-title"), buildInpTitle: $("#inp-build-title"),
    buildDayTabs: $("#build-day-tabs"), buildScroll: $("#build-scroll"),
    pickOverlay: $("#pick-overlay"), sheetPick: $("#sheet-pick"),
    pickSearch: $("#inp-pick-search"), pickFilters: $("#pick-muscle-filters"), pickList: $("#pick-list"),
    wizOverlay: $("#wiz-overlay"), sheetWizard: $("#sheet-wizard"), wizBody: $("#wizard-body"),
    wizNext: $("#wiz-next"), wizCancel: $("#wiz-cancel"),
    infoOverlay: $("#info-overlay"), sheetEx: $("#sheet-exercise"), exBody: $("#exercise-body"),
    guideOverlay: $("#guide-overlay"), sheetGuide: $("#sheet-guide"), guideTabs: $("#guide-tabs"), guideBody: $("#guide-body"),
    alertWrap: $("#alert-wrap"), alertIcon: $("#alert-icon"), alertTitle: $("#alert-title"),
    alertMsg: $("#alert-msg"), alertActions: $("#alert-actions"),
    hud: $("#hud"), hudText: $("#hud-text"),
  };

  /* ================= Утилиты ================= */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const svg = (id, cls = "ic") => `<svg class="${cls}"><use href="#${id}"/></svg>`;
  const tile = (iconId, color, sm) =>
    `<div class="tile${sm ? " sm" : ""}" style="background:${color}">${svg(iconId)}</div>`;

  const fmtRest = (sec) => {
    if (!sec) return "—";
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m ? (s ? `${m}:${String(s).padStart(2, "0")}` : `${m} мин`) : `${s} с`;
  };
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  };
  const dayWord = (n) => plural(n, "день", "дня", "дней");
  const exWord = (n) => plural(n, "упражнение", "упражнения", "упражнений");
  const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  };
  const fmtShortDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  };
  const num = (v) => {
    const n = parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? 0 : n;
  };
  const round1 = (n) => Math.round(n * 10) / 10;
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /* ================= Хранилище ================= */
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return v === null || v === undefined ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { hud("Память браузера переполнена"); return false; }
  }
  const readPlans = () => { const a = readJSON(KEYS.plans, []); return Array.isArray(a) ? a : []; };
  const writePlans = () => writeJSON(KEYS.plans, state.plans.slice(0, 100));
  const readHistory = () => { const a = readJSON(KEYS.history, []); return Array.isArray(a) ? a : []; };
  const writeHistory = () => writeJSON(KEYS.history, state.history.slice(-400));

  function readSettings() {
    const raw = readJSON(KEYS.settings, {});
    state.settings.theme = ["light", "dark", "system"].includes(raw.theme) ? raw.theme : "system";
    state.settings.anim = raw.anim !== false;
  }
  const writeSettings = () => writeJSON(KEYS.settings, state.settings);

  function readProfile() {
    const raw = readJSON(KEYS.profile, {});
    state.profile = {
      name: typeof raw.name === "string" ? raw.name : "",
      age: raw.age ?? "", height: raw.height ?? "", weight: raw.weight ?? "",
    };
  }
  const writeProfile = () => writeJSON(KEYS.profile, state.profile);

  const newId = () => GymPlanner.newId();

  /* ================= HUD / Alert / Sheet ================= */
  let hudTimer;
  function hud(text) {
    dom.hudText.textContent = text;
    dom.hud.hidden = false;
    requestAnimationFrame(() => dom.hud.classList.add("open"));
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => {
      dom.hud.classList.remove("open");
      setTimeout(() => { dom.hud.hidden = true; }, 300);
    }, 2400);
  }

  function showAlert({ title, message = "", actions = [{ label: "ОК" }], icon = null }) {
    return new Promise((resolve) => {
      dom.alertTitle.textContent = title;
      dom.alertMsg.textContent = message;
      dom.alertMsg.hidden = !message;
      dom.alertIcon.hidden = !icon;
      if (icon) dom.alertIcon.innerHTML = svg(icon);
      dom.alertActions.innerHTML = "";
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; cleanup(); resolve(v); } };
      actions.forEach((a) => {
        const b = document.createElement("button");
        b.textContent = a.label;
        if (a.danger) b.classList.add("danger");
        b.onclick = () => done(a.value !== undefined ? a.value : a.label);
        dom.alertActions.appendChild(b);
      });
      dom.alertWrap.hidden = false;
      requestAnimationFrame(() => dom.alertWrap.classList.add("open"));
      const onKey = (e) => { if (e.key === "Escape") done(null); };
      const onClick = (e) => { if (e.target === dom.alertWrap) done(null); };
      function cleanup() {
        dom.alertWrap.classList.remove("open");
        setTimeout(() => { dom.alertWrap.hidden = true; }, 260);
        dom.alertWrap.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKey);
      }
      dom.alertWrap.addEventListener("click", onClick);
      document.addEventListener("keydown", onKey);
    });
  }

  function openSheet(overlay, sheet) {
    overlay.hidden = false; sheet.hidden = false;
    requestAnimationFrame(() => { overlay.classList.add("open"); sheet.classList.add("open"); });
  }
  function closeSheet(overlay, sheet) {
    overlay.classList.remove("open"); sheet.classList.remove("open");
    setTimeout(() => { overlay.hidden = true; sheet.hidden = true; }, 400);
  }

  /* ================= Тема ================= */
  function resolvedTheme() {
    const p = state.settings.theme;
    return p === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : p;
  }
  function applyTheme() {
    const t = resolvedTheme();
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.anim = state.settings.anim ? "on" : "off";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#0B0B0C" : "#FFFFFF");
    syncSettingsUI();
  }
  function syncSettingsUI() {
    $$("[data-th]").forEach((b) => b.classList.toggle("on", b.dataset.th === state.settings.theme));
    const sw = $("#sw-anim");
    if (sw) sw.classList.toggle("on", state.settings.anim);
  }
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (state.settings.theme === "system") applyTheme(); };
    if (mq.addEventListener) mq.addEventListener("change", onChange); else mq.addListener(onChange);
  }

  /* ================= Миграция ================= */
  const GOAL_MIGRATE = { muscle: "power", strength: "power", weight_loss: "fitness", health: "fitness" };
  function migratePlan(p) {
    if (!p) return p;
    if (GOAL_MIGRATE[p.goal]) p.goal = GOAL_MIGRATE[p.goal];
    if (!p.kind) p.kind = p.goal === "custom" ? "custom" : "generated";
    (p.days || []).forEach((d) => (d.items || []).forEach((it) => {
      if (it.compound === undefined) {
        const ex = state.exMap.get(it.exercise_id);
        it.compound = ex ? !!ex.compound : true;
      }
    }));
    return p;
  }

  /* ================= Навигация ================= */
  const TAB_SCREENS = new Set(["home", "catalog", "stats", "profile"]);

  function navigate(name) {
    state.screen = name;
    Object.entries(dom.screens).forEach(([k, el]) => { if (el) el.hidden = k !== name; });
    const withTabs = TAB_SCREENS.has(name) && !(name === "catalog" && state.catalogSel);
    dom.tabbar.hidden = !withTabs;
    Object.values(dom.screens).forEach((el) => {
      if (el) el.classList.toggle("with-tabs", withTabs);
    });
    $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === name));
    const sc = dom.screens[name] && dom.screens[name].querySelector(".scroll");
    if (sc) sc.scrollTop = 0;
    requestAnimationFrame(() => {
      const bar = dom.screens[name] && dom.screens[name].querySelector(".app-bar");
      if (bar) bar.classList.toggle("scrolled", false);
    });
  }

  // тень у шапки при скролле
  Object.values(dom.screens).forEach((scr) => {
    const sc = scr && scr.querySelector(".scroll");
    const bar = scr && scr.querySelector(".app-bar");
    if (sc && bar) {
      sc.addEventListener("scroll", () => bar.classList.toggle("scrolled", sc.scrollTop > 6), { passive: true });
    }
  });

  $$(".tab").forEach((t) => t.addEventListener("click", () => {
    const name = t.dataset.tab;
    if (name === "catalog") { state.catalogSel = null; renderCatalog(); }
    if (name === "stats") renderStats();
    if (name === "profile") renderProfile();
    if (name === "home") renderHome();
    navigate(name);
  }));

  /* ================= ГЛАВНАЯ ================= */
  function weeklyDone() {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // пн = 0
    const monday = new Date(now); monday.setDate(now.getDate() - dow); monday.setHours(0, 0, 0, 0);
    return state.history.filter((h) => {
      const d = new Date(h.finishedAt || h.date);
      return !isNaN(d) && d >= monday;
    }).length;
  }

  function renderHome() {
    const plans = state.plans;
    const target = plans[0] ? plans[0].days_per_week : 3;
    const done = weeklyDone();
    const pct = Math.min(100, Math.round((done / Math.max(1, target)) * 100));
    const C = 2 * Math.PI * 40;

    dom.homeGreeting.textContent = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

    const next = plans[0];
    dom.homeHero.innerHTML = `
      <div class="hero-info">
        <span class="hero-eyebrow">${svg("i-target")} Эта неделя</span>
        <h2 class="hero-title">${done} из ${target} ${dayWord(target)}</h2>
        <p class="hero-sub">${pct >= 100 ? "Неделя закрыта. Отличная работа." : next ? "Продолжай — осталось " + Math.max(0, target - done) : "Начни с готовой программы из каталога"}</p>
        <div class="hero-actions">
          ${next
            ? `<button class="btn btn-primary" id="hero-continue">${svg("i-play")}Тренировка</button>`
            : `<button class="btn btn-primary" id="hero-start">${svg("i-grid")}Каталог</button>`}
          <button class="btn btn-quiet" id="hero-new">${svg("i-plus")}Своя</button>
        </div>
      </div>
      <div class="ring-wrap">
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle class="ring-track" cx="46" cy="46" r="40" fill="none" stroke-width="7"/>
          <circle class="ring-fill" cx="46" cy="46" r="40" fill="none" stroke-width="7" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/>
        </svg>
        <div class="ring-center"><div><b>${pct}%</b><span>план</span></div></div>
      </div>`;

    const totalVol = state.history.reduce((a, h) => a + (h.volume || 0), 0) / 1000;
    const prs = countPRs();
    dom.homeMetrics.innerHTML = `
      <div class="metric accent"><b>${state.history.length}</b><span>тренировок</span></div>
      <div class="metric"><b>${round1(totalVol)}</b><span>тонн объёма</span></div>
      <div class="metric"><b>${prs}</b><span>рекордов</span></div>`;

    dom.plansCount.textContent = plans.length ? `${plans.length}` : "";
    dom.plansSection.hidden = plans.length === 0;
    dom.homeEmpty.hidden = plans.length > 0;

    dom.plansList.innerHTML = plans.map((p, i) => {
      const g = GOAL_META[p.goal] || GOAL_META.fitness;
      const items = (p.days || []).reduce((a, d) => a + ((d.items || []).length), 0);
      const isCat = p.kind === "generated" || p.program_src;
      return `
      <button class="plan-card rise" style="--i:${i}" data-plan="${esc(p.id)}">
        ${tile(g.icon, "var(--accent)")}
        <div class="plan-main">
          <div class="plan-title">${esc(p.title)}</div>
          <div class="plan-meta">
            <span>${p.days_per_week} ${dayWord(p.days_per_week)}</span>
            <i>·</i><span>${items} ${exWord(items)}</span>
          </div>
        </div>
        ${isCat ? `<span class="plan-badge">${p.keep_scheme ? "каталог" : "план"}</span>` : ""}
        <span class="chev">${svg("i-chev-r")}</span>
      </button>`;
    }).join("");

    dom.plansList.querySelectorAll("[data-plan]").forEach((b) =>
      b.addEventListener("click", () => openPlan(b.dataset.plan)));

    const hc = $("#hero-continue");
    if (hc) hc.addEventListener("click", () => { openPlan(plans[0].id); });
    const hs = $("#hero-start");
    if (hs) hs.addEventListener("click", () => { state.catalogSel = null; renderCatalog(); navigate("catalog"); });
    const hn = $("#hero-new");
    if (hn) hn.addEventListener("click", openWizard);
  }

  function countPRs() {
    const best = {};
    state.history.forEach((h) => (h.items || []).forEach((it) => {
      (it.sets || []).forEach((s) => {
        if (!s.done) return;
        const w = num(s.weight);
        if (w > (best[it.exercise_id] || 0)) best[it.exercise_id] = w;
      });
    }));
    return Object.keys(best).length;
  }

  /* ================= КАТАЛОГ ================= */
  function openCatalog() { state.catalogSel = null; renderCatalog(); navigate("catalog"); }

  const CATALOG_TAGS = [
    { id: "all", label: "Все" },
    { id: "gym", label: "Зал" },
    { id: "home", label: "Дома" },
    { id: "beginner", label: "Новичок" },
    { id: "power", label: "Силовые" },
    { id: "fitness", label: "Фитнес" },
  ];

  function catalogFiltered() {
    const q = state.catalogQ.trim().toLowerCase();
    return state.programs.filter((p) => {
      if (state.catalogTag === "gym" && p.place !== "gym") return false;
      if (state.catalogTag === "home" && p.place !== "home" && p.place !== "any") return false;
      if (state.catalogTag === "beginner" && p.level !== "beginner") return false;
      if (state.catalogTag === "power" && p.goal !== "power") return false;
      if (state.catalogTag === "fitness" && p.goal !== "fitness") return false;
      if (!q) return true;
      const hay = [p.name, p.desc, p.source, (p.tags || []).join(" ")].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function renderCatalog() {
    if (state.catalogSel) return renderCatalogDetail();
    dom.catalogAbTitle.textContent = "Каталог";
    dom.catalogBack.hidden = true;
    $("#btn-prog-add").hidden = true;

    const list = catalogFiltered();
    dom.catalogScroll.innerHTML = `
      <p class="catalog-lead">29 проверенных программ со всего интернета — добавляются в один тап, схема сохраняется как есть.</p>
      <div class="catalog-tools">
        <div class="input-card">
          <input id="inp-cat-search" maxlength="40" placeholder="Поиск программы…" autocomplete="off" value="${esc(state.catalogQ)}">
          <button class="clear" id="btn-cat-clear" aria-label="Очистить">${svg("i-x")}</button>
        </div>
        <div class="chip-row" id="cat-tags">
          ${CATALOG_TAGS.map((t) => `<button class="chip ${state.catalogTag === t.id ? "on" : ""}" data-ctag="${t.id}">${t.label}</button>`).join("")}
        </div>
      </div>
      <div class="prog-grid">${list.map((pr, i) => `
        <button class="prog-card rise" style="--i:${i}" data-prog="${esc(pr.id)}">
          <div class="prog-top" style="background:var(--accent)">
            <div class="prog-icon">${svg(pr.icon)}</div>
            <span class="prog-days">${pr.days_per_week}×/нед</span>
          </div>
          <div class="prog-body">
            <h4>${esc(pr.name)}</h4>
            <p>${esc(pr.desc)}</p>
            <div class="tag-row">${(pr.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
          </div>
        </button>`).join("")}</div>
      ${list.length ? "" : `<div class="empty"><div class="empty-badge">${svg("i-search")}</div><h3>Ничего не нашлось</h3><p>Попробуй другой запрос или сбрось фильтры.</p></div>`}`;

    const inp = $("#inp-cat-search");
    if (inp) {
      inp.addEventListener("input", () => { state.catalogQ = inp.value; renderCatalog(); });
      inp.addEventListener("focus", () => setTimeout(() => inp.setSelectionRange(inp.value.length, inp.value.length), 0));
    }
    const clr = $("#btn-cat-clear");
    if (clr) clr.addEventListener("click", () => { state.catalogQ = ""; renderCatalog(); });
    $$("#cat-tags [data-ctag]").forEach((b) =>
      b.addEventListener("click", () => { state.catalogTag = b.dataset.ctag; renderCatalog(); }));
    dom.catalogScroll.querySelectorAll("[data-prog]").forEach((b) =>
      b.addEventListener("click", () => { state.catalogSel = b.dataset.prog; renderCatalog(); navigate("catalog"); }));
  }

  function renderCatalogDetail() {
    const pr = state.programs.find((x) => x.id === state.catalogSel);
    if (!pr) { state.catalogSel = null; return renderCatalog(); }
    dom.catalogAbTitle.textContent = pr.name;
    dom.catalogBack.hidden = false;
    $("#btn-prog-add").hidden = false;
    const total = pr.days.reduce((a, d) => a + d.items.length, 0);

    dom.catalogScroll.innerHTML = `
      <div class="hero-card prog-hero rise" style="background:var(--accent)">
        <div class="prog-hero-icon">${svg(pr.icon)}</div>
        <h2>${esc(pr.name)}</h2>
        <p class="hero-sub">${esc(pr.desc)}</p>
        <div class="hero-stats">
          <div class="hero-stat">${svg("i-calendar")}<b>${pr.days_per_week}</b><span>${dayWord(pr.days_per_week)}</span></div>
          <div class="hero-stat">${svg("i-layers")}<b>${total}</b><span>упр.</span></div>
          <div class="hero-stat">${svg("i-list")}<b>${pr.days.length}</b><span>дн. в цикле</span></div>
        </div>
        ${pr.source ? `<p class="prog-src">${svg("i-info")}<span>${esc(pr.source)}</span></p>` : ""}
      </div>
      ${pr.days.map((d, di) => `
        <div class="card rise" style="--i:${di};margin-top:12px">
          <div class="day-head">${esc(d.title)}</div>
          <div class="day-items">
            ${d.items.map((it) => {
              const ex = state.exMap.get(it.ex);
              const color = MUSCLE_COLOR[(ex || {}).muscle] || "#64748B";
              return `<div class="ex-item">
                ${tile("i-dumbbell", color, true)}
                <div style="min-width:0;flex:1">
                  <div class="ex-name">${esc((ex || {}).name || it.ex)}</div>
                  <div class="ex-muscle">${esc((ex || {}).muscle || "")}</div>
                </div>
                <div class="ex-scheme">${it.sets} × ${esc(it.reps)}<small>${fmtRest(it.rest_sec)}</small></div>
              </div>`;
            }).join("")}
          </div>
        </div>`).join("")}`;
  }

  function importProgram(prg) {
    const days = prg.days.map((d, i) => ({
      day_num: i + 1, title: d.title,
      items: d.items.map((it) => {
        const ex = state.exMap.get(it.ex);
        if (!ex) return null;
        return {
          exercise_id: ex.id, name: ex.name, muscle: ex.muscle,
          compound: !!ex.compound, sets: it.sets, reps: it.reps, rest_sec: it.rest_sec,
        };
      }).filter(Boolean),
    }));
    if (!days.some((d) => d.items.length)) { hud("Каталог упражнений не загружен"); return; }
    const plan = {
      id: newId(), title: prg.name, kind: "generated", goal: prg.goal,
      level: prg.level || "intermediate", equipment: prg.place === "home" ? "home" : "full_gym",
      days_per_week: prg.days_per_week, created_at: new Date().toISOString(),
      keep_scheme: true, program_src: prg.source || "", days,
    };
    state.plans = [plan, ...state.plans];
    writePlans(); renderHome();
    hud("Добавлено в мои программы");
    state.catalogSel = null;
    openPlan(plan.id);
  }

  /* ================= ПЛАН ================= */
  function openPlan(id) {
    const p = state.plans.find((x) => String(x.id) === String(id));
    if (!p) { hud("Программа не найдена"); return; }
    state.plan = p; state.day = 0; state.view = "days";
    dom.planAbTitle.textContent = p.title;
    renderPlan();
    navigate("plan");
  }

  function renderPlan() {
    const p = state.plan;
    const g = GOAL_META[p.goal] || GOAL_META.fitness;
    const eq = EQUIP_META[p.equipment] || EQUIP_META.full_gym;
    const isPower = p.goal === "power" && p.kind === "generated";

    dom.planViewToggle.hidden = !isPower;
    if (isPower) {
      dom.planViewToggle.querySelectorAll("[data-pv]").forEach((b) =>
        b.classList.toggle("on", b.dataset.pv === state.view));
    }

    const items = (p.days || []).reduce((a, d) => a + ((d.items || []).length), 0);
    const sets = (p.days || []).reduce((a, d) => a + (d.items || []).reduce((x, i) => x + (i.sets || 0), 0), 0);
    dom.planHero.innerHTML = `
      <div class="hero-card" style="background:var(--accent)">
        <h2>${esc(p.title)}</h2>
        <p class="hero-sub">${g.label} · ${eq.label}${p.created_at ? " · с " + fmtDate(p.created_at) : ""}</p>
        <div class="hero-stats">
          <div class="hero-stat">${svg("i-calendar")}<b>${p.days_per_week}</b><span>${dayWord(p.days_per_week)}</span></div>
          <div class="hero-stat">${svg("i-layers")}<b>${items}</b><span>упр.</span></div>
          <div class="hero-stat">${svg("i-check")}<b>${sets}</b><span>подходов</span></div>
        </div>
        ${p.program_src ? `<p class="prog-src">${svg("i-info")}<span>${esc(p.program_src)}</span></p>` : ""}
      </div>`;

    if (isPower && state.view === "weeks") { renderCalendar(); return; }

    dom.waveTabs.hidden = true;
    dom.dayTabs.hidden = false;
    dom.dayTabs.innerHTML = (p.days || []).map((d, i) =>
      `<button data-day="${i}" class="${i === state.day ? "on" : ""}">${i + 1}</button>`).join("");
    dom.dayTabs.querySelectorAll("[data-day]").forEach((b) =>
      b.addEventListener("click", () => {
        state.day = Number(b.dataset.day);
        dom.dayTabs.querySelectorAll("button").forEach((x, i) => x.classList.toggle("on", i === state.day));
        renderDay();
      }));
    renderDay();
  }

  function renderCalendar() {
    const p = state.plan;
    dom.dayTabs.hidden = true;
    dom.waveTabs.hidden = false;
    const cal = GymPlanner.buildCalendar(p, p.created_at || new Date().toISOString());
    const weeks = [];
    for (let w = 1; w <= GymPlanner.MESO_WEEKS; w++) weeks.push(cal.filter((s) => s.week === w));

    dom.waveTabs.innerHTML = weeks.map((wk, i) => {
      const wave = wk[0] ? wk[0].wave : GymPlanner.DELOAD;
      return `<button data-week="${i}" class="${i === 0 ? "on" : ""}">
        <b>Нед ${i + 1}</b><span>${p.keep_scheme ? "Цикл" : wave.label}</span></button>`;
    }).join("");
    dom.waveTabs.querySelectorAll("[data-week]").forEach((b) =>
      b.addEventListener("click", () => {
        dom.waveTabs.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        renderCalendarWeek(Number(b.dataset.week));
      }));
    renderCalendarWeek(0);
  }

  function renderCalendarWeek(weekIdx) {
    const p = state.plan;
    const cal = GymPlanner.buildCalendar(p, p.created_at || new Date().toISOString());
    const sessions = cal.filter((s) => s.week === weekIdx + 1);
    dom.planScroll.innerHTML = sessions.map((s, i) => `
      <div class="cal-session rise" style="--i:${i}">
        <div class="cal-session-head" style="border-left-color:${s.wave.color}">
          <div class="cal-wave-badge" style="background:${s.wave.color}">${s.wave.short}</div>
          <div class="cal-session-info">
            <b>${esc(s.title)}</b>
            <span>${fmtShortDate(s.date)} · ${s.wave.label} · ${s.wave.pct}</span>
          </div>
        </div>
        <div class="card cal-items">
          ${s.items.map((it) => `<div class="cal-item">
            <span class="cal-ex-name">${esc(it.name)}</span>
            <span class="cal-ex-scheme">${it.sets}×${esc(it.reps)} · ${fmtRest(it.rest_sec)}</span>
          </div>`).join("")}
        </div>
      </div>`).join("");
  }

  function renderDay() {
    const p = state.plan;
    const day = (p.days || [])[state.day];
    if (!day) { dom.planScroll.innerHTML = ""; return; }
    const list = (day.items || []).map((it, i) => {
      const color = MUSCLE_COLOR[it.muscle] || "#64748B";
      return `<div class="ex-item rise" style="--i:${i}" data-ex="${esc(it.exercise_id)}">
        ${tile("i-dumbbell", color, true)}
        <div style="min-width:0;flex:1">
          <div class="ex-name">${esc(it.name)}</div>
          <div class="ex-muscle">${esc(it.muscle)}</div>
        </div>
        <div class="ex-scheme">${it.sets} × ${esc(it.reps)}<small>${fmtRest(it.rest_sec)}</small></div>
      </div>`;
    }).join("");
    dom.planScroll.innerHTML = `
      <h3 class="section-label" style="margin:14px 2px 9px">${esc(day.title || `День ${state.day + 1}`)}</h3>
      <div class="card ex-list">${list || `<div class="empty"><p>Нет упражнений</p></div>`}</div>`;
    dom.planScroll.querySelectorAll("[data-ex]").forEach((el) =>
      el.addEventListener("click", () => openExercise(el.dataset.ex)));
  }

  /* ================= Sheet упражнения ================= */
  function openExercise(id) {
    const ex = state.exMap.get(id);
    const p = state.plan;
    const dayItems = ((p.days || [])[state.day] || {}).items || [];
    const sch = dayItems.find((x) => x.exercise_id === id);
    if (!ex && !sch) { hud("Нет данных"); return; }
    const info = ex || { name: sch.name, muscle: sch.muscle, equipment: "", tips: "" };
    const color = MUSCLE_COLOR[info.muscle] || "#64748B";
    const pr = bestFor(id);
    dom.exBody.innerHTML = `
      <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:10px">
        ${tile("i-dumbbell", color)}
        <div style="min-width:0">
          <h3 class="sheet-title" style="margin:0 0 4px;font-size:22px">${esc(info.name)}</h3>
          <span style="font-size:14px;color:${color};font-weight:600">${esc(info.muscle)}</span>
          ${info.equipment ? `<span style="font-size:13px;color:var(--text2)"> · ${esc(EX_EQUIP_LABEL[info.equipment] || info.equipment)}</span>` : ""}
        </div>
      </div>
      <div class="stat-hero" style="margin:0 0 12px">
        <div class="stat-big"><b>${sch ? sch.sets : "—"}</b><span>подходы</span></div>
        <div class="stat-big"><b>${sch ? esc(sch.reps) : "—"}</b><span>повторы</span></div>
        <div class="stat-big"><b>${sch && sch.rest_sec ? fmtRest(sch.rest_sec) : "—"}</b><span>отдых</span></div>
      </div>
      ${pr ? `<div class="card"><div class="row">${svg("i-trophy")}<span class="k">Личный рекорд</span><span class="v">${pr.weight > 0 ? pr.weight + " кг × " + pr.reps : pr.reps + " повт."}</span></div></div>` : ""}
      ${info.tips ? `<div class="card" style="margin-top:10px"><div class="row"><span style="color:var(--accent)">${svg("i-info")}</span><span style="font-size:14px;line-height:1.5">${esc(info.tips)}</span></div></div>` : ""}`;
    openSheet(dom.infoOverlay, dom.sheetEx);
  }

  function bestFor(exId) {
    let best = null;
    state.history.forEach((h) => (h.items || []).forEach((it) => {
      if (it.exercise_id !== exId) return;
      (it.sets || []).forEach((s) => {
        if (!s.done) return;
        const w = num(s.weight), r = num(s.reps);
        if (!best || w > best.weight || (w === best.weight && r > best.reps)) best = { weight: w, reps: r };
      });
    }));
    return best;
  }

  /* ================= ТРЕНИРОВКА ================= */
  function lastWeight(exId) {
    for (let i = state.history.length - 1; i >= 0; i--) {
      const it = (state.history[i].items || []).find((x) => x.exercise_id === exId);
      if (it) {
        const done = (it.sets || []).filter((s) => s.done && num(s.weight) > 0);
        if (done.length) return num(done[done.length - 1].weight);
      }
    }
    return 0;
  }

  function startWorkout(dayIdx) {
    const p = state.plan;
    if (!p) return;
    const di = dayIdx === undefined ? state.day : dayIdx;
    const day = (p.days || [])[di];
    if (!day || !(day.items || []).length) { hud("В этом дне нет упражнений"); return; }

    state.workout = {
      planId: p.id, planTitle: p.title, dayTitle: day.title || `День ${di + 1}`,
      startedAt: Date.now(), items: day.items.map((it) => ({
        exercise_id: it.exercise_id, name: it.name, muscle: it.muscle,
        rest_sec: it.rest_sec || 60,
        sets: Array.from({ length: it.sets || 3 }, () => ({
          weight: lastWeight(it.exercise_id) || 0,
          reps: num(String(it.reps).match(/\d+/)) || 10,
          done: false,
        })),
      })),
      restTimer: null, restLeft: 0, tick: null,
    };

    dom.workoutAbTitle.textContent = p.title;
    dom.workoutSub.textContent = state.workout.dayTitle;
    renderWorkout();
    navigate("workout");

    clearInterval(state.workout.tick);
    state.workout.tick = setInterval(tickWorkout, 1000);
    tickWorkout();
  }

  function tickWorkout() {
    const w = state.workout;
    if (!w) return;
    const el = dom.workoutTimer && dom.workoutTimer.querySelector("span");
    if (el) {
      const s = Math.floor((Date.now() - w.startedAt) / 1000);
      el.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    }
    if (w.restLeft > 0) {
      w.restLeft--;
      const bar = $("#rest-bar");
      if (bar) {
        const b = bar.querySelector("b");
        if (b) b.textContent = `${String(Math.floor(w.restLeft / 60)).padStart(2, "0")}:${String(w.restLeft % 60).padStart(2, "0")}`;
        if (w.restLeft === 0) { hud("Отдых закончен"); setTimeout(() => bar.remove(), 1200); }
      }
    }
  }

  function renderWorkout() {
    const w = state.workout;
    if (!w) return;
    dom.workoutScroll.innerHTML = w.items.map((it, ei) => {
      const color = MUSCLE_COLOR[it.muscle] || "#64748B";
      return `<div class="w-ex rise" style="--i:${ei}" data-exi="${ei}">
        <div class="w-ex-head">
          ${tile("i-dumbbell", color, true)}
          <div class="w-name">${esc(it.name)}</div>
          <div class="w-target">${it.sets.length} × ${it.sets[0] ? it.sets[0].reps : ""}</div>
        </div>
        <div class="w-sets">
          <div class="w-col-labels"><span></span><span>кг</span><span>повт</span><span></span></div>
          ${it.sets.map((s, si) => `
            <div class="w-set ${s.done ? "done" : ""}" data-set="${si}">
              <span class="w-set-num">${si + 1}</span>
              <input class="w-inp" type="number" inputmode="decimal" step="0.5" min="0" data-f="weight" value="${s.weight || ""}" placeholder="0">
              <input class="w-inp" type="number" inputmode="numeric" min="0" data-f="reps" value="${s.reps || ""}" placeholder="—">
              <button class="w-check ${s.done ? "on" : ""}" data-check="${si}" aria-label="Готово">${svg("i-check")}</button>
            </div>`).join("")}
        </div>
      </div>`;
    }).join("");

    dom.workoutScroll.querySelectorAll(".w-inp").forEach((inp) =>
      inp.addEventListener("input", () => {
        const box = inp.closest("[data-exi]"), setEl = inp.closest("[data-set]");
        const ei = Number(box.dataset.exi), si = Number(setEl.dataset.set);
        const s = state.workout.items[ei].sets[si];
        if (inp.dataset.f === "weight") s.weight = num(inp.value);
        else s.reps = num(inp.value);
      }));

    dom.workoutScroll.querySelectorAll("[data-check]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const box = btn.closest("[data-exi]"), setEl = btn.closest("[data-set]");
        const ei = Number(box.dataset.exi), si = Number(setEl.dataset.set);
        const it = state.workout.items[ei], s = it.sets[si];
        s.done = !s.done;
        setEl.classList.toggle("done", s.done);
        btn.classList.toggle("on", s.done);
        if (s.done) startRest(it.rest_sec);
      }));
  }

  function startRest(sec) {
    const w = state.workout;
    if (!w) return;
    let bar = $("#rest-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "rest-bar";
      bar.className = "rest-bar";
      bar.innerHTML = `<b>00:00</b><span>Отдых</span><button id="rest-skip">Пропустить</button>`;
      dom.workoutScroll.appendChild(bar);
      bar.querySelector("#rest-skip").addEventListener("click", () => {
        w.restLeft = 0;
        const b = bar.querySelector("b");
        if (b) b.textContent = "00:00";
        bar.remove();
      });
    }
    w.restLeft = sec;
    const b = bar.querySelector("b");
    if (b) b.textContent = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
    bar.querySelector("span").textContent = `Отдых ${fmtRest(sec)}`;
  }

  function workoutSummary() {
    const w = state.workout;
    let volume = 0, setsDone = 0, reps = 0;
    w.items.forEach((it) => it.sets.forEach((s) => {
      if (!s.done) return;
      setsDone++;
      reps += num(s.reps);
      volume += num(s.weight) * num(s.reps);
    }));
    return { volume: Math.round(volume), setsDone, reps };
  }

  async function finishWorkout() {
    const w = state.workout;
    if (!w) return;
    const sum = workoutSummary();
    if (sum.setsDone === 0) {
      const ok = await showAlert({
        title: "Нет отмеченных подходов",
        message: "Отметь галочкой хотя бы один подход или выйди без сохранения.",
        actions: [{ label: "Отмена", value: false }, { label: "Выйти", value: true, danger: true }],
      });
      if (!ok) return;
      cancelWorkout(true);
      return;
    }
    const entry = {
      id: newId(),
      planId: w.planId, planTitle: w.planTitle, dayTitle: w.dayTitle,
      date: todayISO(), finishedAt: new Date().toISOString(),
      durationSec: Math.floor((Date.now() - w.startedAt) / 1000),
      items: w.items.map((it) => ({
        exercise_id: it.exercise_id, name: it.name, muscle: it.muscle,
        sets: it.sets.map((s) => ({ weight: num(s.weight), reps: num(s.reps), done: !!s.done })),
      })),
      volume: sum.volume, setsDone: sum.setsDone, repsTotal: sum.reps,
    };
    state.history.push(entry);
    writeHistory();
    stopWorkoutTimers();
    state.workout = null;
    renderHome();
    renderStats();
    navigate("stats");
    hud(`Тренировка сохранена · ${(sum.volume / 1000).toFixed(1)} т`);
  }

  function cancelWorkout(silent) {
    const doCancel = () => {
      stopWorkoutTimers();
      state.workout = null;
      if (state.plan) openPlan(state.plan.id); else navigate("home");
    };
    if (silent) return doCancel();
    showAlert({
      title: "Прервать тренировку?",
      message: "Отмеченные подходы не сохранятся.",
      actions: [{ label: "Продолжить", value: false }, { label: "Прервать", value: true, danger: true }],
    }).then((ok) => { if (ok) doCancel(); });
  }

  function stopWorkoutTimers() {
    const w = state.workout;
    if (w && w.tick) clearInterval(w.tick);
    const bar = $("#rest-bar");
    if (bar) bar.remove();
  }

  /* ================= ПРОГРЕСС ================= */
  function streakDays() {
    const days = new Set(state.history.map((h) => h.date));
    if (!days.size) return 0;
    let streak = 0;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (!days.has(isoOf(d))) d.setDate(d.getDate() - 1);
    while (days.has(isoOf(d))) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }
  function isoOf(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function renderStats() {
    const h = state.history;
    dom.statsEmpty.hidden = h.length > 0;
    const vol = h.reduce((a, x) => a + (x.volume || 0), 0) / 1000;
    dom.statTotal.textContent = h.length;
    dom.statStreak.textContent = streakDays();
    dom.statVolume.textContent = round1(vol);

    // Бары: последние 6 недель
    const weeks = [];
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now); monday.setDate(now.getDate() - dow);
    for (let i = 5; i >= 0; i--) {
      const start = new Date(monday); start.setDate(monday.getDate() - i * 7);
      const end = new Date(start); end.setDate(start.getDate() + 7);
      const v = h.filter((x) => {
        const d = new Date(x.finishedAt || x.date);
        return d >= start && d < end;
      }).reduce((a, x) => a + (x.volume || 0), 0) / 1000;
      weeks.push({ v, label: i === 0 ? "тек" : "-" + i });
    }
    const maxV = Math.max(...weeks.map((w) => w.v), 1);
    dom.statsBars.innerHTML = weeks.map((w) => `
      <div class="bar">
        <span class="bar-val">${w.v ? round1(w.v) : ""}</span>
        <div class="bar-fill ${w.v ? "" : "zero"}" style="height:${Math.max(3, (w.v / maxV) * 100)}%"></div>
        <span class="bar-label">${w.label}</span>
      </div>`).join("");

    // Рекорды
    const best = {};
    h.forEach((x) => (x.items || []).forEach((it) => (it.sets || []).forEach((s) => {
      if (!s.done) return;
      const w = num(s.weight), r = num(s.reps);
      const cur = best[it.exercise_id];
      if (!cur || w > cur.weight || (w === cur.weight && r > cur.reps)) {
        best[it.exercise_id] = { name: it.name, muscle: it.muscle, weight: w, reps: r };
      }
    })));
    const prs = Object.values(best).filter((b) => b.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, 8);
    dom.statsPrs.innerHTML = prs.length
      ? prs.map((b) => `<div class="pr-row">
          <span style="color:var(--accent)">${svg("i-trophy")}</span>
          <span class="ex-muscle">${esc(b.name)}</span>
          <b>${b.weight} кг × ${b.reps}</b>
        </div>`).join("")
      : `<div class="empty" style="padding:22px 14px"><p style="margin:0">Рекорды появятся после первых подходов с весом.</p></div>`;

    // История
    dom.statsHistory.innerHTML = h.slice().reverse().slice(0, 30).map((x) => {
      const d = new Date(x.finishedAt || x.date);
      const dayNum = isNaN(d) ? "—" : d.getDate();
      const mon = isNaN(d) ? "" : d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
      return `<div class="hist-item">
        <div class="hist-date"><b>${dayNum}</b><span>${mon}</span></div>
        <div class="hist-main">
          <b>${esc(x.dayTitle || x.planTitle || "Тренировка")}</b>
          <span>${x.setsDone || 0} подходов · ${Math.round((x.durationSec || 0) / 60)} мин</span>
        </div>
        <div class="hist-vol">${round1((x.volume || 0) / 1000)} т</div>
      </div>`;
    }).join("");
  }

  /* ================= ПРОФИЛЬ ================= */
  function renderProfile() {
    const p = state.profile;
    dom.profileName.value = p.name || "";
    dom.profileAge.value = p.age ?? "";
    dom.profileHeight.value = p.height ?? "";
    dom.profileWeight.value = p.weight ?? "";
    dom.profileAvatar.textContent = (p.name || "G").trim().charAt(0).toUpperCase() || "G";
    dom.profileSub.textContent = [p.age ? p.age + " лет" : "", p.height ? p.height + " см" : "", p.weight ? p.weight + " кг" : ""]
      .filter(Boolean).join(" · ") || "Данные хранятся только на устройстве";
    updateBmi();
    syncSettingsUI();
  }

  function updateBmi() {
    const h = num(state.profile.height), w = num(state.profile.weight);
    if (h > 60 && w > 20) {
      const bmi = w / Math.pow(h / 100, 2);
      dom.profileBmi.textContent = round1(bmi);
      dom.profileBmiNote.textContent =
        bmi < 18.5 ? "недостаток" : bmi < 25 ? "норма" : bmi < 30 ? "избыток" : "ожирение";
    } else {
      dom.profileBmi.textContent = "—";
      dom.profileBmiNote.textContent = "";
    }
  }

  function bindProfile() {
    const save = () => { writeProfile(); renderProfile(); };
    dom.profileName.addEventListener("input", () => {
      state.profile.name = dom.profileName.value.slice(0, 24);
      dom.profileAvatar.textContent = (state.profile.name || "G").trim().charAt(0).toUpperCase() || "G";
      writeProfile();
    });
    dom.profileName.addEventListener("blur", save);
    [["age", dom.profileAge], ["height", dom.profileHeight], ["weight", dom.profileWeight]].forEach(([k, el]) => {
      el.addEventListener("input", () => {
        state.profile[k] = el.value === "" ? "" : num(el.value);
        updateBmi();
        writeProfile();
      });
      el.addEventListener("blur", save);
    });
  }

  /* ================= МАСТЕР ================= */
  const wizLastStep = () => (state.wiz.draft.goal === "custom" ? 1 : 3);

  function openWizard() {
    state.wiz = { step: 0, draft: { goal: null, days_per_week: 3, equipment: "full_gym", title: "" }, busy: false };
    renderWizard();
    openSheet(dom.wizOverlay, dom.sheetWizard);
  }
  function closeWizard() { closeSheet(dom.wizOverlay, dom.sheetWizard); }

  function renderWizard() {
    const { step, draft } = state.wiz;
    const last = wizLastStep();
    for (let i = 1; i <= 4; i++) {
      const d = document.getElementById(`wiz-dot-${i}`);
      if (d) d.classList.toggle("on", i <= step + 1);
    }
    dom.wizNext.textContent = step === last ? (draft.goal === "custom" ? "Начать сборку" : "Создать план") : "Далее";
    dom.wizNext.disabled = (step === 0 && !draft.goal) || state.wiz.busy;

    const titles = draft.goal === "custom"
      ? ["Тип программы", "Сколько дней"]
      : ["Тип программы", "Сколько дней", "Где тренируешься", "Название"];
    let inner = `<div class="title-row">${step > 0 ? `<button class="step-back" aria-label="Назад">${svg("i-chev-l")}</button>` : ""}<h3 class="sheet-title">${titles[step]}</h3></div>`;

    if (step === 0) {
      inner += `<div class="field-label">Что будешь делать</div><div class="card">` +
        Object.entries(GOAL_META).map(([k, v]) => `
          <button class="option ${draft.goal === k ? "sel" : ""}" data-goal="${k}">
            ${tile(v.icon, "var(--accent)")}
            <div class="opt-text"><b>${v.label}</b><span>${v.desc}</span></div>
            <div class="opt-check">${svg("i-check")}</div>
          </button>`).join("") + `</div>`;
    } else if (step === 1) {
      inner += `<div class="field-label">Тренировок в неделю</div>
        <div class="segmented static" id="seg-days">
          ${[2, 3, 4, 5, 6].map((n) => `<button data-days="${n}" class="${draft.days_per_week === n ? "on" : ""}">${n}</button>`).join("")}
        </div>
        <div class="card"><div class="row"><span style="color:var(--accent)">${svg("i-info")}</span><span style="font-size:13.5px;line-height:1.45;color:var(--text2)">${DAYS_HINT[draft.days_per_week] || ""}</span></div></div>`;
    } else if (step === 2) {
      inner += `<div class="field-label">Где тренируешься</div><div class="card">` +
        Object.entries(EQUIP_META).map(([k, v]) => `
          <button class="option ${draft.equipment === k ? "sel" : ""}" data-equip="${k}">
            ${tile(v.icon, "var(--accent)")}
            <div class="opt-text"><b>${v.label}</b><span>${v.desc}</span></div>
            <div class="opt-check">${svg("i-check")}</div>
          </button>`).join("") + `</div>`;
    } else {
      const g = GOAL_META[draft.goal] || GOAL_META.fitness;
      inner += `
        <div class="field-label">Название программы</div>
        <div class="input-card">
          <input id="inp-title" maxlength="60" placeholder="${esc(suggestTitle())}" value="${esc(draft.title)}" autocomplete="off">
          <button class="clear" id="btn-clear-title" aria-label="Очистить">${svg("i-x")}</button>
        </div>
        <div class="field-label">Итог</div>
        <div class="card">
          <div class="row">${svg(g.icon)}<span class="k">Тип</span><span class="v">${g.label}</span></div>
          <div class="row">${svg("i-calendar")}<span class="k">Частота</span><span class="v">${draft.days_per_week} ${dayWord(draft.days_per_week)}</span></div>
          <div class="row">${svg((EQUIP_META[draft.equipment] || {}).icon || "i-building")}<span class="k">Место</span><span class="v">${(EQUIP_META[draft.equipment] || {}).label || ""}</span></div>
        </div>`;
    }

    const wrap = document.createElement("div");
    wrap.className = "step-anim";
    wrap.innerHTML = inner;
    dom.wizBody.innerHTML = "";
    dom.wizBody.appendChild(wrap);
    bindWizard(wrap);
  }

  function suggestTitle() {
    const d = state.wiz.draft;
    const g = GOAL_META[d.goal];
    return `${g ? g.label : "Программа"} · ${d.days_per_week} ${dayWord(d.days_per_week)}`;
  }

  function bindWizard(wrap) {
    wrap.querySelectorAll("[data-goal]").forEach((b) => b.addEventListener("click", () => {
      state.wiz.draft.goal = b.dataset.goal;
      wrap.querySelectorAll("[data-goal]").forEach((x) => x.classList.toggle("sel", x === b));
      dom.wizNext.disabled = false;
      dom.wizNext.textContent = state.wiz.step === wizLastStep()
        ? (b.dataset.goal === "custom" ? "Начать сборку" : "Создать план") : "Далее";
    }));
    wrap.querySelectorAll("[data-days]").forEach((b) => b.addEventListener("click", () => {
      state.wiz.draft.days_per_week = Number(b.dataset.days);
      renderWizard();
    }));
    wrap.querySelectorAll("[data-equip]").forEach((b) => b.addEventListener("click", () => {
      state.wiz.draft.equipment = b.dataset.equip;
      wrap.querySelectorAll("[data-equip]").forEach((x) => x.classList.toggle("sel", x === b));
      dom.wizNext.disabled = false;
    }));
    const inp = wrap.querySelector("#inp-title");
    if (inp) {
      inp.addEventListener("input", () => { state.wiz.draft.title = inp.value; });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") submitWizard(); });
      setTimeout(() => inp.focus({ preventScroll: true }), 400);
      wrap.querySelector("#btn-clear-title").addEventListener("click", () => {
        inp.value = ""; state.wiz.draft.title = ""; inp.focus();
      });
    }
  }

  function submitWizard() {
    const d = state.wiz.draft;
    if (!d.goal) return;
    if (d.goal === "custom") {
      closeWizard();
      openBuilder(null, d.days_per_week);
      return;
    }
    if (!state.exercises.length) { hud("Каталог упражнений не загружен"); return; }
    state.wiz.busy = true;
    dom.wizNext.disabled = true;
    dom.wizNext.textContent = "Собираю…";

    setTimeout(() => {
      try {
        const built = GymPlanner.build(state.exercises, {
          goal: d.goal, level: "intermediate", days_per_week: d.days_per_week,
          equipment: d.equipment, seed: Math.floor(Math.random() * 1e9),
        });
        if (!built.days.some((x) => x.items.length)) { hud("Под этот инвентарь упражнений не нашлось"); return; }
        const plan = Object.assign(
          { id: newId(), title: (d.title || "").trim() || suggestTitle(), created_at: new Date().toISOString() },
          built);
        state.plans = [plan, ...state.plans];
        writePlans(); renderHome(); closeWizard(); openPlan(plan.id);
        hud("Программа готова");
      } catch (e) {
        showAlert({ title: "Ошибка", message: String((e && e.message) || e), actions: [{ label: "Закрыть" }] });
      } finally {
        state.wiz.busy = false;
        dom.wizNext.textContent = "Создать план";
        dom.wizNext.disabled = false;
      }
    }, 380);
  }

  /* ================= КОНСТРУКТОР ================= */
  function openBuilder(plan, nDays) {
    state.build = plan ? JSON.parse(JSON.stringify(plan)) : GymPlanner.emptyPlan(null, nDays || 1);
    state.buildDay = 0;
    dom.buildInpTitle.value = state.build.title || "";
    dom.buildTitle.textContent = state.build.title || "Своя программа";
    renderBuilder();
    navigate("build");
  }

  function renderBuilder() {
    const b = state.build;
    if (!b) return;
    dom.buildDayTabs.innerHTML = (b.days || []).map((d, i) =>
      `<button data-bd="${i}" class="${i === state.buildDay ? "on" : ""}">${i + 1}</button>`).join("");
    dom.buildDayTabs.querySelectorAll("[data-bd]").forEach((btn) =>
      btn.addEventListener("click", () => { state.buildDay = Number(btn.dataset.bd); renderBuilder(); }));
    renderBuildDay();
  }

  function renderBuildDay() {
    const b = state.build;
    const day = (b.days || [])[state.buildDay];
    if (!day) { dom.buildScroll.innerHTML = ""; return; }
    const items = (day.items || []).map((it, i) => {
      const color = MUSCLE_COLOR[it.muscle] || "#64748B";
      return `<div class="build-row rise" style="--i:${i}" data-bi="${i}">
        <div class="build-row-head">
          ${tile("i-dumbbell", color, true)}
          <div class="build-row-info">
            <div class="ex-name">${esc(it.name)}</div>
            <div class="ex-muscle">${esc(it.muscle)}</div>
          </div>
          <div class="row-move">
            <button data-move="up" data-mi="${i}" aria-label="Выше">${svg("i-up")}</button>
            <button data-move="down" data-mi="${i}" aria-label="Ниже">${svg("i-down")}</button>
          </div>
        </div>
        <div class="build-row-controls">
          <div class="b-stepper">
            <button class="b-step" data-bact="dec" data-bi="${i}" data-bf="sets">${svg("i-minus")}</button>
            <input class="b-inp" type="number" min="1" max="20" value="${it.sets}" data-bi="${i}" data-bf="sets">
            <button class="b-step" data-bact="inc" data-bi="${i}" data-bf="sets">${svg("i-plus")}</button>
          </div>
          <input class="b-inp b-reps" type="text" value="${esc(it.reps)}" placeholder="10–12" data-bi="${i}" data-bf="reps">
          <div class="b-stepper">
            <button class="b-step" data-bact="dec" data-bi="${i}" data-bf="rest_sec">${svg("i-minus")}</button>
            <input class="b-inp" type="number" min="10" max="600" step="15" value="${it.rest_sec}" data-bi="${i}" data-bf="rest_sec">
            <button class="b-step" data-bact="inc" data-bi="${i}" data-bf="rest_sec">${svg("i-plus")}</button>
          </div>
          <button class="b-del" data-bi="${i}" aria-label="Удалить">${svg("i-x")}</button>
        </div>
      </div>`;
    }).join("");

    dom.buildScroll.innerHTML = `
      <h3 class="section-label" style="margin:14px 2px 9px">${esc(day.title || `День ${state.buildDay + 1}`)} · ${(day.items || []).length} ${exWord((day.items || []).length)}</h3>
      <div class="build-list">${items || `<div class="card empty" style="padding:30px 14px"><p style="margin:0">Нажми «Добавить упражнение»</p></div>`}</div>`;

    dom.buildScroll.querySelectorAll("[data-bact]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.bi), field = btn.dataset.bf;
        const step = btn.dataset.bact === "inc" ? 1 : -1;
        const it = state.build.days[state.buildDay].items[idx];
        if (!it) return;
        if (field === "sets") it.sets = Math.max(1, Math.min(20, it.sets + step));
        if (field === "rest_sec") it.rest_sec = Math.max(10, Math.min(600, it.rest_sec + step * 15));
        renderBuildDay();
      }));

    dom.buildScroll.querySelectorAll(".b-inp").forEach((inp) =>
      inp.addEventListener("change", () => {
        const idx = Number(inp.dataset.bi), field = inp.dataset.bf;
        const it = state.build.days[state.buildDay].items[idx];
        if (!it) return;
        if (field === "sets") it.sets = Math.max(1, Math.min(20, Number(inp.value) || 3));
        if (field === "reps") it.reps = inp.value.trim() || "10–12";
        if (field === "rest_sec") it.rest_sec = Math.max(10, Math.min(600, Number(inp.value) || 60));
        renderBuildDay();
      }));

    dom.buildScroll.querySelectorAll(".b-del").forEach((btn) =>
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.bi);
        const day2 = state.build.days[state.buildDay];
        if (day2 && day2.items) { day2.items.splice(idx, 1); renderBuildDay(); }
      }));

    dom.buildScroll.querySelectorAll("[data-move]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.mi);
        const arr = state.build.days[state.buildDay].items;
        const to = btn.dataset.move === "up" ? idx - 1 : idx + 1;
        if (to < 0 || to >= arr.length) return;
        const tmp = arr[idx]; arr[idx] = arr[to]; arr[to] = tmp;
        renderBuildDay();
      }));
  }

  /* ================= ПАЛИТРА ================= */
  function openPicker() {
    state.pick = { q: "", muscle: "all" };
    dom.pickSearch.value = "";
    renderPicker();
    openSheet(dom.pickOverlay, dom.sheetPick);
  }

  function renderPicker() {
    const muscles = ["all", ...Object.keys(MUSCLE_COLOR)];
    dom.pickFilters.innerHTML = muscles.map((m) =>
      `<button class="chip ${state.pick.muscle === m ? "on" : ""}" data-mf="${esc(m)}">${m === "all" ? "Все" : esc(m)}</button>`).join("");
    dom.pickFilters.querySelectorAll("[data-mf]").forEach((b) =>
      b.addEventListener("click", () => { state.pick.muscle = b.dataset.mf; renderPicker(); }));

    let list = state.exercises;
    if (state.pick.muscle !== "all") list = list.filter((e) => e.muscle === state.pick.muscle);
    if (state.pick.q) {
      const q = state.pick.q.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q));
    }

    const used = new Set(((state.build.days[state.buildDay] || {}).items || []).map((x) => x.exercise_id));
    dom.pickList.innerHTML = list.slice(0, 90).map((ex, i) => {
      const color = MUSCLE_COLOR[ex.muscle] || "#64748B";
      const added = used.has(ex.id);
      return `<div class="pick-row rise" style="--i:${i};opacity:${added ? .45 : 1}" data-pe="${esc(ex.id)}">
        ${tile("i-dumbbell", color, true)}
        <div class="pick-info"><div class="ex-name">${esc(ex.name)}</div><div class="ex-muscle">${esc(ex.muscle)}</div></div>
        <button class="pick-add">${svg(added ? "i-check" : "i-plus")}</button>
      </div>`;
    }).join("");
    if (!list.length) dom.pickList.innerHTML = `<div class="empty" style="padding:40px 0"><p>Ничего не найдено</p></div>`;

    dom.pickList.querySelectorAll("[data-pe]").forEach((el) =>
      el.addEventListener("click", () => {
        const ex = state.exMap.get(el.dataset.pe);
        if (!ex) return;
        const day = state.build.days[state.buildDay];
        if (day.items.some((it) => it.exercise_id === ex.id)) { hud("Уже в этом дне"); return; }
        day.items.push(GymPlanner.fromCatalog(ex));
        renderBuildDay();
        renderPicker();
      }));
  }

  /* ================= ГАЙД ================= */
  const GUIDE = {
    ios: {
      steps: [
        "Открой сайт в <b>Safari</b> (в браузере из Telegram/VK кнопки не будет).",
        "Нажми <b>«Поделиться»</b> — квадрат со стрелкой вверх в нижней панели.",
        "Пролистай меню и выбери <b>«На экран Домой»</b>.",
        "Подтверди — GymBro появится среди приложений и откроется во весь экран.",
      ],
      note: "Работает на iOS 12.2+. Программа доступна офлайн — даже без интернета в зале.",
    },
    android: {
      steps: [
        "Открой сайт в <b>Chrome</b>.",
        "Нажми <b>⋮</b> (три точки) в правом верхнем углу.",
        "Выбери <b>«Установить приложение»</b> или «Добавить на главный экран».",
        "Подтверди — появится иконка GymBro без адресной строки.",
      ],
      note: "Если пункта «Установить» нет — обнови Chrome или используй «Добавить на главный экран».",
    },
    desktop: {
      steps: [
        "Открой сайт в <b>Chrome</b> или <b>Edge</b>.",
        "В адресной строке справа нажми иконку <b>монитора со стрелкой</b> — «Установить».",
        "Или меню <b>⋮</b> → «Готово к установке» → «Установить GymBro».",
        "Приложение откроется в отдельном окне и добавится в меню Пуск.",
      ],
      note: "На macOS в Chrome/Edge аналогично; в Safari: Файл → «Добавить в Dock».",
    },
  };

  function openGuide(plat) {
    state.guideTab = plat || state.guideTab || "ios";
    renderGuide();
    openSheet(dom.guideOverlay, dom.sheetGuide);
  }
  function closeGuide() { closeSheet(dom.guideOverlay, dom.sheetGuide); }

  function renderGuide() {
    const key = state.guideTab || "ios";
    dom.guideTabs.querySelectorAll("[data-gp]").forEach((b) => b.classList.toggle("on", b.dataset.gp === key));
    const g = GUIDE[key];
    dom.guideBody.innerHTML = `
      <div class="step-anim">
        <h3 class="sheet-title">На рабочий стол</h3>
        <ol class="guide-steps">${g.steps.map((s, i) => `<li><span class="guide-num">${i + 1}</span><div>${s}</div></li>`).join("")}</ol>
        <div class="guide-note">${svg("i-info")}<span>${g.note}</span></div>
      </div>`;
  }

  /* ================= ПОДЕЛИТЬСЯ ================= */
  function planToText(p) {
    const L = [];
    L.push(`${p.title}`);
    const g = GOAL_META[p.goal] || {};
    L.push(`${g.label || p.goal} · ${p.days_per_week} ${dayWord(p.days_per_week)} · ${(EQUIP_META[p.equipment] || {}).label || p.equipment}`);
    L.push("");
    (p.days || []).forEach((d) => {
      L.push(`День ${d.day_num}. ${d.title}`);
      (d.items || []).forEach((it) => L.push(`• ${it.name} — ${it.sets}×${it.reps}, отдых ${fmtRest(it.rest_sec)}`));
      L.push("");
    });
    return L.join("\n").trim();
  }

  async function sharePlan() {
    const p = state.plan;
    if (!p) return;
    const text = planToText(p);
    if (navigator.share) {
      try { await navigator.share({ title: p.title, text }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text); hud("Скопировано"); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;top:-1000px";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); hud("Скопировано"); } catch (e2) { hud("Не удалось скопировать"); }
      document.body.removeChild(ta);
    }
  }

  async function deletePlan() {
    const p = state.plan;
    if (!p) return;
    const ok = await showAlert({
      title: "Удалить программу?",
      message: `«${p.title}» будет удалена с этого устройства. История тренировок останется.`,
      icon: "i-trash",
      actions: [{ label: "Отмена", value: false }, { label: "Удалить", value: true, danger: true }],
    });
    if (!ok) return;
    state.plans = state.plans.filter((x) => x.id !== p.id);
    writePlans(); state.plan = null;
    renderHome(); navigate("home"); hud("Удалено");
  }

  /* ================= ОБРАБОТЧИКИ ================= */
  $("#btn-new-plan").addEventListener("click", openWizard);
  $("#btn-empty-new").addEventListener("click", openWizard);
  $("#btn-catalog-home").addEventListener("click", openCatalog);
  $("#btn-install-home").addEventListener("click", () => openGuide(
    /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" :
    /Android/.test(navigator.userAgent) ? "android" : "desktop"));

  $("#btn-catalog-back").addEventListener("click", () => {
    if (state.catalogSel) { state.catalogSel = null; renderCatalog(); navigate("catalog"); }
    else navigate("home");
  });
  $("#btn-prog-add").addEventListener("click", () => {
    const pr = state.programs.find((x) => x.id === state.catalogSel);
    if (pr) importProgram(pr);
  });

  $("#btn-back-home").addEventListener("click", () => { state.plan = null; navigate("home"); });
  $("#btn-share-plan").addEventListener("click", sharePlan);
  $("#btn-delete-plan").addEventListener("click", deletePlan);
  $("#btn-edit-plan").addEventListener("click", () => { if (state.plan) openBuilder(state.plan); });
  $("#btn-start-workout").addEventListener("click", () => startWorkout());

  $("#btn-workout-cancel").addEventListener("click", () => cancelWorkout(false));
  $("#btn-workout-finish").addEventListener("click", finishWorkout);

  dom.planViewToggle.querySelectorAll("[data-pv]").forEach((b) =>
    b.addEventListener("click", () => {
      state.view = b.dataset.pv;
      dom.planViewToggle.querySelectorAll("[data-pv]").forEach((x) => x.classList.toggle("on", x === b));
      renderPlan();
    }));

  dom.buildInpTitle.addEventListener("input", () => {
    state.build.title = dom.buildInpTitle.value;
    dom.buildTitle.textContent = state.build.title || "Своя программа";
  });
  $("#btn-clear-build-title").addEventListener("click", () => {
    dom.buildInpTitle.value = ""; state.build.title = "";
    dom.buildTitle.textContent = "Своя программа";
    dom.buildInpTitle.focus();
  });
  $("#btn-build-back").addEventListener("click", () => {
    if (state.plan) openPlan(state.plan.id); else navigate("home");
  });
  $("#btn-build-save").addEventListener("click", () => {
    const b = state.build;
    if (!b) return;
    b.days_per_week = b.days.length;
    const idx = state.plans.findIndex((p) => p.id === b.id);
    if (idx >= 0) state.plans[idx] = b; else state.plans = [b, ...state.plans];
    writePlans(); renderHome();
    state.plan = b;
    openPlan(b.id);
    hud("Сохранено");
  });
  $("#btn-build-add-ex").addEventListener("click", openPicker);
  $("#btn-build-add-day").addEventListener("click", () => {
    const b = state.build;
    if (b.days.length >= 7) { hud("Максимум 7 дней"); return; }
    const n = b.days.length + 1;
    b.days.push({ day_num: n, title: "День " + n, items: [] });
    state.buildDay = b.days.length - 1;
    renderBuilder();
  });
  $("#btn-build-copy-day").addEventListener("click", () => {
    const b = state.build;
    if (b.days.length >= 7) { hud("Максимум 7 дней"); return; }
    const src = b.days[state.buildDay];
    const copy = JSON.parse(JSON.stringify(src));
    copy.day_num = b.days.length + 1;
    copy.title = src.title + " (копия)";
    b.days.push(copy);
    state.buildDay = b.days.length - 1;
    renderBuilder();
    hud("День скопирован");
  });
  $("#btn-build-del-day").addEventListener("click", async () => {
    const b = state.build;
    if (b.days.length <= 1) { hud("Нужен хотя бы один день"); return; }
    const ok = await showAlert({
      title: "Удалить день?",
      message: `«${b.days[state.buildDay].title}» и все его упражнения будут удалены.`,
      icon: "i-trash",
      actions: [{ label: "Отмена", value: false }, { label: "Удалить", value: true, danger: true }],
    });
    if (!ok) return;
    b.days.splice(state.buildDay, 1);
    b.days.forEach((d, i) => { d.day_num = i + 1; });
    state.buildDay = Math.min(state.buildDay, b.days.length - 1);
    renderBuilder();
  });

  dom.pickSearch.addEventListener("input", () => { state.pick.q = dom.pickSearch.value.trim(); renderPicker(); });
  $("#btn-clear-pick-search").addEventListener("click", () => { dom.pickSearch.value = ""; state.pick.q = ""; renderPicker(); dom.pickSearch.focus(); });
  $("#btn-pick-done").addEventListener("click", () => closeSheet(dom.pickOverlay, dom.sheetPick));
  dom.pickOverlay.addEventListener("click", () => closeSheet(dom.pickOverlay, dom.sheetPick));

  $("#btn-close-info").addEventListener("click", () => closeSheet(dom.infoOverlay, dom.sheetEx));
  dom.infoOverlay.addEventListener("click", () => closeSheet(dom.infoOverlay, dom.sheetEx));

  dom.wizNext.addEventListener("click", () => {
    const w = state.wiz;
    if (w.step === 0 && !w.draft.goal) return;
    if (w.step === wizLastStep()) return submitWizard();
    w.step++; renderWizard();
  });
  dom.wizBody.addEventListener("click", (e) => {
    if (e.target.closest(".step-back")) { state.wiz.step = Math.max(0, state.wiz.step - 1); renderWizard(); }
  });
  dom.wizCancel.addEventListener("click", closeWizard);
  dom.wizOverlay.addEventListener("click", closeWizard);

  dom.guideTabs.querySelectorAll("[data-gp]").forEach((b) =>
    b.addEventListener("click", () => { state.guideTab = b.dataset.gp; renderGuide(); }));
  $("#btn-close-guide").addEventListener("click", closeGuide);
  dom.guideOverlay.addEventListener("click", closeGuide);
  $("#btn-open-guide").addEventListener("click", () => openGuide());

  $$("[data-th]").forEach((b) => b.addEventListener("click", () => {
    state.settings.theme = b.dataset.th;
    writeSettings(); applyTheme();
  }));
  $("#sw-anim").addEventListener("click", () => {
    state.settings.anim = !state.settings.anim;
    writeSettings(); applyTheme();
  });
  $("#btn-reset-data").addEventListener("click", async () => {
    const ok = await showAlert({
      title: "Удалить все данные?",
      message: "Программы, история тренировок и профиль будут стёрты безвозвратно.",
      icon: "i-trash",
      actions: [{ label: "Отмена", value: false }, { label: "Удалить всё", value: true, danger: true }],
    });
    if (!ok) return;
    [KEYS.plans, KEYS.history, KEYS.profile].forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });
    location.reload();
  });

  /* ================= ДАННЫЕ ================= */
  async function loadExercises() {
    try {
      const res = await fetch("./data/exercises.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      state.exercises = data.exercises || [];
      state.exMap = new Map(state.exercises.map((e) => [String(e.id), e]));
    } catch (e) { hud("Не удалось загрузить каталог упражнений"); }
  }
  async function loadPrograms() {
    try {
      const res = await fetch("./data/programs.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      state.programs = data.programs || [];
    } catch (e) { /* не критично */ }
  }

  async function boot() {
    readSettings(); readProfile(); applyTheme();
    bindProfile();
    state.plans = readPlans().map(migratePlan);
    state.history = readHistory();
    renderHome();
    navigate("home");
    await Promise.all([loadExercises(), loadPrograms()]);
    renderHome();
  }

  boot();
})();
