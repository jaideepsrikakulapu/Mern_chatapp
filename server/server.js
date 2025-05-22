require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
// const helmet = require('helmet'); // Optional: for extra security

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const aiRoutes = require('./routes/ai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

// Constants
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/newchat';
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Middleware
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(helmet()); // Uncomment for extra security headers

// Serve static files
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Image Upload Endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(200).json({ imageUrl });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);

// Health Check
app.get('/api/health', (req, res) => res.status(200).json({ status: 'OK' }));

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Socket.IO: Chat and Video Call Logic
const videoCallRooms = {}; // { roomId: Set(socketId) }

io.on('connection', (socket) => {
  console.log(`🔌 New socket connected: ${socket.id}`);

  // Chat messaging room
  socket.on('joinRoom', ({ sender, receiver }) => {
    const roomId = [sender, receiver].sort().join('_');
    socket.join(roomId);
    console.log(`🗨️ Socket ${socket.id} joined chat room ${roomId}`);
  });

  socket.on('sendMessage', (message) => {
    try {
      const roomId = [message.sender, message.receiver].sort().join('_');
      io.to(roomId).emit('receiveMessage', message);
    } catch (err) {
      console.error('💬 Message error:', err);
    }
  });

  // Video call signaling
  socket.on('join-call', ({ roomId }) => {
  socket.join(roomId);

  if (!videoCallRooms[roomId]) {
    videoCallRooms[roomId] = new Set();
  }

  // Send existing users to the new user
  const existingUsers = Array.from(videoCallRooms[roomId]);
  socket.emit('all-users', existingUsers);

  // Notify existing users of new joiner
  existingUsers.forEach((peerId) => {
    socket.to(peerId).emit('user-joined', socket.id);
  });

  videoCallRooms[roomId].add(socket.id);
  console.log(`📹 ${socket.id} joined call room ${roomId}. Total users: ${videoCallRooms[roomId].size}`);
});


  // WebRTC signaling
  socket.on('webrtc-offer', ({ offer, to }) => {
    io.to(to).emit('webrtc-offer', { offer, from: socket.id });
  });

  socket.on('webrtc-answer', ({ answer, to }) => {
    io.to(to).emit('webrtc-answer', { answer, from: socket.id });
  });

  socket.on('webrtc-ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('webrtc-ice-candidate', { candidate, from: socket.id });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
    for (const roomId in videoCallRooms) {
      if (videoCallRooms[roomId].has(socket.id)) {
        videoCallRooms[roomId].delete(socket.id);
        socket.to(roomId).emit('user-left', socket.id);

        if (videoCallRooms[roomId].size === 0) {
          delete videoCallRooms[roomId];
        } else {
          console.log(`🔔 Remaining users in ${roomId}: ${videoCallRooms[roomId].size}`);
        }
      }
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Server Start
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
