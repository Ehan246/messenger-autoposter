const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const APPSTATE_FILE = "appstate.json";
const GROUPS_FILE = "my-groups.txt";
let apiClient = null;
let groupsList = [];

// ==========================================
// LOGIN FUNCTION
// ==========================================
function initBot() {
  if (!fs.existsSync(APPSTATE_FILE)) {
    console.log("❌ appstate.json nai!");
    return;
  }

  const appState = JSON.parse(fs.readFileSync(APPSTATE_FILE, "utf8"));
  login({ appState }, (err, api) => {
    if (err) return console.log("❌ Login failed:", err);
    apiClient = api;
    console.log("✅ Bot Login Successful! Web Dashboard ready.");

    api.listenMqtt((err, event) => {
      if (err) return console.error(err);
    });
  });

  if (fs.existsSync(GROUPS_FILE)) {
    groupsList = fs.readFileSync(GROUPS_FILE, "utf8").split("\n").filter(id => id.trim());
  }
}

// ==========================================
// WEB DASHBOARD (HTML)
// ==========================================
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Messenger Auto-Poster</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #1877f2; text-align: center; }
        .status { text-align: center; padding: 10px; border-radius: 5px; margin-bottom: 20px; font-weight: bold; }
        .online { background: #d4edda; color: #155724; }
        .offline { background: #f8d7da; color: #721c24; }
        textarea { width: 100%; height: 150px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box; resize: vertical; }
        button { width: 100%; padding: 15px; background: #1877f2; color: white; border: none; border-radius: 5px; font-size: 18px; cursor: pointer; margin-top: 10px; font-weight: bold; }
        button:hover { background: #166fe5; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        #result { margin-top: 20px; padding: 15px; border-radius: 5px; display: none; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 Messenger Auto-Poster</h1>
        <div class="status ${apiClient ? 'online' : 'offline'}">
          ${apiClient ? '✅ Bot Online' : '❌ Bot Offline'} | Groups: ${groupsList.length}
        </div>
        
        <label style="font-weight:bold; display:block; margin-bottom:10px;">Write your message:</label>
        <textarea id="message" placeholder="Type your message here..."></textarea>
        
        <button onclick="sendMessage()" id="sendBtn">🚀 Post to All Groups</button>
        
        <div id="result"></div>
      </div>

      <script>
        async function sendMessage() {
          const msg = document.getElementById('message').value;
          const btn = document.getElementById('sendBtn');
          const result = document.getElementById('result');
          
          if (!msg.trim()) {
            result.style.display = 'block';
            result.className = 'error';
            result.innerText = '❌ Message khali ache!';
            return;
          }

          btn.disabled = true;
          btn.innerText = '⏳ Posting...';
          result.style.display = 'none';

          try {
            const res = await fetch('/post', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: msg })
            });
            const data = await res.json();
            
            result.style.display = 'block';
            if (data.success) {
              result.className = 'success';
              result.innerText = '✅ ' + data.message;
              document.getElementById('message').value = '';
            } else {
              result.className = 'error';
              result.innerText = '❌ ' + data.message;
            }
          } catch (e) {
            result.style.display = 'block';
            result.className = 'error';
            result.innerText = '❌ Server error!';
          }

          btn.disabled = false;
          btn.innerText = '🚀 Post to All Groups';
        }
      </script>
    </body>
    </html>
  `);
});

// ==========================================
// POST API
// ==========================================
app.post("/post", (req, res) => {
  const message = req.body.message;

  if (!apiClient) return res.json({ success: false, message: "Bot login kora nai!" });
  if (groupsList.length === 0) return res.json({ success: false, message: "Group list khali! Age scan kor." });
  if (!message || !message.trim()) return res.json({ success: false, message: "Message khali!" });

  let count = 0;
  let failed = 0;

  groupsList.forEach((id, i) => {
    setTimeout(() => {
      apiClient.sendMessage(message, id, (e) => {
        if (e) {
          failed++;
        } else {
          count++;
        }

        if (i === groupsList.length - 1) {
          setTimeout(() => {
            res.json({ 
              success: true, 
              message: `${count}/${groupsList.length} groups e post hoyeche!${failed > 0 ? ` (${failed} failed)` : ''}` 
            });
          }, 1000);
        }
      });
    }, i * 3000);
  });
});

// ==========================================
// START SERVER
// ==========================================
initBot();
app.listen(3000, () => {
  console.log("\n=================================");
  console.log("🌐 WEB DASHBOARD RUNNING!");
  console.log("=================================");
  console.log("👉 PC te browser khul: http://localhost:3000");
  console.log("👉 Phone theke access korte: http://<PC_IP>:3000");
  console.log("=================================");
});