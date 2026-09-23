# Телемост без зелёного

Меняет фирменный зелёный цвет Яндекс Телемоста на любой другой.

Файлы Телемоста **не трогаются** — тема накладывается поверх при запуске.
Обновление Телемоста ничего не ломает.

## Скачать

Готовый `telemost-start.exe` — на странице
[Releases](../../releases/latest). Рядом лежит файл `.sha256`, если хотите
сверить контрольную сумму:

```powershell
Get-FileHash telemost-start.exe -Algorithm SHA256
```

Программа не подписана сертификатом, поэтому SmartScreen при первом запуске
может показать предупреждение: «Подробнее» → «Выполнить в любом случае».

## Как пользоваться

Запустите `telemost-start.exe` вместо обычного ярлыка. Он сам откроет Телемост
и применит тему.

Если Телемост уже открыт — закроет и откроет заново (иначе подключиться к нему
нельзя). Консольное окно спрячется само, когда всё применится.

Удобно: закрепите `telemost-start.exe` на панели задач вместо ярлыка Телемоста.

---

## Полный алгоритм замены и настройки темы

### Где находятся файлы конфигурации

При первом запуске создаётся персональная папка настроек:

```
%LOCALAPPDATA%\TelemostThemeOverride\
  theme.json     цвета и оформление интерфейса
  config.json    путь к Телемосту, порт, поведение консоли
```

> **Важно:** Файл `%LOCALAPPDATA%\TelemostThemeOverride\theme.json` создаётся один раз и **не перезаписывается автоматически**, чтобы ваши правки не сбрасывались.

---

### Пошаговая инструкция

#### Шаг 1. Откройте файл темы

1. Нажмите сочетание клавиш `Win + R`.
2. Вставьте путь: `%LOCALAPPDATA%\TelemostThemeOverride` и нажмите **Enter**.
3. Откройте файл `theme.json` в любом текстовом редакторе (VS Code, Блокнот и т.д.).

*(Если вы работаете с исходным кодом репозитория, редактируйте `config/theme.json`)*.

---

#### Шаг 2. Выберите способ настройки

##### Способ А. Быстрая смена основного цвета (только интерактивные элементы)
Удалите массив `accentScale` и укажите желаемый HEX-цвет в `seeds.interactive`:

```json
{
  "name": "My Custom Theme",
  "id": "my-custom-theme",
  "light": {
    "seeds": {
      "neutral": "#8e8b8b",
      "primary": "#dcde8d",
      "success": "#12c905",
      "warning": "#ffdc17",
      "error": "#fc533a",
      "info": "#a753ae",
      "interactive": "#ec729c"
    }
  },
  "dark": {
    "seeds": {
      "neutral": "#716c6b",
      "primary": "#fab283",
      "success": "#12c905",
      "warning": "#fcd53a",
      "error": "#fc533a",
      "info": "#edb2f1",
      "interactive": "#f497be"
    }
  }
}
```
*Все промежуточные оттенки (наведение, нажатие, фон сообщений) генератор построит автоматически.*

##### Способ Б. Полный контроль палитры бренда (12 оттенков)
Задайте шкалу `accentScale` (ровно 12 оттенков от самого светлого к самому тёмному).
Она имеет приоритет над автоматической генерацией из `seeds.interactive`.

##### Способ В. Полная перекраска всего интерфейса (`semantic`)
Чтобы изменить цвет **контейнеров, карточек, фона страницы, боковой панели, текста, кнопок, обводок и теней**, используйте блок `semantic` внутри `light` и `dark`:

```json
{
  "name": "Pastel Blossom",
  "id": "pastel-blossom",
  "light": {
    "seeds": { ... },
    "semantic": {
      "page": {
        "background": "#fff5f8",
        "conversation": "#fff5f8"
      },
      "surface": {
        "generic": "#ffffff",
        "genericHovered": "#fef0f5"
      },
      "modal": {
        "card": "#ffffff",
        "popup": "#ffffff"
      },
      "control": {
        "buttonBrand": "#ec729c",
        "buttonBrandText": "#ffffff"
      },
      "text": {
        "primary": "#3f1b2b",
        "secondary": "#7e445b"
      },
      "line": {
        "generic": "#f3d5e2"
      }
    }
  },
  "dark": {
    "seeds": { ... },
    "semantic": {
      "page": {
        "background": "#20121a",
        "conversation": "#20121a"
      },
      "surface": {
        "generic": "#36202e",
        "genericHovered": "#432739"
      },
      "modal": {
        "card": "#36202e",
        "popup": "#36202e"
      },
      "control": {
        "buttonBrand": "#d9659b",
        "buttonBrandText": "#ffffff"
      },
      "text": {
        "primary": "#fff2f7",
        "secondary": "#e2b4c8"
      },
      "line": {
        "generic": "#542a42"
      }
    }
  }
}
```

Всего доступно **124 семантических слота** в 15 категориях (`page`, `surface`, `elevation`, `modal`, `overlay`, `line`, `focus`, `text`, `icon`, `control`, `state`, `selection`, `status`, `shadow`, `gradient`). Полная документация слотов: [docs/semantic-colors.md](docs/semantic-colors.md).

##### Способ Г. Картинки и обои на фон в разных местах (`backgrounds`)
Вы можете установить любые фоновые изображения (обои, текстуры, арты, узоры) для окна чата, главного экрана, боковой панели со списком чатов, экрана звонка, страницы логина и модальных окон:

```json
{
  "name": "Pastel Blossom with Chat Wallpaper",
  "id": "pastel-blossom-wallpaper",
  "light": {
    "seeds": { ... },
    "backgrounds": {
      "chat": {
        "image": "wallpapers/light-bg.png",
        "size": "cover",
        "position": "center",
        "overlay": "rgba(255, 245, 248, 0.85)"
      },
      "sidebar": "wallpapers/pattern.png"
    }
  },
  "dark": {
    "seeds": { ... },
    "backgrounds": {
      "chat": {
        "image": "wallpapers/dark-bg.png",
        "size": "cover",
        "position": "center",
        "overlay": "rgba(32, 18, 26, 0.8)"
      }
    }
  }
}
```

- Поддерживаются локальные файлы (`.png`, `.jpg`, `.webp`, `.svg`), веб-ссылки `https://...`, Data URI и градиенты.
- Параметр `overlay` добавляет полупрозрачную подложку поверх картинки, чтобы текст сообщений оставался 100% читаемым.
- Доступные зоны: `chat` (чат), `page` (весь фон), `sidebar` (боковая панель), `home` (главный экран), `call` (экран звонка), `login` (вход), `modal` (карточки и окна), `settings` (настройки), `custom` (любой CSS-селектор).
- Подробное руководство и все параметры: [docs/background-images.md](docs/background-images.md).

---

#### Шаг 3. Примените тему

- **Для пользователей `.exe`**: сохраните файл `theme.json` и просто запустите `telemost-start.exe`.
- **Для разработчиков**: выполните команду `bun run launch` или `bun run apply`.

Если Телемост уже был запущен, лаунчер перезапустит его и применит новые цвета.

---

### Сброс темы к стандартным значениям

Если вы хотите вернуть исходную тему по умолчанию:
1. Удалите файл `%LOCALAPPDATA%\TelemostThemeOverride\theme.json`.
2. Запустите `telemost-start.exe` — файл создастся заново со стандартными значениями.

---

## Настройки `config.json`

| Параметр | По умолчанию | Что делает |
| --- | --- | --- |
| `telemostExe` | находится сам | Путь к `YandexTelemost.exe` |
| `debugPort` | `9333` | Технический порт, только `127.0.0.1` |
| `watch` | `true` | Держать тему при переходах внутри приложения |
| `launchTimeoutSeconds` | `45` | Сколько ждать окно Телемоста |
| `hideConsole` | `"auto"` | `auto` — спрятать после успеха, `always` — всегда, `never` — не прятать |

При `auto` окно остаётся открытым, если есть предупреждение — чтобы его можно
было прочитать.

## Работа с пресетами тем (готовые темы, сохранение и шеринг)

В программу встроен полноценный менеджер пресетов. Вы можете мгновенно переключаться между готовыми темами, сохранять свои варианты оформления, экспортировать их в единый файл для друзей и импортировать чужие темы.

---

### Встроенные темы из коробки

| Идентификатор (ID) | Название темы | Описание и акценты |
| :--- | :--- | :--- |
| **`pastel-blossom`** | Pastel Blossom & Rose Velvet | Нежный пудрово-розовый / глубокая бархатная роза *(дефолт)* |
| **`tokyo-night`** | Tokyo Night | Неоновый индиго и фиолетовый `#7aa2f7` на глубоком тёмном фоне |
| **`nord`** | Nord Frost | Легендарная арктическая палитра Nord (`#88c0d0`, `#2e3440`) |
| **`catppuccin`** | Catppuccin Mocha & Latte | Уютная палитра Catppuccin (Mocha для тёмной, Latte для светлой) |
| **`emerald`** | Cyberpunk Emerald | Высококонтрастный киберпанк с неоновым изумрудным `#00ff9f` |
| **`dracula`** | Dracula Vampire | Классическая тёмная тема Dracula с фиолетово-розовыми акцентами |
| **`monokai`** | Monokai Pro Sunset | Тёплый угольный фон с янтарно-золотым и коралловым сиянием |
| **`cobalt`** | Cobalt Midnight | Глубокий кобальтово-синий стиль shuvcode (`#388bfd`) |

---

### Сценарии работы с пресетами

#### 1. Посмотреть список всех доступных пресетов

```powershell
telemost-start.exe --list-presets
```
Команда выведет таблицу всех встроенных тем и пользовательских пресетов из папки `%LOCALAPPDATA%\TelemostThemeOverride\presets\`, отметив звёздочкой `*` текущую активную тему.

#### 2. Запустить Телемост с выбранным пресетом

Вы можете запускать Телемост сначала с одной темой, затем с другой:

```powershell
# Запуск с темой Nord:
telemost-start.exe --preset nord

# Запуск с темой Tokyo Night:
telemost-start.exe --preset tokyo-night

# Запуск с темой Cyberpunk Emerald:
telemost-start.exe --preset emerald

# Запуск напрямую из любого .json файла на диске:
telemost-start.exe --preset "C:\Users\User\Downloads\my-custom-theme.json"
```

> **Подсказка:** Если Телемост уже открыт, лаунчер применит новую тему на лету прямо в работающее окно без необходимости перезапускать программу.

#### 3. Установить тему по умолчанию

Чтобы не указывать `--preset` при каждом запуске:

```powershell
telemost-start.exe --set-preset nord
```
Эта команда запишет `"preset": "nord"` в ваш `config.json`. После этого при обычном клике на `telemost-start.exe` всегда будет запускаться выбранная тема. Чтобы вернуться к ручной правке `theme.json`, установите `--set-preset custom`.

#### 4. Сохранить текущую тему как новый пресет

Когда вы настроили цвета или добавили фоновые обои в `theme.json`, сохраните результат как отдельный пресет:

```powershell
telemost-start.exe --save-preset my-sunset-theme
```
Файл сохранится в `%LOCALAPPDATA%\TelemostThemeOverride\presets\my-sunset-theme.json` и сразу появится в списке `--list-presets`.

#### 5. Экспортировать тему для отправки другу (шеринг)

Если в вашей теме использовались локальные фоновые картинки (обои чата, сайдбара и т.д.), обычная отправка JSON не передаст файлы картинок. 
Команда `--export-preset` автоматически упаковывает все локальные картинки в самодостаточный формат Base64 Data URI внутри одного `.json` файла:

```powershell
# Экспорт встроенной или пользовательской темы в отдельный файл:
telemost-start.exe --export-preset tokyo-night --out tokyo-shareable.json

# Экспорт текущей рабочей темы:
telemost-start.exe --export-preset custom --out my-cool-theme.json
```
Полученный файл `tokyo-shareable.json` можно скинуть другу в Телеграм или Телемост — у него сразу будут и цвета, и фоновые обои без необходимости настраивать пути.

#### 6. Импортировать пресет от друга

Получив файл темы, импортируйте его одной командой:

```powershell
telemost-start.exe --import-preset friend-theme.json
```
Лаунчер проверит корректность темы и сохранит её в вашу папку пресетов. После этого её можно сразу запускать через `telemost-start.exe --preset <id>`.

---

### Где хранятся пользовательские пресеты

Все ваши сохранённые и импортированные темы лежат в папке:
```
%LOCALAPPDATA%\TelemostThemeOverride\presets\
```
Вы можете просто копировать сюда любые `.json` файлы тем — программа автоматически их распознает.

---

### Использование пресетов в режиме разработки (`bun`)

Для разработчиков, работающих с исходным кодом:

```powershell
# Применить пресет:
bun run apply -- --preset nord

# Сгенерировать CSS для пресета в файл:
bun run build-css -- --preset tokyo-night --out dist/tokyo.css

# Посмотреть список пресетов:
bun run main.ts presets

# Сохранить или экспортировать:
bun run apply -- --export-preset catppuccin --out catppuccin-shared.json
```
Новые пресеты для репозитория добавляются в папку `presets/<id>.json` и автоматически валидируются скриптом `bun run sync-defaults` перед сборкой бинарника.

## Команды

```
telemost-start.exe                          запустить и держать активную тему
telemost-start.exe --preset <name|path>     запустить с указанным пресетом
telemost-start.exe --list-presets           список всех доступных пресетов
telemost-start.exe --set-preset <name>      выбрать тему по умолчанию
telemost-start.exe --save-preset <name>     сохранить тему как пресет
telemost-start.exe --import-preset <path>   импортировать тему
telemost-start.exe --export-preset <name>   экспортировать тему в JSON
telemost-start.exe --once                   применить один раз и выйти
telemost-start.exe --where                  показать, где лежат настройки
telemost-start.exe --help                   справка
```

## Почему так сделано

Интерфейс Телемоста — веб-приложение, зашитое внутрь подписанного `.exe`
размером 156 МБ. Файла со стилями на диске просто нет, а правка самой программы
слетела бы при первом автообновлении.

Поэтому тема подставляется в момент работы, через штатный механизм Qt.
Подмена идёт на уровне базовой палитры, а не отдельных кнопок: имена элементов
меняются от версии к версии, палитра — нет. После применения программа
перепроверяет результат в живом окне и прямо сообщает, если Телемост
что-то переименовал.

Подробности: [`docs/brand-tokens.md`](docs/brand-tokens.md).

## Для разработчиков

```
bun install
bun run launch        запуск из исходников (читает %LOCALAPPDATA%)
bun run apply         быстрое применение (читает config/theme.json)
bun run build-css     показать генерируемый CSS
bun run doctor        диагностика работающего Телемоста
bun run typecheck     проверка типов TypeScript
bun run test          запуск набора unit-тестов
bun run build         собрать dist/telemost-start.exe (вшивает config/ в бинарник)
```

Источник правды по умолчанию — `config/*.json`.
При сборке (`bun run build`) скрипт автоматически выполняет `sync-defaults`, перекрашивает иконку `assets/telemost-themed.ico` и компилирует автономный бинарный файл `dist/telemost-start.exe`.

---

<sub>
Яндекс Телемост тема, Telemost dark theme, кастомная тема Телемост,
убрать зелёный цвет Телемост, telemost custom theme, изменить цвет Телемоста,
Yandex Telemost theme changer, Телемост тёмная тема, Telemost UI customization,
перекрасить Телемост, Telemost accent color, Яндекс Мессенджер тема,
Qt WebEngine CSS injection, telemost-theme-override
</sub>
