const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const Message = require('../models/Message');
const { encrypt, decrypt } = require('../utils/encryption');

// Multer config: store images in /uploads with timestamped filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

// POST /api/messages - send message with optional image, encrypt content before saving
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { sender, receiver, content } = req.body;

    if (!sender || !receiver) {
      return res.status(400).json({ error: 'Sender and receiver are required' });
    }

    // Encrypt message content, allow empty string if content missing
    const encryptedContent = encrypt(content || '');

    // If image uploaded, build relative URL to access it
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const message = await Message.create({
      sender,
      receiver,
      content: encryptedContent,
      image: imageUrl,
      createdAt: new Date(),
    });

    // Return message with decrypted content for immediate display
    res.status(201).json({
      ...message.toObject(),
      content, // plaintext content here for client convenience
    });
  } catch (err) {
    console.error('Error saving encrypted message:', err);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// GET /api/messages/:sender/:receiver - fetch messages between two users, decrypt content
router.get('/:sender/:receiver', async (req, res) => {
  try {
    const { sender, receiver } = req.params;

    if (!sender || !receiver) {
      return res.status(400).json({ error: 'Sender and receiver parameters are required' });
    }

    // Find messages where sender and receiver match either way, sorted by date ascending
    const messages = await Message.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender },
      ],
    }).sort({ createdAt: 1 });

    // Decrypt content for each message before sending
    const decryptedMessages = messages.map(msg => ({
      ...msg.toObject(),
      content: msg.content ? decrypt(msg.content) : '',
    }));

    res.json(decryptedMessages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
