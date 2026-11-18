# GymBro — генератор программ тренировок

Персональная программа тренировок за 5 шагов. Работает полностью в браузере — без сервера, без установки, офлайн.

**Демо:** `https://weendd.github.io/gymbro/`

## Возможности

- **5 шагов настройки:** цель (масса / сила / похудение / форма) → опыт → дни в неделю (2–6) → инвентарь (зал / гантели / дом) → название
- **71 упражнение** с техниками выполнения, разделённые по мышечным группам
- **Детерминированный генератор:** одинаковые параметры → одинаковый план (seed)
- **iOS-дизайн:** grouped-карточки, blur-бары, bottom sheets, segmented controls, spring-анимации
- **Автотема:** светлая / тёмная через `prefers-color-scheme` (или через тему Telegram, если открыто в боте)
- **PWA:** устанавливается на домашний экран, работает офлайн после первого визита
- **Поделиться:** нативный Web Share (iOS Safari / Android Chrome) или копирование в буфер

## Структура

```
site/
├── index.html              # Главная страница
├── style.css               # iOS-дизайн-система (~22 КБ)
├── planner.js              # Генератор планов (порт app/planner.py)
├── app.js                  # Клиентская логика (localStorage, UI)
├── manifest.webmanifest    # PWA-манифест
├── sw.js                   # Service Worker (кэш + офлайн)
├── favicon.svg             # Иконка вкладки
├── icon-*.png              # PWA-иконки 192/512
├── data/exercises.json     # Каталог упражнений (71 шт.)
└── selftest.html           # Самопроверка (180 комбинаций)
```

## Архитектура

- **planner.js** — порт `app/planner.py`: те же сплиты (2–6 дней), параметры целей, выбор упражнений по мышечным группам, детерминированный PRNG (mulberry32)
- **app.js** — vanilla JS, без фреймворков: DOM, localStorage, Web Share API, service worker
- **style.css** — CSS-переменные для тем, `@media (prefers-color-scheme)`, backdrop-filter blur, spring-анимации

## Локальный запуск

```bash
cd site
python -m http.server 8081
# или
npx serve .
# откройте http://localhost:8081
```

## Деплой на GitHub Pages

1. Создать репозиторий `weendd/gymbro` (или любое имя)
2. Загрузить папку `site/`:

```bash
cd site
git init
git add .
git commit -m "GymBro — генератор тренировок"
git branch -M main
git remote add origin https://github.com/weendd/gymbro.git
git push -u origin main
```

3. В настройках репозитория: **Settings → Pages → Deploy from branch → main / (root)**
4. Через пару минут сайт доступен по `https://weendd.github.io/gymbro/`

### Деплой на корневой домен

Если нужен `https://weendd.github.io/` без пути:
- Переименовать репозиторий в `weendd.github.io`
- Или создать `CNAME`-файл с доменом

## Интеграция с Telegram-ботом

После деплоя на HTTPS можно привязать Mini App к боту:

1. `@BotFather` → `/newapp` → ссылка на `https://weendd.github.io/gymbro/`
2. Или в `/start` заменить ссылку на inline-кнопку с `web_app`

Статическая версия генерирует план в браузере и отправляет компактный JSON через `sendData()` — бот восстанавливает текст упражнения из `exercises.json` и присылает карточку в чат.

## Тесты

`selftest.html` — перебирает все 180 комбинаций (4 цели × 3 уровня × 5 дней × 3 инвентаря), проверяет что план непустой, дни совпадают с параметром, и seed детерминирован.

```
PASS — проверено 180 комбинаций, пустых: 0
Мин. упражнений: 8
Макс. упражнений: 24
Средне подходов: 51.2
```

## Серверная версия (для локальной разработки)

Для режима Mini App в Telegram нужен Python-сервер (FastAPI + aiogram):

```bash
cd gym bot
python -m pip install -r requirements.txt
# скопировать .env.example в .env и вставить токен от @BotFather
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Сервер раздаёт `web/` (iOS-дизайн) и предоставляет API (`/api/plans`, `/api/exercises`).

## Лицензия

MIT
