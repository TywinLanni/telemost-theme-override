# Текущий движок перекраски: что делает, куда достаёт, где расширять (current_engine)

Scope: только исследование репозитория `telemost-theme-override` (ветка `djan-theme`, HEAD `0a3890a`). Все цитаты ниже — локальные файлы репозитория в формате `путь:строка`. Ничего не модифицировалось.

**Механизм в одном абзаце.** Программа НЕ правит файлы Телемоста. Она запускает `YandexTelemost.exe` с штатной переменной окружения Qt `QTWEBENGINE_REMOTE_DEBUGGING=127.0.0.1:9333` (`src/launcher.ts:27-31`), находит CDP-цель страницы по предикату `isTelemostPage` (`url` начинается с `ychat://` или содержит `telemost`, `src/start.ts:51-53`, `src/main.ts:36-38`), подключается WebSocket-ом (`CdpSession.connect`, `src/cdp/client.ts:82-86`) и внедряет один `<style>`-элемент с генерируемым CSS. Генерируемый CSS содержит ТОЛЬКО переопределения CSS custom properties (переменных Orb) на `:root` и составных селекторах темы. Всё остальное перекрашивается косвенно — через каскад `var(...)` внутри собственных стилей Телемоста.

## 1. Какие файлы и символы реализуют обнаружение, замену, конфигурацию, инъекцию и наблюдение за DOM?

### Takeaway
Движок — тонкий линейный пайплайн: `bootstrap → buildCss → launch (QTWEBENGINE_REMOTE_DEBUGGING) → CDP attach → инъекция скрипта-агента → верификация → watch-цикл`. Ключевые символы: `buildCss`/`generateRamp` (`src/theme/generate.ts`), `buildAgentSource`/`applyToLiveDocument`/`waitForAppStyles`/`verify` (`src/inject.ts`), `CdpSession` (`src/cdp/client.ts`), zod-схемы (`src/schema.ts`).

### Cited Findings
- Запуск с отладчиком: `buildEnv` устанавливает `QTWEBENGINE_REMOTE_DEBUGGING: "${host}:${port}"` — это штатный механизм Qt, файлы Телемоста не трогаются — [src/launcher.ts:27-31]; подтверждено [README.md:108-118].
- Поиск CDP-цели: `waitForPageTarget` опрашивает `/json/list` каждые 500 мс и ищет `type === "page"` с `webSocketDebuggerUrl` — [src/cdp/client.ts:49-71]; матчер `isTelemostPage` — [src/start.ts:51-53]; страницы Телемоста обслуживаются по схеме `ychat://`, цель регистрируется независимо от схемы — комментарий [src/cdp/client.ts:44-48].
- CDP-клиент: `fetchVersion`/`listTargets` (HTTP `/json/version`, `/json/list`) — [src/cdp/client.ts:30-40]; `CdpSession.evaluate` через `Runtime.evaluate` с zod-парсингом результата — [src/cdp/client.ts:163-175]; `addScriptOnNewDocument` (`Page.addScriptToEvaluateOnNewDocument`, «переживает перезагрузки и навигации») и `removeScriptOnNewDocument` — [src/cdp/client.ts:177-185].
- Последовательность применения (`run` в `src/start.ts`): `Page.enable`, `Runtime.enable`, `addScriptOnNewDocument(buildAgentSource(css))`, `applyToLiveDocument`, ожидание стилей `waitForAppStyles(..., 30_000)`, повторный `applyToLiveDocument` (после появления собственных стилей приложения), `verify`, далее при `watch` — повторная инъекция на событии `Page.frameNavigated` и `waitForTelemostExit` (опрос `/json/version` раз в 3 с, выход после 2 промахов) — [src/start.ts:133-192], [src/start.ts:82-93].
- Агент в странице (`buildAgentSource`, возвращает строку JS): монтирует `<style id="telemost-theme-override">` в `document.head || document.documentElement`; идемпотентен по `getElementById`; всегда перемещает себя в конец родителя (`root.lastChild !== el → appendChild`), т.к. «порядок решает ничью» в каскаде; повторный `mount()` на `DOMContentLoaded`; `MutationObserver({ childList: true, subtree: true })` на `document.documentElement` перемонтирует тег, если SPA его удалила — [src/inject.ts:5-59].
- Применение к живому документу: `applyToLiveDocument` выполняет агент через `Runtime.evaluate` — [src/inject.ts:62-64].
- Ожидание загрузки стилей: `waitForAppStyles` каждые 250 мс проверяет, что первый canary-токен (`--orb-surface-brand`) резолвится через `getComputedStyle(document.documentElement).getPropertyValue(...)` — [src/inject.ts:78-95]; причина — окно гонки: цель появляется на +1.5 с без CSS, токены только к +2.8 с — [docs/brand-tokens.md:137-158].
- Верификация: `verify` читает `mapping.canaryTokens` через `getComputedStyle(documentElement)` и возвращает `rootClasses`, `styleTagPresent`, `resolved`, `missing` — [src/inject.ts:103-126]; схема `verificationReportSchema` — [src/schema.ts:204-211].
- Генерация CSS: `buildCss` собирает рампы и оверрайды в блоки по селекторам темы — [src/theme/generate.ts:231-284]; `generateRamp` — [src/theme/generate.ts:177-206]; интерполяция палитры в OKLCH `rampStopFromPalette` — [src/theme/generate.ts:133-165]; гамма-маппинг `gamutMap` (бинарный поиск по хроме, подход CSS Color 4) — [src/theme/generate.ts:106-117].
- Цветовая математика: `hexToRgb`, `rgbToHex`, `rgbToOklch`, `oklchToRgb`, `hexToOklch`, `oklchToHex` (OKLab/OKLCH, формула Бьорна Оттоссона, перенесена из shuvcode) — [src/theme/color.ts:17-112].
- Конфигурация темы: `config/theme.json` (тема `OC-1`: light/dark, по 7 сидов + 12-шаговый `accentScale`); схемы `hexColorSchema`, `themeSeedColorsSchema`, `paletteScaleSchema` (ровно 12), `themeVariantSchema`, `desktopThemeSchema` — [src/schema.ts:12-68].
- Конфигурация маппинга: `config/mapping.json` (рампы `ya-telemost`, `ya-messenger`; `darkOverrides`/`lightOverrides` пусты; 13 `canaryTokens`); схема `mappingConfigSchema` — [src/schema.ts:111-135]; скомпилированная копия `DEFAULT_MAPPING` генерируется скриптом `scripts/sync-defaults.ts` в `src/defaults/mapping.ts` (заголовок «GENERATED … do not edit»).
- Пользовательский конфиг (`%LOCALAPPDATA%\TelemostThemeOverride\config.json`): `userConfigSchema` — `telemostExe`, `debugPort`, `watch`, `launchTimeoutSeconds`, `hideConsole` — [src/bootstrap.ts:41-56]; пути — [src/paths.ts:16-26].
- Обнаружение/перезапуск уже запущенного Телемоста: `findRunning`, `stopTelemost` — [src/process.ts:61-103] (нужно, т.к. `QTWEBENGINE_REMOTE_DEBUGGING` читается только при старте — комментарий [src/process.ts:10]).
- CLI-режимы: `apply`, `build-css`, `doctor` — [src/main.ts:39-90]; `doctor` читает живое состояние через `verify` — [src/main.ts:53-88].

### Inferences
- Точка единственности истины для «что красим» — `config/mapping.json`; `config/theme.json` задаёт только цвета. Любое расширение покрытия должно начинаться со схемы `mappingConfigSchema`.
- `src/start.ts` (продакшен-путь через `.exe`) и `src/main.ts` (dev-команды) дублируют логику `isTelemostPage` и применения; расширение инъекции затронет оба файла.

### Gaps
- Точное содержимое `src/process.ts` (механизм поиска процесса, PowerShell/Get-Process?) я не вычитывал полностью — для темы это не релевантно.

## 2. Что именно механизм целится: селекторы, custom properties, computed styles, таблицы стилей, inline-стили, SVG, canvas, изображения, iframe, Shadow DOM?

### Takeaway
Механизм целится ТОЛЬКО в CSS custom properties Orb, объявляя их заново на `:root` и на составных селекторах `:root.theme_dark` / `:root.brand_telemost` / `:root.theme_auto` (внутри `@media (prefers-color-scheme: dark)`). Computed styles используются только для чтения (верификация). Никакой работы с обычными CSS-свойствами элементов, таблицами стилей Телемоста, inline-стилями, SVG, canvas, изображениями, iframe или Shadow DOM в коде нет.

