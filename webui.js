const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// CORS Enable (GitHub theke request accept korar jonno)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

let api = null;
let groupsList = [];

// Appstate load korar function
function loadAppState() {
  // Prothome check koro file ache kina (local er jonno)
  if (fs.existsSync("appstate.json")) {
    return JSON.parse(fs.readFileSync("appstate.json", "utf8"));
  }
  // Na thakle environment variable theke poro (render er jonno)
  if (process.env.APPSTATE) {
    return JSON.parse(process.env.APPSTATE);
  }
  return null;
}

function initBot() {
  const appState = loadAppState();
  if (!appState) {
    console.log("❌ appstate.json nai ba Environment Variable set kora nai!");
    return;
  }

  console.log("⏳ Logging in...");
  login({ appState }, (err, newApi) => {
    if (err) return console.log("❌ Login Failed:", err);
    api = newApi;
    console.log("✅ Bot Logged In & Online!");

    api.listenMqtt((err, event) => {
      if (err) return console.error(err);
    });
  });
}

// Group list load koro (file ba env var)
if (fs.existsSync("my-groups.txt")) {
  groupsList = fs.readFileSync("my-groups.txt", "utf8").split("\n").filter(id => id.trim());
}

// ==========================================
// API ENDPOINTS (Website er jonno)
// ==========================================

// Start Bot
app.get("/start", (req, res) => {
  initBot();
  res.json({ success: true, message: "Bot start command deya hoyeche!" });
});

// Status Check
app.get("/status", (req, res) => {
  res.json({ online: api !== null, groups: groupsList.length });
});

// Post Message
app.post("/post", (req, res) => {
  const { message } = req.body;
  if (!api) return res.json({ success: false, message: "Bot offline! Age start kor." });
  if (!message) return res.json({ success: false, message: "Message khali!" });

  let count = 0;
  // Render e file write kora jay na, tai ekhane dynamic list check koro
  if (groupsList.length === 0) return res.json({ success: false, message: "Group list khali!" });

  groupsList.forEach((id, i) => {
    setTimeout(() => {
      api.sendMessage(message, id, (e) => {
        if (!e) count++;
        if (i === groupsList.length - 1) {
          setTimeout(() => {
            res.json({ success: true, message: `${count}/${groupsList.length} groups e post hoyeche!` });
          }, 1000);
        }
      });
    }, i * 3000);
  });
});

// Start Server
app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Server is running on port " + (process.env.PORT || 3000));
});