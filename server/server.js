require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
// const helmet = require('helmet'); // Uncomment for production

// Route imports
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const aiRoutes = require('./routes/ai');

const app = express();
const server = http.createServer(app);

// Config Constants
const PORT = process.env.PORT || 5000;
const FRONTEND_URLS = [
  'http://localhost:3000',
  'https://chat-app-mern-frontend-3ce5.onrender.com',
];
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jaideep:Sjaideep04%40@cluster0.so2bzuz.mongodb.net/chatDB?retryWrites=true&w=majority';
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URLS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Middleware
app.use(cors({ origin: FRONTEND_URLS, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(helmet()); // Optional security headers

// Static upload route
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer config for image upload
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

// Health check
app.get('/api/health', (req, res) => res.status(200).json({ status: 'OK' }));

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// Video Call Rooms Memory
const videoCallRooms = {}; // { roomId: Set(socketId) }

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Chat room join
  socket.on('joinRoom', ({ sender, receiver }) => {
    const roomId = [sender, receiver].sort().join('_');
    socket.join(roomId);
    console.log(`🗨️ ${socket.id} joined chat room ${roomId}`);
  });

  // Chat message
  socket.on('sendMessage', (message) => {
    const roomId = [message.sender, message.receiver].sort().join('_');
    io.to(roomId).emit('receiveMessage', message);
  });

  // Video Call Join
  socket.on('join-call', ({ roomId }) => {
    socket.join(roomId);

    if (!videoCallRooms[roomId]) videoCallRooms[roomId] = new Set();

    const existingUsers = Array.from(videoCallRooms[roomId]);
    socket.emit('all-users', existingUsers);

    existingUsers.forEach((peerId) => {
      socket.to(peerId).emit('user-joined', socket.id);
    });

    videoCallRooms[roomId].add(socket.id);
    console.log(`📹 ${socket.id} joined call room ${roomId} (${videoCallRooms[roomId].size} users)`);
  });

  // WebRTC Signaling
  socket.on('webrtc-offer', ({ offer, to }) => {
    io.to(to).emit('webrtc-offer', { offer, from: socket.id });
  });

  socket.on('webrtc-answer', ({ answer, to }) => {
    io.to(to).emit('webrtc-answer', { answer, from: socket.id });
  });

  socket.on('webrtc-ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('webrtc-ice-candidate', { candidate, from: socket.id });
  });

  // Handle disconnection
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

// Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
