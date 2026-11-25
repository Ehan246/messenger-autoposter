const db = require("./db");
const scheduler = require("./scheduler");
const config = require("./config");

function handle(api, event, threadID) {
  if (!event.body || !event.body.startsWith(config.PREFIX)) return;
  
  // Admin check
  if (event.senderID !== config.ADMIN_ID) return;

  const args = event.body.slice(config.PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();
  const reply = (text) => api.sendMessage(text, threadID);

  switch (cmd) {
    case "help":
      reply(
        "📋 Commands:\n" +
          "!start — auto-posting on\n" +
          "!stop — auto-posting off\n" +
          "!interval <min> — set interval\n" +
          "!addtext <msg> — add message\n" +
          "!cleartext — clear queue\n" +
          "!status — show status\n" +
          "!postnow — post one message now\n" +
          "!broadcast <msg> — post to ALL groups"
      );
      break;

    case "start": {
      const data = db.get();
      if (data.messages.length === 0)
        return reply("❌ Queue empty. Use !addtext first.");
      db.setAutoPosting(true);
      scheduler.start(api, threadID);
      reply("✅ Auto-posting ON");
      break;
    }

    case "stop":
      db.setAutoPosting(false);
      scheduler.stop();
      reply("❌ Auto-posting OFF");
      break;

    case "interval": {
      const m = parseInt(args[0]);
      if (!m || m < 1) return reply("❌ Usage: !interval 15");
      db.setInterval(m);
      if (db.get().autoPosting) scheduler.start(api, threadID);
      reply(`✅ Interval set to ${m} minutes`);
      break;
    }

    case "addtext": {
      const msg = args.join(" ");
      if (!msg) return reply("❌ Usage: !addtext Your message here");
      db.addMessage(msg);
      reply(`✅ Added. Total: ${db.get().messages.length}`);
      break;
    }

    case "cleartext":
      db.clearMessages();
      reply("✅ Queue cleared");
      break;

    case "status": {
      const d = db.get();
      reply(
        `📊 Status:\n` +
          `Auto-posting: ${d.autoPosting ? "ON" : "OFF"}\n` +
          `Interval: ${d.intervalMinutes} min\n` +
          `Queue: ${d.messages.length} messages\n` +
          `Today posted: ${d.dailyCount}/${config.MAX_DAILY_POSTS}`
      );
      break;
    }

    case "postnow":
      scheduler.post(threadID);
      reply("📤 Posting now...");
      break;

    case "broadcast": {
      const msg = args.join(" ");
      if (!msg) return reply("❌ Usage: !broadcast your message here");
      
      reply("⏳ Posting to all groups...");
      
      // Thread list fetch koro
      api.getThreadList(100, null, ["INBOX"], (err, list) => {
        if (err) return reply("❌ Failed to get group list.");
        
        let count = 0;
        list.forEach(thread => {
          // Sudhu group gulo te pathao (thread.isGroup = true)
          if (thread.isGroup) {
            api.sendMessage(msg, thread.threadID, (e) => {
              if (!e) count++;
            });
          }
        });
        
        setTimeout(() => {
          reply(`✅ Broadcast sent to ${count} groups!`);
        }, 3000); // 3 second wait for sending
      });
      break;
    }

    default:
      reply("❓ Unknown command. Use !help");
  }
}

module.exports = { handle };