### Cited Findings
- Генерируемые правила — исключительно декларации вида `--orb-color-<family>-<stop>: <hex>`; `renderBlock` рендерит пары `[имя, значение]` — [src/theme/generate.ts:208-212], [src/theme/generate.ts:186-203].
- Набор селекторов, которые эмитит `buildCss`: `:root` (light-рампа), `:root.theme_dark, .theme_dark:root` (dark-рампа), `:root, :root.brand_telemost` (light-оверрайды), `:root.theme_dark, .theme_dark:root, .theme_dark:root.brand_telemost` (dark-оверрайды), `@media (prefers-color-scheme: dark) { :root.theme_auto { … } }`. `!important` не используется — победа в каскаде обеспечивается тем, что тег добавляется последним — [src/theme/generate.ts:219-283], [src/inject.ts:34-35].
- Переопределяются рампы `--orb-color-ya-telemost-{100,150,…,1000}` (14 стопов), `--orb-color-ya-telemost-alpha-{100…500}` (7 стопов, 8-значные hex) и `--orb-color-ya-telemost-light-{400,500,600}`; для `ya-messenger` то же без light-трио — [src/theme/generate.ts:19], [src/theme/generate.ts:50-58], [src/theme/generate.ts:186-203], [config/mapping.json:3-16]. Итого 24 декларации для `ya-telemost` — [docs/brand-tokens.md:120-135].
- Всё остальное перекрашивается косвенно: 17 семантических бренд-токенов Телемоста (`--orb-surface-brand`, `-hovered`, `-pressed`, `-light*`, `--orb-text-brand`, `--orb-line-brand`, `--orb-shadow-brand` и т.д.) резолвятся через примитивную рампу — [docs/brand-tokens.md:8-41]; поэтому состояния наведения/нажатия бренд-поверхностей уже перекрашены.
- Верификация читает ТОЛЬКО корневой `getComputedStyle(document.documentElement)`; токены, объявленные на компонентных селекторах (например `--orb-button-brand-*` на `.yamb-desktop-merge-notice-banner`), не видны и не могут быть канарейками — [src/schema.ts:126-134], [docs/brand-tokens.md:42-57].
- Поиск по репозиторию: упоминаний `svg`, `canvas`, `iframe`, `shadow`, `image`-перекраски в `src/**` нет (проверено `QTWEBENGINE|webSocket|devtools|ws://|REMOTE_DEBUGGING` и обзором всех `src/*.ts`); `MutationObserver` единственный и следит только за собственным `<style>`-узлом — [src/inject.ts:44-54].
- Внедрение идёт через `Page.addScriptToEvaluateOnNewDocument` — в стандартном CDP такой скрипт выполняется во всех фреймах документа; однако в репозитории это поведение для Qt WebEngine/`ychat://` отдельно не верифицировано.
- Иконка приложения перекрашивается отдельно, в момент сборки (`scripts/recolor-icon.ts`, `bun run build` «вшывает конфиг и перекрашивает иконку под текущую тему») — [README.md:122-134]; это единственный не-веб-объект перекраски.

### Inferences
- Inline-стили, которые Телемост ставит из JS (в т.ч. динамически смонтированным узлам), НЕ перекрашиваются, если только они сами не ссылаются на `var(--orb-…)`.
- Жёстко зашитые гексы в таблицах стилей Телемоста (вне токенов), в SVG-атрибутах `fill`/`stroke`, в canvas-рендере и растровых картинках не достигаются текущим механизмом в принципе.
- Shadow DOM (если он в Телемосте есть) изолирован от `<style>` в `document.head`; текущий агент в него не заходит. Наличие Shadow DOM в Телемосте в репозитории не проверялось — см. Gaps.

### Gaps
- Использует ли Телемост Shadow DOM, iframe или canvas для каких-либо поверхностей — в репозитории нет данных; проверяется только эмпирически через `doctor`/DevTools на живом приложении.
- Применяется ли `addScriptToEvaluateOnNewDocument` к дочерним фреймам в Qt WebEngine 6.8.3 — не верифицировано репозиторием.
- Перечень небренд-токенов, несущих зелёный/нейтральный цвет (кроме упомянутых семей аватаров `green`/`lime`/`emerald`/`teal` через `--orb-surface-accent-05..09` — [docs/brand-tokens.md:160-167]), в репозитории не задокументирован.

## 3. Какие цвет-несущие CSS-свойства покрыты, а какие пропущены?

### Takeaway
Напрямую не покрывается ни одно обычное CSS-свойство: движок переопределяет только переменные. Через каскад `var()` фактически перекрашиваются те свойства, которые Телемост привязал к 17 бренд-токенам (фоновые поверхности, фоны «лёгких» поверхностей, текст, линии, фокус-обводка, бренд-тень; состояния `hover`/`pressed` — только у бренд-элементов). Контейнерные фоны вне бренд-токенов, бордеры нейтральных элементов, оверлеи/модалки, иконки, `disabled`-состояния, `focus` вне `--orb-misc-line-focus` — не покрыты.

### Cited Findings
- Покрыто косвенно (входит в 13 корневых канареек): `--orb-surface-brand` (background бренд-элементов), `--orb-surface-brand-hovered`, `--orb-surface-brand-pressed` (hover/active), `--orb-surface-brand-light{,-hovered,-pressed}` (фон «лёгких» бренд-поверхностей, напр. исходящие сообщения), `--orb-text-brand`, `--orb-text-brand-static` (текст), `--orb-line-brand`, `--orb-misc-line-focus` (линии/обводки), `--orb-shadow-brand` (тень), `--component-desktop-merge-notice-brand-bg/-color` — [config/mapping.json:19-33], [docs/brand-tokens.md:26-41].
- Косвенно покрыты также компонентные `--orb-button-brand-background{,-hover,-active}` и `--orb-button-brand-text` (читают ту же рампу), но они вне корневой верификации — [docs/brand-tokens.md:42-57].
- `darkOverrides` и `lightOverrides` в текущем `config/mapping.json` пусты — механизм прямых подстановок «токен → значение» существует, но не задействован — [config/mapping.json:17-18]; схема разрешает произвольные пары строка→строка, «значения — сырой CSS (гекс или ссылки на var())» — [src/schema.ts:109], [src/schema.ts:119-124]; рендерятся в блоки `:root`/`:root.theme_dark,…` — [src/theme/generate.ts:253-254], [src/theme/generate.ts:272-273].
- Явно выведены из объёма: аватары-монограммы и индикаторы присутствия (семьи `green`, `lime`, `emerald`, `teal` через `--orb-surface-accent-05..09`) — осознанное решение («это идентичность пользователя, не бренд»), подключение — добавлением семьи в `ramps` — [docs/brand-tokens.md:160-167].
- Ничто в генераторе не эмитит обычных деклараций (`background`, `border-color`, `box-shadow`, `fill`, `stroke`, `outline`, `caret-color`, `filter`) — [src/theme/generate.ts:208-284].

### Inferences
- «Полная перекраска» потребует двух слоёв: (а) расширение `ramps`/`overrides` на остальные семейства переменных Орба (нейтральные поверхности, акцентные семьи, тени) — работает существующим механизмом; (б) новые обычные CSS-правила с селекторами для поверхностей, которые Орб не прогоняет через переменные, — требует расширения `buildCss`.
- Состояния `hover/focus/disabled` достижимы без кода, только если они в Телемосте выражены через токены Орба; иначе нужны обычные псевдоселекторы (`:hover`, `:focus-visible`, `:disabled`) в генерируемом листе.
- Динамически смонтированные узлы будут перекрашены автоматически, если их цвет идёт через переменные или селекторы классов; прямая правка инлайновых стилей таких узлов потребует расширения агента (см. раздел 4).

### Gaps
- Полная карта небренд-токенов Телемоста (нейтральные шкалы `cool-gray`, акценты, токены оверлеев/скароллов и т.п.) в репозитории отсутствует — известна только `--orb-color-cool-gray-1000 = #242429` из проверки контраста [docs/brand-tokens.md:106-118].
- Неизвестно, какие поверхности Телемоста вообще не токенизированы (жёсткие гексы, градиенты, картинки) — только эмпирический аудит живого приложения.

## 4. Какая архитектура расширения вписывается без лишнего редизайна?

### Takeaway
Вписывается эволюционное расширение: новый раздел «сырых» CSS-правил в том же единственном генерируемом `<style>` (расширение `buildCss` + новое поле в `mapping.json`), плюс пополнение `ramps`/`darkOverrides`/`lightOverrides` данными. Агент, CDP-канал, верификацию и схему можно не трогать; агент расширяется только если понадобится трогать инлайновые стили/динамические узлы императивно.

