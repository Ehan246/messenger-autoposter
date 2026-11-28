const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  tokenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Token', required: true },
  telegramUsername: { type: String, default: null }, // Eita add koro
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);