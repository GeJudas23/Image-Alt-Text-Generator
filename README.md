# Firefox Image Alt Text Generator

Автоматическое расширение для Firefox, которое генерирует alt текст для изображений на веб-страницах с использованием AI.

## Описание

Расширение автоматически:
- Находит все смысловые изображения на веб-странице
- Фильтрует системные элементы (иконки, меню, навигационные элементы)
- Конвертирует изображения в base64
- Отправляет их в локальный API для генерации описания
- Добавляет полученное описание в атрибут `alt` изображения
- Отслеживает динамические изменения страницы (модальные окна, lazy loading)

## Требования

- **Firefox**: версия 109 или выше (поддержка Manifest V3)
- **API сервер**: локальный сервер на `http://localhost:8000/analyze`
  - Должен принимать POST запросы с FormData
  - Поле `image`: файл изображения
  - Должен возвращать JSON: `{ "description": "описание изображения" }`

## Установка в Firefox (временная)

Для разработки и тестирования:

1. Откройте Firefox
2. Введите в адресной строке: `about:debugging#/runtime/this-firefox`
3. Нажмите "Load Temporary Add-on..."
4. Выберите файл `manifest.json` в папке расширения
5. Расширение будет загружено (активно до перезапуска Firefox)


## Структура проекта

```
d:\Python\FireFox_Image_to_text\
├── manifest.json                    # Конфигурация расширения
├── background.js                    # Background script (CORS proxy)
├── content/
│   ├── content.js                   # Главный координатор
│   ├── imageProcessor.js            # Обнаружение и фильтрация изображений
│   ├── mutationObserver.js          # Отслеживание динамических изменений
│   └── stateManager.js              # Управление состоянием
├── utils/
│   ├── apiClient.js                 # Взаимодействие с API
│   └── imageConverter.js            # Конвертация в base64
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## Конфигурация

### Основные параметры

Можно изменить в соответствующих файлах:

**imageProcessor.js:**
```javascript
const MIN_IMAGE_WIDTH = 100;        // Минимальная ширина изображения
const MIN_IMAGE_HEIGHT = 100;       // Минимальная высота изображения
const MIN_ASPECT_RATIO = 0.1;       // Минимальное соотношение сторон
const MAX_ASPECT_RATIO = 10;        // Максимальное соотношение сторон
```

**apiClient.js:**
```javascript
const API_ENDPOINT = 'http://localhost:8000/analyze';  // API endpoint
const MAX_CONCURRENT_REQUESTS = 3;   // Макс. одновременных запросов
const BATCH_DELAY_MS = 500;          // Задержка между батчами
const MAX_RETRIES = 3;               // Макс. попыток retry
const REQUEST_TIMEOUT_MS = 30000;    // Timeout запроса (30 сек)
```

**mutationObserver.js:**
```javascript
const DEBOUNCE_DELAY_MS = 1000;     // Debounce для мутаций (1 сек)
```

### Отключение отладочных сообщений

В каждом файле установите:
```javascript
const DEBUG = false;  // Отключить логирование
```

## Использование

### Автоматическая работа

Расширение работает автоматически после установки:
1. Открываете любую веб-страницу
2. Расширение находит все подходящие изображения
3. Отправляет их в API
4. Обновляет alt атрибуты

## Фильтрация изображений

Расширение автоматически исключает:

### По размеру
- Изображения меньше 100x100 пикселей
- Изображения с экстремальным соотношением сторон (< 0.1 или > 10)

### По видимости
- `display: none`
- `visibility: hidden`
- `opacity < 0.1`

### По классам/ID
Исключаются изображения с паттернами:
- `icon`, `ico`, `sprite`, `emoji`
- `logo`, `badge`, `button-img`
- `nav-`, `menu-`, `header-`, `footer-`
- `ad-`, `advertisement`, `sponsored`
- `thumbnail`

### По контексту
Изображения внутри:
- `<nav>`, `<header>`, `<footer>`, `<aside>`
- `[role="navigation"]`, `[role="banner"]`

### По URL
- Tracking pixels (1x1 изображения)
- URL с паттернами: `tracking`, `pixel`, `analytics`, `beacon`

## Тестирование

### Базовое тестирование

1. **Запустите API сервер**
   ```bash
   python your_api_server.py
   ```

2. **Загрузите расширение в Firefox**
   ```bash
   cd d:\Python\FireFox_Image_to_text
   web-ext run
   ```

3. **Откройте тестовую страницу**
   - Запустите из папки расширения demo.html
   - Страница имеет 5 статический фото и 5 рандомных

4. **Откройте любую страницу**
   - Так же работу расширения можно проверить на любой другой странице 