### Cited Findings
- Уже существующие точки расширения без кода: `ramps[]` (новая семья = перекраска всех её примитивов — прямо задокументированный путь для аватаров/статусов) — [docs/brand-tokens.md:167], [src/schema.ts:115-118]; `darkOverrides`/`lightOverrides` (токен → сырой CSS) — [src/schema.ts:119-124], [src/theme/generate.ts:253-273].
- Единственный носитель стилей — один `<style id="telemost-theme-override">`, всегда последний в каскаде; добавление туда ещё одного блока правил наследует это свойство бесплатно — [src/inject.ts:24-35].
- `buildCss` уже собран из независимых «секций» (баннер, рампы, оверрайды, media-блок) — новый блок вставляется в тот же массив `sections` — [src/theme/generate.ts:268-283].
- Верификация расширяема данными: `canaryTokens` — просто массив строк в `config/mapping.json`, но ограничен корневыми токенами (см. комментарий схемы) — [src/schema.ts:126-134].
- Наблюдение за навигацией уже есть (`Page.frameNavigated` → `applyToLiveDocument`) — [src/start.ts:173-177]; конфиг `watch` — [src/schema.ts:148-149].
- Сгенерированные дефолты синхронизируются из `config/*.json` скриптом `bun run sync-defaults` — [package.json:12], [src/defaults/mapping.ts:1]; значит новые поля маппинга нужно синхронизировать в `src/defaults` при сборке.
- Философия проекта явно против правки Телемоста и против точечных селекторов компонентов («имена элементов меняются от версии к версии, палитра — нет») — [README.md:114-118]; стратегия «примитивы, а не 17 токенов» — [src/theme/generate.ts:219-230].

### Inferences
- Минимально-инвазивный план расширения покрытия: (1) данные — добавить семьи/токены в `config/mapping.json`; (2) код — одно новое поле (например `surfaceRules`/`extraCss`) в `mappingConfigSchema` и один новый блок в `buildCss`; (3) агент и `CdpSession` без изменений; (4) расширение `verify`/`canaryTokens` по мере добавления корневых токенов.
- Если аудит живого приложения покажет небренд-поверхности без токенов, понадобится слой селекторных правил (контейнеры, бордеры, оверлеи, иконки через `svg [fill]`-селекторы, `:hover/:focus-visible/:disabled`). Это всё ещё пассивный CSS внутри того же `<style>` и не требует смены архитектуры.
- Императивное вмешательство (правка инлайновых стилей, наблюдение за монтированием конкретных узлов, проникание в Shadow DOM) потребует изменений в шаблоне `buildAgentSource` — это самая рискованная точка, т.к. агент работает в чужом приложении и обязан оставаться идемпотентным и неблокирующим ([src/inject.ts:7-15]).

### Gaps
- Точный перечень поверхностей, не достижимых пассивным CSS (canvas, картинки, iframe), неизвестен без эмпирического аудита — он определяет, понадобится ли вообще императивный слой.

## 5. Тесты, команды сборки и риски сопровождения при расширении покрытия?

### Takeaway
Тестов в репозитории нет (скрипт `bun test` объявлен, но ни одного тестового файла не существует), поэтому гарантией корректности служат `bun run typecheck`, `bun run build-css` (просмотр генерируемого CSS без запуска) и встроенная верификация в живом приложении (`verify` + `bun run doctor`). Главные риски расширения: хрупкость каскадного порядка, переименование токенов/классов Телемостом в обновлениях и отсутствие регрессионных тестов генератора.

### Cited Findings
- Скрипты: `launch`, `apply`, `build-css`, `doctor`, `sync-defaults`, `recolor-icon`, `build`, `typecheck` (`tsc --noEmit`), `test` (`bun test`) — [package.json:7-17].
- Тестовые файлы отсутствуют: поиск `**/*.test.ts` и `**/*{test,spec}*` по репозиторию не дал ни одного файла (проверено глобом); `git ls-files` их тоже не содержит.
- Пайплайн релиза есть (`.github/workflows/release.yml`), README обещает воспроизводимые бинарники и `.sha256` — [README.md:8-19]; git-история из 5 коммитов движется к релизной упаковке (`Keep release binaries reproducible across builds` и т.д.).
- Защита от поломок обновлений Телемоста уже встроена: `canaryTokens` + `verify` громко сообщают об исчезнувших токенах (`WARNING … Telemost may have changed its design tokens`), `doctor` диагностирует живое приложение — [src/start.ts:153-162], [src/main.ts:53-88], [README.md:116-118].
- Известные задокументированные хрупкости: окно гонки холодного старта (+1.5 с без CSS) — [docs/brand-tokens.md:137-158]; компонентные токены дают ложные «пропавшие», если включить их в канарейки — [docs/brand-tokens.md:42-57]; ошибка в кривой рампы (L=0.63 вместо измеренного 0.742) портила вид — [docs/brand-tokens.md:59-75].
- Вне сгенерированных дефолтов: `bun run sync-defaults` обязателен после правки `config/*.json` — [src/defaults/mapping.ts:1].
- Версии: Bun зафиксирован в `.bun-version` (1.4.2), TypeScript 5.7, zod 4 — [.bun-version], [package.json:20-25].

