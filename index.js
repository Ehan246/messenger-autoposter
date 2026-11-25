const fs = require("fs");
const login = require("@dongdev/fca-unofficial");
const config = require("./config");
const db = require("./db");
const commands = require("./commands");

if (!fs.existsSync("appstate.json")) {
  console.error("❌ appstate.json not found! Export cookies first.");
  process.exit(1);
}

const appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));

function startBot() {
  login({ appState }, (err, api) => {
    if (err) {
      console.error("Login failed:", err);
      console.log("Retrying in 30s...");
      return setTimeout(startBot, 30000);
    }

    console.log("✅ Logged in");

    // API options set koro
    api.setOptions({ listenEvents: true, selfListen: false });

    // MQTT listener shuru koro
    api.listenMqtt((err, event) => {
      if (err) return console.error("Listen error:", err);
      if (!event || !event.threadID) return;

      // Jodi config e TARGET_THREAD_ID faka thake, tobe console e print korbe
      if (!config.TARGET_THREAD_ID) {
        console.log(
          `📌 threadID: ${event.threadID} | senderID: ${event.senderID} | body: ${event.body || "(no text)"}`
        );
      }

      // Jodi target group set thake, onno group ignore korbe
      if (config.TARGET_THREAD_ID && event.threadID !== config.TARGET_THREAD_ID)
        return;

      // Command handle korbe
      if (event.body) commands.handle(api, event, event.threadID);
    });
  });
}

startBot();