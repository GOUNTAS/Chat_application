import React, { useState } from 'react';

function Sidebar({
  groups,
  selectedGroup,
  onSelectGroup,
  channels,
  selectedChannel,
  onSelectChannel,
  onCreateGroup,
  onCreateChannel
}) {
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [channelForm, setChannelForm] = useState({ name: '', type: 'text' });
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinGroupId, setJoinGroupId] = useState('');

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      await onCreateGroup(groupForm.name, groupForm.description);
      setGroupForm({ name: '', description: '' });
      setShowGroupModal(false);
    } catch (error) {
      alert('Error creating group');
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    try {
      await onCreateChannel(channelForm.name, channelForm.type);
      setChannelForm({ name: '', type: 'text' });
      setShowChannelModal(false);
    } catch (error) {
      alert('Error creating channel');
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/groups/${joinGroupId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join group');
      }
      
      setJoinGroupId('');
      setShowJoinModal(false);
      window.location.reload();
    } catch (error) {
      alert('Error joining group: ' + error.message);
    }
  };

  const textChannels = channels.filter(ch => ch.type === 'text');
  const voiceChannels = channels.filter(ch => ch.type === 'voice');

  return (
    <div className={`sidebar`}>
      {/* Groups Section */}
      <div className="sidebar-section">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0">Groups</h6>
          <div>
            <button
              className="btn btn-sm btn-success me-1"
              onClick={() => setShowJoinModal(true)}
              title="Join Group"
            >
              ↓
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowGroupModal(true)}
              title="Create Group"
            >
              +
            </button>
          </div>
        </div>

        <div className="group-list">
          {groups.map(group => (
            <div
              key={group.id}
              className={`group-item ${selectedGroup?.id === group.id ? 'active' : ''}`}
              onClick={() => onSelectGroup(group)}
            >
              <div className="group-icon">
                {group.name.charAt(0).toUpperCase()}
              </div>
              <span className="group-name">{group.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Channels Section */}
      {selectedGroup && (
        <div className="sidebar-section">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0">Channels</h6>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowChannelModal(true)}
            >
              +
            </button>
          </div>

          {/* Text Channels */}
          {textChannels.length > 0 && (
            <div className="channel-group mb-3">
              <div className="channel-group-title">TEXT CHANNELS</div>
              {textChannels.map(channel => (
                <div
                  key={channel.id}
                  className={`channel-item ${selectedChannel?.id === channel.id ? 'active' : ''}`}
                  onClick={() => onSelectChannel(channel)}
                >
                  # {channel.name}
                </div>
              ))}
            </div>
          )}

          {/* Voice Channels */}
          {voiceChannels.length > 0 && (
            <div className="channel-group">
              <div className="channel-group-title">VOICE CHANNELS</div>
              {voiceChannels.map(channel => (
                <div
                  key={channel.id}
                  className={`channel-item ${selectedChannel?.id === channel.id ? 'active' : ''}`}
                  onClick={() => onSelectChannel(channel)}
                >
                  🔊 {channel.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Group Modal */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h5>Create Group</h5>
            <form onSubmit={handleCreateGroup}>
              <div className="mb-3">
                <label className="form-label">Group Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="form-control"
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary">Create</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowGroupModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showChannelModal && (
        <div className="modal-overlay" onClick={() => setShowChannelModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h5>Create Channel</h5>
            <form onSubmit={handleCreateChannel}>
              <div className="mb-3">
                <label className="form-label">Channel Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={channelForm.name}
                  onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Channel Type</label>
                <select
                  className="form-select"
                  value={channelForm.type}
                  onChange={(e) => setChannelForm({ ...channelForm, type: e.target.value })}
                >
                  <option value="text">Text Channel</option>
                  <option value="voice">Voice Channel</option>
                </select>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary">Create</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowChannelModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h5>Join Group</h5>
            <form onSubmit={handleJoinGroup}>
              <div className="mb-3">
                <label className="form-label">Group ID</label>
                <input
                  type="number"
                  className="form-control"
                  value={joinGroupId}
                  onChange={(e) => setJoinGroupId(e.target.value)}
                  required
                  placeholder="Enter group ID"
                />
                <small className="text-muted">Ask the group owner for the Group ID</small>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary">Join</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowJoinModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;