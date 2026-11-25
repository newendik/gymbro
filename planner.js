/* GymBro — генератор планов, волновая периодизация, своя программа. Окно: GymPlanner. */
(function (global) {
  "use strict";

  /* ---------------- Сплиты ---------------- */
  var SPLITS = {
    2: [
      { title: "Верх тела", muscles: ["Грудь", "Спина", "Плечи", "Бицепс", "Трицепс"] },
      { title: "Низ тела + пресс", muscles: ["Квадрицепс", "Бицепс бедра", "Ягодицы", "Икры", "Пресс"] },
    ],
    3: [
      { title: "Жим (грудь, плечи, трицепс)", muscles: ["Грудь", "Плечи", "Трицепс"] },
      { title: "Тяга (спина, бицепс)", muscles: ["Спина", "Бицепс"] },
      { title: "Ноги + пресс", muscles: ["Квадрицепс", "Бицепс бедра", "Ягодицы", "Икры", "Пресс"] },
    ],
    4: [
      { title: "Грудь + трицепс", muscles: ["Грудь", "Трицепс"] },
      { title: "Спина + бицепс", muscles: ["Спина", "Бицепс"] },
      { title: "Ноги + ягодицы", muscles: ["Квадрицепс", "Бицепс бедра", "Ягодицы", "Икры"] },
      { title: "Плечи + пресс", muscles: ["Плечи", "Пресс"] },
    ],
    5: [
      { title: "Грудь", muscles: ["Грудь", "Трицепс"] },
      { title: "Спина", muscles: ["Спина", "Бицепс"] },
      { title: "Ноги", muscles: ["Квадрицепс", "Бицепс бедра", "Икры"] },
      { title: "Плечи", muscles: ["Плечи"] },
      { title: "Ягодицы + пресс", muscles: ["Ягодицы", "Пресс"] },
    ],
    6: [
      { title: "Грудь + трицепс", muscles: ["Грудь", "Трицепс"] },
      { title: "Спина + бицепс", muscles: ["Спина", "Бицепс"] },
      { title: "Ноги: квадрицепс", muscles: ["Квадрицепс", "Икры"] },
      { title: "Плечи + пресс", muscles: ["Плечи", "Пресс"] },
      { title: "Ноги: задняя цепь", muscles: ["Бицепс бедра", "Ягодицы"] },
      { title: "Руки + верх", muscles: ["Бицепс", "Трицепс", "Плечи"] },
    ],
  };

  /* Интервалы между тренировками внутри недели (сумма = 7) */
  var WEEK_GAPS = { 2: [3, 4], 3: [2, 2, 3], 4: [1, 2, 2, 2], 5: [1, 1, 2, 1, 2], 6: [1, 1, 1, 1, 1, 2] };
  var MESO_WEEKS = 4;

  /* ---------------- Цели ---------------- */
  var GOALS = {
    power: {
      label: "Силовые", icon: "i-barbell",
      grad: "linear-gradient(135deg,#2563EB,#1D4ED8)",
      desc: "Периодизация: тяжёлые, средние и лёгкие недели по кругу",
    },
    fitness: {
      label: "Фитнес", icon: "i-heart",
      grad: "linear-gradient(135deg,#2563EB,#60A5FA)",
      desc: "Много повторов, короткий отдых — тонус и выносливость",
    },
    custom: {
      label: "Своя программа", icon: "i-pencil",
      grad: "linear-gradient(135deg,#334155,#0F172A)",
      desc: "Собираешь сам: упражнения, подходы, повторы, отдых",
    },
  };

  /* ---------------- Волны периодизации ---------------- */
  var WAVES = [
    { key: "medium", label: "Средняя", short: "С", reps: "6–8",   sets: 4, rest: 150, pct: "75–80% 1ПМ", rpe: 8, color: "#2563EB" },
    { key: "heavy",  label: "Тяжёлая", short: "Т", reps: "3–5",   sets: 5, rest: 180, pct: "85–92% 1ПМ", rpe: 9, color: "#DC2626" },
    { key: "light",  label: "Лёгкая",  short: "Л", reps: "10–12", sets: 3, rest: 90,  pct: "60–70% 1ПМ", rpe: 6, color: "#16A34A" },
  ];
  var DELOAD = { key: "deload", label: "Разгрузка", short: "Р", reps: "10–12", sets: 2, rest: 60, pct: "50–60% 1ПМ", rpe: 5, color: "#94A3B8" };

  var FITNESS = { base: { reps: "12–15", sets: 3, rest: 45 }, iso: { reps: "15–20", sets: 3, rest: 30 } };

  /* Ограничения по уровню: упражнений на мышцу и всего в дне */
  var LEVEL_LIMITS = {
    beginner:     { perMuscle: 1, maxItems: 5, isoBonus: 0 },
    intermediate: { perMuscle: 2, maxItems: 6, isoBonus: 1 },
    advanced:     { perMuscle: 2, maxItems: 7, isoBonus: 1 },
  };

  /* Порядок «крупные раньше мелких» */
  var MUSCLE_ORDER = ["Квадрицепс", "Бицепс бедра", "Спина", "Грудь", "Ягодицы", "Плечи", "Трицепс", "Бицепс", "Икры", "Пресс"];
  var MUSCLE_RANK = {};
  MUSCLE_ORDER.forEach(function (m, i) { MUSCLE_RANK[m] = i; });

  var SMALL_MUSCLES = new Set(["Пресс", "Икры", "Бицепс", "Трицепс"]);
  var SMALL_REST_FACTOR = 0.5;

  /* Схема для одного упражнения в конкретной волне */
  function scheme(goal, wave, compound, muscle) {
    var s;
    if (goal !== "power") {
      s = compound ? FITNESS.base : FITNESS.iso;
    } else {
      s = compound
        ? { reps: wave.reps, sets: wave.sets, rest: wave.rest }
        : { reps: bumpReps(wave.reps), sets: Math.max(2, wave.sets - 1), rest: Math.round(wave.rest * 0.65) };
    }
    var rest = s.rest;
    if (SMALL_MUSCLES.has(muscle)) rest = Math.round(rest * SMALL_REST_FACTOR);
    return { sets: s.sets, reps: s.reps, rest_sec: rest };
  }

  function bumpReps(range) {
    var m = String(range).match(/(\d+)\D+(\d+)/);
    if (!m) return range;
    var lo = Number(m[1]) + 4, hi = Number(m[2]) + 4;
    return lo + "–" + hi;
  }

  function allowedEquipment(equipment) {
    if (equipment === "full_gym") return new Set(["full_gym", "dumbbell", "no_equipment", "band"]);
    if (equipment === "home") return new Set(["dumbbell", "no_equipment", "band"]);
    return new Set(["dumbbell", "no_equipment"]);
  }

  /* Детерминированный PRNG (mulberry32) */
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  /* ---------------- Подбор упражнений на день ---------------- */
  function pickForDay(catalog, dayDef, ctx) {
    var allowed = ctx.allowed, rand = ctx.rand, used = ctx.used;
    var perMuscle = ctx.perMuscle, maxItems = ctx.maxItems;
    var chosen = [], chosenIds = new Set(), mvCount = {};

    function poolFor(muscle) {
      var p = catalog.filter(function (e) {
        return e.muscle === muscle && allowed.has(e.equipment) && !chosenIds.has(e.id);
      });
      var fresh = p.filter(function (e) { return !used.has(e.id); });
      return fresh.length ? fresh : p;
    }

    function add(ex) {
      if (!ex || chosen.length >= maxItems || chosenIds.has(ex.id)) return false;
      var cnt = 0;
      for (var i = 0; i < chosen.length; i++) if (chosen[i].muscle === ex.muscle) cnt++;
      if (cnt >= perMuscle) return false;
      chosen.push(ex);
      chosenIds.add(ex.id);
      mvCount[ex.movement] = (mvCount[ex.movement] || 0) + 1;
      return true;
    }

    function ordered(muscle) {
      var pool = poolFor(muscle);
      var comp = shuffle(pool.filter(function (e) { return e.compound; }), rand);
      var iso = shuffle(pool.filter(function (e) { return !e.compound; }), rand);
      var list = comp.concat(iso);
      list.sort(function (a, b) {
        return (mvCount[a.movement] || 0) - (mvCount[b.movement] || 0);
      });
      return list;
    }

    /* Фаза 1: по одному упражнению на каждую мышцу дня */
    dayDef.muscles.forEach(function (muscle) {
      var list = ordered(muscle);
      for (var i = 0; i < list.length; i++) if (add(list[i])) break;
    });

    /* Фаза 2: добираем объём, крупные мышцы первыми */
    var bySize = dayDef.muscles.slice().sort(function (a, b) {
      return (MUSCLE_RANK[a] || 99) - (MUSCLE_RANK[b] || 99);
    });
    for (var pass = 0; pass < 3 && chosen.length < maxItems; pass++) {
      bySize.forEach(function (muscle) {
        if (chosen.length >= maxItems) return;
        var list = ordered(muscle);
        for (var i = 0; i < list.length; i++) {
          var ex = list[i];
          if (chosen.length >= maxItems) return;
          if (chosenIds.has(ex.id)) continue;
          if ((mvCount[ex.movement] || 0) >= 2) continue;
          if (add(ex)) break;
        }
      });
    }

    /* Порядок в дне: сначала многосуставные, затем крупные мышцы */
    chosen.sort(function (a, b) {
      if (!!a.compound !== !!b.compound) return a.compound ? -1 : 1;
      return (MUSCLE_RANK[a.muscle] || 99) - (MUSCLE_RANK[b.muscle] || 99);
    });
    return chosen;
  }

  /* ---------------- Сборка плана ---------------- */
  function build(catalog, opts) {
    var goal = opts.goal || "power";
    var level = opts.level || "beginner";
    var daysPerWeek = opts.days_per_week || 3;
    var equipment = opts.equipment || "full_gym";
    var seed = (opts.seed === undefined || opts.seed === null) ? Date.now() % 1e9 : opts.seed;

    var rand = makeRng(seed);
    var split = SPLITS[daysPerWeek] || SPLITS[3];
    var allowed = allowedEquipment(equipment);
    var lim = LEVEL_LIMITS[level] || LEVEL_LIMITS.beginner;
    var used = new Set();
    var wave = WAVES[0];

    var days = split.map(function (dayDef, i) {
      var maxItems = Math.max(lim.maxItems, Math.min(dayDef.muscles.length + lim.isoBonus, lim.maxItems + 1));
      var picked = pickForDay(catalog, dayDef, {
        allowed: allowed, rand: rand, used: used,
        perMuscle: lim.perMuscle, maxItems: maxItems,
      });
      var items = picked.map(function (ex) {
        used.add(ex.id);
        var sc = scheme(goal, wave, ex.compound, ex.muscle);
        return {
          exercise_id: ex.id, name: ex.name, muscle: ex.muscle,
          compound: !!ex.compound,
          sets: sc.sets, reps: sc.reps, rest_sec: sc.rest_sec,
        };
      });
      return { day_num: i + 1, title: dayDef.title, items: items };
    });

    return {
      kind: "generated",
      seed: seed, goal: goal, level: level,
      days_per_week: daysPerWeek, equipment: equipment,
      days: days,
    };
  }

  /* ---------------- Календарь на мезоцикл ---------------- */
  function buildCalendar(plan, startISO) {
    var d = plan.days_per_week;
    var gaps = WEEK_GAPS[d] || WEEK_GAPS[3];
    var start = startISO ? new Date(startISO) : new Date();
    if (isNaN(start.getTime())) start = new Date();
    start.setHours(0, 0, 0, 0);

    var out = [];
    var cursor = new Date(start.getTime());
    var total = d * MESO_WEEKS;
    var slotInWeek = 0;

    for (var s = 0; s < total; s++) {
      var week = Math.floor(s / d) + 1;
      var isDeload = week === MESO_WEEKS;
      var wave = isDeload ? DELOAD : WAVES[s % WAVES.length];
      var day = (plan.days || [])[slotInWeek] || { day_num: slotInWeek + 1, title: "", items: [] };

      out.push({
        session: s + 1,
        week: week,
        date: cursor.toISOString().slice(0, 10),
        day_num: day.day_num,
        title: day.title,
        wave: wave,
        items: (day.items || []).map(function (it) {
          if (plan.keep_scheme) {
            return {
              exercise_id: it.exercise_id, name: it.name, muscle: it.muscle,
              sets: it.sets, reps: it.reps, rest_sec: it.rest_sec,
            };
          }
          var sc = scheme(plan.goal, wave, it.compound, it.muscle);
          return {
            exercise_id: it.exercise_id, name: it.name, muscle: it.muscle,
            sets: sc.sets, reps: sc.reps, rest_sec: sc.rest_sec,
          };
        }),
      });

      slotInWeek++;
      if (slotInWeek >= d) slotInWeek = 0;
      if (s < total - 1) cursor = new Date(cursor.getTime() + gaps[s % gaps.length] * 86400000);
    }
    return out;
  }

  /* ---------------- Утилиты ---------------- */
  function newId() {
    return (global.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "p" + Date.now() + Math.random().toString(36).slice(2, 8);
  }

  function emptyPlan(title, nDays) {
    var n = Math.max(1, Math.min(7, nDays || 1));
    var days = [];
    for (var i = 0; i < n; i++) days.push({ day_num: i + 1, title: "День " + (i + 1), items: [] });
    return {
      kind: "custom",
      id: newId(),
      title: title || "Своя программа",
      goal: "custom",
      level: "intermediate",
      equipment: "full_gym",
      days_per_week: n,
      created_at: new Date().toISOString(),
      days: days,
    };
  }

  function fromCatalog(ex, opts) {
    var sc = scheme("custom", WAVES[0], ex.compound, ex.muscle);
    return {
      exercise_id: ex.id, name: ex.name, muscle: ex.muscle,
      compound: !!ex.compound,
      sets: (opts && opts.sets) || sc.sets,
      reps: (opts && opts.reps) || "10–12",
      rest_sec: (opts && opts.rest_sec) || (SMALL_MUSCLES.has(ex.muscle) ? 45 : 90),
    };
  }

  function targetItems(level, musclesCount) {
    var lim = LEVEL_LIMITS[level] || LEVEL_LIMITS.beginner;
    return Math.min(lim.maxItems + 1, Math.max(3, musclesCount + lim.isoBonus));
  }

  global.GymPlanner = {
    build: build, buildCalendar: buildCalendar, scheme: scheme,
    emptyPlan: emptyPlan, fromCatalog: fromCatalog, newId: newId, targetItems: targetItems,
    GOALS: GOALS, SPLITS: SPLITS, WEEK_GAPS: WEEK_GAPS,
    WAVES: WAVES, DELOAD: DELOAD, MESO_WEEKS: MESO_WEEKS,
    SMALL_MUSCLES: SMALL_MUSCLES, MUSCLE_ORDER: MUSCLE_ORDER,
  };
})(window);
