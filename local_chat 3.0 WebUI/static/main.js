document.addEventListener('DOMContentLoaded', () => {
    const socket = io({ autoConnect: false });

    // Login Elements
    const loginOverlay = document.getElementById('loginOverlay');
    const usernameInput = document.getElementById('usernameInput');
    const avatarUrlInput = document.getElementById('avatarUrlInput');
    const joinBtn = document.getElementById('joinBtn');

    // Main App Elements
    const appContainer = document.querySelector('.app-container');
    const chatListUL = document.getElementById('chatList');
    const chatSearchInput = document.getElementById('chatSearchInput');
    // addChatBtn is located in a separate div (.chat-list-add-btn) next to search input in HTML
    const addChatBtn = document.getElementById('addChatBtn');

    const currentUserAvatarSmall = document.getElementById('currentUserAvatarSmall');
    const currentUsernameSmall = document.getElementById('currentUsernameSmall');
    const generalSettingsBtn = document.getElementById('generalSettingsBtn');

    // Chat Area Elements
    const currentChatHeader = document.getElementById('currentChatHeader');
    const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    const chatHeaderName = document.getElementById('chatHeaderName');
    const currentChatSettingsBtn = document.getElementById('currentChatSettingsBtn');
    const chatWindow = document.getElementById('chatWindow');
    const messageInputContainer = document.getElementById('messageInputContainer');
    const messageTextInput = document.getElementById('messageText');
    const sendBtn = document.getElementById('sendBtn');
    const attachFileBtn = document.getElementById('attachFileBtn');
    const imageUploadInput = document.getElementById('imageUploadInput');
    const noChatSelectedMessage = document.getElementById('noChatSelectedMessage');

    // Image Preview Elements (for messages)
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const imageCaptionInput = document.getElementById('imageCaptionInput');
    const sendImageBtn = document.getElementById('sendImageBtn');
    const cancelImageBtn = document.getElementById('cancelImageBtn');

    // General Settings Modal Elements
    const generalSettingsModal = document.getElementById('generalSettingsModal');
    const generalSettingsUsernameInput = document.getElementById('generalSettingsUsername');
    const generalSettingsAvatarUrlInput = document.getElementById('generalSettingsAvatarUrl');
    const generalSettingsAvatarFileInput = document.getElementById('generalSettingsAvatarFile');
    const generalSettingsAvatarPreview = document.getElementById('generalSettingsAvatarPreview');
    const saveGeneralSettingsBtn = document.getElementById('saveGeneralSettingsBtn');

    // Chat Settings Modal Elements
    const chatSettingsModal = document.getElementById('chatSettingsModal');
    const chatSettingsModalTitle = document.getElementById('chatSettingsModalTitle').querySelector('span');
    const chatSettingsAvatarUrlInput = document.getElementById('chatSettingsAvatarUrl');
    const chatSettingsAvatarFileInput = document.getElementById('chatSettingsAvatarFile');
    const chatSettingsAvatarPreview = document.getElementById('chatSettingsAvatarPreview');
    const saveChatSettingsBtn = document.getElementById('saveChatSettingsBtn');

    // Close Modal Buttons
    document.querySelectorAll('.close-modal-btn, .cancel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Use data-modal-id attribute to get the target modal ID
            const modalId = btn.dataset.modalId;
            if (modalId) {
                 closeModal(modalId);
            } else {
                // Fallback if data-modal-id is not set, maybe close the parent modal?
                // Find the closest modal parent and close it
                const modal = btn.closest('.modal-overlay');
                if(modal) closeModal(modal.id);
            }
        });
    });


    let currentUser = {
        username: null,
        avatar: null // Use null initially, set default during login/settings
    };
    let currentChatId = null;
    let chats = {};
    let selectedImageFile = null; // For message images
    let tempGeneralAvatarBase64 = null; // For general settings avatar preview
    let tempChatAvatarBase64 = null; // For chat settings avatar preview

    // Get CSS variables - do this once after DOM is ready
    const rootStyles = getComputedStyle(document.documentElement);
    const spacingMedium = rootStyles.getPropertyValue('--spacing-medium');
    const textSecondaryColor = rootStyles.getPropertyValue('--text-secondary-color');


    // --- MODAL HANDLING ---
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            // Optional: Add a class to body to prevent scrolling
            document.body.classList.add('modal-open');
             // Focus the first input field in the modal for better UX
             const firstInput = modal.querySelector('input:not([type="hidden"]):not([type="file"]), button');
             if(firstInput) firstInput.focus();
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            // Optional: Remove the class from body
            document.body.classList.remove('modal-open');

            // Reset temporary avatar previews and file inputs
            if (modalId === 'generalSettingsModal') {
                 tempGeneralAvatarBase64 = null;
                 generalSettingsAvatarFileInput.value = ''; // Clear file input
                 // Reset preview to current user avatar if available
                 generalSettingsAvatarPreview.src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.username || '?')}&background=random&size=100`;
                 generalSettingsAvatarUrlInput.value = currentUser.avatar && !currentUser.avatar.startsWith('data:image') ? currentUser.avatar : ''; // Reset URL input correctly
            } else if (modalId === 'chatSettingsModal') {
                 tempChatAvatarBase64 = null; // Corrected typo
                 chatSettingsAvatarFileInput.value = ''; // Clear file input
                 // Reset preview to current chat avatar if available
                 if (currentChatId && chats[currentChatId]) {
                     const chat = chats[currentChatId];
                     chatSettingsAvatarPreview.src = chat.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name.substring(0,2))}&background=random&size=100`;
                     chatSettingsAvatarUrlInput.value = chat.avatar && !chat.avatar.startsWith('data:image') ? chat.avatar : ''; // Reset URL input
                 } else {
                     // If no chat is selected, reset to a default placeholder
                     chatSettingsAvatarPreview.src = 'https://ui-avatars.com/api/?name=??&background=random&size=100';
                     chatSettingsAvatarUrlInput.value = '';
                 }
            }
        }
    }

     // Close modals when clicking outside the modal content
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            // Check if the click target is the overlay itself, not the modal-content
            if (e.target === overlay) {
                closeModal(overlay.id);
            }
        });
    });

    // Prevent clicks inside modal-content from closing the modal
    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop the click from bubbling up to the overlay
        });
    });


    // --- LOGIN ---
    function attemptLogin() {
        const username = usernameInput.value.trim();
        const avatarUrl = avatarUrlInput.value.trim();

        if (!username) {
            alert('Имя пользователя обязательно!');
            usernameInput.focus(); // Focus username input
            return;
        }
        currentUser.username = username;
        // Use provided URL or generate a default avatar
        currentUser.avatar = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username.substring(0,2))}&background=random&size=40`; // Use first 2 letters

        sessionStorage.setItem('chat_username', currentUser.username);
        sessionStorage.setItem('chat_avatar', currentUser.avatar);

        updateCurrentUserDisplay();

        loginOverlay.style.display = 'none';
        appContainer.style.display = 'flex';

        socket.connect(); // Connect Socket.IO after successful login
    }

    joinBtn.addEventListener('click', attemptLogin);

    // Allow joining by pressing Enter in the avatar URL field
    avatarUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default form submission
            attemptLogin();
        }
    });
    // Allow joining by pressing Enter in the username field
     usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default form submission
            attemptLogin();
        }
    });


    // Check for saved user on page load
    const savedUsername = sessionStorage.getItem('chat_username');
    const savedAvatar = sessionStorage.getItem('chat_avatar');

    if (savedUsername) {
        currentUser.username = savedUsername;
        currentUser.avatar = savedAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(savedUsername.substring(0,2))}&background=random&size=40`; // Use saved or generate default

        // Populate inputs for consistency if login overlay is briefly shown or for debugging
        usernameInput.value = currentUser.username;
        avatarUrlInput.value = currentUser.avatar && !currentUser.avatar.startsWith('data:image') ? currentUser.avatar : ''; // Only populate URL input if it's a URL

        attemptLogin(); // Attempt login automatically
    } else {
        loginOverlay.style.display = 'flex'; // Show login if no saved user
        appContainer.style.display = 'none';
         usernameInput.focus(); // Focus username input on load
    }


    function updateCurrentUserDisplay() {
        currentUserAvatarSmall.src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.username || '?')}&background=random&size=40`;
        currentUsernameSmall.textContent = currentUser.username || 'Имя пользователя';
    }


    // --- SOCKET.IO EVENT HANDLERS ---
    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        // Request initial chat list upon connection
        socket.emit('get_chat_list'); // Assuming server has this event listener now
    });

    socket.on('chat_list', (receivedChats) => {
        console.log('Received chat list:', receivedChats);
        // Convert the received chat list array into an object keyed by chat_id for easier access
        chats = receivedChats.reduce((obj, chat) => {
             obj[chat.chat_id] = chat;
             return obj;
        }, {});
        renderChatList();

        // Attempt to select the last active chat
        const lastChatId = sessionStorage.getItem('current_chat_id');
        if (lastChatId && chats[lastChatId]) {
            selectChat(lastChatId);
        } else {
             // If no last chat or last chat doesn't exist, show no chat selected message
             displayNoChatSelected();
        }
    });

    socket.on('chat_created', (chatData) => {
        console.log('Chat created/updated on client:', chatData);
         // Update the chat object with potentially new data (like server-set avatar if not provided by user)
        chats[chatData.chat_id] = {
            // Keep existing properties unless overwritten by chatData
             ...(chats[chatData.chat_id] || {}), // Merge with existing data if chat_id was already known
             name: chatData.name,
             avatar: chatData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(chatData.name.substring(0,2))}&background=random&size=45`, // Use first 2 letters
             last_message_preview: chatData.last_message_preview || '',
             last_message_time: chatData.last_message_time || '',
             ...chatData // Spread to include any other fields like created_at, creator_sid
        };
        renderChatList();

        // If this client created the chat, select it automatically
        if (chatData.creator_sid === socket.id) {
             selectChat(chatData.chat_id);
        } else if (Object.keys(chats).length === 1 && !currentChatId) {
             // If it's the very first chat and nothing was selected, select it
             selectChat(chatData.chat_id);
        }
         // If chat was created by someone else, it will just appear in the list via renderChatList
    });

     socket.on('chat_history', (data) => {
        console.log('Received chat history for chat:', data.chat_id, data.history);
        if (data.chat_id !== currentChatId) {
            console.warn('Received history for inactive chat. Ignoring.', data.chat_id);
            return;
        }
        chatWindow.innerHTML = ''; // Clear current messages
        if (data.history && data.history.length > 0) {
             data.history.forEach(msg => {
                  // Use sender_sid to determine if the message is from the current user
                  const isSelf = msg.sender_sid === socket.id;
                  appendMessage(msg, isSelf);
             });
             scrollToBottom(); // Scroll after loading history
        } else {
             // Display a message if chat history is empty
             const emptyHistoryDiv = document.createElement('div');
             emptyHistoryDiv.style.textAlign = 'center';
             // Correctly get CSS variable values using getComputedStyle
             emptyHistoryDiv.style.color = textSecondaryColor; // Use pre-fetched variable
             emptyHistoryDiv.style.marginTop = '20px';
             emptyHistoryDiv.textContent = 'Начните диалог...';
             chatWindow.appendChild(emptyHistoryDiv);
              // No scroll needed for empty history
        }
    });


    socket.on('new_message', (msg) => {
        console.log('Received new message:', msg);
        // Only append message if it belongs to the currently active chat
        if (msg.chat_id === currentChatId) {
            // Determine if the message was sent by this client using sender_sid
            const isSelf = msg.sender_sid === socket.id;

            // Append the message. Since we removed optimistic appending in sendMessage,
            // all messages (including our own) are now appended here when received from server.
            appendMessage(msg, isSelf); // Pass isSelf for correct styling

            scrollToBottom(); // Scroll down after adding message
        }
        // Update last message preview and time in chat list for the relevant chat
         if (chats[msg.chat_id]) {
             // Update preview text based on message type
            let preview = msg.text || '';
             if (msg.type === 'image') {
                preview = '📷 Image' + (msg.text ? `: ${msg.text.substring(0, 20)}...` : '');
             } else {
                 preview = msg.text ? msg.text.substring(0, 30) + (msg.text.length > 30 ? '...' : '') : 'Нет сообщений';
             }

            chats[msg.chat_id].last_message_preview = preview;
            chats[msg.chat_id].last_message_time = msg.time; // Assuming server sends time in sortable format

            // Re-render chat list to show updated preview and time
            renderChatList();

             // If the chat is not currently active, maybe highlight it or add a notification?
             // (Implementation depends on desired UI/UX for unread messages)
        }
    });

     socket.on('chat_updated_ack', (updatedChatData) => { // Listen for updates from server
        console.log('Chat updated by server:', updatedChatData);
        if (chats[updatedChatData.chat_id]) {
            // Update the chat data in our local chats object
            chats[updatedChatData.chat_id] = {
                 ...(chats[updatedData.chat_id] || {}), // Merge existing data (use updatedData to be safe)
                 ...updatedChatData // Overwrite with server's latest data
            };
            renderChatList(); // Re-render to show new avatar/name in list
            if (currentChatId === updatedChatData.chat_id) {
                // Update current chat header if it's the active one
                const chat = chats[currentChatId]; // Get latest data
                chatHeaderName.textContent = chat.name;
                chatHeaderAvatar.src = chat.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name.substring(0,2))}&background=random&size=40`; // Use chat's avatar
            }
        }
    });


    socket.on('error', (error) => {
        console.error('Socket Error:', error);
        alert('Ошибка: ' + (error.message || 'Произошла ошибка.'));
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        // Optionally show a "disconnected" message to the user
        // alert(`Disconnected from server: ${reason}`);
    });


    // --- CHAT LIST LOGIC ---
    function renderChatList() {
        chatListUL.innerHTML = ''; // Clear current list

        // Sort chats by last message time (newest first)
        // Assuming server sends ISO 8601 time strings which are sortable
        const sortedChatIds = Object.keys(chats).sort((a, b) => {
            const timeA = chats[a].last_message_time || ''; // Use empty string for chats with no messages
            const timeB = chats[b].last_message_time || '';
            return timeB.localeCompare(timeA); // Sort descending
        });

        if (sortedChatIds.length === 0) {
             const noChatsItem = document.createElement('li');
             noChatsItem.style.textAlign = 'center';
             // Correctly get CSS variable values using pre-fetched variables
             noChatsItem.style.padding = spacingMedium; // Use pre-fetched variable
             noChatsItem.style.color = textSecondaryColor; // Use pre-fetched variable
             noChatsItem.textContent = 'Нет доступных чатов. Создайте новый!';
             chatListUL.appendChild(noChatsItem);
             return;
        }

        // If there are chats, render them
        sortedChatIds.forEach(chat_id => {
            const chat = chats[chat_id];
            const listItem = document.createElement('li');
            listItem.className = 'chat-list-item';
            listItem.dataset.chatId = chat_id;
            if (chat_id === currentChatId) {
                listItem.classList.add('active');
            }

            // Use chat's avatar or generate default
            const chatAvatar = chat.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name.substring(0, Math.min(2, chat.name.length)) || '?')}&background=random&size=45`; // Handle empty name
            const lastMsgPreview = chat.last_message_preview || 'Нет сообщений';
            // Format time for display, handle potential ISO strings from server
            const lastMsgTimeDisplay = chat.last_message_time ? formatDisplayTime(chat.last_message_time) : '';


            listItem.innerHTML = `
                <img src="${chatAvatar}" alt="${chat.name} avatar" class="avatar">
                <div class="chat-info">
                    <div class="chat-name">${chat.name}</div>
                    <div class="last-message">${lastMsgPreview}</div>
                </div>
                <div class="chat-meta">
                    <span class="timestamp">${lastMsgTimeDisplay}</span>
                </div>
            `;
            listItem.addEventListener('click', () => selectChat(chat_id));
            chatListUL.appendChild(listItem);
        });
    }

    function selectChat(chat_id) {
        if (currentChatId === chat_id) return; // Prevent re-selecting same chat

        // Remove 'active' class from previously selected item
        if (currentChatId) {
            const prevActiveItem = document.querySelector(`.chat-list-item[data-chat-id="${currentChatId}"]`);
            if (prevActiveItem) {
                prevActiveItem.classList.remove('active');
            }
             // Notify server about leaving the room
             socket.emit('leave_chat', { chat_id: currentChatId });
        }

        currentChatId = chat_id; // Set the new active chat ID
        sessionStorage.setItem('current_chat_id', currentChatId); // Save to session storage

        // Add 'active' class to the newly selected item
        const newActiveItem = document.querySelector(`.chat-list-item[data-chat-id="${currentChatId}"]`);
        if (newActiveItem) {
            newActiveItem.classList.add('active');
        }

        // Update chat header
        const selectedChatData = chats[currentChatId];
        if (selectedChatData) {
            chatHeaderName.textContent = selectedChatData.name;
             // Use chat's avatar or generate default based on name
            chatHeaderAvatar.src = selectedChatData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChatData.name.substring(0, Math.min(2, selectedChatData.name.length)) || '?')}&background=random&size=40`; // Handle empty name
            currentChatHeader.style.display = 'flex';
            messageInputContainer.style.display = 'flex'; // Show input area
            imagePreviewContainer.style.display = 'none'; // Hide image preview if visible from previous chat
            noChatSelectedMessage.style.display = 'none'; // Hide 'no chat selected' message
            currentChatSettingsBtn.style.display = 'block'; // Show chat settings button

            // Request chat history for the selected chat
            // Pass current user info for server context if needed (e.g., permissions)
            socket.emit('join_chat', { chat_id: currentChatId, username: currentUser.username, user_sid: socket.id });
             chatWindow.innerHTML = ''; // Clear window immediately while waiting for history
             // Show a loading indicator here?
        } else {
             // This case should ideally not happen if chat_id comes from chats object
             console.error("Attempted to select a chat_id that doesn't exist in chats:", chat_id);
             displayNoChatSelected(); // Fallback
        }
    }

    function displayNoChatSelected() {
        currentChatId = null; // Clear current chat ID
        sessionStorage.removeItem('current_chat_id');
        currentChatHeader.style.display = 'none';
        messageInputContainer.style.display = 'none';
        imagePreviewContainer.style.display = 'none'; // Hide image preview too
        noChatSelectedMessage.style.display = 'flex'; // Show 'no chat selected' message
         currentChatSettingsBtn.style.display = 'none'; // Hide chat settings button
        chatWindow.innerHTML = ''; // Clear any previous messages
    }


    addChatBtn.addEventListener('click', () => {
        const chatName = prompt('Введите название нового чата:');
        if (chatName && chatName.trim()) {
            socket.emit('create_chat', { chat_name: chatName.trim() });
        }
    });

    chatSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const chatItems = chatListUL.querySelectorAll('.chat-list-item');
        chatItems.forEach(item => {
            const chatName = item.querySelector('.chat-name').textContent.toLowerCase();
            const lastMessageElement = item.querySelector('.last-message');
            const lastMessage = lastMessageElement ? lastMessageElement.textContent.toLowerCase() : ''; // Handle case with no last message

            // Check if the item should be displayed based on search term
            if (chatName.includes(searchTerm) || lastMessage.includes(searchTerm)) {
                item.style.display = 'flex'; // Show matching items
            } else {
                item.style.display = 'none'; // Hide non-matching items
            }
        });
    });


    // --- MESSAGE SENDING & APPENDING ---
    function sendMessage() {
        const text = messageTextInput.value.trim();
        if (!text || !currentChatId) return;

        const msgObj = {
            chat_id: currentChatId,
            username: currentUser.username,
            avatar: currentUser.avatar, // Send user's current avatar
            text: text,
            type: 'text',
            // Server will add time and sender_sid
        };

        socket.emit('message', msgObj);
        messageTextInput.value = ''; // Clear input after sending

        // NO OPTIMISTIC APPENDING HERE to avoid duplication
        // Message will be appended when received back from the server via 'new_message'
    }

    sendBtn.addEventListener('click', sendMessage);

    // Send message on Enter key press (without Shift)
    messageTextInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent newline in textarea
            sendMessage();
        }
    });

    attachFileBtn.addEventListener('click', () => {
        imageUploadInput.click(); // Trigger the hidden file input click
    });

    // Handle file selection for image messages
    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            selectedImageFile = file; // Store the file object
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result; // Show preview (Base64 data URL)
                imagePreviewContainer.style.display = 'flex'; // Show preview container
                messageInputContainer.style.display = 'none'; // Hide text input
                imageCaptionInput.value = ''; // Clear previous caption
                imageCaptionInput.focus(); // Focus caption input
            }
            reader.readAsDataURL(file); // Read file as Base64
        } else {
            selectedImageFile = null;
            // Optional: Clear the file input even if selection was cancelled or invalid
            imageUploadInput.value = '';
             if (file) alert('Пожалуйста, выберите файл изображения.');
        }
    });

    // Send image message
    sendImageBtn.addEventListener('click', () => {
        if (!selectedImageFile || !currentChatId || !imagePreview.src || imagePreview.src === '#') {
            alert('Не выбрано изображение или чат.'); // Basic validation
            return;
        }

        const caption = imageCaptionInput.value.trim();
        const base64Image = imagePreview.src; // Get Base64 data URL from preview

        const msgObj = {
            chat_id: currentChatId,
            username: currentUser.username,
            avatar: currentUser.avatar, // Send user's current avatar
            type: 'image',
            image_data: base64Image, // Send Base64 string (Data URL)
            text: caption, // Send caption as text
            // Server will add time and sender_sid
        };

        socket.emit('message', msgObj);

        // Clear preview and switch back to text input
        cancelImagePreview();

        // NO OPTIMISTIC APPENDING HERE
        // Message will be appended when received back from the server via 'new_message'
    });

    // Cancel image preview and sending
    cancelImageBtn.addEventListener('click', () => {
        cancelImagePreview();
        messageTextInput.focus(); // Focus message input after canceling
    });

    function cancelImagePreview() {
         selectedImageFile = null;
         imagePreview.src = '#'; // Clear preview image
         imagePreviewContainer.style.display = 'none'; // Hide preview container
         messageInputContainer.style.display = 'flex'; // Show text input again
         imageUploadInput.value = ''; // Clear the file input value
         imageCaptionInput.value = ''; // Clear caption
    }


    function appendMessage(msgObj, isSelf = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper');
        if (isSelf) {
            messageWrapper.classList.add('right');
        } else {
            messageWrapper.classList.add('left');
        }

        const avatarImg = document.createElement('img');
        avatarImg.classList.add('avatar');
         // Use msgObj.avatar if available, fallback to a generated one
         // Use first 2 letters for default avatar if username is available
        avatarImg.src = msgObj.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msgObj.username.substring(0, Math.min(2, msgObj.username.length)) || '?')}&background=random&size=40`; // Handle empty username
        avatarImg.alt = `${msgObj.username} avatar`;

        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message');

        const usernameSpan = document.createElement('div');
        usernameSpan.classList.add('username');
        usernameSpan.textContent = msgObj.username;
        messageBubble.appendChild(usernameSpan);

        if (msgObj.type === 'text') {
            // Use textContent for safety against XSS
            messageBubble.appendChild(document.createTextNode(msgObj.text));
        } else if (msgObj.type === 'image' && msgObj.image_data) {
             const imgElement = document.createElement('img');
             imgElement.src = msgObj.image_data;
             imgElement.alt = msgObj.text || 'Image';
             imgElement.classList.add('chat-image');
             // Optional: Add click handler to view full image
             // imgElement.addEventListener('click', () => window.open(imgElement.src, '_blank'));

             messageBubble.appendChild(imgElement);

             // Add caption below the image if it exists and is not empty
             if (msgObj.text && msgObj.text.trim()) {
                const captionElement = document.createElement('p');
                 // Use textContent for safety
                captionElement.textContent = msgObj.text.trim();
                 captionElement.style.fontSize = '0.9em';
                 captionElement.style.color = '#555'; // Hardcoded, could use a variable
                 captionElement.style.marginTop = '5px';
                 captionElement.style.marginBottom = '0';
                 messageBubble.appendChild(captionElement);
             }

        } else if (msgObj.type === 'image' && msgObj.text) {
             // Fallback for image message without image_data (e.g., just a caption received)
             // Use textContent for safety
             messageBubble.appendChild(document.createTextNode(`[Image] ${msgObj.text.trim()}`));
        } else {
             // Fallback for unknown message type or empty content
             messageBubble.appendChild(document.createTextNode(msgObj.text || '[Empty Message]'));
        }


        // Time element is now part of the message content bubble
        const timeSpan = document.createElement('div');
        timeSpan.classList.add('time');
        timeSpan.textContent = formatDisplayTime(msgObj.time); // Format time for display
        messageBubble.appendChild(timeSpan); // Append time INSIDE the message bubble

        messageContent.appendChild(messageBubble); // messageContent now contains bubble with username, content, and time

        messageWrapper.appendChild(avatarImg);
        messageWrapper.appendChild(messageContent);

        // Ensure 'No chat selected' message is hidden
        if (noChatSelectedMessage.style.display !== 'none') {
             noChatSelectedMessage.style.display = 'none';
        }

        chatWindow.appendChild(messageWrapper);
    }

    // --- GENERAL USER SETTINGS ---
    generalSettingsBtn.addEventListener('click', () => {
        generalSettingsUsernameInput.value = currentUser.username;
        // Set URL input value only if the current avatar is not a data URL (Base64)
        generalSettingsAvatarUrlInput.value = currentUser.avatar && !currentUser.avatar.startsWith('data:image') ? currentUser.avatar : '';
        generalSettingsAvatarPreview.src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.username.substring(0, Math.min(2, currentUser.username.length)) || '?')}&background=random&size=100`; // Show current avatar or default
        tempGeneralAvatarBase64 = null; // Reset temporary file data
        generalSettingsAvatarFileInput.value = ''; // Clear file input value
        openModal('generalSettingsModal');
    });

    generalSettingsAvatarFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                generalSettingsAvatarPreview.src = e.target.result; // Show preview (Base64)
                tempGeneralAvatarBase64 = e.target.result; // Store base64 for saving
                generalSettingsAvatarUrlInput.value = ''; // Clear URL if file is chosen
            }
            reader.readAsDataURL(file); // Read file as Base64 for preview and potential saving
        } else {
             // Handle case where non-image or no file is selected
            generalSettingsAvatarPreview.src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.username.substring(0, Math.min(2, currentUser.username.length)) || '?')}&background=random&size=100`; // Revert preview
            tempGeneralAvatarBase64 = null;
            generalSettingsAvatarFileInput.value = '';
            if (file) alert('Пожалуйста, выберите файл изображения.');
        }
    });

     generalSettingsAvatarUrlInput.addEventListener('input', () => {
        const url = generalSettingsAvatarUrlInput.value.trim();
        if (url) {
            generalSettingsAvatarPreview.src = url; // Show preview from URL
            tempGeneralAvatarBase64 = null; // Clear file data if URL is entered
            generalSettingsAvatarFileInput.value = ''; // Clear file input
        } else {
            // If URL input is cleared, revert preview to current user avatar or default
            generalSettingsAvatarPreview.src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.username.substring(0, Math.min(2, currentUser.username.length)) || '?')}&background=random&size=100`;
        }
    });


    saveGeneralSettingsBtn.addEventListener('click', () => {
        const newUsername = generalSettingsUsernameInput.value.trim();
        const newAvatarUrl = generalSettingsAvatarUrlInput.value.trim();

        if (!newUsername) {
            alert('Имя пользователя не может быть пустым!');
            generalSettingsUsernameInput.focus();
            return;
        }

        let finalAvatar = currentUser.avatar; // Start with current avatar

        if (tempGeneralAvatarBase64) {
             finalAvatar = tempGeneralAvatarBase64; // Prioritize uploaded file (Base64)
        } else if (newAvatarUrl) {
             finalAvatar = newAvatarUrl; // Use URL if provided
        } else {
             // If both file and URL are empty, regenerate default avatar based on new username
             finalAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(newUsername.substring(0, Math.min(2, newUsername.length)) || '?')}&background=random&size=40`; // Use first 2 letters
        }

        currentUser.username = newUsername;
        currentUser.avatar = finalAvatar;

        sessionStorage.setItem('chat_username', currentUser.username);
        sessionStorage.setItem('chat_avatar', currentUser.avatar); // Save the final avatar URL or Base64

        updateCurrentUserDisplay(); // Update UI

        // Note: Avatars in past messages on the client side won't change automatically.
        // New messages will use the new avatar.

        // Optionally, emit 'update_user_profile' to server if needed for other features
        // socket.emit('update_user_profile', { username: currentUser.username, avatar: currentUser.avatar });

        closeModal('generalSettingsModal');
    });

    // --- CHAT SETTINGS ---
    currentChatSettingsBtn.addEventListener('click', () => {
        if (!currentChatId || !chats[currentChatId]) return; // Ensure a chat is selected

        const chat = chats[currentChatId];
        chatSettingsModalTitle.textContent = chat.name;
         // Set URL input value only if the current chat avatar is not a data URL
        chatSettingsAvatarUrlInput.value = chat.avatar && !chat.avatar.startsWith('data:image') ? chat.avatar : '';
        chatSettingsAvatarPreview.src = chat.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name.substring(0, Math.min(2, chat.name.length)) || '?')}&background=random&size=100`; // Show current avatar or default
        tempChatAvatarBase64 = null; // Reset temporary file data
        chatSettingsAvatarFileInput.value = ''; // Clear file input value
        openModal('chatSettingsModal');
    });

    chatSettingsAvatarFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                chatSettingsAvatarPreview.src = e.target.result; // Show preview (Base64)
                tempChatAvatarBase64 = e.target.result; // Store base64 for saving
                chatSettingsAvatarUrlInput.value = ''; // Clear URL if file chosen
            }
            reader.readAsDataURL(file); // Read file as Base64
        } else {
            // Handle case where non-image or no file is selected
            if (currentChatId && chats[currentChatId]) {
                 const chat = chats[currentChatId];
                 chatSettingsAvatarPreview.src = chat.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name.substring(0, Math.min(2, chat.name.length)) || '?')}&background=random&size=100`; // Revert preview
            } else {
                 chatSettingsAvatarPreview.src = 'https://ui-avatars.com/api/?name=??&background=random&size=100'; // Fallback default
            }
             tempChatAvatarBase64 = null;
             chatSettingsAvatarFileInput.value = '';
            if (file) alert('Пожалуйста, выберите файл изображения.');
        }
    });

    chatSettingsAvatarUrlInput.addEventListener('input', () => {
        const url = chatSettingsAvatarUrlInput.value.trim();
        if (url) {
            chatSettingsAvatarPreview.src = url; // Show preview from URL
            tempChatAvatarBase64 = null; // Clear file data if URL is entered
            chatSettingsAvatarFileInput.value = ''; // Clear file input
        } else if (currentChatId && chats[currentChatId]) {
             // If URL input is cleared, revert preview to current chat avatar or default
            const chat = chats[currentChatId];
            chatSettingsAvatarPreview.src = chat.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name.substring(0, Math.min(2, chat.name.length)) || '?')}&background=random&size=100`;
        } else {
            chatSettingsAvatarPreview.src = 'https://ui-avatars.com/api/?name=??&background=random&size=100'; // Fallback default
        }
    });


    saveChatSettingsBtn.addEventListener('click', () => {
        if (!currentChatId || !chats[currentChatId]) return;

        const newChatAvatarUrl = chatSettingsAvatarUrlInput.value.trim();
        const chat = chats[currentChatId]; // Get current chat data
        let finalAvatar = chat.avatar; // Start with current chat avatar

        if (tempChatAvatarBase64) {
            finalAvatar = tempChatAvatarBase64; // Prioritize uploaded file (Base64)
        } else if (newChatAvatarUrl) {
            finalAvatar = newChatAvatarUrl; // Use URL if provided
        } else {
             // If both file and URL are empty, use a default based on chat name
             finalAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name.substring(0, Math.min(2, chat.name.length)) || '?')}&background=random&size=45`; // Use first 2 letters
        }

        // Optimistically update client-side
        chat.avatar = finalAvatar; // Update the avatar in the local chats object
        renderChatList(); // Update avatar in list
        // Update header avatar if this is the currently viewed chat
        if (currentChatId === chat.chat_id) {
             chatHeaderAvatar.src = finalAvatar;
        }


        // Emit update to server
        socket.emit('update_chat_settings', {
            chat_id: currentChatId,
            avatar: finalAvatar
            // name: newName // If name editing is added to modal
        });

        closeModal('chatSettingsModal');
    });

    // --- UTILITY ---
    function formatDisplayTime(isoOrSimpleTime) {
        // Tries to format time nicely (HH:MM).
        if (!isoOrSimpleTime) return '';

        // If it looks like HH:MM already, return it
        if (/^\d{2}:\d{2}$/.test(isoOrSimpleTime)) {
            return isoOrSimpleTime;
        }

        try {
            // Attempt to parse as ISO string
            const date = new Date(isoOrSimpleTime);
            // Check if date is valid and not the Unix epoch start if it shouldn't be
             if (isNaN(date.getTime()) || date.getTime() === 0) {
                 // If not a valid date, try parsing as simple HH:MM:SS or similar
                 const parts = String(isoOrSimpleTime).split(':'); // Ensure it's a string
                 if (parts.length >= 2) {
                     return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
                 }
                 return String(isoOrSimpleTime); // Return original as string if all else fails
            }

            // Format valid Date object to HH:MM
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        } catch (e) {
            console.error("Failed to parse time:", isoOrSimpleTime, e);
            return String(isoOrSimpleTime); // Return original as string on error
        }
    }


    function scrollToBottom() {
         // Use a slight delay to ensure DOM updates before scrolling
         setTimeout(() => {
            chatWindow.scrollTop = chatWindow.scrollHeight;
         }, 50); // 50ms delay
    }

    // --- INITIALIZATION ---
     // Check for saved user on page load is handled earlier.
     // If logged in, the default view is handled by displayNoChatSelected or selectChat based on last_chat_id

    // Event listener for modal-open class to prevent body scroll
    const body = document.body;
    const modalOverlays = document.querySelectorAll('.modal-overlay');

    const updateBodyScroll = () => {
        let modalOpen = false;
        modalOverlays.forEach(overlay => {
            if (overlay.style.display === 'flex') {
                modalOpen = true;
            }
        });
        if (modalOpen) {
            body.classList.add('modal-open');
        } else {
            body.classList.remove('modal-open');
        }
    };

    // Call updateBodyScroll whenever a modal's display style might change
    // (already handled in openModal/closeModal, but this ensures initial state)
    updateBodyScroll();


}); // End of DOMContentLoaded listener