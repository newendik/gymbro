/* Генератор плана. Порт app/planner.py — та же логика, что и на сервере бота.
   Окно: глобальная функция GymPlanner.build(catalog, params). */
(function (global) {
  "use strict";

  const SPLITS = {
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

  const EXERCISES_PER_GROUP = { beginner: 1, intermediate: 2, advanced: 2 };
  const MAX_ITEMS_PER_DAY = { beginner: 4, intermediate: 6, advanced: 7 };

  const GOAL_PARAMS = {
    muscle: { reps: [8, 12], rest: 90, sets: 4 },
    strength: { reps: [4, 6], rest: 150, sets: 5 },
    weight_loss: { reps: [12, 15], rest: 45, sets: 3 },
    health: { reps: [10, 12], rest: 60, sets: 3 },
  };

  const SMALL_MUSCLE_REST = 45;
  const SMALL_MUSCLES = new Set(["Пресс", "Икры", "Бицепс", "Трицепс"]);

  function allowedEquipment(equipment) {
    if (equipment === "full_gym") return new Set(["full_gym", "dumbbell", "no_equipment", "band"]);
    if (equipment === "home") return new Set(["dumbbell", "no_equipment", "band"]);
    return new Set(["dumbbell", "no_equipment"]);
  }

  /** Детерминированный PRNG (mulberry32): один seed -> один план. */
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function build(catalog, opts) {
    const goal = opts.goal || "health";
    const level = opts.level || "beginner";
    const daysPerWeek = opts.days_per_week || 3;
    const equipment = opts.equipment || "full_gym";
    const seed = opts.seed === undefined || opts.seed === null ? Date.now() % 1e9 : opts.seed;

    const rand = makeRng(seed);
    const split = SPLITS[daysPerWeek] || SPLITS[3];
    const allowed = allowedEquipment(equipment);
    const params = GOAL_PARAMS[goal] || GOAL_PARAMS.health;
    const perGroup = EXERCISES_PER_GROUP[level] || 1;
    const maxItems = MAX_ITEMS_PER_DAY[level] || 5;

    const days = [];
    split.forEach((dayDef, i) => {
      let chosen = [];
      for (const muscle of dayDef.muscles) {
        let pool = catalog.filter((e) => e.muscle === muscle && allowed.has(e.equipment));
        if (!pool.length) continue;
        // Перемешиваем базовые и изолированные детерминированно
        const base = shuffle(pool.filter((e) => e.compound), rand);
        const iso = shuffle(pool.filter((e) => !e.compound), rand);
        const picked = (base.concat(iso)).slice(0, perGroup);
        for (const ex of picked) {
          const [low, high] = params.reps;
          const rest = SMALL_MUSCLES.has(muscle) ? SMALL_MUSCLE_REST : params.rest;
          const sets = ex.compound ? params.sets : Math.max(2, params.sets - 1);
          chosen.push({ exercise_id: ex.id, name: ex.name, muscle: ex.muscle, sets, reps: `${low}-${high}`, rest_sec: rest });
        }
      }
      days.push({ day_num: i + 1, title: dayDef.title, items: chosen.slice(0, maxItems) });
    });

    return {
      seed,
      goal, level,
      days_per_week: daysPerWeek,
      equipment,
      days,
    };
  }

  global.GymPlanner = { build, GOAL_PARAMS };
})(window);
