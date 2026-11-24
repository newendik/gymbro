/* GymBro — клиентская логика. */
(() => {
  "use strict";

  /* ============ Метаданные ============ */
  const GOAL_META = {
    power:  { label: "Силовые",       icon: "i-barbell", grad: "linear-gradient(135deg,#5E5CE6,#BF5AF2)", desc: "Периодизация: тяжёлые / средние / лёгкие недели" },
    fitness:{ label: "Фитнес",        icon: "i-heart",   grad: "linear-gradient(135deg,#30D158,#0FB5A3)", desc: "Много повторов, короткий отдых — тонус" },
    custom: { label: "Своя программа", icon: "i-pencil",  grad: "linear-gradient(135deg,#FF9500,#FFD60A)", desc: "Собираешь сам: упражнения, подходы, повторы" },
  };
  const LEVEL_META = {
    beginner:     { label: "Новичок",     icon: "i-sprout", desc: "До года опыта · меньше упражнений" },
    intermediate: { label: "Средний",     icon: "i-chart",  desc: "1–3 года · сбалансированный объём" },
    advanced:     { label: "Продвинутый", icon: "i-zap",    desc: "3+ года · максимальный объём" },
  };
  const EQUIP_META = {
    full_gym: { label: "Полный зал", icon: "i-building", desc: "Штанги, тренажёры, блоки" },
    dumbbell: { label: "Гантели",    icon: "i-dumbbell", desc: "Гантели и собственный вес" },
    home:     { label: "Дома",       icon: "i-home",     desc: "Свой вес, гантели, резинки" },
  };
  const EX_EQUIP_LABEL = { full_gym: "Полный зал", dumbbell: "Гантели", no_equipment: "Свой вес", band: "Резинки" };
  const DAYS_HINT = {
    2: "Верх / Низ — два сбалансированных дня.",
    3: "Жим · Тяга · Ноги — золотой стандарт.",
    4: "Четыре фокусных дня: грудь, спина, ноги, плечи.",
    5: "Пять дней — каждая группа отдельно.",
    6: "Максимальная частота: 6 узких дней.",
  };
  const MUSCLE_COLOR = {
    "Грудь": "#FF3B30", "Спина": "#5E5CE6", "Плечи": "#FF9500", "Квадрицепс": "#0FB5A3",
    "Бицепс бедра": "#BF5AF2", "Ягодицы": "#FF2D55", "Бицепс": "#30D158",
    "Трицепс": "#32ADE6", "Пресс": "#D9A000", "Икры": "#8E8E93",
  };
  const STORE_KEY = "gymbro.plans";

  /* ============ Состояние ============ */
  const state = {
    exercises: [], exMap: new Map(),
    plans: [],
    plan: null,
    day: 0,
    view: "days",   /* days | weeks */
    wiz: { step: 0, draft: { goal: null, level: null, days_per_week: 3, equipment: "full_gym", title: "" }, busy: false },
    build: null,     /* копия плана в редакторе */
    buildDay: 0,
    pick: { q: "", muscle: "all" },
  };

  /* ============ DOM ============ */
  const $ = (s) => document.querySelector(s);
  const dom = {
    home: $("#screen-home"), plan: $("#screen-plan"), build: $("#screen-build"),
    greeting: $("#greeting"), today: $("#today-chip"),
    homeEmpty: $("#home-empty"), plansSection: $("#plans-section"), plansList: $("#plans-list"),
    wizOverlay: $("#wiz-overlay"), sheetWizard: $("#sheet-wizard"), wizBody: $("#wizard-body"),
    wizNext: $("#wiz-next"), wizCancel: $("#wiz-cancel"),
    planAbTitle: $("#plan-ab-title"), planHero: $("#plan-hero"),
    dayTabs: $("#day-tabs"), waveTabs: $("#wave-tabs"), planScroll: $("#plan-scroll"),
    planViewToggle: $("#plan-view-toggle"),
    infoOverlay: $("#info-overlay"), sheetEx: $("#sheet-exercise"), exBody: $("#exercise-body"),
    alertWrap: $("#alert-wrap"), alertIcon: $("#alert-icon"), alertTitle: $("#alert-title"),
    alertMsg: $("#alert-msg"), alertActions: $("#alert-actions"),
    hud: $("#hud"), hudText: $("#hud-text"),
    buildAbTitle: $("#build-title"), buildInpTitle: $("#inp-build-title"),
    buildDayTabs: $("#build-day-tabs"), buildScroll: $("#build-scroll"),
    pickOverlay: $("#pick-overlay"), sheetPick: $("#sheet-pick"),
    pickSearch: $("#inp-pick-search"), pickFilters: $("#pick-muscle-filters"), pickList: $("#pick-list"),
  };

  /* ============ Утилиты ============ */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const svg = (id, cls = "ic") => `<svg class="${cls}"><use href="#${id}"/></svg>`;

  const tile = (iconId, color, sm) =>
    `<div class="tile${sm ? " sm" : ""}" style="background:${color}">${svg(iconId)}</div>`;

  const fmtRest = (sec) => {
    if (!sec) return "—";
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? (s ? `${m} мин ${s} с` : `${m} мин`) : `${s} с`;
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
    if (isNaN(d)) return "";
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  };
  const fmtShortDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  };

  /* ============ HUD / Alert ============ */
  let hudTimer;
  function hud(text) {
    dom.hudText.textContent = text;
    dom.hud.hidden = false;
    requestAnimationFrame(() => dom.hud.classList.add("open"));
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => {
      dom.hud.classList.remove("open");
      setTimeout(() => (dom.hud.hidden = true), 320);
    }, 2600);
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
        setTimeout(() => (dom.alertWrap.hidden = true), 300);
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
    setTimeout(() => { overlay.hidden = true; sheet.hidden = true; }, 480);
  }

  /* ============ Миграция старых целей ============ */
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

  /* ============ Хранилище ============ */
  function readStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.plans.slice(0, 100)));
    } catch (e) {
      hud("Память браузера переполнена");
    }
  }

  const newId = () => GymPlanner.newId();

  /* ============ Экраны ============ */
  function showScreen(which) {
    dom.home.hidden = which !== "home";
    dom.plan.hidden = which !== "plan";
    dom.build.hidden = which !== "build";
    window.scrollTo(0, 0);
    if (which === "plan") dom.planScroll.scrollTop = 0;
    if (which === "build") dom.buildScroll.scrollTop = 0;
  }

  /* ============ Главная ============ */
  function renderHome() {
    dom.homeEmpty.hidden = state.plans.length > 0;
    dom.plansSection.hidden = state.plans.length === 0;
    dom.plansList.innerHTML = state.plans.map((p, i) => {
      const g = GOAL_META[p.goal] || GOAL_META.fitness;
      const items = (p.days || []).reduce((a, d) => a + ((d.items || []).length), 0);
      return `
      <button class="cell rise" style="--i:${i}" data-plan="${esc(p.id)}">
        ${tile(g.icon, g.grad)}
        <div class="cell-main">
          <div class="t1">${esc(p.title)}</div>
          <div class="t2">${p.days_per_week} ${dayWord(p.days_per_week)} · ${items} ${exWord(items)}</div>
        </div>
        <span class="chev">${svg("i-chev-r")}</span>
      </button>`;
    }).join("");
    dom.plansList.querySelectorAll("[data-plan]").forEach((b) =>
      b.addEventListener("click", () => openPlan(b.dataset.plan)));
  }

  /* ============ Просмотр плана ============ */
  function openPlan(id) {
    const p = state.plans.find((x) => String(x.id) === String(id));
    if (!p) { hud("План не найден"); return; }
    state.plan = p;
    state.day = 0;
    state.view = "days";
    dom.planAbTitle.textContent = p.title;
    renderPlan();
    showScreen("plan");
  }

  function renderPlan() {
    const p = state.plan;
    const g = GOAL_META[p.goal] || GOAL_META.fitness;
    const lv = LEVEL_META[p.level] || LEVEL_META.beginner;
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
      <div class="hero-card" style="background:${g.grad}">
        <h2>${esc(p.title)}</h2>
        <p class="hero-sub">${g.label} · ${lv.label} · ${eq.label}${p.created_at ? " · с " + fmtDate(p.created_at) : ""}</p>
        <div class="hero-stats">
          <div class="hero-stat">${svg("i-calendar")}<b>${p.days_per_week}</b><span>${dayWord(p.days_per_week)}</span></div>
          <div class="hero-stat">${svg("i-layers")}<b>${items}</b><span>упр.</span></div>
          <div class="hero-stat">${svg("i-check")}<b>${sets}</b><span>подходов</span></div>
        </div>
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

  /* Календарь на месяц (только power/fitness) */
  function renderCalendar() {
    const p = state.plan;
    dom.dayTabs.hidden = true;
    dom.waveTabs.hidden = false;

    const cal = GymPlanner.buildCalendar(p, p.created_at || new Date().toISOString());
    const weeks = [];
    for (let w = 1; w <= GymPlanner.MESO_WEEKS; w++) {
      weeks.push(cal.filter((s) => s.week === w));
    }

    dom.waveTabs.innerHTML = weeks.map((wk, i) => {
      const wave = wk[0] ? wk[0].wave : GymPlanner.DELOAD;
      const active = i === 0;
      return `<button data-week="${i}" class="${active ? "on" : ""}" style="border-color:${wave.color}">
        <b>Нед ${i + 1}</b><span>${wave.label}</span></button>`;
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

    dom.planScroll.innerHTML = sessions.map((s) => `
      <div class="cal-session">
        <div class="cal-session-head" style="border-left-color:${s.wave.color}">
          <div class="cal-wave-badge" style="background:${s.wave.color}">${s.wave.short}</div>
          <div class="cal-session-info">
            <b>${esc(s.title)}</b>
            <span>${fmtShortDate(s.date)} · ${s.wave.label} · ${s.wave.pct} · RPE ${s.wave.rpe}</span>
          </div>
        </div>
        <div class="card cal-items">
          ${s.items.map((it) => `
            <div class="cal-item">
              <span class="cal-ex-name">${esc(it.name)}</span>
              <span class="cal-ex-scheme">${it.sets}×${it.reps} · ${fmtRest(it.rest_sec)}</span>
            </div>`).join("")}
        </div>
      </div>`).join("");
  }

  function renderDay() {
    const p = state.plan;
    const day = (p.days || [])[state.day];
    if (!day) { dom.planScroll.innerHTML = ""; return; }

    const list = (day.items || []).map((it, i) => {
      const color = MUSCLE_COLOR[it.muscle] || "#8E8E93";
      return `
      <div class="ex-item rise" style="--i:${i}" data-ex="${esc(it.exercise_id)}">
        ${tile("i-dumbbell", color, true)}
        <div style="min-width:0;flex:1">
          <div class="ex-name">${esc(it.name)}</div>
          <div class="ex-muscle">${esc(it.muscle)}</div>
        </div>
        <div class="ex-scheme">${it.sets} × ${it.reps}<small>${fmtRest(it.rest_sec)}</small></div>
      </div>`;
    }).join("");

    dom.planScroll.innerHTML = `
      <h3 class="section-label">${esc(day.title || `День ${state.day + 1}`)}</h3>
      <div class="card ex-list">${list || `<div class="empty"><p>Нет упражнений</p></div>`}</div>`;

    dom.planScroll.querySelectorAll("[data-ex]").forEach((el) =>
      el.addEventListener("click", () => openExercise(el.dataset.ex)));
  }

  /* ============ Sheet упражнения ============ */
  function openExercise(id) {
    const ex = state.exMap.get(id);
    const p = state.plan;
    const dayItems = ((p.days || [])[state.day] || {}).items || [];
    const sch = dayItems.find((x) => x.exercise_id === id);
    if (!ex && !sch) { hud("Нет данных"); return; }
    const info = ex || { name: sch.name, muscle: sch.muscle, equipment: "", tips: "" };
    const color = MUSCLE_COLOR[info.muscle] || "#8E8E93";
    dom.exBody.innerHTML = `
      <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:6px">
        ${tile("i-dumbbell", color)}
        <div style="min-width:0">
          <h3 class="sheet-title" style="margin:0 0 4px;font-size:24px">${esc(info.name)}</h3>
          <span style="font-size:14px;color:${color};font-weight:600">${esc(info.muscle)}</span>
          ${info.equipment ? `<span style="font-size:13px;color:var(--text2)"> · ${esc(EX_EQUIP_LABEL[info.equipment] || info.equipment)}</span>` : ""}
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat"><b>${sch ? sch.sets : "—"}</b><span>подходы</span></div>
        <div class="stat"><b>${sch ? sch.reps : "—"}</b><span>повторы</span></div>
        <div class="stat"><b>${sch && sch.rest_sec ? fmtRest(sch.rest_sec) : "—"}</b><span>отдых</span></div>
      </div>
      ${info.tips ? `<div class="rows"><div class="row"><span style="color:var(--text2);font-size:15px">${svg("i-info")}</span><span style="font-size:15px;line-height:1.45">${esc(info.tips)}</span></div></div>` : ""}`;
    openSheet(dom.infoOverlay, dom.sheetEx);
  }
  $("#btn-close-info").addEventListener("click", () => closeSheet(dom.infoOverlay, dom.sheetEx));
  dom.infoOverlay.addEventListener("click", () => closeSheet(dom.infoOverlay, dom.sheetEx));

  /* ============ Мастер ============ */
  function openWizard() {
    state.wiz = { step: 0, draft: { goal: null, level: null, days_per_week: 3, equipment: "full_gym", title: "" }, busy: false };
    renderWizard();
    openSheet(dom.wizOverlay, dom.sheetWizard);
  }
  function closeWizard() { closeSheet(dom.wizOverlay, dom.sheetWizard); }

  function renderWizard() {
    const { step, draft } = state.wiz;
    for (let i = 1; i <= 5; i++) {
      const d = document.getElementById(`wiz-dot-${i}`);
      if (d) d.classList.toggle("on", i <= step + 1);
    }
    dom.wizNext.textContent = step === 4 ? "Создать план" : "Далее";
    dom.wizNext.disabled = (step === 0 && !draft.goal) || (step === 1 && !draft.level) || state.wiz.busy;

    const titles = ["Тип программы", "Опыт", "Частота", "Экипировка", "Название"];
    let inner = `<div class="title-row">${step > 0 ? `<button class="step-back" aria-label="Назад">${svg("i-chev-l")}</button>` : ""}<h3 class="sheet-title">${titles[step]}</h3></div>`;

    if (step === 0) {
      inner += `<div class="field-label">Что будешь делать</div><div class="card">` +
        Object.entries(GOAL_META).map(([k, v]) => `
          <button class="option ${draft.goal === k ? "sel" : ""}" data-goal="${k}">
            ${tile(v.icon, v.grad)}
            <div class="opt-text"><b>${v.label}</b><span>${v.desc}</span></div>
            <div class="opt-check">${svg("i-check")}</div>
          </button>`).join("") + `</div>`;
    } else if (step === 1) {
      inner += `<div class="field-label">Опыт тренировок</div><div class="card">` +
        Object.entries(LEVEL_META).map(([k, v]) => `
          <button class="option ${draft.level === k ? "sel" : ""}" data-level="${k}">
            ${tile(v.icon, "linear-gradient(135deg,#0A84FF,#5E5CE6)")}
            <div class="opt-text"><b>${v.label}</b><span>${v.desc}</span></div>
            <div class="opt-check">${svg("i-check")}</div>
          </button>`).join("") + `</div>`;
    } else if (step === 2) {
      inner += `<div class="field-label">Тренировок в неделю</div>
        <div class="segmented static" id="seg-days">
          ${[2, 3, 4, 5, 6].map((n) => `<button data-days="${n}" class="${draft.days_per_week === n ? "on" : ""}">${n}</button>`).join("")}
        </div>
        <div class="rows" style="margin-top:14px">
          <div class="row">${svg("i-info")}<span class="k" style="text-align:left;font-weight:400">${DAYS_HINT[draft.days_per_week] || ""}</span></div>
        </div>`;
    } else if (step === 3) {
      inner += `<div class="field-label">Где тренируешься</div><div class="card">` +
        Object.entries(EQUIP_META).map(([k, v]) => `
          <button class="option ${draft.equipment === k ? "sel" : ""}" data-equip="${k}">
            ${tile(v.icon, "linear-gradient(135deg,#30D158,#0FB5A3)")}
            <div class="opt-text"><b>${v.label}</b><span>${v.desc}</span></div>
            <div class="opt-check">${svg("i-check")}</div>
          </button>`).join("") + `</div>`;
    } else {
      const g = GOAL_META[draft.goal] || GOAL_META.fitness;
      const lv = LEVEL_META[draft.level] || LEVEL_META.beginner;
      inner += `
        <div class="field-label">Название программы</div>
        <div class="input-card">
          <input id="inp-title" maxlength="60" placeholder="${esc(suggestTitle())}" value="${esc(draft.title)}" autocomplete="off">
          <button class="clear" id="btn-clear-title" aria-label="Очистить">${svg("i-x")}</button>
        </div>
        <div class="field-label" style="margin-top:20px">Итог</div>
        <div class="rows">
          <div class="row">${svg(g.icon)}<span class="k">Тип</span><span class="v">${g.label}</span></div>
          <div class="row">${svg(lv.icon)}<span class="k">Уровень</span><span class="v">${lv.label}</span></div>
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
    }));
    wrap.querySelectorAll("[data-level]").forEach((b) => b.addEventListener("click", () => {
      state.wiz.draft.level = b.dataset.level;
      wrap.querySelectorAll("[data-level]").forEach((x) => x.classList.toggle("sel", x === b));
      dom.wizNext.disabled = false;
    }));
    wrap.querySelectorAll("[data-days]").forEach((b) => b.addEventListener("click", () => {
      state.wiz.draft.days_per_week = Number(b.dataset.days);
      renderWizard();
    }));
    wrap.querySelectorAll("[data-equip]").forEach((b) => b.addEventListener("click", () => {
      state.wiz.draft.equipment = b.dataset.equip;
      wrap.querySelectorAll("[data-equip]").forEach((x) => x.classList.toggle("sel", x === b));
    }));
    const inp = wrap.querySelector("#inp-title");
    if (inp) {
      inp.addEventListener("input", () => { state.wiz.draft.title = inp.value; });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") submitWizard(); });
      setTimeout(() => inp.focus({ preventScroll: true }), 420);
      wrap.querySelector("#btn-clear-title").addEventListener("click", () => {
        inp.value = ""; state.wiz.draft.title = ""; inp.focus();
      });
    }
  }

  function submitWizard() {
    const d = state.wiz.draft;
    if (!d.goal || !d.level) return;

    if (d.goal === "custom") {
      closeWizard();
      openBuilder(null);
      return;
    }

    if (!state.exercises.length) { hud("Каталог не загружен"); return; }
    state.wiz.busy = true;
    dom.wizNext.disabled = true;
    dom.wizNext.textContent = "Собираю…";

    setTimeout(() => {
      try {
        const built = GymPlanner.build(state.exercises, {
          goal: d.goal, level: d.level, days_per_week: d.days_per_week, equipment: d.equipment,
          seed: Math.floor(Math.random() * 1e9),
        });
        if (!built.days.some((x) => x.items.length)) {
          hud("Под этот инвентарь упражнений не нашлось"); return;
        }
        const plan = Object.assign(
          { id: newId(), title: (d.title || "").trim() || suggestTitle(), created_at: new Date().toISOString() },
          built);
        state.plans = [plan, ...state.plans];
        writeStore(); renderHome(); closeWizard(); openPlan(plan.id);
        hud("План готов");
      } catch (e) {
        showAlert({ title: "Ошибка", message: String(e && e.message || e), actions: [{ label: "Закрыть" }] });
      } finally {
        state.wiz.busy = false;
        dom.wizNext.textContent = "Создать план";
        dom.wizNext.disabled = false;
      }
    }, 420);
  }

  dom.wizNext.addEventListener("click", () => {
    const w = state.wiz;
    if (w.step === 0 && !w.draft.goal) return;
    if (w.step === 1 && !w.draft.level) return;
    if (w.step === 4) return submitWizard();
    w.step++; renderWizard();
  });
  dom.wizBody.addEventListener("click", (e) => {
    const chev = e.target.closest(".step-back");
    if (chev) { state.wiz.step = Math.max(0, state.wiz.step - 1); renderWizard(); }
  });
  dom.wizCancel.addEventListener("click", closeWizard);
  dom.wizOverlay.addEventListener("click", closeWizard);

  /* ============ КОНСТРУКТОР СВОЕЙ ПРОГРАММЫ ============ */
  function openBuilder(plan) {
    state.build = plan ? JSON.parse(JSON.stringify(plan)) : GymPlanner.emptyPlan();
    state.buildDay = 0;
    dom.buildInpTitle.value = state.build.title;
    dom.buildAbTitle.textContent = state.build.title || "Своя программа";
    renderBuilder();
    showScreen("build");
  }

  function renderBuilder() {
    const b = state.build;
    dom.buildDayTabs.innerHTML = (b.days || []).map((d, i) =>
      `<button data-bd="${i}" class="${i === state.buildDay ? "on" : ""}">${i + 1}</button>`).join("");
    dom.buildDayTabs.querySelectorAll("[data-bd]").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.buildDay = Number(btn.dataset.bd);
        renderBuilder();
      }));
    renderBuildDay();
  }

  function renderBuildDay() {
    const b = state.build;
    const day = (b.days || [])[state.buildDay];
    if (!day) { dom.buildScroll.innerHTML = ""; return; }
    const items = (day.items || []).map((it, i) => {
      const color = MUSCLE_COLOR[it.muscle] || "#8E8E93";
      return `
      <div class="build-row rise" style="--i:${i}" data-bi="${i}">
        ${tile("i-dumbbell", color, true)}
        <div class="build-row-info">
          <div class="ex-name">${esc(it.name)}</div>
          <div class="ex-muscle">${esc(it.muscle)}</div>
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
      <h3 class="section-label">${esc(day.title || `День ${state.buildDay + 1}`)}</h3>
      <div class="card build-list">${items || `<div class="empty"><p>Нажми «Упражнение» чтобы добавить</p></div>`}</div>`;

    dom.buildScroll.querySelectorAll("[data-bact]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.bi);
        const field = btn.dataset.bf;
        const step = btn.dataset.bact === "inc" ? 1 : -1;
        const day = state.build.days[state.buildDay];
        const it = day.items[idx];
        if (!it) return;
        if (field === "sets") it.sets = Math.max(1, Math.min(20, it.sets + step));
        if (field === "rest_sec") it.rest_sec = Math.max(10, Math.min(600, it.rest_sec + step * 15));
        renderBuildDay();
      }));

    dom.buildScroll.querySelectorAll(".b-inp").forEach((inp) =>
      inp.addEventListener("change", () => {
        const idx = Number(inp.dataset.bi);
        const field = inp.dataset.bf;
        const day = state.build.days[state.buildDay];
        const it = day.items[idx];
        if (!it) return;
        if (field === "sets") it.sets = Math.max(1, Math.min(20, Number(inp.value) || 3));
        if (field === "reps") it.reps = inp.value.trim() || "10–12";
        if (field === "rest_sec") it.rest_sec = Math.max(10, Math.min(600, Number(inp.value) || 60));
        renderBuildDay();
      }));

    dom.buildScroll.querySelectorAll(".b-del").forEach((btn) =>
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.bi);
        const day = state.build.days[state.buildDay];
        if (day && day.items) { day.items.splice(idx, 1); renderBuildDay(); }
      }));
  }

  /* Кнопки конструктора */
  dom.buildInpTitle.addEventListener("input", () => {
    state.build.title = dom.buildInpTitle.value;
    dom.buildAbTitle.textContent = state.build.title || "Своя программа";
  });
  $("#btn-clear-build-title").addEventListener("click", () => {
    dom.buildInpTitle.value = ""; state.build.title = "";
    dom.buildAbTitle.textContent = "Своя программа";
    dom.buildInpTitle.focus();
  });

  $("#btn-build-back").addEventListener("click", () => {
    if (state.plan) { openPlan(state.plan.id); } else { showScreen("home"); }
  });

  $("#btn-build-save").addEventListener("click", () => {
    const b = state.build;
    if (!b) return;
    b.days_per_week = b.days.length;
    const existing = state.plans.findIndex((p) => p.id === b.id);
    if (existing >= 0) { state.plans[existing] = b; } else { state.plans = [b, ...state.plans]; }
    writeStore(); renderHome();
    state.plan = b;
    openPlan(b.id);
    hud("Сохранено");
  });

  $("#btn-build-add-ex").addEventListener("click", openPicker);

  $("#btn-build-add-day").addEventListener("click", () => {
    const b = state.build;
    const n = b.days.length + 1;
    b.days.push({ day_num: n, title: "День " + n, items: [] });
    state.buildDay = b.days.length - 1;
    renderBuilder();
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

  /* ============ ПАЛИТРА УПРАЖНЕНИЙ ============ */
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

    dom.pickList.innerHTML = list.slice(0, 80).map((ex, i) => {
      const color = MUSCLE_COLOR[ex.muscle] || "#8E8E93";
      return `
      <div class="pick-row rise" style="--i:${i}" data-pe="${esc(ex.id)}">
        ${tile("i-dumbbell", color, true)}
        <div class="pick-info"><div class="ex-name">${esc(ex.name)}</div><div class="ex-muscle">${esc(ex.muscle)}</div></div>
        <button class="pick-add">${svg("i-plus")}</button>
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
      }));
  }

  dom.pickSearch.addEventListener("input", () => { state.pick.q = dom.pickSearch.value.trim(); renderPicker(); });
  $("#btn-clear-pick-search").addEventListener("click", () => { dom.pickSearch.value = ""; state.pick.q = ""; renderPicker(); dom.pickSearch.focus(); });
  $("#btn-pick-done").addEventListener("click", () => closeSheet(dom.pickOverlay, dom.sheetPick));
  dom.pickOverlay.addEventListener("click", () => closeSheet(dom.pickOverlay, dom.sheetPick));

  /* ============ Переключатель дней/недель ============ */
  dom.planViewToggle.querySelectorAll("[data-pv]").forEach((b) =>
    b.addEventListener("click", () => {
      state.view = b.dataset.pv;
      dom.planViewToggle.querySelectorAll("[data-pv]").forEach((x) => x.classList.toggle("on", x === b));
      renderPlan();
    }));

  /* ============ Текстовая версия ============ */
  function planToText(p) {
    const L = [];
    L.push(`📋 ${p.title}`);
    const g = GOAL_META[p.goal] || {};
    L.push(`${g.label || p.goal} · ${(LEVEL_META[p.level] || {}).label || p.level} · ${p.days_per_week} ${dayWord(p.days_per_week)} · ${(EQUIP_META[p.equipment] || {}).label || p.equipment}`);
    L.push("");
    (p.days || []).forEach((d) => {
      L.push(`День ${d.day_num}. ${d.title}`);
      (d.items || []).forEach((it) => L.push(`• ${it.name} — ${it.sets}×${it.reps}, отдых ${fmtRest(it.rest_sec)}`));
      L.push("");
    });
    return L.join("\n").trim();
  }

  /* ============ Поделиться ============ */
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

  /* ============ Удаление ============ */
  async function deletePlan() {
    const p = state.plan;
    if (!p) return;
    const ok = await showAlert({
      title: "Удалить план?",
      message: `«${p.title}» будет удалён с этого устройства.`,
      icon: "i-trash",
      actions: [{ label: "Отмена", value: false }, { label: "Удалить", value: true, danger: true }],
    });
    if (!ok) return;
    state.plans = state.plans.filter((x) => x.id !== p.id);
    writeStore(); state.plan = null;
    renderHome(); showScreen("home"); hud("Удалено");
  }

  /* ============ About ============ */
  async function showAbout() {
    const n = state.exercises.length;
    await showAlert({
      title: "GymBro",
      message: `${n} упражнений · 3 режима (силовые с периодизацией, фитнес, своя программа) · 3 уровня · 2–6 дней · всё считается в браузере.`,
      actions: [{ label: "Понятно", value: true }],
    });
  }

  /* ============ Навигация ============ */
  $("#btn-new-plan").addEventListener("click", openWizard);
  $("#btn-new-again").addEventListener("click", openWizard);
  $("#btn-back-home").addEventListener("click", () => { state.plan = null; showScreen("home"); });
  $("#btn-share-plan").addEventListener("click", sharePlan);
  $("#btn-delete-plan").addEventListener("click", deletePlan);
  $("#btn-about").addEventListener("click", showAbout);
  $("#btn-edit-plan").addEventListener("click", () => {
    if (!state.plan) return;
    openBuilder(state.plan);
  });

  /* ============ Данные ============ */
  async function loadCatalog() {
    try {
      const res = await fetch("./data/exercises.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      state.exercises = data.exercises || [];
      state.exMap = new Map(state.exercises.map((e) => [String(e.id), e]));
    } catch (e) {
      hud("Не удалось загрузить каталог");
    }
  }

  function applyTheme() {
    const cs = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = cs;
  }

  function greet() {
    const h = new Date().getHours();
    dom.greeting.textContent = h < 6 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
    dom.today.textContent = new Date().toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  }

  async function boot() {
    greet(); applyTheme();
    state.plans = readStore().map(migratePlan);
    renderHome();
    await loadCatalog();
    renderHome();
  }

  boot();
})();
