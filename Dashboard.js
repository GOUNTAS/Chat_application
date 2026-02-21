import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import Sidebar from './Sidebar';
import Chat from './Chat';
import VoiceChannel from './VoiceChannel';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Dashboard({ user, token, onLogout }) {
  const [socket, setSocket] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
 

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(API_URL, {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [token]);

  // Load user's groups
  useEffect(() => {
    loadGroups();
  }, []);

  // Load channels when group is selected
  useEffect(() => {
    if (selectedGroup) {
      loadChannels(selectedGroup.id);
    }
  }, [selectedGroup]);

  const loadGroups = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(response.data);
      
      // Auto-select first group if available
      if (response.data.length > 0 && !selectedGroup) {
        setSelectedGroup(response.data[0]);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadChannels = async (groupId) => {
    try {
      const response = await axios.get(`${API_URL}/api/groups/${groupId}/channels`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChannels(response.data);
      
      // Auto-select first text channel if available
      if (response.data.length > 0 && !selectedChannel) {
        const firstTextChannel = response.data.find(ch => ch.type === 'text');
        if (firstTextChannel) {
          setSelectedChannel(firstTextChannel);
        }
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  };

  const createGroup = async (name, description) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/groups`,
        { name, description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadGroups();
      return response.data;
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  };

  const createChannel = async (name, type) => {
    if (!selectedGroup) return;
    
    try {
      const response = await axios.post(
        `${API_URL}/api/groups/${selectedGroup.id}/channels`,
        { name, type },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadChannels(selectedGroup.id);
      return response.data;
    } catch (error) {
      console.error('Error creating channel:', error);
      throw error;
    }
  };



  return (
    <div className={`dashboard`}>
      {/* Top Bar */}
      <div className="top-bar">
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">
            {selectedGroup ? selectedGroup.name : 'Discord Clone'}
          </h4>
          <div className="d-flex align-items-center gap-3">
            
            
            <span className="text-muted">Welcome, {user?.username}</span>
            <button className="btn btn-sm btn-outline-danger" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Sidebar */}
        <Sidebar
          groups={groups}
          selectedGroup={selectedGroup}
          onSelectGroup={setSelectedGroup}
          channels={channels}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
          onCreateGroup={createGroup}
          onCreateChannel={createChannel}
        
        />

        {/* Main Content */}
        <div className="main-content">
          {selectedChannel ? (
            selectedChannel.type === 'text' ? (
              <Chat
                channel={selectedChannel}
                user={user}
                token={token}
                socket={socket}
        
              />
            ) : (
              <VoiceChannel
                channel={selectedChannel}
                user={user}
                socket={socket}
         
              />
            )
          ) : (
            <div className="empty-state">
              <h3>Select a channel to start</h3>
              <p className="text-muted">
                Choose a text or voice channel from the sidebar
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard