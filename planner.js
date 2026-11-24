/* GymBro — генератор планов, волновая периодизация, своя программа. Окно: GymPlanner. */
(function (global) {
  "use strict";

  /* ---------------- Сплиты ---------------- */
  var SPLITS = {
    2: [
      { title: "Верх тела", muscles: ["Грудь", "Спина", "Плечи", "Бицепс", "Трицепс"] },
      { title: "Низ тела + пресс", muscles: ["Квадрицепс", "Бицепс бедра", "Ягодицы", "Пресс"] },
    ],
    3: [
      { title: "Жим (грудь, плечи, трицепс)", muscles: ["Грудь", "Плечи", "Трицепс"] },
      { title: "Тяга (спина, бицепс)", muscles: ["Спина", "Бицепс"] },
      { title: "Ноги + пресс", muscles: ["Квадрицепс", "Бицепс бедра", "Ягодицы", "Пресс"] },
    ],
    4: [
      { title: "Грудь + трицепс", muscles: ["Грудь", "Трицепс"] },
      { title: "Спина + бицепс", muscles: ["Спина", "Бицепс"] },
      { title: "Ноги + ягодицы", muscles: ["Квадрицепс", "Бицепс бедра", "Ягодицы"] },
      { title: "Плечи + пресс", muscles: ["Плечи", "Пресс"] },
    ],
    5: [
      { title: "Грудь", muscles: ["Грудь", "Трицепс"] },
      { title: "Спина", muscles: ["Спина", "Бицепс"] },
      { title: "Ноги", muscles: ["Квадрицепс", "Бицепс бедра"] },
      { title: "Плечи", muscles: ["Плечи"] },
      { title: "Финиш: ягодицы + пресс", muscles: ["Ягодицы", "Пресс"] },
    ],
    6: [
      { title: "Грудь + трицепс", muscles: ["Грудь", "Трицепс"] },
      { title: "Спина + бицепс", muscles: ["Спина", "Бицепс"] },
      { title: "Ноги (акцент квадрицепс)", muscles: ["Квадрицепс", "Икры"] },
      { title: "Плечи + пресс", muscles: ["Плечи", "Пресс"] },
      { title: "Задняя поверхность", muscles: ["Бицепс бедра", "Ягодицы"] },
      { title: "Руки + верх", muscles: ["Бицепс", "Трицепс"] },
    ],
  };

  /* Интервалы между тренировками внутри недели (сумма = 7) */
  var WEEK_GAPS = { 2: [3, 4], 3: [2, 2, 3], 4: [1, 2, 2, 2], 5: [1, 1, 2, 1, 2], 6: [1, 1, 1, 1, 1, 2] };
  var MESO_WEEKS = 4;

  /* ---------------- Цели ---------------- */
  var GOALS = {
    power: {
      label: "Силовые", icon: "i-barbell",
      grad: "linear-gradient(135deg,#5E5CE6,#BF5AF2)",
      desc: "Периодизация: тяжёлые, средние и лёгкие недели по кругу",
    },
    fitness: {
      label: "Фитнес", icon: "i-heart",
      grad: "linear-gradient(135deg,#30D158,#0FB5A3)",
      desc: "Много повторов, короткий отдых — тонус и выносливость",
    },
    custom: {
      label: "Своя программа", icon: "i-pencil",
      grad: "linear-gradient(135deg,#FF9500,#FFD60A)",
      desc: "Собираешь сам: упражнения, подходы, повторы, отдых",
    },
  };

  /* ---------------- Волны периодизации ---------------- */
  /* База — силовые (compound). Изоляция сдвигается ниже в scheme(). */
  var WAVES = [
    { key: "medium", label: "Средняя",  short: "С", reps: "6–8",   sets: 4, rest: 150, pct: "75–80% 1ПМ", rpe: 8, color: "#FF9500" },
    { key: "heavy",  label: "Тяжёлая",  short: "Т", reps: "3–5",   sets: 5, rest: 180, pct: "85–92% 1ПМ", rpe: 9, color: "#FF3B30" },
    { key: "light",  label: "Лёгкая",   short: "Л", reps: "10–12", sets: 3, rest: 90,  pct: "60–70% 1ПМ", rpe: 6, color: "#30D158" },
  ];
  var DELOAD = { key: "deload", label: "Разгрузка", short: "Р", reps: "10–12", sets: 2, rest: 60, pct: "50–60% 1ПМ", rpe: 5, color: "#8E8E93" };

  /* Фитнес: одна схема без волн */
  var FITNESS = { base: { reps: "12–15", sets: 3, rest: 45 }, iso: { reps: "15–20", sets: 3, rest: 30 } };

  var EXERCISES_PER_GROUP = { beginner: 1, intermediate: 2, advanced: 2 };
  var MAX_ITEMS_PER_DAY = { beginner: 4, intermediate: 6, advanced: 7 };
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

  /* Для изоляции в силовой волне — повторы выше */
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

  /* Детерминированный PRNG (mulberry32): один seed -> один план */
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
    var perGroup = EXERCISES_PER_GROUP[level] || 1;
    var maxItems = MAX_ITEMS_PER_DAY[level] || 5;
    var wave = WAVES[0];

    var days = [];
    split.forEach(function (dayDef, i) {
      var chosen = [];
      dayDef.muscles.forEach(function (muscle) {
        var pool = catalog.filter(function (e) {
          return e.muscle === muscle && allowed.has(e.equipment);
        });
        if (!pool.length) return;
        var base = shuffle(pool.filter(function (e) { return e.compound; }), rand);
        var iso = shuffle(pool.filter(function (e) { return !e.compound; }), rand);
        base.concat(iso).slice(0, perGroup).forEach(function (ex) {
          var sc = scheme(goal, wave, ex.compound, ex.muscle);
          chosen.push({
            exercise_id: ex.id, name: ex.name, muscle: ex.muscle,
            compound: !!ex.compound,
            sets: sc.sets, reps: sc.reps, rest_sec: sc.rest_sec,
          });
        });
      });
      days.push({ day_num: i + 1, title: dayDef.title, items: chosen.slice(0, maxItems) });
    });

    return {
      kind: "generated",
      seed: seed, goal: goal, level: level,
      days_per_week: daysPerWeek, equipment: equipment,
      days: days,
    };
  }

  /* ---------------- Календарь на мезоцикл ---------------- */
  /* Возвращает тренировки по датам: волна назначается по номеру тренировки,
     последняя неделя — разгрузка. */
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

  /* ---------------- Утилиты для своей программы ---------------- */
  function newId() {
    return (global.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "p" + Date.now() + Math.random().toString(36).slice(2, 8);
  }

  function emptyPlan(title) {
    return {
      kind: "custom",
      id: newId(),
      title: title || "Своя программа",
      goal: "custom",
      level: "intermediate",
      equipment: "full_gym",
      days_per_week: 1,
      created_at: new Date().toISOString(),
      days: [{ day_num: 1, title: "День 1", items: [] }],
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

  global.GymPlanner = {
    build: build, buildCalendar: buildCalendar, scheme: scheme,
    emptyPlan: emptyPlan, fromCatalog: fromCatalog, newId: newId,
    GOALS: GOALS, SPLITS: SPLITS, WEEK_GAPS: WEEK_GAPS,
    WAVES: WAVES, DELOAD: DELOAD, MESO_WEEKS: MESO_WEEKS,
    SMALL_MUSCLES: SMALL_MUSCLES,
  };
})(window);
