import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Chat({ channel, user, token, socket }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load messages when channel changes
  useEffect(() => {
    if (channel) {
      loadMessages();
      
      // Join channel room
      if (socket) {
        socket.emit('join_channel', channel.id);
      }

      return () => {
        // Leave channel room on unmount
        if (socket) {
          socket.emit('leave_channel', channel.id);
        }
      };
    }
  }, [channel, socket]);

  // Listen for new messages
  useEffect(() => {
    if (socket) {
      socket.on('new_message', (message) => {
        if (message.channel_id === channel.id) {
          setMessages(prev => [...prev, message]);
          scrollToBottom();
        }
      });

      return () => {
        socket.off('new_message');
      };
    }
  }, [socket, channel]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/channels/${channel.id}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(response.data);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !socket) return;

    socket.emit('send_message', {
      channelId: channel.id,
      message: newMessage.trim()
    });

    setNewMessage('');
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-container">
      {/* Channel Header */}
      <div className="chat-header">
        <h5 className="mb-0"># {channel.name}</h5>
      </div>

      {/* Messages Area */}
      <div className={`messages-area`}>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-messages">
            <p className="text-muted">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`message ${msg.user_id === user.id ? 'message-own' : ''}`}
            >
              <div className="message-avatar">
                {msg.username.charAt(0).toUpperCase()}
              </div>
              <div className="message-content">
                <div className="message-header">
                  <span className="message-username">{msg.username}</span>
                  <span className="message-time">{formatTime(msg.created_at)}</span>
                </div>
                <div className="message-text">{msg.message}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="chat-input">
        <form onSubmit={handleSendMessage} className="d-flex gap-2">
          <input
            type="text"
            className="form-control"
            placeholder={`Message #${channel.name}`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            maxLength="2000"
          />
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={!newMessage.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chat;