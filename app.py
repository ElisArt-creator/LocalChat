from flask import Flask, render_template, request
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from datetime import datetime
import json
import os
import base64 # For handling image data
import uuid # To generate unique IDs for chats

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your_secret_key') # Important for sessions
# Consider adding cors_allowed_origins="*" for development, restrict in production
# socketio = SocketIO(app, cors_allowed_origins="*") # Uncomment for development cross-origin if needed
socketio = SocketIO(app) # Use this for same-origin or configured origins


CHAT_HISTORY_DIR = 'chat_histories'
CHAT_LIST_FILE = 'chats.json' # To store metadata about chats (name, id, last message for quick loading)

# Ensure history directory exists
if not os.path.exists(CHAT_HISTORY_DIR):
    os.makedirs(CHAT_HISTORY_DIR)

def load_chats_metadata():
    """Loads metadata for all chats."""
    if os.path.exists(CHAT_LIST_FILE):
        with open(CHAT_LIST_FILE, 'r') as f:
            try:
                # Ensure loaded data is a dictionary
                data = json.load(f)
                if not isinstance(data, dict):
                    print(f"Warning: {CHAT_LIST_FILE} is not a dictionary. Returning empty.")
                    return {}
                return data
            except json.JSONDecodeError:
                print(f"Error decoding JSON from {CHAT_LIST_FILE}. Returning empty.")
                return {} # Return empty dict if file is corrupted
    return {} # {chat_id: {name, last_message_preview, last_message_time, avatar}}

def save_chats_metadata(chats_data):
    """Saves metadata for all chats."""
    with open(CHAT_LIST_FILE, 'w') as f:
        json.dump(chats_data, f, indent=2)

def load_chat_history(chat_id):
    """Loads chat history for a specific chat."""
    history_file = os.path.join(CHAT_HISTORY_DIR, f'{chat_id}.json')
    if os.path.exists(history_file):
        with open(history_file, 'r') as f:
            try:
                # Ensure loaded data is a list
                data = json.load(f)
                if not isinstance(data, list):
                     print(f"Warning: History file {history_file} is not a list. Returning empty.")
                     return []
                return data
            except json.JSONDecodeError:
                print(f"Error decoding JSON from {history_file}. Returning empty.")
                return [] # Return empty list if file is corrupted
    return [] # Return empty list if file doesn't exist

def save_message_to_history(chat_id, message_data):
    """Appends a message to the chat history file."""
    history = load_chat_history(chat_id)
    history.append(message_data)
    history_file = os.path.join(CHAT_HISTORY_DIR, f'{chat_id}.json')
    with open(history_file, 'w') as f:
        json.dump(history, f, indent=2)

# --- Flask Routes ---
@app.route('/')
def index():
    return render_template('index.html')

# --- Socket.IO Event Handlers ---
@socketio.on('connect')
def handle_connect():
    print('Client connected:', request.sid)
    # Acknowledge connection or send initial data if needed immediately

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected:', request.sid)
    # Remove user from any rooms they were in if necessary (SocketIO handles this mostly)

@socketio.on('get_chat_list')
def handle_get_chat_list():
    """Sends the list of chats metadata to the connected client."""
    print(f"Client {request.sid} requested chat list.")
    chats_metadata = load_chats_metadata()
    # Convert dict to list of chat objects for client
    chat_list = [{"chat_id": cid, **data} for cid, data in chats_metadata.items()]
    emit('chat_list', chat_list)


@socketio.on('create_chat')
def handle_create_chat(data):
    """Creates a new chat."""
    chat_name = data.get('chat_name')
    if not chat_name or not chat_name.strip():
        emit('error', {'message': 'Chat name is required.'})
        return

    chat_id = str(uuid.uuid4()) # Generate a unique ID for the chat
    chats_metadata = load_chats_metadata()

    if chat_id in chats_metadata:
         # Should not happen with UUID, but as a safeguard
         emit('error', {'message': 'Chat ID collision. Please try again.'})
         return

    # Initial chat data
    new_chat_data = {
        "name": chat_name.strip(),
        "avatar": data.get('avatar', None), # Optional avatar URL from client
        "created_at": datetime.utcnow().isoformat(), # Use ISO format for better sorting/parsing
        "last_message_preview": "", # No messages yet
        "last_message_time": "" # No messages yet
    }

    chats_metadata[chat_id] = new_chat_data
    save_chats_metadata(chats_metadata)
    print(f"New chat created: {chat_name} with ID {chat_id} by {request.sid}")

    # Prepare data to send back to client(s)
    chat_to_broadcast = {
        "chat_id": chat_id,
        "is_new": True, # Flag to indicate it's a new creation
        "creator_sid": request.sid, # Include creator's SID
        **new_chat_data # Include chat metadata
    }

    # Broadcast the new chat to all connected clients so they can update their lists
    socketio.emit('chat_created', chat_to_broadcast, broadcast=True)

@socketio.on('join_chat')
def handle_join_chat(data):
    """Client requests to join a chat room and get history."""
    chat_id = data.get('chat_id')
    username = data.get('username', 'Anonymous') # Get username for context

    if not chat_id:
        emit('error', {'message': 'Chat ID is required to join.'})
        return

    chats_metadata = load_chats_metadata()
    if chat_id not in chats_metadata:
        emit('error', {'message': 'Chat not found.'})
        return

    print(f"Client {request.sid} ({username}) attempting to join chat {chat_id}")
    join_room(chat_id) # Add client to the SocketIO room for this chat

    # Load and send chat history to the joining client
    history = load_chat_history(chat_id)
    emit('chat_history', {'chat_id': chat_id, 'history': history})
    print(f"Sent history for chat {chat_id} to {request.sid}")

@socketio.on('leave_chat')
def handle_leave_chat(data):
    """Client requests to leave a chat room."""
    chat_id = data.get('chat_id')
    if chat_id:
        print(f"Client {request.sid} leaving chat {chat_id}")
        leave_room(chat_id)

@socketio.on('message')
def handle_message(msg_data):
    """Handles incoming messages (text or image) and broadcasts them to the correct chat."""
    chat_id = msg_data.get('chat_id')
    if not chat_id:
        print(f"Error: Message received without chat_id from {request.sid}: {msg_data}")
        emit('error', {'message': 'Message must include a chat_id.'})
        return

    chats_metadata = load_chats_metadata()
    if chat_id not in chats_metadata:
        print(f"Error: Message received for non-existent chat {chat_id} from {request.sid}")
        emit('error', {'message': 'Chat not found.'})
        return

    # Ensure message has essential fields and add server data
    # Use ISO format for consistent time parsing on client
    msg_data['time'] = datetime.utcnow().isoformat() # Use UTC for consistency
    msg_data.setdefault('username', 'Anonymous')
    msg_data.setdefault('avatar', '') # Default avatar if not provided

    # Add sender's SID
    msg_data['sender_sid'] = request.sid

    # Handle image data if present
    if msg_data.get('type') == 'image' and 'image_data' in msg_data:
         # Basic validation - check if it's a base64 string, could add size limits
         # This assumes client sends data URL (e.g., "data:image/png;base64,...")
         print(f"Received image message for chat {chat_id} from {msg_data['username']}")
         # Optional: Process or save image on server if needed.
         # For now, we'll just broadcast the data URL back.

    # --- ЭТОТ БЛОК ПЕРЕМЕЩЕН СЮДА ВНУТРЬ handle_message ---
    # Update last message preview and time in chat metadata
    preview_text = msg_data.get('text', '')
    if msg_data.get('type') == 'image':
        # Corrected Python syntax for ternary and f-string
        preview_text = '📷 Image' + (f': {preview_text[:20]}...' if preview_text else '')
    else:
        preview_text = preview_text[:30] + ('...' if len(preview_text) > 30 else '')

    chats_metadata[chat_id]['last_message_preview'] = preview_text or 'Нет сообщений' # Handle empty text
    chats_metadata[chat_id]['last_message_time'] = msg_data['time'] # Use server time for consistency
    save_chats_metadata(chats_metadata)
    # --- КОНЕЦ ПЕРЕМЕЩЕННОГО БЛОКА ---


    # Broadcast the message to all clients in the specific chat_id room
    # Include sender_sid in the broadcast payload
    socketio.emit('new_message', msg_data, room=chat_id)
    print(f"Broadcast message to room {chat_id}: {msg_data.get('text', 'Image')[:50]}")


@socketio.on('update_chat_settings')
def handle_update_chat_settings(data):
    """Handles updating chat settings (e.g., avatar)."""
    chat_id = data.get('chat_id')
    new_avatar = data.get('avatar') # Can be URL or base64 data URL
    # new_name = data.get('name') # If you add name editing

    if not chat_id:
        emit('error', {'message': 'Chat ID is required to update settings.'})
        return

    chats_metadata = load_chats_metadata()
    if chat_id not in chats_metadata:
        emit('error', {'message': 'Chat not found.'})
        return

    updated_fields = False
    # Check if new_avatar is provided and different from current one (basic check)
    # Also handle setting avatar to None or empty string if client intends to remove it
    if new_avatar is not None:
         # Check if the value is actually different before marking as updated
        if chats_metadata[chat_id].get('avatar') != new_avatar:
             chats_metadata[chat_id]['avatar'] = new_avatar
             updated_fields = True
    # else: # If new_avatar is None, it means client sent None, possibly to clear avatar?
    #      if chats_metadata[chat_id].get('avatar') is not None:
    #          chats_metadata[chat_id]['avatar'] = None # Or a default placeholder URL?
    #          updated_fields = True


    # if new_name and chats_metadata[chat_id].get('name') != new_name:
    #     chats_metadata[chat_id]['name'] = new_name
    #     updated_fields = True

    if updated_fields:
        save_chats_metadata(chats_metadata)
        print(f"Chat settings updated for {chat_id} by {request.sid}. New avatar: {'Yes' if new_avatar else 'No'}")
        # Broadcast the updated chat data to all clients so their lists and headers update
        # Send back the specific chat that was updated.
        updated_chat_info = chats_metadata[chat_id]
        updated_chat_info['chat_id'] = chat_id # Ensure chat_id is part of the payload
        # Add sender_sid to broadcast to identify the client that triggered the update (optional but useful)
        updated_chat_info['updater_sid'] = request.sid
        socketio.emit('chat_updated_ack', updated_chat_info, broadcast=True)
    else:
        print(f"No chat settings changed for {chat_id} by {request.sid}")
        # Optionally emit a 'no_change' or acknowledgement if the client expects one

# --- Helper functions (like save/load history) are defined above ---


if __name__ == '__main__':
    # Use debug=True for development, remove in production
    # allow_unsafe_werkzeug=True might be needed depending on environment, but generally avoid
    # host='0.0.0.0' makes the server accessible externally (e.g., in a local network)
    socketio.run(app, debug=True, host='0.0.0.0') # Added host='0.0.0.0' for easier access
