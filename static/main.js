document.addEventListener('DOMContentLoaded', () => {
    // Инициализация Socket.IO клиента с отключенным автоподключением
    const socket = io({ autoConnect: false });

    // --- Элементы DOM ---
    const loginOverlay = document.getElementById('loginOverlay');
    const usernameInput = document.getElementById('usernameInput');
    const avatarUrlInput = document.getElementById('avatarUrlInput');
    const joinBtn = document.getElementById('joinBtn');

    const appContainer = document.querySelector('.app-container');
    const chatListUL = document.getElementById('chatList');
    const chatSearchInput = document.getElementById('chatSearchInput');
    const addChatBtn = document.getElementById('addChatBtn');

    const currentUserAvatarSmall = document.getElementById('currentUserAvatarSmall');
    const currentUsernameSmall = document.getElementById('currentUsernameSmall');
    const generalSettingsBtn = document.getElementById('generalSettingsBtn');

    const currentChatHeader = document.getElementById('currentChatHeader');
    const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    const chatHeaderName = document.getElementById('chatHeaderName');
    const currentChatSettingsBtn = document.getElementById('currentChatSettingsBtn');
    const chatWindow = document.getElementById('chatWindow');
    const messageInputContainer = document.getElementById('messageInputContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    // const typingIndicator = document.getElementById('typingIndicator'); // Если есть

    // Модальные окна
    const createChatModal = document.getElementById('createChatModal');
    const chatSettingsModal = document.getElementById('chatSettingsModal');
    const generalSettingsModal = document.getElementById('generalSettingsModal');

    // Элементы модального окна создания чата
    const createChatNameInput = document.getElementById('createChatName');
    const createChatAvatarUrlInput = document.getElementById('createChatAvatarUrl');
    const createChatAvatarFileInput = document.getElementById('createChatAvatarFile');
    const createChatAvatarPreview = document.getElementById('createChatAvatarPreview');
    const saveNewChatBtn = document.getElementById('saveNewChatBtn');

    // Элементы модального окна настроек чата
    const chatSettingsModalTitle = document.getElementById('chatSettingsModalTitle');
    const chatSettingsNameInput = document.getElementById('chatSettingsName');
    const chatSettingsAvatarUrlInput = document.getElementById('chatSettingsAvatarUrl');
    const chatSettingsAvatarFileInput = document.getElementById('chatSettingsAvatarFile');
    const chatSettingsAvatarPreview = document.getElementById('chatSettingsAvatarPreview');
    const saveChatSettingsBtn = document.getElementById('saveChatSettingsBtn');

    // Элементы модального окна общих настроек
    const generalSettingsUsernameInput = document.getElementById('generalSettingsUsername');
    const generalSettingsAvatarUrlInput = document.getElementById('generalSettingsAvatarUrl');
    const generalSettingsAvatarFileInput = document.getElementById('generalSettingsAvatarFile');
    const generalSettingsAvatarPreview = document.getElementById('generalSettingsAvatarPreview');
    const saveGeneralSettingsBtn = document.getElementById('saveGeneralSettingsBtn');

    // --- Переменные состояния ---
    let currentUser = null;
    let currentChatId = null; // Хранит ID текущего активного чата
    let allChatsMetadata = []; // Хранит все метаданные чатов для поиска и рендеринга

    // Объект для хранения элементов потоковых сообщений AI по их ID
    const streamingAIMessages = {};

    // --- Вспомогательные функции ---

    // Возвращает URL аватара, обрабатывая разные типы данных
    function getAvatarUrl(avatarData) {
        if (!avatarData) return 'https://ui-avatars.com/api/?name=?'; // Аватар по умолчанию
        if (avatarData.startsWith('data:image')) {
            return avatarData; // Base64 Data URL
        }
        // Включаем проверку на /static/ для локальных аватаров
        if (avatarData.startsWith('http://') || avatarData.startsWith('https://') || avatarData.startsWith('/static/')) {
            return avatarData; // URL
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarData)}`; // Fallback для Gravatar-подобных аватаров
    }

    // Форматирует временную метку ISO-строки в читаемый формат
    function formatTimestamp(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    }

    // Очищает HTML-строку от потенциально вредоносного содержимого
    function sanitizeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // --- Функции обновления UI ---

    // Обновляет UI с информацией о текущем пользователе
    function updateUserSettingsUI() {
        if (currentUser) {
            currentUsernameSmall.textContent = currentUser.username;
            currentUserAvatarSmall.src = getAvatarUrl(currentUser.avatar);
            currentUserAvatarSmall.alt = currentUser.username;
        }
    }

    // Рендерит список чатов на основе метаданных
    function renderChatList(chats) {
        chatListUL.innerHTML = ''; // Очищаем существующий список
        const searchTerm = chatSearchInput.value.toLowerCase(); // Получаем поисковый запрос

        chats.forEach(chat => {
            // Фильтруем чаты по поисковому запросу
            if (chat.name.toLowerCase().includes(searchTerm)) {
                const listItem = document.createElement('li');
                listItem.classList.add('chat-list-item');
                // Добавляем класс 'active', если это текущий выбранный чат
                if (currentChatId === chat.chat_id) {
                    listItem.classList.add('active');
                }
                listItem.dataset.chatId = chat.chat_id; // Сохраняем ID чата в data-атрибуте
                listItem.innerHTML = `
                    <img src="${getAvatarUrl(chat.avatar)}" alt="${sanitizeHTML(chat.name)}" class="avatar">
                    <div class="chat-info">
                        <span class="chat-name">${sanitizeHTML(chat.name)}</span>
                        <span class="last-message">${sanitizeHTML(chat.last_message)}</span>
                    </div>
                    <span class="last-message-time">${formatTimestamp(chat.last_message_time)}</span>
                `;
                // Добавляем обработчик клика для каждого элемента чата
                listItem.addEventListener('click', () => handleChatClick(chat.chat_id));
                chatListUL.appendChild(listItem);
            }
        });
    }

    // Добавляет одно сообщение в окно чата
    function appendMessageToChatWindow(message) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper');
        messageWrapper.classList.add(message.user_id === currentUser.id ? 'outgoing' : 'incoming');
        messageWrapper.dataset.messageId = message.id; // Добавляем data-атрибут для ID сообщения

        messageWrapper.innerHTML = `
            <img src="${getAvatarUrl(message.avatar)}" alt="${sanitizeHTML(message.username)}" class="avatar">
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-username">${sanitizeHTML(message.username)}</span>
                    <span class="message-time">${formatTimestamp(message.timestamp)}</span>
                </div>
                <div class="message-content">${sanitizeHTML(message.content)}</div>
            </div>
        `;
        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight; // Прокручиваем к последнему сообщению
        return messageWrapper; // Возвращаем созданный элемент
    }

    // Рендерит все сообщения в окне чата (используется для загрузки истории)
    function renderMessages(messages) {
        chatWindow.innerHTML = ''; // Очищаем существующие сообщения
        if (!messages || messages.length === 0) {
            chatWindow.innerHTML = '<div class="no-messages">Нет сообщений в этом чате.</div>';
            return;
        }
        messages.forEach(message => {
            appendMessageToChatWindow(message);
        });
    }

    // Рендерит заголовок окна чата и активирует поле ввода
    function renderChatWindow(chatMetadata) {
        console.log('Rendering chat window for:', chatMetadata ? chatMetadata.chat_id : 'No chat selected');

        if (!chatMetadata) {
            currentChatHeader.style.display = 'none';
            messageInputContainer.style.display = 'none';
            chatWindow.innerHTML = '<div class="select-chat-placeholder">Выберите чат, чтобы начать общение.</div>';
            return;
        }

        // Активируем заголовок чата и контейнер ввода сообщений
        currentChatHeader.style.display = 'flex';
        messageInputContainer.style.display = 'flex';

        // Обновляем информацию в заголовке чата
        chatHeaderAvatar.src = getAvatarUrl(chatMetadata.avatar);
        chatHeaderAvatar.alt = chatMetadata.name;
        chatHeaderName.textContent = sanitizeHTML(chatMetadata.name);

        // Устанавливаем заполнитель, пока история загружается
        chatWindow.innerHTML = '<div class="loading-messages">Загрузка истории...</div>';
        chatWindow.scrollTop = chatWindow.scrollHeight;

        // Обновляем активный класс в списке чатов для немедленной визуальной обратной связи
        document.querySelectorAll('.chat-list-item').forEach(item => {
            if (item.dataset.chatId === chatMetadata.chat_id) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // --- Обработчики событий DOM ---

    // Обработчик кнопки "Войти в чат"
    joinBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const avatarUrl = avatarUrlInput.value.trim();

        if (username) {
            currentUser = {
                id: socket.id || `user_${Date.now()}`, // Fallback ID, если socket.id еще не доступен
                username: username,
                avatar: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser)); // Сохраняем пользователя в локальное хранилище
            socket.connect(); // Подключаем сокет только после установки информации о пользователе
            loginOverlay.style.display = 'none'; // Скрываем оверлей входа
            appContainer.style.display = 'flex'; // Показываем основное приложение
            updateUserSettingsUI(); // Обновляем UI пользователя
        } else {
            console.error('Пожалуйста, введите ваше имя.');
        }
    });

    // Обработчик кнопки общих настроек
    generalSettingsBtn.addEventListener('click', () => {
        if (currentUser) {
            generalSettingsUsernameInput.value = currentUser.username;
            generalSettingsAvatarUrlInput.value = currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('/static/') ? currentUser.avatar : '';
            generalSettingsAvatarPreview.src = getAvatarUrl(currentUser.avatar);
            generalSettingsAvatarPreview.alt = currentUser.username;
            generalSettingsModal.style.display = 'block'; // ОТКРЫВАЕМ МОДАЛЬНОЕ ОКНО
        }
    });

    // Обработчик кнопки сохранения общих настроек
    saveGeneralSettingsBtn.addEventListener('click', () => {
        if (currentUser) {
            const newUsername = generalSettingsUsernameInput.value.trim();
            let newAvatar = generalSettingsAvatarUrlInput.value.trim();

            if (generalSettingsAvatarFileInput.files.length > 0) {
                const file = generalSettingsAvatarFileInput.files[0];
                const reader = new FileReader();
                reader.onloadend = () => {
                    newAvatar = reader.result; // Base64 строка
                    updateAndSaveGeneralSettings(newUsername, newAvatar);
                };
                reader.readAsDataURL(file);
            } else {
                if (!newAvatar) {
                    newAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(newUsername)}`;
                }
                updateAndSaveGeneralSettings(newUsername, newAvatar);
            }
        }
    });

    // Вспомогательная функция для обновления и сохранения общих настроек
    function updateAndSaveGeneralSettings(newUsername, newAvatar) {
        currentUser.username = newUsername;
        currentUser.avatar = newAvatar;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserSettingsUI();
        generalSettingsModal.style.display = 'none';
        socket.emit('set_user_info', currentUser);
    }

    // Обработчик изменения файла аватара в общих настройках
    generalSettingsAvatarFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                generalSettingsAvatarPreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            generalSettingsAvatarPreview.src = getAvatarUrl(currentUser.avatar);
        }
        generalSettingsAvatarUrlInput.value = '';
    });

    // Обработчик ввода URL аватара в общих настройках
    generalSettingsAvatarUrlInput.addEventListener('input', () => {
        const url = generalSettingsAvatarUrlInput.value.trim();
        if (url) {
            generalSettingsAvatarPreview.src = url;
            generalSettingsAvatarFileInput.value = '';
        } else {
            generalSettingsAvatarPreview.src = getAvatarUrl(currentUser.avatar);
        }
    });

    // Обработчик кнопки "Добавить чат"
    addChatBtn.addEventListener('click', () => {
        // Очищаем поля модального окна создания чата
        createChatNameInput.value = '';
        createChatAvatarUrlInput.value = '';
        createChatAvatarFileInput.value = '';
        createChatAvatarPreview.src = 'https://ui-avatars.com/api/?name=NC';
        createChatModal.style.display = 'block'; // ОТКРЫВАЕМ МОДАЛЬНОЕ ОКНО
    });

    // Обработчик кнопки "Создать чат" в модальном окне
    saveNewChatBtn.addEventListener('click', () => {
        const chatName = createChatNameInput.value.trim();
        let chatAvatar = createChatAvatarUrlInput.value.trim();

        if (!chatName) {
            console.error('Пожалуйста, введите название чата.');
            return;
        }

        if (createChatAvatarFileInput.files.length > 0) {
            const file = createChatAvatarFileInput.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                chatAvatar = reader.result;
                socket.emit('create_new_chat', { name: chatName, avatar: chatAvatar });
                createChatModal.style.display = 'none';
            };
            reader.readAsDataURL(file);
        } else {
            if (!chatAvatar) {
                chatAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(chatName)}`;
            }
            socket.emit('create_new_chat', { name: chatName, avatar: chatAvatar });
            createChatModal.style.display = 'none';
        }
    });

    // Обработчик изменения файла аватара при создании чата
    createChatAvatarFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                createChatAvatarPreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            createChatAvatarPreview.src = 'https://ui-avatars.com/api/?name=NC';
        }
        createChatAvatarUrlInput.value = '';
    });

    // Обработчик ввода URL аватара при создании чата
    createChatAvatarUrlInput.addEventListener('input', () => {
        const url = createChatAvatarUrlInput.value.trim();
        if (url) {
            createChatAvatarPreview.src = url;
            createChatAvatarFileInput.value = '';
        } else {
            createChatAvatarPreview.src = 'https://ui-avatars.com/api/?name=NC';
        }
    });

    // Обработчик кнопки настроек текущего чата
    currentChatSettingsBtn.addEventListener('click', () => {
        if (!currentChatId || !allChatsMetadata) return;

        const currentChat = allChatsMetadata.find(chat => chat.chat_id === currentChatId);
        if (currentChat) {
            chatSettingsModalTitle.querySelector('span').textContent = sanitizeHTML(currentChat.name);
            chatSettingsNameInput.value = currentChat.name;
            chatSettingsAvatarUrlInput.value = currentChat.avatar.startsWith('http') || currentChat.avatar.startsWith('/static/') ? currentChat.avatar : '';
            chatSettingsAvatarPreview.src = getAvatarUrl(currentChat.avatar);
            chatSettingsAvatarPreview.alt = currentChat.name;
            chatSettingsAvatarFileInput.value = '';
            chatSettingsModal.style.display = 'block'; // ОТКРЫВАЕМ МОДАЛЬНОЕ ОКНО
        }
    });

    // Обработчик кнопки сохранения настроек чата
    saveChatSettingsBtn.addEventListener('click', () => {
        if (!currentChatId) return;

        const newName = chatSettingsNameInput.value.trim();
        let newAvatar = chatSettingsAvatarUrlInput.value.trim();

        if (!newName) {
            console.error('Название чата не может быть пустым.');
            return;
        }

        if (chatSettingsAvatarFileInput.files.length > 0) {
            const file = chatSettingsAvatarFileInput.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                newAvatar = reader.result;
                socket.emit('update_chat_settings', { chat_id: currentChatId, name: newName, avatar: newAvatar });
                chatSettingsModal.style.display = 'none';
            };
            reader.readAsDataURL(file);
        } else {
            const currentChat = allChatsMetadata.find(chat => chat.chat_id === currentChatId);
            if (!newAvatar && (!currentChat || (!currentChat.avatar.startsWith('data:image') && !currentChat.avatar.startsWith('/static/')))) {
                 newAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}`;
            } else if (!newAvatar && currentChat && (currentChat.avatar.startsWith('data:image') || currentChat.avatar.startsWith('/static/'))) {
                newAvatar = currentChat.avatar;
            }

            socket.emit('update_chat_settings', { chat_id: currentChatId, name: newName, avatar: newAvatar });
            chatSettingsModal.style.display = 'none';
        }
    });

    // Обработчик изменения файла аватара в настройках чата
    chatSettingsAvatarFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                chatSettingsAvatarPreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            const currentChat = allChatsMetadata.find(chat => chat.chat_id === currentChatId);
            chatSettingsAvatarPreview.src = getAvatarUrl(currentChat ? currentChat.avatar : '?');
        }
        chatSettingsAvatarUrlInput.value = '';
    });

    // Обработчик ввода URL аватара в настройках чата
    chatSettingsAvatarUrlInput.addEventListener('input', () => {
        const url = chatSettingsAvatarUrlInput.value.trim();
        if (url) {
            chatSettingsAvatarPreview.src = url;
            chatSettingsAvatarFileInput.value = '';
        } else {
            const currentChat = allChatsMetadata.find(chat => chat.chat_id === currentChatId);
            chatSettingsAvatarPreview.src = getAvatarUrl(currentChat ? currentChat.avatar : '?');
        }
    });

    // Обработчик кнопки отправки сообщения
    sendBtn.addEventListener('click', () => {
        const messageContent = messageInput.value.trim();
        if (messageContent && currentChatId && currentUser) {
            // Мгновенное отображение сообщения пользователя
            const userMessage = {
                id: `user_msg_${Date.now()}`, // Временный ID для локального отображения
                user_id: currentUser.id,
                username: currentUser.username,
                avatar: currentUser.avatar,
                content: messageContent,
                timestamp: new Date().toISOString(),
                is_ai: false
            };
            appendMessageToChatWindow(userMessage);

            // Отправляем сообщение на сервер, указывая, что оно уже отображено локально
            socket.emit('send_message', {
                chat_id: currentChatId,
                user_id: currentUser.id,
                username: currentUser.username,
                avatar: currentUser.avatar,
                message: messageContent,
                is_local_display: true // Новый флаг
            });
            messageInput.value = ''; // Очищаем поле ввода
        }
    });

    // Обработчик нажатия клавиши Enter в поле ввода сообщения
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { // Отправляем по Enter, если не зажат Shift
            event.preventDefault(); // Предотвращаем новую строку
            sendBtn.click(); // Имитируем клик по кнопке отправки
        }
    });

    // Обработчик клика по элементу списка чатов
    function handleChatClick(chatId) {
        console.log(`Clicked on chat: ${chatId}`); // Лог для отладки
        if (currentChatId === chatId) {
            console.log(`Chat ${chatId} is already active.`);
            return; // Если чат уже активен, ничего не делаем
        }

        currentChatId = chatId; // Устанавливаем текущий активный чат
        localStorage.setItem('lastActiveChatId', currentChatId); // Сохраняем в локальное хранилище

        // Находим метаданные для выбранного чата
        const selectedChatMetadata = allChatsMetadata.find(chat => chat.chat_id === chatId);
        renderChatWindow(selectedChatMetadata); // Рендерим заголовок и заполнитель окна чата

        // Запрашиваем историю для нового выбранного чата
        socket.emit('request_chat_history', { chat_id: currentChatId });

        // Обновляем активный класс в списке чатов для немедленной визуальной обратной связи
        document.querySelectorAll('.chat-list-item').forEach(item => {
            if (item.dataset.chatId === currentChatId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Обработчики кнопок закрытия модальных окон
    document.querySelectorAll('.modal .close-btn, .modal .cancel-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const modalId = event.target.dataset.modalId;
            if (modalId) {
                document.getElementById(modalId).style.display = 'none';
            }
        });
    });

    // Закрытие модального окна при клике вне его
    window.addEventListener('click', (event) => {
        if (event.target === createChatModal) {
            createChatModal.style.display = 'none';
        }
        if (event.target === chatSettingsModal) {
            chatSettingsModal.style.display = 'none';
        }
        if (event.target === generalSettingsModal) {
            generalSettingsModal.style.display = 'none';
        }
    });

    // Обработчик ввода в поле поиска чатов
    chatSearchInput.addEventListener('input', () => {
        renderChatList(allChatsMetadata); // Перерисовываем список чатов с учетом фильтра поиска
    });


    // --- Обработчики событий Socket.IO ---

    // Событие подключения к серверу
    socket.on('connect', () => {
        console.log('Connected to server!');
        if (currentUser) {
            socket.emit('set_user_info', currentUser); // Отправляем информацию о пользователе на сервер
        }
        socket.emit('request_all_chats_metadata'); // Запрашиваем все метаданные чатов при подключении
    });

    // Событие отключения от сервера
    socket.on('disconnect', () => {
        console.log('Disconnected from server.');
    });

    // Событие получения всех метаданных чатов
    socket.on('all_chats_metadata', (chats) => {
        console.log('Received all chat metadata:', chats); // Лог для отладки
        allChatsMetadata = chats; // Сохраняем все чаты
        renderChatList(allChatsMetadata); // Рендерим список чатов

        const lastActiveChatId = localStorage.getItem('lastActiveChatId');
        if (lastActiveChatId && allChatsMetadata.some(chat => chat.chat_id === lastActiveChatId)) {
            handleChatClick(lastActiveChatId);
        } else if (allChatsMetadata.length > 0 && !currentChatId) {
            handleChatClick(allChatsMetadata[0].chat_id);
        } else if (!currentChatId) {
            renderChatWindow(null);
        }
    });

    // Событие создания чата
    socket.on('chat_created', (data) => {
        console.log('Chat created:', data.name);
        handleChatClick(data.chat_id);
    });

    // Событие получения истории чата
    socket.on('chat_history', (data) => {
        console.log('Received chat history for:', data.chat_id); // Лог для отладки
        console.log('History data:', data.history); // Лог для отладки
        if (data.chat_id === currentChatId) { // Убеждаемся, что история для текущего чата
            renderMessages(data.history); // Рендерим сообщения
        }
    });

    // Событие получения нового сообщения (для сообщений, не отображенных локально, или завершенных AI-сообщений)
    socket.on('new_message', (data) => {
        const message = data.message;
        const chatId = data.chat_id;

        // Игнорируем сообщения, которые уже были отображены локально
        if (message.user_id === currentUser.id && message.is_local_display) {
            return;
        }

        // Если это потоковое AI-сообщение, которое только инициализируется, добавляем его
        if (message.is_streaming && message.is_ai && chatId === currentChatId) {
            const messageElement = appendMessageToChatWindow(message);
            streamingAIMessages[message.id] = messageElement.querySelector('.message-content');
            return; // Не обновляем метаданные и список чатов для начального потокового сообщения
        }

        // Обновляем метаданные чата
        const chatIndex = allChatsMetadata.findIndex(chat => chat.chat_id === chatId);
        if (chatIndex !== -1) {
            allChatsMetadata[chatIndex].last_message = message.content;
            allChatsMetadata[chatIndex].last_message_time = message.timestamp;
            allChatsMetadata.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
            renderChatList(allChatsMetadata);
        } else {
            socket.emit('request_all_chats_metadata');
        }

        // Добавляем сообщение, если это текущий чат и оно не является потоковым AI-сообщением
        if (chatId === currentChatId && !message.is_streaming) {
            if (!message.is_ai || !streamingAIMessages[message.id]) {
                appendMessageToChatWindow(message);
            }
        }
    });

    // Событие получения чанка потокового сообщения от AI
    socket.on('new_message_chunk', (data) => {
        const chatId = data.chat_id;
        const messageId = data.message_id;
        const contentChunk = data.content;

        if (chatId === currentChatId && streamingAIMessages[messageId]) {
            // Добавляем чанк к содержимому существующего элемента сообщения AI
            streamingAIMessages[messageId].textContent += contentChunk;
            chatWindow.scrollTop = chatWindow.scrollHeight; // Прокручиваем до конца
        }
    });

    // Событие завершения потока сообщения от AI
    socket.on('message_stream_end', (data) => {
        const chatId = data.chat_id;
        const messageId = data.message_id;

        if (chatId === currentChatId && streamingAIMessages[messageId]) {
            delete streamingAIMessages[messageId];
        }
    });

    // Событие ошибки от сервера
    socket.on('error', (data) => {
        console.error('Server error:', data.message);
    });


    // --- Инициализация при загрузке страницы ---
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            if (!currentUser || typeof currentUser.username !== 'string') {
                console.warn("Invalid currentUser data in localStorage, re-prompting login.");
                currentUser = null;
                localStorage.removeItem('currentUser');
                loginOverlay.style.display = 'flex';
                appContainer.style.display = 'none';
                return;
            }

            socket.connect();
            loginOverlay.style.display = 'none';
            appContainer.style.display = 'flex';
            updateUserSettingsUI();
        } catch (e) {
            console.error("Error parsing currentUser from localStorage:", e);
            currentUser = null;
            localStorage.removeItem('currentUser');
            loginOverlay.style.display = 'flex';
            appContainer.style.display = 'none';
        }
    } else {
        loginOverlay.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});
