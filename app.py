from flask import Flask, render_template, request, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import datetime
import json
import os
import base64
import uuid
import requests

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your_secret_key')
socketio = SocketIO(app)

CHAT_HISTORY_DIR = 'chat_histories'
CHAT_LIST_FILE = 'chats.json'
OLLAMA_CHAT_ID = "elixai_gemma_chat" # Фиксированный ID для чата ElixAI (Gemma)
OLLAMA_API_URL = "http://localhost:11434/api/chat" # Используем /api/chat для контекста
OLLAMA_MODEL = "gemma3:1b" # Убедитесь, что это правильная модель, которую вы используете

# Создаем директорию для истории чатов, если она не существует
if not os.path.exists(CHAT_HISTORY_DIR):
    os.makedirs(CHAT_HISTORY_DIR)

# Загружает метаданные всех чатов из файла chats.json
def load_chats_metadata():
    if os.path.exists(CHAT_LIST_FILE):
        with open(CHAT_LIST_FILE, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                if not isinstance(data, dict):
                    print(f"Warning: {CHAT_LIST_FILE} is not a dictionary. Returning empty.")
                    return {}
                return data
            except json.JSONDecodeError:
                print(f"Error decoding JSON from {CHAT_LIST_FILE}. Returning empty.")
                return {}
    return {}

# Сохраняет метаданные всех чатов в файл chats.json
def save_chats_metadata(metadata):
    with open(CHAT_LIST_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=4, ensure_ascii=False)

# Загружает историю конкретного чата
def load_chat_history(chat_id):
    history_file = os.path.join(CHAT_HISTORY_DIR, f"{chat_id}.json")
    if os.path.exists(history_file):
        with open(history_file, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                print(f"Error decoding JSON from {history_file}. Returning empty list.")
                return []
    return []

# Сохраняет историю конкретного чата
def save_chat_history(chat_id, history):
    history_file = os.path.join(CHAT_HISTORY_DIR, f"{chat_id}.json")
    with open(history_file, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=4, ensure_ascii=False)

# Маршрут для главной страницы, которая будет отображать index.html
@app.route('/')
def index():
    return render_template('index.html')

# Маршрут для обслуживания статических файлов (CSS, JS, изображения).
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

# Обработчик события подключения нового клиента Socket.IO
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")
    emit_all_chats_metadata()

# Обработчик события отключения клиента Socket.IO
@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

# Обработчик установки информации о пользователе
@socketio.on('set_user_info')
def handle_set_user_info(data):
    print(f"User info set for {request.sid}: {data}")

# Отправляет метаданные всех чатов всем подключенным клиентам
@socketio.on('request_all_chats_metadata')
def emit_all_chats_metadata():
    chats_metadata = load_chats_metadata()
    # Убеждаемся, что чат ElixAI (Gemma) всегда существует
    if OLLAMA_CHAT_ID not in chats_metadata:
        chats_metadata[OLLAMA_CHAT_ID] = {
            "chat_id": OLLAMA_CHAT_ID,
            "name": "ElixAI (Gemma)",
            "avatar": "/static/ollama_avatar.png",
            "last_message": "Начните чат с Gemma!",
            "last_message_time": datetime.now().isoformat()
        }
        save_chats_metadata(chats_metadata)
    # Сортируем чаты по времени последнего сообщения для отображения
    # и убеждаемся, что чат Ollama всегда первый
    sorted_chats = sorted(chats_metadata.values(), key=lambda x: (x['chat_id'] != OLLAMA_CHAT_ID, x.get('last_message_time', '0')), reverse=True)
    emit('all_chats_metadata', sorted_chats)
    print(f"Sent all chats metadata to {request.sid}")

# Обработчик создания нового чата
@socketio.on('create_new_chat')
def handle_create_new_chat(data):
    user_id = request.sid
    new_chat_id = str(uuid.uuid4())
    chat_name = data.get('name', 'Новый чат').strip()
    chat_avatar = data.get('avatar', 'https://ui-avatars.com/api/?name=NC').strip()
    if not chat_avatar:
        chat_avatar = 'https://ui-avatars.com/api/?name=NC'

    chats_metadata = load_chats_metadata()
    chats_metadata[new_chat_id] = {
        "chat_id": new_chat_id,
        "name": chat_name,
        "avatar": chat_avatar,
        "last_message": "Чат создан.",
        "last_message_time": datetime.now().isoformat()
    }
    save_chats_metadata(chats_metadata)
    save_chat_history(new_chat_id, [])

    emit_all_chats_metadata()
    emit('chat_created', {'chat_id': new_chat_id, 'name': chat_name, 'avatar': chat_avatar})
    print(f"New chat '{chat_name}' created with ID: {new_chat_id}")

# Обработчик запроса истории чата
@socketio.on('request_chat_history')
def handle_request_chat_history(data):
    chat_id = data.get('chat_id')
    if not chat_id:
        emit('error', {'message': 'Chat ID is required.'})
        return

    history = load_chat_history(chat_id)
    emit('chat_history', {'chat_id': chat_id, 'history': history}, room=request.sid)
    print(f"Sent history for chat {chat_id} to {request.sid}")

# Обработчик отправки сообщения
@socketio.on('send_message')
def handle_send_message(data):
    chat_id = data.get('chat_id')
    user_id = data.get('user_id')
    username = data.get('username')
    avatar = data.get('avatar')
    message_content = data.get('message')
    is_local_display = data.get('is_local_display', False)

    if not all([chat_id, user_id, username, message_content]):
        emit('error', {'message': 'Missing message data.'})
        return

    timestamp = datetime.now().isoformat()
    message = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'username': username,
        'avatar': avatar,
        'content': message_content,
        'timestamp': timestamp,
        'is_ai': False
    }

    history = load_chat_history(chat_id)
    history.append(message)
    save_chat_history(chat_id, history)

    chats_metadata = load_chats_metadata()
    if chat_id in chats_metadata:
        chats_metadata[chat_id]['last_message'] = message_content
        chats_metadata[chat_id]['last_message_time'] = timestamp
        save_chats_metadata(chats_metadata)
        emit_all_chats_metadata()

    if not is_local_display:
        emit('new_message', {'chat_id': chat_id, 'message': message}, broadcast=True)
    print(f"Message in chat {chat_id} from {username}: {message_content}")

    if chat_id == OLLAMA_CHAT_ID:
        handle_ollama_response(chat_id, user_id, message_content, request.sid) # Передаем user_id

# Обработчик получения ответа от Ollama с учетом истории и потоковой передачи
def handle_ollama_response(chat_id, user_id, user_prompt, client_sid):
    print(f"Sending prompt to Ollama for chat {chat_id}: {user_prompt}")

    history = load_chat_history(chat_id)
    ollama_messages = []
    for msg in history:
        # Включаем только сообщения, которые не являются системными ошибками, для контекста
        if not msg.get('is_system_error', False):
            if msg['is_ai']:
                ollama_messages.append({"role": "assistant", "content": msg['content']})
            else:
                ollama_messages.append({"role": "user", "content": msg['content']})

    ai_message_id = str(uuid.uuid4())

    initial_ai_message = {
        'id': ai_message_id,
        'user_id': 'ollama_ai',
        'username': 'ElixAI (Gemma)',
        'avatar': '/static/ollama_avatar.png',
        'content': '',
        'timestamp': datetime.now().isoformat(),
        'is_ai': True,
        'is_streaming': True # Флаг, указывающий на потоковое сообщение
    }
    # Отправляем начальное сообщение только тому клиенту, который отправил запрос
    emit('new_message', {'chat_id': chat_id, 'message': initial_ai_message}, room=client_sid)


    full_ai_response_content = ""
    try:
        response = requests.post(OLLAMA_API_URL, json={
            "model": OLLAMA_MODEL,
            "messages": ollama_messages,
            "stream": True
        }, timeout=300, stream=True)

        response.raise_for_status()

        for line in response.iter_lines():
            if line:
                try:
                    json_chunk = json.loads(line.decode('utf-8'))

                    if json_chunk.get('done'):
                        break

                    content_chunk = json_chunk.get('message', {}).get('content', '')
                    if content_chunk:
                        full_ai_response_content += content_chunk
                        # Отправляем каждый чанк клиенту, который отправил запрос
                        emit('new_message_chunk', {
                            'chat_id': chat_id,
                            'message_id': ai_message_id,
                            'content': content_chunk
                        }, room=client_sid)
                except json.JSONDecodeError:
                    print(f"Could not decode JSON from line: {line}")
                    continue

        print(f"Received full response from Ollama: {full_ai_response_content}")

        final_ai_message = {
            'id': ai_message_id,
            'user_id': 'ollama_ai',
            'username': 'ElixAI (Gemma)',
            'avatar': '/static/ollama_avatar.png',
            'content': full_ai_response_content,
            'timestamp': datetime.now().isoformat(),
            'is_ai': True,
            'is_streaming': False # Флаг, указывающий на завершение потока
        }

        # Сохраняем полное сообщение AI в историю после завершения потока
        history = load_chat_history(chat_id)
        found = False
        for i, msg in enumerate(history):
            if msg.get('id') == ai_message_id: # Ищем по ID, чтобы обновить существующее сообщение
                history[i] = final_ai_message
                found = True
                break
        if not found: # Если по какой-то причине не нашли, добавляем
            history.append(final_ai_message)

        save_chat_history(chat_id, history)

        # Обновляем последнее сообщение в метаданных чата
        chats_metadata = load_chats_metadata()
        if chat_id in chats_metadata:
            chats_metadata[chat_id]['last_message'] = full_ai_response_content
            chats_metadata[chat_id]['last_message_time'] = final_ai_message['timestamp']
            save_chats_metadata(chats_metadata)
            emit_all_chats_metadata() # Обновляем список чатов для всех клиентов

        # Отправляем финальное событие клиенту, чтобы он знал, что поток завершен
        emit('message_stream_end', {'chat_id': chat_id, 'message_id': ai_message_id}, room=client_sid)

    except requests.exceptions.RequestException as e:
        print(f"Error communicating with Ollama API: {e}")
        error_message_content = f"Ошибка подключения к Ollama: {e}"
        error_message = {
            'id': str(uuid.uuid4()),
            'user_id': 'system',
            'username': 'System',
            'avatar': '',
            'content': error_message_content,
            'timestamp': datetime.now().isoformat(),
            'is_ai': False,
            'is_system_error': True # Флаг для системных ошибок
        }
        history = load_chat_history(chat_id)
        history.append(error_message)
        save_chat_history(chat_id, history)
        # Отправляем сообщение об ошибке только тому клиенту, который отправил запрос
        emit('new_message', {'chat_id': chat_id, 'message': error_message}, room=client_sid)
        emit('message_stream_end', {'chat_id': chat_id, 'message_id': ai_message_id, 'error': True}, room=client_sid)
    except Exception as e:
        print(f"An unexpected error occurred during Ollama response handling: {e}")
        error_message_content = f"Произошла непредвиденная ошибка при обработке ответа Ollama: {e}"
        error_message = {
            'id': str(uuid.uuid4()),
            'user_id': 'system',
            'username': 'System',
            'avatar': '',
            'content': error_message_content,
            'timestamp': datetime.now().isoformat(),
            'is_ai': False,
            'is_system_error': True
        }
        history = load_chat_history(chat_id)
        history.append(error_message)
        save_chat_history(chat_id, history)
        emit('new_message', {'chat_id': chat_id, 'message': error_message}, room=client_sid)
        emit('message_stream_end', {'chat_id': chat_id, 'message_id': ai_message_id, 'error': True}, room=client_sid)


# Обработчик обновления настроек чата
@socketio.on('update_chat_settings')
def handle_update_chat_settings(data):
    chat_id = data.get('chat_id')
    new_name = data.get('name')
    new_avatar = data.get('avatar')

    if not chat_id:
        emit('error', {'message': 'Chat ID is required to update settings.'})
        return

    chats_metadata = load_chats_metadata()
    if chat_id not in chats_metadata:
        emit('error', {'message': 'Chat not found.'})
        return

    updated_fields = False
    if new_name is not None and chats_metadata[chat_id].get('name') != new_name:
        chats_metadata[chat_id]['name'] = new_name.strip() if new_name else ""
        updated_fields = True

    if new_avatar is not None and chats_metadata[chat_id].get('avatar') != new_avatar:
         chats_metadata[chat_id]['avatar'] = new_avatar
         updated_fields = True

    if updated_fields:
        save_chats_metadata(chats_metadata)
        print(f"Chat settings updated for {chat_id}. New name: {new_name}, new avatar: {'Yes' if new_avatar else 'No'}")
        updated_chat_info = {
            "chat_id": chat_id,
            "name": new_name,
            "avatar": new_avatar,
            "last_message": chats_metadata[chat_id].get("last_message", ""),
            "last_message_time": chats_metadata[chat_id].get("last_message_time", "")
        }
        emit('chat_settings_updated', updated_chat_info, broadcast=True)
        emit_all_chats_metadata()


# Запуск приложения Flask-SocketIO
if __name__ == '__main__':
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)
