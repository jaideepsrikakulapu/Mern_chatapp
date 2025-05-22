const crypto = require('crypto');

const rawKey = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef';
const ENCRYPTION_KEY = Buffer.from(rawKey.padEnd(32, '0').slice(0, 32), 'utf8');
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return '';

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return iv.toString('base64') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return '';

  try {
    const parts = text.split(':');
    if (parts.length !== 2) {
      return text;
    }

    const iv = Buffer.from(parts[0], 'base64');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('Decryption error:', err);
    return text;
  }
}

module.exports = { encrypt, decrypt };
