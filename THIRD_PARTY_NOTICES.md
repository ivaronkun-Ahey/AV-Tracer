# Сторонние компоненты

AV-Tracer распространяется по лицензии Apache 2.0 (см. `LICENSE` и `NOTICE`).
В собранное приложение (`frontend/dist`, Docker-образ) входят сторонние
библиотеки под их собственными лицензиями.

## Требующие отдельного упоминания

| Компонент | Лицензия | Где используется | Исходный код |
|---|---|---|---|
| [elkjs](https://github.com/kieler/elkjs) | Eclipse Public License 2.0 | автораскладка «Упорядочить» (загружается отдельным модулем, без изменений) | https://github.com/kieler/elkjs |
| [Material Icons](https://github.com/google/material-design-icons) (Google) через [@mui/icons-material](https://github.com/mui/material-ui) | Apache 2.0 (значки), MIT (пакет) | контуры пиктограмм устройств в `frontend/src/components/deviceIcons.ts` и значки интерфейса | https://github.com/google/material-design-icons |
| Шрифт [PT Sans Narrow](https://github.com/google/fonts/tree/main/ofl/ptsansnarrow) (ParaType) | SIL Open Font License 1.1 (`frontend/public/fonts/OFL-PTSansNarrow.txt`) | чертежи в PDF (встраивается подмножество глифов); файлы шрифта не изменены | https://github.com/google/fonts/tree/main/ofl/ptsansnarrow |

## Остальные зависимости

Все остальные пакеты, которые попадают в сборку, распространяются по
лицензиям MIT, BSD-3-Clause, ISC или Zlib: React, Redux Toolkit, React Redux,
Konva, react-konva, Material UI, Emotion, zod, pdf-lib и @pdf-lib/fontkit
(вывод PDF) и их зависимости; pako — MIT и Zlib. Тексты
лицензий находятся в каталогах пакетов (`frontend/node_modules/<пакет>/LICENSE`).

Список проверяется автоматически: `npm run licenses:check` во `frontend`
(и в CI) завершается ошибкой, если в продакшен-зависимостях появится
лицензия не из разрешённого списка.

Инструменты разработки (Vite, TypeScript, ESLint, Vitest, Playwright и др.) в
собранное приложение не входят.

## Товарные знаки

Названия производителей и моделей оборудования в каталоге — товарные знаки
их владельцев и используются только для обозначения оборудования. Проект не
связан с производителями и не одобрен ими. Характеристики оборудования
приведены справочно (см. `docs/STATUS.md`).
