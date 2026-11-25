const db = require("./db");
const config = require("./config");

let timer = null;
let apiRef = null;

function randomDelay() {
  return (
    Math.floor(Math.random() * (config.MAX_DELAY_MS - config.MIN_DELAY_MS + 1)) +
    config.MIN_DELAY_MS
  );
}

function start(api, threadID) {
  apiRef = api;
  stop();
  const minutes = db.get().intervalMinutes || config.DEFAULT_INTERVAL;
  console.log(`[Scheduler] Starting every ${minutes} min`);
  timer = setInterval(() => {
    post(threadID);
  }, minutes * 60 * 1000);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[Scheduler] Stopped");
  }
}

function post(threadID) {
  const data = db.get();
  if (!data.autoPosting) return;
  if (data.messages.length === 0) {
    console.log("[Scheduler] No messages in queue, skipping");
    return;
  }

  db.resetDailyIfNeeded();
  if (data.dailyCount >= config.MAX_DAILY_POSTS) {
    console.log("[Scheduler] Daily limit reached");
    return;
  }

  const msg = data.messages[Math.floor(Math.random() * data.messages.length)];
  const delay = randomDelay();

  setTimeout(() => {
    apiRef.sendMessage(msg, threadID, (err) => {
      if (err) {
        console.error("[Post] Failed:", err);
        db.addHistory({ time: Date.now(), msg, ok: false });
      } else {
        console.log("[Post] Sent:", msg);
        db.incrementDaily();
        db.addHistory({ time: Date.now(), msg, ok: true });
      }
    });
  }, delay);
}

module.exports = { start, stop, post };