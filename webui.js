const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const crypto = require('crypto');

// 🔥 Apnar Telegram Bot Token ekhane din
const TELEGRAM_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
// 🔥 Apnar Telegram User ID ekhane din (Admin)
const ADMIN_ID = 'YOUR_TELEGRAM_ID';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const TOKENS_FILE = 'tokens.json';

function loadTokens() {
  if (!fs.existsSync(TOKENS_FILE)) return {};
  return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

function generateToken() {
  return crypto.randomBytes(8).toString('hex'); 
}

bot.onText(/\/start/, (msg) => {
  if (msg.from.id.toString() !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "❌ Apni Admin na! Ei bot apnar jonno na.");
  }
  bot.sendMessage(msg.chat.id, "🤖 Token Manager Bot\n\nCommands:\n/gen - Notun token generate korun\n/list - Sob token list dekhu\n/revoke <token> - Token expire korun\n/help - Help");
});

bot.onText(/\/gen/, (msg) => {
  if (msg.from.id.toString() !== ADMIN_ID) return bot.sendMessage(msg.chat.id, "❌ Apni Admin na!");
  
  const tokens = loadTokens();
  const newToken = generateToken();
  tokens[newToken] = { created: Date.now(), active: true };
  saveTokens(tokens);
  
  bot.sendMessage(msg.chat.id, `✅ Notun Token Generate Hoyese:\n\n\`${newToken}\`\n\nEi token ti user ke din.`, { parse_mode: 'Markdown' });
});

bot.onText(/\/list/, (msg) => {
  if (msg.from.id.toString() !== ADMIN_ID) return bot.sendMessage(msg.chat.id, "❌ Apni Admin na!");
  
  const tokens = loadTokens();
  const tokenList = Object.keys(tokens);
  if (tokenList.length === 0) return bot.sendMessage(msg.chat.id, "📭 Kono token nei.");
  
  let message = "📋 **Active Tokens:**\n\n";
  tokenList.forEach(t => {
    message += `🔑 \`${t}\`\n`;
  });
  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

bot.onText(/\/revoke (.+)/, (msg, match) => {
  if (msg.from.id.toString() !== ADMIN_ID) return bot.sendMessage(msg.chat.id, "❌ Apni Admin na!");
  
  const tokenToRevoke = match[1].trim();
  const tokens = loadTokens();
  
  if (!tokens[tokenToRevoke]) {
    return bot.sendMessage(msg.chat.id, "❌ Ei token ti nei!");
  }
  
  tokens[tokenToRevoke].active = false;
  saveTokens(tokens);
  bot.sendMessage(msg.chat.id, `✅ Token Expire Hoyese: \`${tokenToRevoke}\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 Commands:\n/gen - Notun token\n/list - Token list\n/revoke <token> - Token expire\n/help - Help");
});

console.log("🤖 Telegram Token Bot Chalu Hoyese!");