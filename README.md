# Local Chat 3.0 WebUI

It is a basic LAN chat application that allows users to connect, create chats, send text messages and images, and customize their profile and chat avatars.

## Возможности

* Вход пользователя с указанием имени и (опционально) URL аватара.
* Список доступных чатов.
* Создание новых чатов.
* Отображение истории сообщений для выбранного чата.
* Отправка текстовых сообщений.
* Отправка изображений (через загрузку файла или URL).
* Настройка аватара пользователя и аватара чата.
* Сохранение истории чатов и метаданных в файлах.
* Базовый поиск по списку чатов.
* Адаптивный дизайн для разных размеров экрана.

## Структура проекта
├── app.py              # Основной скрипт сервера Flask и Socket.IO
├── index.html          # HTML-файл пользовательского интерфейса
├── static/
│   ├── style.css       # CSS-стили
│   └── main.js         # JavaScript для работы интерфейса и Socket.IO
├── requirements.txt    # Список зависимостей Python
├── run_app.bat         # Скрипт для запуска приложения (Windows)
├── run_app.sh          # Скрипт для запуска приложения (macOS/Linux)
├── install_requirements.bat # Скрипт для установки зависимостей (Windows)
├── install_requirements.sh  # Скрипт для установки зависимостей (macOS/Linux)
└── chat_histories/     # Папка для сохранения истории сообщений (создается автоматически)
└── chats.json          # Файл для сохранения метаданных чатов (создается автоматически)


## Установка и запуск

Для запуска приложения вам потребуется установленный Python 3 и менеджер пакетов `pip`.

### 1. Установка Python и pip

Если у вас еще нет Python, следуйте инструкциям для вашей операционной системы:

* [Установка Python на Windows](#установка-python-на-windows)
* [Установка Python на macOS](#установка-python-на-macos)
* [Установка Python на Linux](#установка-python-на-linux)

Убедитесь, что Python и `pip` (или `pip3`) добавлены в переменную среды `PATH`.

### 2. Установка зависимостей Python

Перейдите в корневую папку проекта в терминале или командной строке и выполните скрипт для установки зависимостей:

* **Для Windows:**
    ```bash
    .\install_requirements.bat
    ```
* **Для macOS и Linux:**
    ```bash
    chmod +x install_requirements.sh # Сделайте скрипт исполняемым
    ./install_requirements.sh
    ```

Это установит Flask и Flask-SocketIO.

### 3. Запуск приложения

После установки зависимостей вы можете запустить сервер Flask. Перейдите в корневую папку проекта в терминале или командной строке и выполните скрипт запуска:

* **Для Windows:**
    ```bash
    .\run_app.bat
    ```
* **Для macOS и Linux:**
    ```bash
    chmod +x run_app.sh # Сделайте скрипт исполняемым
    ./run_app.sh
    ```

Сервер запустится (по умолчанию на `http://127.0.0.1:5000`).

### 4. Использование чата

1.  Откройте веб-браузер и перейдите по адресу `http://127.0.0.1:5000`.
2.  Введите ваше имя пользователя и (опционально) ссылку на аватар в окне входа.
3.  Нажмите "Войти в чат".
4.  В левой панели вы увидите список чатов. Если чатов нет, создайте новый с помощью кнопки `+`.
5.  Выберите чат из списка, чтобы просмотреть историю сообщений и начать писать.
6.  Введите текст в поле ввода внизу или используйте значок скрепки для отправки изображения.
7.  Используйте значок шестеренки в верхней панели для изменения настроек пользователя или чата (когда чат выбран).

---

#### Установка Python на Windows

1.  Скачайте установщик с [python.org](https://www.python.org/downloads/windows/).
2.  Запустите установщик.
3.  **Обязательно** отметьте галочку "Add Python X.Y to PATH" на первом шаге.
4.  Выберите "Install Now" и завершите установку.
5.  Перезапустите командную строку.

#### Установка Python на macOS

1.  **Через Homebrew (рекомендуется):** Откройте Терминал и выполните `brew install python3` (если Homebrew не установлен, следуйте инструкциям на [brew.sh](https://brew.sh/)).
2.  **Через официальный установщик:** Скачайте `.pkg` файл с [python.org](https://www.python.org/downloads/mac-osx/) и запустите его.

#### Установка Python на Linux

Python 3, вероятно, уже установлен. Проверьте `python3 --version`. Если нужна установка или обновление:

* **Debian/Ubuntu:** `sudo apt update && sudo apt install python3 python3-pip`
* **Fedora:** `sudo dnf install python3 python3-pip`
