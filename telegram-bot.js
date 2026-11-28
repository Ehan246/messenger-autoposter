require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Environment Variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const MONGO_URI = process.env.MONGO_URI;

// Check Configuration
if (!TELEGRAM_TOKEN || !ADMIN_ID || !MONGO_URI) {
    console.error('❌ Missing environment variables! Check your .env file.');
    process.exit(1);
}

// Telegram Bot Initialize
const bot = new TelegramBot(TELEGRAM_TOKEN, {
    polling: true
});

// MongoDB Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected!'))
    .catch(err => console.error('❌ MongoDB Error:', err));

// ==========================================
// TOKEN SCHEMA (Updated)
// ==========================================
const TokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    usedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    active: {
        type: Boolean,
        default: true
    },
    created: {
        type: Date,
        default: Date.now
    }
});

const Token = mongoose.model('Token', TokenSchema);

// Generate Random Token
function generateToken() {
    return crypto.randomBytes(8).toString('hex');
}

// Admin Verification
function isAdmin(msg) {
    return msg.from?.id.toString() === ADMIN_ID;
}

// Access Denied Message
function denyAccess(msg) {
    return bot.sendMessage(
        msg.chat.id,
        '❌ Apni Admin na! Ei bot apnar jonno na.'
    );
}

// START COMMAND
bot.onText(/^\/start$/, async (msg) => {
    if (!isAdmin(msg)) return denyAccess(msg);

    const welcomeMessage = `
🤖 Welcome to Token Manager Bot!

Available Commands:

/gen - Generate new token
/list - Show active tokens
/revoke <token> - Revoke a token
/help - Show help

✅ Bot is running successfully!
`;

    bot.sendMessage(msg.chat.id, welcomeMessage);
});

// GENERATE TOKEN
bot.onText(/^\/gen$/, async (msg) => {
    if (!isAdmin(msg)) return denyAccess(msg);

    try {
        const newToken = generateToken();

        await Token.create({
            token: newToken,
            isUsed: false,
            usedBy: null,
            active: true
        });

        bot.sendMessage(
            msg.chat.id,
            `✅ New Token Generated!\n\n🔑 ${newToken}\n\nShare this token with your user.`
        );

    } catch (error) {
        console.error(error);

        bot.sendMessage(
            msg.chat.id,
            '❌ Database Error: ' + error.message
        );
    }
});

// LIST ACTIVE TOKENS
bot.onText(/^\/list$/, async (msg) => {
    if (!isAdmin(msg)) return denyAccess(msg);

    try {
        const tokens = await Token.find({
            active: true,
            isUsed: false
        }).sort({ created: -1 });

        if (tokens.length === 0) {
            return bot.sendMessage(
                msg.chat.id,
                '📭 No active tokens found.'
            );
        }

        let message = '📋 Active Tokens:\n\n';

        tokens.forEach((token, index) => {
            message += `${index + 1}. ${token.token}\n`;
        });

        message += `\n📊 Total Active Tokens: ${tokens.length}`;

        bot.sendMessage(msg.chat.id, message);

    } catch (error) {
        console.error(error);

        bot.sendMessage(
            msg.chat.id,
            '❌ Database Error: ' + error.message
        );
    }
});

// REVOKE TOKEN
bot.onText(/^\/revoke\s+(.+)$/, async (msg, match) => {
    if (!isAdmin(msg)) return denyAccess(msg);

    try {
        const tokenToRevoke = match[1].trim();

        const tokenDoc = await Token.findOne({
            token: tokenToRevoke
        });

        if (!tokenDoc) {
            return bot.sendMessage(
                msg.chat.id,
                '❌ Token not found!'
            );
        }

        if (!tokenDoc.active) {
            return bot.sendMessage(
                msg.chat.id,
                '⚠️ This token is already revoked.'
            );
        }

        tokenDoc.active = false;

        await tokenDoc.save();

        bot.sendMessage(
            msg.chat.id,
            `✅ Token Revoked Successfully!\n\n🔑 ${tokenToRevoke}`
        );

    } catch (error) {
        console.error(error);

        bot.sendMessage(
            msg.chat.id,
            '❌ Database Error: ' + error.message
        );
    }
});

// HELP COMMAND
bot.onText(/^\/help$/, async (msg) => {
    if (!isAdmin(msg)) return denyAccess(msg);

    const helpMessage = `
🤖 TOKEN MANAGER HELP

/gen
Generate a new token.

/list
Show all active tokens.

/revoke <token>
Deactivate a token.

/start
Start the bot.

/help
Show this help message.
`;

    bot.sendMessage(msg.chat.id, helpMessage);
});

// Polling Errors
bot.on('polling_error', (error) => {
    console.error('❌ Telegram Polling Error:', error.message);
});

// Bot Startup
bot.getMe()
    .then((info) => {
        console.log('🤖 Telegram Token Bot Started!');
        console.log('Bot Username: @' + info.username);
    })
    .catch((error) => {
        console.error('❌ Telegram Bot Error:', error.message);
    });