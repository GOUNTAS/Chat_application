const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'discord_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// ============================================
// AUTH ROUTES
// ============================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    // Generate token
    const token = jwt.sign({ userId: result.insertId }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: result.insertId,
        username,
        email
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        preferred_language: user.preferred_language
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.userId = decoded.userId;
    next();
  });
};

// ============================================
// GROUP ROUTES
// ============================================

// Create group
app.post('/api/groups', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO `groups` (name, description, owner_id) VALUES (?, ?, ?)',
      [name, description || '', req.userId]
    );

    // Add creator as member
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)',
      [result.insertId, req.userId]
    );

    // Create default channel
    await pool.query(
      'INSERT INTO channels (group_id, name, type) VALUES (?, ?, ?)',
      [result.insertId, 'general', 'text']
    );

    res.json({
      id: result.insertId,
      name,
      description
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's groups
app.get('/api/groups', authenticateToken, async (req, res) => {
  try {
    const [groups] = await pool.query(`
      SELECT g.id, g.name, g.description, g.created_at 
      FROM \`groups\` g
      INNER JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
      ORDER BY g.created_at DESC
    `, [req.userId]);

    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join group
app.post('/api/groups/:groupId/join', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;

    // Check if group exists
    const [groups] = await pool.query('SELECT * FROM `groups` WHERE id = ?', [groupId]);
    
    if (groups.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if already member
    const [existing] = await pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, req.userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already a member' });
    }

    // Add member
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)',
      [groupId, req.userId]
    );

    res.json({ message: 'Joined successfully' });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// CHANNEL ROUTES
// ============================================

// Get channels for a group
app.get('/api/groups/:groupId/channels', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verify user is member
    const [membership] = await pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, req.userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const [channels] = await pool.query(
      'SELECT * FROM channels WHERE group_id = ? ORDER BY created_at ASC',
      [groupId]
    );

    res.json(channels);
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create channel
app.post('/api/groups/:groupId/channels', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    if (!['text', 'voice'].includes(type)) {
      return res.status(400).json({ error: 'Type must be text or voice' });
    }

    // Verify user is member
    const [membership] = await pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, req.userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const [result] = await pool.query(
      'INSERT INTO channels (group_id, name, type) VALUES (?, ?, ?)',
      [groupId, name, type]
    );

    res.json({
      id: result.insertId,
      name,
      type,
      group_id: groupId
    });
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a channel
app.get('/api/channels/:channelId/messages', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const [messages] = await pool.query(`
      SELECT m.*, u.username 
      FROM messages m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [channelId, limit]);

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// SOCKET.IO REAL-TIME
// ============================================

const onlineUsers = new Map(); // userId -> socketId

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error'));
    }
    socket.userId = decoded.userId;
    next();
  });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);
  onlineUsers.set(socket.userId, socket.id);

  // Join channel room
  socket.on('join_channel', (channelId) => {
    socket.join(`channel_${channelId}`);
    console.log(`User ${socket.userId} joined channel ${channelId}`);
  });

  // Leave channel room
  socket.on('leave_channel', (channelId) => {
    socket.leave(`channel_${channelId}`);
    console.log(`User ${socket.userId} left channel ${channelId}`);
  });

  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { channelId, message } = data;

      // Save message to database
      const [result] = await pool.query(
        'INSERT INTO messages (channel_id, user_id, message) VALUES (?, ?, ?)',
        [channelId, socket.userId, message || 'en']
      );

      // Get username
      const [users] = await pool.query('SELECT username FROM users WHERE id = ?', [socket.userId]);
      
      const messageData = {
        id: result.insertId,
        channel_id: channelId,
        user_id: socket.userId,
        username: users[0].username,
        message,
        created_at: new Date()
      };

      // Broadcast to channel
      io.to(`channel_${channelId}`).emit('new_message', messageData);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // User typing indicator
  socket.on('typing', (data) => {
    socket.to(`channel_${data.channelId}`).emit('user_typing', {
      userId: socket.userId,
      username: data.username
    });
  });

  // Voice channel events
  socket.on('join_voice', (data) => {
    const { channelId } = data;
    socket.join(`voice_${channelId}`);
    socket.to(`voice_${channelId}`).emit('user_joined_voice', {
      userId: socket.userId,
      socketId: socket.id
    });
  });

  socket.on('leave_voice', (data) => {
    const { channelId } = data;
    socket.to(`voice_${channelId}`).emit('user_left_voice', {
      userId: socket.userId,
      socketId: socket.id
    });
    socket.leave(`voice_${channelId}`);
  });

  // WebRTC signaling
  socket.on('webrtc_offer', (data) => {
    io.to(data.targetSocketId).emit('webrtc_offer', {
      offer: data.offer,
      fromSocketId: socket.id
    });
  });

  socket.on('webrtc_answer', (data) => {
    io.to(data.targetSocketId).emit('webrtc_answer', {
      answer: data.answer,
      fromSocketId: socket.id
    });
  });

  socket.on('webrtc_ice_candidate', (data) => {
    io.to(data.targetSocketId).emit('webrtc_ice_candidate', {
      candidate: data.candidate,
      fromSocketId: socket.id
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
    onlineUsers.delete(socket.userId);
  });
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});