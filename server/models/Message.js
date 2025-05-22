const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  content: { type: String, default: '' }, // encrypted
  image: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