### Inferences
- Перед расширением покрытия стоит добавить хотя бы снапшот-тесты `buildCss` (детерминированный вывод из фикстуры темы+маппинга) и юнит-тесты цветовой математики (`hexToOklch`/`oklchToHex`/`gamutMap`) — сейчас рефакторинг генератора никак не застрахован; инфраструктура `bun test` уже объявлена.
- Расширение числа переопределяемых токенов должно сопровождаться расширением `canaryTokens` (только корневыми токенами), иначе регрессии станут тихими; для небренд-поверхностей канареечный механизм в текущем виде (корневой `getComputedStyle`) недостаточен.
- Любые новые правила обязаны учитывать существующую стратегию «последний тег выигрывает» и не использовать `!important` без нужды — текущий код сознательно его избегает ([src/theme/generate.ts:229-230]).
- Риски сопровождения растут от того, что селекторы класса темы на `<html>` (`theme_dark`, `theme_light`, `theme_auto`, `brand_telemost`) и схема `ychat://` не верифицируются отдельно от канареек; их смена Телемостом сломает тёмную ветку тихо.
- Риск производительности: добавление императивного `MutationObserver` за всеми узлами (взамен текущего точечного) в агрессивном SPA — потенциальная деградация; текущий агент комментирует это как «SPA re-renders aggressively» — [src/inject.ts:44].

### Gaps
- Нет данных о том, как часто Телемост меняет дизайн-токены между версиями (проект верифицирован только против `3.0.1.9940` / QtWebEngine 6.8.3 / Chrome 122 — [config/mapping.json:2], [docs/brand-tokens.md:3-4]); оценка риска обновлений возможна только по истории версий Телемоста вне репозитория.
- CI-прогон тестов в `release.yml` не проверялся детально (файл не читался построчно); наличие/отсутствие `bun run typecheck` в CI — не подтверждено.

## Сводная таблица фактов (для писателя отчёта)

| Аспект | Текущее состояние | Источник |
| --- | --- | --- |
| Канал | CDP через `QTWEBENGINE_REMOTE_DEBUGGING`, loopback, порт 9333 | src/launcher.ts:27-31, src/schema.ts:143-145 |
| Носитель темы | один `<style id="telemost-theme-override">`, всегда последний | src/inject.ts:5-59 |
| Содержимое темы | только CSS custom properties (рампы + оверрайды), без `!important` | src/theme/generate.ts:208-284 |
| Селекторы | `:root`, `:root.theme_dark`, `:root.brand_telemost`, `@media(prefers-color-scheme: dark) :root.theme_auto` | src/theme/generate.ts:268-283 |
| Что перекрашено | 24 примитива `ya-telemost` + рампа `ya-messenger` → 17 семантических бренд-токенов, включая hover/pressed | docs/brand-tokens.md:8-57 |
| Наблюдение за DOM | один `MutationObserver` только за собственным `<style>`; `Page.frameNavigated` ре-инъекция | src/inject.ts:44-54, src/start.ts:173-177 |
| Верификация | `getComputedStyle(documentElement)` по 13 корневым токенам | src/inject.ts:103-126, config/mapping.json:19-33 |
| Конфиг-точки расширения | `ramps[]`, `darkOverrides`, `lightOverrides`, `canaryTokens` | src/schema.ts:111-135 |
| Пустые сегодня | `darkOverrides`, `lightOverrides` | config/mapping.json:17-18 |
| Не покрыто механизмом | обычные CSS-свойства, инлайновые стили, небренд-гексы, `fill`/`stroke`, canvas, картинки, iframe, Shadow DOM, disabled вне токенов | анализ разделов 2-3 |
| Тесты | отсутствуют (0 файлов), `bun test` объявлен | package.json:16, glob-проверка |
| Команды | `bun run typecheck`, `build-css`, `doctor`, `sync-defaults`, `build`, `launch`, `apply` | package.json:7-17 |
| Главный риск | переименование токенов/классов Телемостом; тихие регрессии без тестов | README.md:114-118, раздел 5 |
