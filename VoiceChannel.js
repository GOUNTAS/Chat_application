import React, { useState, useEffect, useRef } from 'react';

function VoiceChannel({ channel, user, socket }) {
  const [inCall, setInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());

  useEffect(() => {
    if (!socket) return;

    // Listen for other users joining
    const handleUserJoined = async ({ userId, socketId }) => {
      console.log('User joined voice:', userId, socketId);
      
      if (!localStreamRef.current) return;

      // Add to connected users list
      setConnectedUsers(prev => {
        // Check if user already in list
        if (prev.find(u => u.socketId === socketId)) return prev;
        return [...prev, { userId, socketId }];
      });

      // Create peer connection for new user
      const peerConnection = createPeerConnection(socketId);
      
      // Add local tracks to peer connection
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });

      // Create and send offer
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit('webrtc_offer', {
          targetSocketId: socketId,
          offer: offer
        });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    };

    const handleUserLeft = ({ userId, socketId }) => {
      console.log('User left voice:', userId, socketId);
      
      // Remove from connected users
      setConnectedUsers(prev => prev.filter(u => u.socketId !== socketId));
      
      // Close peer connection
      if (peersRef.current.has(socketId)) {
        peersRef.current.get(socketId).close();
        peersRef.current.delete(socketId);
      }
    };

    const handleOffer = async ({ offer, fromSocketId }) => {
      console.log('Received offer from:', fromSocketId);
      
      if (!localStreamRef.current) return;

      // Add to connected users if not already there
      setConnectedUsers(prev => {
        if (prev.find(u => u.socketId === fromSocketId)) return prev;
        return [...prev, { userId: 'remote', socketId: fromSocketId }];
      });

      const peerConnection = createPeerConnection(fromSocketId);
      
      // Add local tracks
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('webrtc_answer', {
          targetSocketId: fromSocketId,
          answer: answer
        });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    };

    const handleAnswer = async ({ answer, fromSocketId }) => {
      console.log('Received answer from:', fromSocketId);
      
      const peerConnection = peersRef.current.get(fromSocketId);
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error('Error setting remote description:', error);
        }
      }
    };

    const handleIceCandidate = ({ candidate, fromSocketId }) => {
      const peerConnection = peersRef.current.get(fromSocketId);
      if (peerConnection) {
        try {
          peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    };

    socket.on('user_joined_voice', handleUserJoined);
    socket.on('user_left_voice', handleUserLeft);
    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleIceCandidate);

    return () => {
      socket.off('user_joined_voice', handleUserJoined);
      socket.off('user_left_voice', handleUserLeft);
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleIceCandidate);
      
      if (inCall) {
        leaveCall();
      }
    };
  }, [socket, inCall]);

  const createPeerConnection = (socketId) => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_ice_candidate', {
          targetSocketId: socketId,
          candidate: event.candidate
        });
      }
    };

    // Handle incoming audio stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote track from:', socketId);
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.play().catch(err => console.error('Error playing audio:', err));
    };

    // Handle connection state
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed') {
        console.error('Connection failed for peer:', socketId);
      }
    };

    peersRef.current.set(socketId, peerConnection);
    return peerConnection;
  };

  const joinCall = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      });

      localStreamRef.current = stream;
      setInCall(true);

      // Notify server
      if (socket) {
        socket.emit('join_voice', { channelId: channel.id });
      }
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const leaveCall = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peersRef.current.forEach(peer => peer.close());
    peersRef.current.clear();

    // Notify server
    if (socket) {
      socket.emit('leave_voice', { channelId: channel.id });
    }

    setInCall(false);
    setConnectedUsers([]);
    setIsMuted(false);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div className="voice-channel-container">
      <div className="voice-header">
        <h5 className="mb-0">🔊 {channel.name}</h5>
      </div>

      <div className="voice-content">
        {!inCall ? (
          <div className="voice-join">
            <div className="text-center">
              <h4>Voice Channel</h4>
              <p className="text-muted mb-4">
                Join the voice channel to talk with your team
              </p>
              <button 
                className="btn btn-success btn-lg"
                onClick={joinCall}
              >
                Join Call
              </button>
              <p className="text-muted mt-3 small">
                Max 6 users per call
              </p>
            </div>
          </div>
        ) : (
          <div className="voice-active">
            <div className="connected-users mb-4">
              <h6>Connected Users ({connectedUsers.length + 1}/6)</h6>
              <div className="user-list">
                <div className="voice-user voice-user-self">
                  <div className="voice-avatar">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span>{user.username} (You)</span>
                  {isMuted && <span className="badge bg-danger ms-2">Muted</span>}
                </div>
                
                {connectedUsers.map((connectedUser, index) => (
                  <div key={connectedUser.socketId} className="voice-user">
                    <div className="voice-avatar">
                      U
                    </div>
                    <span>User {index + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="voice-controls">
              <button
                className={`btn ${isMuted ? 'btn-danger' : 'btn-secondary'} me-2`}
                onClick={toggleMute}
              >
                {isMuted ? '🔇 Unmute' : '🔊 Mute'}
              </button>
              <button
                className="btn btn-danger"
                onClick={leaveCall}
              >
                Leave Call
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceChannel;