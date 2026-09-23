# Семантические цвета: настройка всего интерфейса

Помимо базовой палитры (`seeds`, `accentScale`) в `theme.json` можно задать
точные цвета для конкретных мест интерфейса. Такие места называются
**слотами**: фон страницы, текст, иконки, рамки, кнопки, выделение,
состояния, статусы, тени, градиенты. Всего 124 слота, у каждого своё
значение для светлой и тёмной темы.

Этот документ описывает: структуру `semantic` в `theme.json`, форматы
значений, точный порядок применения, полный список слотов, биндинги правил и
контрольные токены в `mapping.json`, совместимость, миграцию, аудит и
границы применимости.

Источник правды — реестр слотов `src/theme/semantic-slots.ts`. Все имена
слотов, типы, целевые токены и признаки области действия в этом документе
выведены из реестра и сверены с ним программно. Реестр составлен по
зафиксированному файлу стилей Телемоста `3.0.1.9940` (QtWebEngine 6.8.3,
sha256 `7ee580fd…`).

Сразу о границе: слоты перекрашивают CSS — токены, цвета, тени, градиенты.
Пиксельный контент (картинки, видео, canvas, внешние iframe) они не трогают.
Подробности — в разделе [«Границы»](#границы).

## Где писать

Слоты живут внутри `semantic` в каждой из двух секций темы — `light` и
`dark`. Путь к слоту: `semantic.<категория>.<ключ>`.

Пользователям exe-файла: файл лежит в
`%LOCALAPPDATA%\TelemostThemeOverride\theme.json`. Тем, кто собирает из
исходников: `config/theme.json`.

Структура (схема, не готовый файл — полный рабочий пример ниже):

```text
{
  "name": "…",                       // любые непустые строки
  "id": "…",
  "light": {
    "seeds":   { 7 hex-цветов },     // обязательно, как и раньше
    "semantic": {                    // необязательно
      "<категория>": { "<ключ>": значение }
    }
  },
  "dark": { "seeds": { … }, "semantic": { … } }
}
```

Правила:

- `seeds` обязательны в обоих режимах; `semantic` — необязателен.
- Вложенность строгая: неизвестная категория, неизвестный ключ или
  опечатка — ошибка конфигурации, программа ничего не применит. Тихих
  «настройка ничего не сделала» нет.
- `semantic` уже разделён по режимам. Вкладывать внутрь него `light`/`dark`
  нельзя: при запуске из исходников это ошибка конфигурации, в собранном exe
  такие ключи игнорируются. Правильно: `light.semantic.<категория>.<ключ>`,
  а не `light.semantic.light.<категория>`.

## Форматы значений

| Тип слота | Слотов | Формат значения | Пример |
| --- | --- | --- | --- |
| `color` | 110 | только hex: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` | `#1dcc66`, `#0bb55233` |
| `shadow` | 12 | строка box-shadow: без `; { } @ " ' !`, скобки сбалансированы, длина 1–512, без `url()` | `0 8px 24px rgba(0, 0, 0, 0.4)` |
| `gradient` | 2 | то же, что у `shadow`, плюс обязательно `gradient(` | `linear-gradient(90deg, #23262e 25%, #2c303a 50%, #23262e 75%)` |

Детали:

- Цветовые слоты принимают только hex. Имена цветов, `rgb()`, `oklch()` —
  ошибка валидации. Прозрачность — через четвёртую пару hex: `#0bb55233`.
- Запрет `!` делает `!important` недостижимым из пользовательских значений;
  запрет `; { } @` не даёт значению вырваться из своего объявления.
- В `shadow` и `gradient` валиатор пропускает и `var(--token)` — ссылка
  останется ссылкой в итоговом CSS.
- `shadow.color` и `shadow.brand` имеют тип `color`, хотя лежат в категории
  `shadow`: это цвет тени (hex), а не полная её запись. Полные записи — у
  остальных 12 слотов категории.

## Что происходит с вашими значениями

Точный порядок, без упрощений:

1. Слот не задан в активном режиме → для него не эмитится ничего → работает
   штатный CSS Телемоста.
2. Слот задан → значение попадает в CSS дословно (verbatim) на селекторы
   области действия слота этого режима. Никакого вывода из seeds, гамма-
   коррекции или пересчёта оттенка не происходит.
3. Фолбэка между режимами нет. Значение из секции `light` не действует в
   `dark` и наоборот: тёмная тема читает слоты только из `semantic` секции
   `dark`, светлая — из секции `light`.
4. В `mapping.json` есть «сырые» переопределения токенов —
   `lightOverrides` и `darkOverrides`. Они эмитятся в том же файле стилей
   **после** семантических блоков, поэтому при равной специфичности сырые
   переопределения побеждают значения слотов для того же токена и режима.
5. Полный порядок секций генерируемого стиля: баннер → рампы из `ramps` →
   семантические блоки → сырые переопределения → биндинги правил →
   медиа-блок `theme_auto`. Инжектируемый стиль добавляется в документ
   последним и выигрывает каскад при равной специфичности.

## Тема «Авто» (`theme_auto`)

Когда Телемост следует системной теме, на `<html>` нет класса `theme_dark`.
Для этого случая генератор добавляет один тёмный медиа-блок
`@media (prefers-color-scheme: dark)`:

- тёмные значения слотов классов `R` и `REF` переобъявляются на
  `:root.theme_auto`;
- тёмные значения классов `RB` и `RBC` — на `:root.theme_auto.brand_telemost`
  и `:root.theme_auto.Orb-Brand_brand_telemost`;
- тёмные сырые переопределения (`darkOverrides`) — на тех же брендовых
  auto-областях.

Светлого медиа-блока нет: обычные `:root`-объявления уже совпадают с
документом `theme_auto`. Компонентные области (`RC`, `MN`) определяют тему
через собственные классы `Orb-Theme_*`, которые приложение расставляет и в
режиме `theme_auto`, — в медиа-блок они не входят.

Итог: при системной тёмной теме применяются тёмные значения, при светлой —
светлые, отдельной настройки не требуется.

## Пример: полная тема

Пример задаёт по два значения в восьми категориях: страница, поверхности,
текст, контролы, состояния, статусы, тени, градиенты. Файл проходит
валидацию в том виде, как приведён.

```json
{
  "name": "Моя тема",
  "id": "my-theme",
  "light": {
    "seeds": {
      "neutral": "#8e8b8b",
      "primary": "#dcde8d",
      "success": "#12c905",
      "warning": "#ffdc17",
      "error": "#fc533a",
      "info": "#a753ae",
      "interactive": "#2f6bff"
    },
    "semantic": {
      "page": { "background": "#f5f6fa", "conversation": "#ffffff" },
      "surface": { "generic": "#ffffff", "genericHovered": "#eef0f5" },
      "text": { "primary": "#17181c", "link": "#2f6bff" },
      "control": { "brandSurface": "#2f6bff", "buttonBrandText": "#ffffff" },
      "state": { "cardHover": "#eef0f5", "listItemActive": "#e4ecff" },
      "status": { "dangerText": "#c22f26", "successSurface": "#e7f6e7" },
      "shadow": { "popup": "0 8px 24px rgba(15, 18, 25, 0.16)" },
      "gradient": { "messageSkeleton": "linear-gradient(90deg, #eceef3 25%, #f8f9fb 50%, #eceef3 75%)" }
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
      "interactive": "#2f6bff"
    },
    "semantic": {
      "page": { "background": "#14161b", "conversation": "#1b1e24" },
      "surface": { "generic": "#20232a", "genericHovered": "#262a33" },
      "text": { "primary": "#e8eaef", "link": "#2f6bff" },
      "control": { "brandSurface": "#2f6bff", "buttonBrandText": "#ffffff" },
      "state": { "cardHover": "#262a33", "listItemActive": "#26324d" },
      "status": { "dangerText": "#ff7a70", "successSurface": "#1d3a24" },
      "shadow": { "popup": "0 8px 24px rgba(0, 0, 0, 0.45)" },
      "gradient": { "messageSkeleton": "linear-gradient(90deg, #23262e 25%, #2c303a 50%, #23262e 75%)" }
    }
  }
}
```

`text.link` здесь задан одинаково в обоих режимах — этого требует биндинг из
примера `mapping.json` ниже: его правило тематически нейтральное, и загрузчик
проверяет равенство значений.

## Полный справочник слотов

124 слота в 15 категориях. Колонки:

- **Ключ** — имя ключа в `theme.json` внутри `semantic.<категория>`;
- **ID слота** — идентификатор для `semanticBindings` в `mapping.json`;
- **Тип** — формат значения (`color` / `shadow` / `gradient`);
- **Целевой токен** — CSS-переменная, которую перекрашивает слот. Токен
  закреплён реестром и не переносится из конфига;
- **Область** — класс области действия (см. таблицу ниже);
- **Основание** — доказательство из зафиксированного стиля (легенда ниже).

Особый случай: четыре слота с ID `border.*` зарегистрированы в категории
`line`, потому что категории `border` не существует. В `theme.json` они
пишутся как `semantic.line.compose`, `semantic.line.mainBanner`,
`semantic.line.codeBlock`, `semantic.line.joinCallBanner`, а в биндингах
используется ID `border.compose` и т.д.

Области действия (сколько слотов): `R` — 49, `RC` — 60, `RBC` — 9, `MN` — 4,
`REF` — 2.

| Класс | Где объявляются значения |
| --- | --- |
| `R` | только корень: `:root` (light), `.theme_dark:root` (dark) |
| `RB` | корень плюс бренд-варианты (`:root.brand_telemost`, `:root.Orb-Brand_brand_telemost`); в реестре пока нет слотов этого класса |
| `RC` | корень плюс три компонентных компаунда (`yamb-modal`, `ui-popup`, `Orb-Popover2`) по пять форм каждый — чтобы цвет не терялся внутри бренд-окрашенных модалок |
| `RBC` | корень плюс бренд плюс компоненты |
| `MN` | только баннеры склейки звонков: `.yamb-desktop-merge-notice-banner`, `.yamb-merge-notice__content` |
| `REF` | токен без места определения в штатном CSS (есть только потребители `var()`); значение объявляется на корне, чтобы потребители его разрешили |

Основание (evidence): `def n/m` — n определений токена в штатном стиле на m
компонентных группах областей; `raw n` — n определений в сыром CSS, которые
пропущены эвристикой инвентаризации, потому что штатное значение не несёт
цвета; `ref n` — определений нет вообще, n потребителей `var()`. По реестру:
118 слотов `def`, 4 `raw` (`page.actionbar`, `shadow.cardNeutral`,
`shadow.cardNeutralHover`, `shadow.modal`), 2 `ref`
(`selection.calendarCell`, `selection.segmentedControlChecked`). Все 124
целевых токена различны.

### page — страница (7)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `background` | `page.background` | color | `--common-bg` | RC | def 20/5 |
| `backgroundSecondary` | `page.backgroundSecondary` | color | `--common-bg-secondary` | RC | def 20/5 |
| `settingsBackground` | `page.settingsBackground` | color | `--common-settings-bg` | RC | def 20/5 |
| `actionbar` | `page.actionbar` | color | `--common-actionbar` | RC | raw 20 |
| `surface` | `page.surface` | color | `--common-surface-bg` | RC | def 20/5 |
| `poll` | `page.poll` | color | `--common-poll-bg` | RC | def 21/6 |
| `conversation` | `page.conversation` | color | `--conversation-bg` | RC | def 21/6 |

### surface — поверхности (13)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `generic` | `surface.generic` | color | `--orb-surface-generic` | R | def 20/5 |
| `genericHovered` | `surface.genericHovered` | color | `--orb-surface-generic-hovered` | R | def 20/5 |
| `genericPressed` | `surface.genericPressed` | color | `--orb-surface-generic-pressed` | R | def 20/5 |
| `genericMedium` | `surface.genericMedium` | color | `--orb-surface-generic-medium` | R | def 20/5 |
| `genericMediumHovered` | `surface.genericMediumHovered` | color | `--orb-surface-generic-medium-hovered` | R | def 20/5 |
| `genericMediumPressed` | `surface.genericMediumPressed` | color | `--orb-surface-generic-medium-pressed` | R | def 20/5 |
| `genericAlt` | `surface.genericAlt` | color | `--orb-surface-generic-alt` | R | def 20/5 |
| `disabled` | `surface.disabled` | color | `--orb-surface-disabled` | R | def 20/5 |
| `inverse` | `surface.inverse` | color | `--orb-surface-inverse` | R | def 20/5 |
| `inverseHovered` | `surface.inverseHovered` | color | `--orb-surface-inverse-hovered` | R | def 20/5 |
| `inversePressed` | `surface.inversePressed` | color | `--orb-surface-inverse-pressed` | R | def 20/5 |
| `staticLight` | `surface.staticLight` | color | `--orb-surface-static-light` | R | def 20/5 |
| `staticHeavy` | `surface.staticHeavy` | color | `--orb-surface-static-heavy` | R | def 20/5 |

### elevation — уровни (6)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `base` | `elevation.base` | color | `--orb-elevation-base` | R | def 20/5 |
| `risen` | `elevation.risen` | color | `--orb-elevation-risen` | R | def 20/5 |
| `sunken` | `elevation.sunken` | color | `--orb-elevation-sunken` | R | def 20/5 |
| `overlay` | `elevation.overlay` | color | `--orb-elevation-overlay` | R | def 20/5 |
| `overlayModal` | `elevation.overlayModal` | color | `--orb-elevation-overlay-modal` | R | def 20/5 |
| `sidebar` | `elevation.sidebar` | color | `--orb-elevation-base-sidebar` | R | def 20/5 |

### modal — модальные окна (3)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `popup` | `modal.popup` | color | `--ui-popup-bg` | RC | def 20/5 |
| `card` | `modal.card` | color | `--ui-card-neutral-bg` | RC | def 20/5 |
| `cardContrast` | `modal.cardContrast` | color | `--ui-card-contrast-bg` | RC | def 33/5 |

### overlay — перекрытия (5)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `scrim` | `overlay.scrim` | color | `--common-overlay-bg` | RC | def 20/5 |
| `backdrop` | `overlay.backdrop` | color | `--overlay-shadow-color` | RC | def 20/5 |
| `background` | `overlay.background` | color | `--overlay-background-color` | RC | def 20/5 |
| `textPrimary` | `overlay.textPrimary` | color | `--overlay-primary-color` | RC | def 20/5 |
| `textSecondary` | `overlay.textSecondary` | color | `--overlay-secondary-color` | RC | def 20/5 |

### line — линии и рамки (12)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `generic` | `line.generic` | color | `--orb-line-generic` | R | def 20/5 |
| `genericLight` | `line.genericLight` | color | `--orb-line-generic-light` | R | def 20/5 |
| `genericMedium` | `line.genericMedium` | color | `--orb-line-generic-medium` | R | def 20/5 |
| `genericHeavy` | `line.genericHeavy` | color | `--orb-line-generic-heavy` | R | def 20/5 |
| `divider` | `line.divider` | color | `--common-divider` | RC | def 20/5 |
| `darkmode` | `line.darkmode` | color | `--orb-misc-line-darkmode` | R | def 20/5 |
| `compose` | `border.compose` | color | `--ui-compose-border-color` | RC | def 20/5 |
| `mainBanner` | `border.mainBanner` | color | `--main-banner-border-color` | RC | def 20/5 |
| `codeBlock` | `border.codeBlock` | color | `--component-code-block-border-color` | RC | def 20/5 |
| `joinCallBanner` | `border.joinCallBanner` | color | `--component-telemost-action-banner-join-call-border-color` | RC | def 20/5 |
| `codeIncomingDivider` | `line.codeIncomingDivider` | color | `--component-code-incoming-divider-color` | RC | def 20/5 |
| `codeOutgoingDivider` | `line.codeOutgoingDivider` | color | `--component-code-outgoing-divider-color` | RC | def 20/5 |

### focus — фокус (2)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `color` | `focus.color` | color | `--ui-focus-color` | RC | def 20/5 |
| `cardOutline` | `focus.cardOutline` | color | `--ui-card-focus-outline-color` | RC | def 20/5 |

### text — текст (9)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `primary` | `text.primary` | color | `--orb-text-primary` | R | def 20/5 |
| `secondary` | `text.secondary` | color | `--orb-text-secondary` | R | def 20/5 |
| `tertiary` | `text.tertiary` | color | `--orb-text-tertiary` | R | def 20/5 |
| `disabled` | `text.disabled` | color | `--orb-text-disabled` | R | def 20/5 |
| `inverse` | `text.inverse` | color | `--orb-text-inverse` | R | def 20/5 |
| `link` | `text.link` | color | `--orb-text-link` | RBC | def 40/11 |
| `linkHovered` | `text.linkHovered` | color | `--orb-text-link-hovered` | RBC | def 40/11 |
| `staticLight` | `text.staticLight` | color | `--orb-text-static-light` | R | def 20/5 |
| `staticHeavy` | `text.staticHeavy` | color | `--orb-text-static-heavy` | R | def 20/5 |

### icon — иконки (2)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `primary` | `icon.primary` | color | `--common-icons-primary` | RC | def 20/5 |
| `secondary` | `icon.secondary` | color | `--common-icons-secondary` | RC | def 20/5 |

### control — контролы (20)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `brandSurface` | `control.brandSurface` | color | `--orb-surface-brand` | RBC | def 42/13 |
| `brandSurfaceHovered` | `control.brandSurfaceHovered` | color | `--orb-surface-brand-hovered` | RBC | def 42/13 |
| `brandSurfacePressed` | `control.brandSurfacePressed` | color | `--orb-surface-brand-pressed` | RBC | def 42/13 |
| `brandSurfaceLight` | `control.brandSurfaceLight` | color | `--orb-surface-brand-light` | RBC | def 40/11 |
| `brandSurfaceLightHovered` | `control.brandSurfaceLightHovered` | color | `--orb-surface-brand-light-hovered` | RBC | def 40/11 |
| `brandSurfaceLightPressed` | `control.brandSurfaceLightPressed` | color | `--orb-surface-brand-light-pressed` | RBC | def 40/11 |
| `buttonBrand` | `control.buttonBrand` | color | `--orb-button-brand-background` | MN | def 4/2 |
| `buttonBrandHover` | `control.buttonBrandHover` | color | `--orb-button-brand-background-hover` | MN | def 4/2 |
| `buttonBrandActive` | `control.buttonBrandActive` | color | `--orb-button-brand-background-active` | MN | def 4/2 |
| `buttonBrandText` | `control.buttonBrandText` | color | `--orb-button-brand-text` | MN | def 4/2 |
| `iconButtonPrimary` | `control.iconButtonPrimary` | color | `--ui-icon-button-primary` | RC | def 20/5 |
| `iconButtonPrimaryHoverBg` | `control.iconButtonPrimaryHoverBg` | color | `--ui-icon-button-primary-hover-bg` | RC | def 20/5 |
| `iconButtonAccent` | `control.iconButtonAccent` | color | `--ui-icon-button-accent` | RC | def 20/5 |
| `iconButtonAccentHover` | `control.iconButtonAccentHover` | color | `--ui-icon-button-accent-hover` | RC | def 20/5 |
| `iconButtonAccentPressed` | `control.iconButtonAccentPressed` | color | `--ui-icon-button-accent-pressed` | RC | def 20/5 |
| `iconButtonAccentText` | `control.iconButtonAccentText` | color | `--ui-icon-button-accent-text` | RC | def 20/5 |
| `messageButtonBackground` | `control.messageButtonBackground` | color | `--component-message-button-background-color` | RC | def 20/5 |
| `messageButtonBackgroundHovered` | `control.messageButtonBackgroundHovered` | color | `--component-message-button-background-color-hovered` | RC | def 20/5 |
| `messageButtonText` | `control.messageButtonText` | color | `--component-message-button-text-color` | RC | def 20/5 |
| `sendButtonDestructive` | `control.sendButtonDestructive` | color | `--ui-send-message-button-destructive-bg` | RC | def 20/5 |

### state — состояния карточек и списков (8)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `cardHover` | `state.cardHover` | color | `--ui-card-bg-hover` | RC | def 22/7 |
| `cardActive` | `state.cardActive` | color | `--ui-card-bg-active` | RC | def 22/7 |
| `cardDisabled` | `state.cardDisabled` | color | `--ui-card-bg-disabled` | RC | def 20/5 |
| `cardNeutralHover` | `state.cardNeutralHover` | color | `--ui-card-neutral-bg-hover` | RC | def 20/5 |
| `cardNeutralActive` | `state.cardNeutralActive` | color | `--ui-card-neutral-bg-active` | RC | def 20/5 |
| `cardContrastHover` | `state.cardContrastHover` | color | `--ui-card-contrast-bg-hover` | RC | def 33/5 |
| `cardContrastActive` | `state.cardContrastActive` | color | `--ui-card-contrast-bg-active` | RC | def 33/5 |
| `listItemActive` | `state.listItemActive` | color | `--ui-list-item-active-background-color` | RC | def 20/5 |

### selection — выделение (4)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `messageRow` | `selection.messageRow` | color | `--component-message-row-selected-background` | RC | def 20/5 |
| `reaction` | `selection.reaction` | color | `--components-reaction-bg` | RC | def 20/5 |
| `calendarCell` | `selection.calendarCell` | color | `--orb-calendar-cell-background-selected` | REF | ref 2 |
| `segmentedControlChecked` | `selection.segmentedControlChecked` | color | `--local-orb-segmented-control-fill-color-checked-base` | REF | ref 2 |

### status — статусы (17)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `dangerText` | `status.dangerText` | color | `--orb-text-feedback-danger` | R | def 20/5 |
| `dangerSurface` | `status.dangerSurface` | color | `--orb-surface-feedback-danger` | R | def 20/5 |
| `dangerSurfaceHovered` | `status.dangerSurfaceHovered` | color | `--orb-surface-feedback-danger-hovered` | R | def 20/5 |
| `dangerSurfacePressed` | `status.dangerSurfacePressed` | color | `--orb-surface-feedback-danger-pressed` | R | def 20/5 |
| `dangerSurfaceLight` | `status.dangerSurfaceLight` | color | `--orb-surface-feedback-danger-light` | R | def 20/5 |
| `dangerSurfaceLightHovered` | `status.dangerSurfaceLightHovered` | color | `--orb-surface-feedback-danger-light-hovered` | R | def 20/5 |
| `dangerSurfaceLightPressed` | `status.dangerSurfaceLightPressed` | color | `--orb-surface-feedback-danger-light-pressed` | R | def 20/5 |
| `warningText` | `status.warningText` | color | `--orb-text-feedback-warning` | R | def 20/5 |
| `warningSurface` | `status.warningSurface` | color | `--orb-surface-feedback-warning` | R | def 20/5 |
| `warningSurfaceLight` | `status.warningSurfaceLight` | color | `--orb-surface-feedback-warning-light` | R | def 20/5 |
| `successText` | `status.successText` | color | `--orb-text-feedback-success` | R | def 20/5 |
| `successSurface` | `status.successSurface` | color | `--orb-surface-feedback-success` | R | def 20/5 |
| `successSurfaceLight` | `status.successSurfaceLight` | color | `--orb-surface-feedback-success-light` | R | def 20/5 |
| `infoText` | `status.infoText` | color | `--orb-text-feedback-info` | R | def 20/5 |
| `infoSurface` | `status.infoSurface` | color | `--orb-surface-feedback-info` | R | def 20/5 |
| `infoSurfaceLight` | `status.infoSurfaceLight` | color | `--orb-surface-feedback-info-light` | R | def 20/5 |
| `neutralText` | `status.neutralText` | color | `--orb-text-feedback-neutral` | R | def 20/5 |

### shadow — тени (14)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `color` | `shadow.color` | color | `--orb-misc-shadow` | R | def 20/5 |
| `brand` | `shadow.brand` | color | `--orb-shadow-brand` | RBC | def 40/11 |
| `popup` | `shadow.popup` | shadow | `--ui-popup-shadow` | RC | def 20/5 |
| `focusInset` | `shadow.focusInset` | shadow | `--ui-focus-shadow` | RC | def 20/5 |
| `focusPrimary` | `shadow.focusPrimary` | shadow | `--ui-focus-shadow-primary` | RC | def 20/5 |
| `card` | `shadow.card` | shadow | `--ui-card-box-shadow` | RC | def 22/7 |
| `cardHover` | `shadow.cardHover` | shadow | `--ui-card-box-shadow-hover` | RC | def 22/7 |
| `cardNeutral` | `shadow.cardNeutral` | shadow | `--ui-card-neutral-box-shadow` | RC | raw 20 |
| `cardNeutralHover` | `shadow.cardNeutralHover` | shadow | `--ui-card-neutral-box-shadow-hover` | RC | raw 20 |
| `cardContrast` | `shadow.cardContrast` | shadow | `--ui-card-contrast-box-shadow` | RC | def 33/5 |
| `cardContrastHover` | `shadow.cardContrastHover` | shadow | `--ui-card-contrast-box-shadow-hover` | RC | def 20/5 |
| `modal` | `shadow.modal` | shadow | `--component-modal-box-shadow` | RC | raw 20 |
| `reactionsPicker` | `shadow.reactionsPicker` | shadow | `--component-reactions-picker-shadow` | RC | def 20/5 |
| `joinCallBanner` | `shadow.joinCallBanner` | shadow | `--component-telemost-action-banner-join-call-box-shadow` | RC | def 20/5 |

### gradient — градиенты (2)

| Ключ | ID слота | Тип | Целевой токен | Область | Основание |
| --- | --- | --- | --- | --- | --- |
| `messageSkeleton` | `gradient.messageSkeleton` | gradient | `--component-message-balloon-skeleton-gradient` | RC | def 34/6 |
| `diskLoading` | `gradient.diskLoading` | gradient | `--component-disk-available-space-indicator-loading` | RC | def 20/5 |

## mapping.json: биндинги правил (`semanticBindings`)

124 слота перекрашивают токены. Немногое в Телемосте зашито в CSS как
литерал, без токена, — токенами такие места не достать. Для них существуют
биндинги: правило, перекрашивающее одно конкретное объявление.

`mapping.json` — файл уровня репозитория (`config/mapping.json`); в
собранном exe он вшит внутрь, поэтому править биндинги могут те, кто
собирает проект из исходников. Тема (`theme.json`) при этом остаётся
пользовательским файлом: значения биндинг берёт из неё.

Биндинг валиден, только если пара «селектор + свойство» совпадает байт в
байт с одним из 139 проверенных пар (`VERIFIED_RULE_TARGETS`, 121
уникальный селектор), собранных из инвентаризации зафиксированного стиля.
Свои селекторы, регулярные выражения, at-rules и списки селекторов задать
нельзя — только точная копия пары из allowlist, включая запятые и пробелы.

Поля биндинга:

| Поле | Что это |
| --- | --- |
| `kind` | всегда `"rule"` — других видов биндингов в v1 нет |
| `slot` | ID слота из справочника выше |
| `selector` | байт-в-байт из allowlist |
| `property` | свойство той же пары allowlist |
| `mode` | необязателен; выводится из селектора и должен совпадать с выводом |

Режим правила выводится из селектора: есть класс `Orb-Theme_theme_light` —
`light`, `Orb-Theme_theme_dark` — `dark`, иначе `static`. Все 139 пар
allowlist сейчас тематически нейтральные (`static`), поэтому каждое такое
правило требует одного значения: `light.semantic.<категория>.<ключ>` и
`dark.semantic.<категория>.<ключ>` должны существовать и быть равны — это
проверяет загрузчик.

Матрица «тип слота → допустимые свойства правила»:

| Тип слота | Свойства |
| --- | --- |
| `color` | `color`, `background-color`, `background`, `background-image`, `border-color`, `border-top-color`, `fill`, `stroke`, `outline-color` |
| `shadow` | `box-shadow` |
| `gradient` | `background`, `background-image` |

Матрица проходит 111 из 139 пар; разбиение без пересечений: 87 пар — только
цветовые слоты (`color` — 55, `background-color` — 29, `border-color` — 3),
22 пары со свойством `background` — и цветовые, и градиентные, 2 пары
`box-shadow` — только теневые. Пять свойств матрицы (`background-image`,
`border-top-color`, `fill`, `stroke`, `outline-color`) целевых пар в
allowlist сейчас не имеют: правило на них принять можно, но пар с такими
свойствами в инвентаризации нет.

Оставшиеся 28 пар ни одним типом слота в v1 не биндятся. По свойствам:
`border` — 11, `border-bottom` — 4, `-webkit-mask-image` и `mask-image` —
по 5, `-webkit-tap-highlight-color`, `border-block-start-color`,
`-webkit-text-fill-color` — по 1.

Статус этих 28 пар: задокументированные исключения v1, не настраиваемые
правила. Критерий AC2 эпика `tto-6ia` требует, чтобы каждый найденный
CSS-цвет был связан с конфигурацией или явно задокументирован как
исключение, — приведённая ниже таблица и есть эта документация. Пары
остаются в `VERIFIED_RULE_TARGETS` как проверенные цели инвентаризации.
Расширение матрицы типов — изменение реестра
(`src/theme/semantic-slots.ts`) с доказательствами из инвентаризации,
а не настройка конфигурации.

Причины, по группам свойств:

- Шорткаты `border` и `border-bottom` несут в значении толщину и стиль
  вместе с цветом (`1px solid #ebebeb`, `var(--line-m) solid transparent`).
  Цветовой слот подставляет голый hex — в позиции шортката это невалидное
  объявление; теневые и градиентные слоты пишут другие свойства.
- `-webkit-tap-highlight-color`, `border-block-start-color`,
  `-webkit-text-fill-color` принимают цвет, но их нет в наборе цветовых
  свойств v1 (девять свойств матрицы выше), поэтому
  `slotKindAllowsProperty` отклоняет их для всех трёх типов слотов.
- `-webkit-mask-image` и `mask-image` у всех пяти селекторов держат
  `linear-gradient`-маску затухания. По форме значения подошёл бы
  градиентный слот, но матрица v1 допускает градиентные слоты только на
  `background` и `background-image`.

Таблица исключений — все 28 пар. У каждой пары ровно одно вхождение в
зафиксированном стиле; at-rules нет. Колонка «Аудит» — класс вхождения из
`reports/telemost_ui_color_inventory.json` (kind / override). Для масок
`-webkit-mask-image` и `mask-image` — префиксная и стандартная форма одного
объявления, поэтому селекторов пять, а строк десять. Описания поверхностей
выведены из имён классов и значений в зафиксированном стиле; живое поведение
не проверялось.

| Селектор | Свойство | Аудит: kind / override | Причина | Поверхность |
| --- | --- | --- | --- | --- |
| `.Orb-CalendarCell` | `border` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | рамка ячейки календаря; сток `var(--orb-line-05-m) solid transparent` |
| `.div-card` | `border` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | рамка карточки блока `.div-card`; сток `1px solid #ebebeb` |
| `.div-container-block_frame_border` | `border` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | рамка контейнера блока; сток `1px solid #dcdee0` |
| `.div-tail-icon_arrow` | `border` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | рамка стрелки-«хвоста» иконки; сток `1px solid #ccc` |
| `.div-traffic-element__score` | `border` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | рамка счётчика traffic-элемента; сток `2px solid #edf0f2` |
| `.yamb-call-button_view_action` | `border` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | рамка кнопки звонка; сток `var(--line-05m) solid #1c70c4` |
| `.yamb-chat-action__button` | `border` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | рамка кнопки действий чата; сток прозрачный |
| `.yamb-compose_transparent` | `border` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | рамка прозрачного композера; сток прозрачный |
| `.yamb-message-gallery__images` | `border` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | рамка галереи изображений сообщения; сток прозрачный |
| `.yamb-message-image` | `border` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | рамка изображения в сообщении; сток прозрачный |
| `.yamb-message-voice-footer` | `border` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | рамка голосового сообщения; сток прозрачный |
| `.div-separator-block__delimiter` | `border-bottom` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | разделитель блока-разделителя; сток `1px solid rgba(0,0,0,.08)` |
| `.div-separator-element` | `border-bottom` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | разделитель; сток `1px solid rgba(0,0,0,.08)` |
| `.div-tabs-block__tabs-list_hasDelimiter_1` | `border-bottom` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | нижняя граница списка вкладок; сток `1px solid rgba(0,0,0,.1)` |
| `.ui-notificationbar_design_line` | `border-bottom` | `literal-color` / `targeted-rule` | шорткат (цвет + толщина + стиль) | нижняя граница панели уведомлений; сток `var(--line-05m) solid rgba(0,0,0,.05)` |
| `.yamb-conferences-history-filter-controls__action-bar` | `border-block-start-color` | `literal-color` / `targeted-rule` | цветовое свойство вне набора v1 | верхняя граница панели фильтров истории конференций; сток `transparent` |
| `.yamb-telemost-login-page:before` | `mask-image` | `gradient` / `full-value-replacement` | маска вне набора градиентных свойств v1 | маска затухания на псевдоэлементе страницы логина |
| `.yamb-telemost-login-page__scroll-area>.ui-scroll-area__container` | `mask-image` | `gradient` / `full-value-replacement` | маска вне набора градиентных свойств v1 | маска затухания контейнера прокрутки страницы логина |
| `.yamb-telemost-login-page_layout_touch .yamb-telemost-login-page__scroll-area>.ui-scroll-area__container` | `mask-image` | `gradient` / `full-value-replacement` | маска вне набора градиентных свойств v1 | та же маска в touch-раскладке |
| `.yamb-telemost-login-touch-page__cards:before` | `mask-image` | `gradient` / `full-value-replacement` | маска вне набора градиентных свойств v1 | маска затухания карточек touch-логина (псевдоэлемент) |
| `.yamb-telemost-promo__image-overlay` | `mask-image` | `gradient` / `full-value-replacement` | маска вне набора градиентных свойств v1 | маска оверлея промо-изображения |
| `.yamb-telemost-login-page:before` | `-webkit-mask-image` | `gradient` / `full-value-replacement` | маска вне набора градиентных свойств v1 | то же, префиксная форма |
| `.yamb-telemost-login-page__scroll-area>.ui-scroll-area__container` | `-webkit-mask-image` | `gradient` / `full-value-replacement` | маска вне набора градиентных свойств v1 | то же, префиксная форма |
| `.yamb-telemost-login-page_layout_touch .yamb-telemost-login-page__scroll-area>.ui-scroll-area__container` | `-webkit-mask-image` | `gradient` / `full-value-replacement` | маска вне набора градиентных свойств v1 | то же, префиксная форма |
| `.yamb-telemost-login-touch-page__cards:before` | `-webkit-mask-image` | `gradient` / `full-value-replacement` | маска вне набора градиентных свойств v1 | то же, префиксная форма |
| `.yamb-telemost-promo__image-overlay` | `-webkit-mask-image` | `gradient` / `full-value-replacement` | маска вне набора градиентных свойств v1 | то же, префиксная форма |
| `.Orb-SegmentedControl2-Radio` | `-webkit-tap-highlight-color` | `literal-color` / `targeted-rule` | цветовое свойство вне набора v1 | подсветка касания сегмента переключателя; сток прозрачный |
| `.yamb-thinking-bubble-content__text` | `-webkit-text-fill-color` | `literal-color` / `targeted-rule` | цветовое свойство вне набора v1 | заливка текста thinking-пузыря; сток `transparent` |

Дополнительно: один слот — один биндинг, дубликат отклоняется. Каждое
правило попадает в сгенерированный CSS отдельным блоком с комментарием
`semantic.<ID слота>.<режим>`.

Пример — полный `mapping.json`, валидируется в приведённом виде:

```json
{
  "description": "Пример: биндинг правила и контрольные семантические токены",
  "ramps": [
    { "family": "ya-telemost", "seed": "interactive", "alphaSource": 700, "emitLightTrio": true },
    { "family": "ya-messenger", "seed": "interactive", "alphaSource": 700, "emitLightTrio": false }
  ],
  "semanticBindings": [
    {
      "kind": "rule",
      "slot": "text.link",
      "selector": ".yamb-statusbar__link",
      "property": "color"
    }
  ],
  "semanticCanaries": ["--common-bg", "--orb-surface-brand", "--orb-text-link"]
}
```

Цвет ссылки в строке состояния зашит в стиле Телемоста литералом, поэтому
токен `text.link` до него не достаёт — нужен именно биндинг. Значение берётся
из темы: в примере темы выше `text.link` одинаков в `light` и `dark`, как и
требует static-правило.

## mapping.json: контрольные токены (`semanticCanaries`)

Это список семантических токенов для проверки после инжекции: приложение
читает их вычисленное значение в живом окне и честно сообщает, если Телемост
что-то переименовал. Требования, которые проверяет загрузчик:

- токен должен быть целевым токеном какого-нибудь слота из реестра —
  произвольные имена отклоняются;
- токен должен объявляться на корне документа, потому что проверка читает
  `getComputedStyle(documentElement)`. Слоты класса `MN` (четыре токена
  `--orb-button-brand-*`) объявлены только на компонентах и канарейками быть
  не могут.

Проверка видит только CSS-токены. Это не проверка «всё ли перекрасилось» —
это проверка того, что конкретные переменные разрешились.

## Совместимость и миграция

Обратная совместимость полная:

- `semantic` необязателен. Старый `theme.json` без него работает как раньше,
  байт в байт тот же результат;
- нес заданный слот не эмитит ничего — штатный вид Телемоста сохраняется;
- `seeds` остаются обязательной основой, `accentScale` — необязательным
  уточнением, как и прежде; старые примеры темы поддерживаются, мигратировать
  их не нужно.

Слои перекраски и их роль:

| Слой | Что делает |
| --- | --- |
| `seeds` | обязательная база: из неё строятся примитивные шкалы Orb |
| `accentScale` | необязательная ручная шкала на 12 шагов; когда задана — именно она управляет брендовым цветом |
| `semantic` | точечные значения конкретных токенов, без пересчётов |
| `lightOverrides` / `darkOverrides` | сырые переопределения любых токенов; применяются после `semantic` и побеждают его на том же токене |

Миграция «из seeds/accentScale в semantic» — надстройка, а не замена:

- шкала красит бренд целиком, а слот — одно место. Если `accentScale`
  устраивает, но одно место нужно другим цветом, допишите слот и не трогайте
  шкалу;
- если оттенок шкалы в конкретном месте не устраивает (например,
  `control.brandSurface` вышел темнее, чем хочется), закрепите точный hex в
  слоте — он применится дословно, без гамма-коррекции;
- удалять что-либо из старой темы не требуется: слои применяются в порядке
  таблицы выше.

## Аудит покрытия

Реестр слотов и allowlist биндингов выведены из статической инвентаризации
зафиксированного файла стилей. Команда:

```
bun run audit-colors
```

Скрипт читает зафиксированный стиль (только чтение, sha256 `7ee580fd…`),
находит каждое цветовое вхождение — определения и потребители токенов,
литералы, градиенты, тени, SVG-краску — и записывает отчёт в
`reports/telemost_ui_color_inventory.json`. Вывод детерминирован: без
временных меток, сортировка стабильна, ресурс идентифицируется sha256.
Числа `def/raw/ref` в справочнике выше взяты из этого отчёта.

## Границы

Что семантические слоты и биндинги делают: перекрашивают CSS — токены,
цвета, тени, градиенты на проверенных областях, в обоих режимах, включая
`theme_auto`.

Что они не делают и обещать не может:

- растровые картинки, аватары-изображения, эмодзи;
- видео;
- canvas;
- содержимое внешних iframe — сторонние страницы рисуют себя сами;
- inline-стили и SVG, отрисованные из DOM, если их не видно в
  зафиксированном файле стилей.

Реестр составлен статическим анализом зафиксированного файла стилей
Телемоста `3.0.1.9940`. Этот документ не утверждает, что покрытие проверялось
в живом звонке: проверка живого звонка — отдельная работа, и её результаты
здесь не заявляются. После применения темы приложение проверяет разрешение
контрольных токенов в живом окне — но это проверка токенов, а не пикселей.

## Ошибки валидации

Ошибку видно в консоли запуска; при `hideConsole: "auto"` окно останется
открытым. Применения темы при ошибке не происходит.

`theme.json` (проверяется при каждом запуске):

| Ситуация | Сообщение |
| --- | --- |
| файл не JSON | `cannot read JSON from <путь>: <причина>` — причина содержит позицию ошибки |
| неизвестный ключ или опечатка | `invalid theme file <путь>:` и строка вида `- light.semantic.page.backgroud: unknown key "backgroud"` — путь назван полностью |
| не hex | `- light.semantic.page.background: expected a hex color like #1dcc66 or #0bb55233` |
| вложенность light/dark внутри semantic | `invalid theme file <путь>: "semantic" is already scoped per mode — write light.semantic.<category>.<slot> instead of nesting light/dark inside semantic` |
| запрещённый символ в тени/градиенте | `value must not contain ; { } @ " ' or !` |
| несбалансированные скобки | `parentheses must be balanced` |
| `url()` в тени/градиенте | `shadow values must not contain url()` / `gradient values must not contain url()` |
| нет `gradient(` в градиенте | `gradient values must contain gradient(` |
| значение длиннее 512 символов | сообщение о превышении длины |

У exe-файла тексты близкие: `<путь> is not valid JSON: <причина>` для
битого JSON и `<путь> is not a valid theme file:` с тем же списком проблем
для нарушений схемы. Отличие по существу одно: вложенные `light`/`dark`
внутри `semantic` exe не считает ошибкой и тихо игнорирует, поэтому
избегайте вложенности и там.

`mapping.json` (проверяется при запуске из исходников, загрузчик сверяет
биндинги с темой):

| Ситуация | Сообщение |
| --- | --- |
| неизвестный ID слота | `semantic binding #N (slot "page.bogus"): unknown slot id` |
| пара вне allowlist | `(selector, property) pair ("<селектор>", <свойство>) is not in the verified rule allowlist` |
| режим противоречит селектору | `mode "<режим>" contradicts the selector's derived mode "<режим>"` |
| тип слота не умеет это свойство | `a <тип> slot cannot target the property "<свойство>"` |
| дубликат слота | `duplicate binding for this slot` |
| static-правило без равных значений | `a static rule needs one value — set equal light.semantic.<категория>.<ключ> and dark.semantic.<категория>.<ключ>` |
| правило light/dark без значения своего режима | `light.semantic.<категория>.<ключ> must be set` (или `dark.semantic.…`) |
| канарейка вне реестра | `semantic canary "<токен>" has no registry evidence` |
| канарейка компонентной области | `semantic canary "<токен>" is component-scoped (MN, slot <ID>) and is not observable on :root` |
| биндинги есть, тема не передана | `semantic bindings are cross-validated against the theme — pass the parsed theme as the second loadMapping argument` (ситуация возможна только при прямом вызове API) |
