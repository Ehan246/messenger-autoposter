const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const login = require("@dongdev/fca-unofficial");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const upload = multer({ dest: "uploads/" });
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// Session Store (User data memory te thakbe)
let sessions = {}; 
// Structure: { token: { api: object, groups: [], adminId: string, appstateFile: string } }

// ==========================================
// LOGIN API (Token check)
// ==========================================
app.post("/login", (req, res) => {
  const { token } = req.body;
  
  // Demo Token (Tui nijer moto kore token bariye nite parbi)
  const validTokens = ["ehan123", "user456", "admin789"]; 
  
  if (!validTokens.includes(token)) {
    return res.json({ success: false, message: "❌ Invalid Token!" });
  }
  
  if (!sessions[token]) {
    sessions[token] = { api: null, groups: [], adminId: "100024128466507", appstateFile: `uploads/${token}.json` };
  }
  
  res.json({ success: true, message: "✅ Login Successful!", hasCookies: fs.existsSync(`uploads/${token}.json`) });
});

// ==========================================
// UPLOAD COOKIES (Appstate)
// ==========================================
app.post("/upload", upload.single("appstate"), (req, res) => {
  const { token } = req.body;
  if (!sessions[token]) return res.json({ success: false, message: "Age login kor!" });
  if (!req.file) return res.json({ success: false, message: "File nai!" });

  fs.renameSync(req.file.path, `uploads/${token}.json`);
  sessions[token].appstateFile = `uploads/${token}.json`;
  res.json({ success: true, message: "✅ Cookies Uploaded!" });
});

// ==========================================
// START BOT
// ==========================================
app.post("/start", (req, res) => {
  const { token } = req.body;
  if (!sessions[token]) return res.json({ success: false, message: "Age login kor!" });
  if (!fs.existsSync(sessions[token].appstateFile)) return res.json({ success: false, message: "❌ Age Cookies Upload kor!" });

  if (sessions[token].api) return res.json({ success: true, message: "✅ Bot already online!" });

  const appState = JSON.parse(fs.readFileSync(sessions[token].appstateFile, "utf8"));
  
  login({ appState }, (err, api) => {
    if (err) return res.json({ success: false, message: "❌ Login Failed: " + err });
    
    sessions[token].api = api;
    api.listenMqtt((err, event) => { if (err) console.error(err); });
    
    res.json({ success: true, message: "✅ Bot Online!" });
  });
});

// ==========================================
// SCAN GROUPS
// ==========================================
app.post("/scan", (req, res) => {
  const { token } = req.body;
  if (!sessions[token] || !sessions[token].api) return res.json({ success: false, message: "❌ Bot offline!" });

  sessions[token].api.getThreadList(100, null, ["INBOX"], (err, list) => {
    if (err) return res.json({ success: false, message: "❌ Facebook block koreche." });
    
    sessions[token].groups = list.filter(t => t.isGroup).map(t => t.threadID);
    res.json({ success: true, message: `✅ ${sessions[token].groups.length} ta group paoa geche!` });
  });
});

// ==========================================
// POST MESSAGE
// ==========================================
app.post("/post", (req, res) => {
  const { token, message } = req.body;
  if (!sessions[token] || !sessions[token].api) return res.json({ success: false, message: "❌ Bot offline!" });
  if (!message) return res.json({ success: false, message: "❌ Message khali!" });
  if (sessions[token].groups.length === 0) return res.json({ success: false, message: "❌ Age scan kor!" });

  let count = 0;
  const groups = sessions[token].groups;

  groups.forEach((id, i) => {
    setTimeout(() => {
      sessions[token].api.sendMessage(message, id, (e) => {
        if (!e) count++;
        if (i === groups.length - 1) {
          setTimeout(() => {
            res.json({ success: true, message: `✅ ${count}/${groups.length} groups e post hoyeche!` });
          }, 1000);
        }
      });
    }, i * 3000);
  });
});

// ==========================================
// CHANGE ADMIN ID
// ==========================================
app.post("/admin", (req, res) => {
  const { token, adminId } = req.body;
  if (!sessions[token]) return res.json({ success: false, message: "Age login kor!" });
  
  sessions[token].adminId = adminId;
  res.json({ success: true, message: "✅ Admin ID updated!" });
});

// ==========================================
// WEB UI (HTML)
// ==========================================
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Multi-User Bot Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { font-family: Arial; box-sizing: border-box; }
        body { background: #f0f2f5; padding: 20px; display: flex; justify-content: center; }
        .box { background: #fff; max-width: 500px; width: 100%; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        h1 { color: #1877f2; text-align: center; }
        input, textarea, button { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ccc; border-radius: 6px; font-size: 15px; }
        button { background: #1877f2; color: white; border: none; font-weight: bold; cursor: pointer; }
        button:hover { background: #0f5bbf; }
        .hidden { display: none; }
        .status { padding: 10px; border-radius: 5px; text-align: center; margin-bottom: 10px; font-weight: bold; }
        .online { background: #d4edda; color: #155724; }
        .offline { background: #f8d7da; color: #721c24; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>🤖 Multi-User Bot</h1>
        
        <!-- Login Section -->
        <div id="login-section">
          <h3>Login with Token</h3>
          <input type="text" id="tokenInput" placeholder="Enter Token (ehan123)">
          <button onclick="login()">Login</button>
          <p id="loginMsg"></p>
        </div>

        <!-- Dashboard Section -->
        <div id="dashboard-section" class="hidden">
          <div id="statusBar" class="status offline">❌ Bot Offline</div>
          
          <h3>1. Upload Cookies (appstate.json)</h3>
          <input type="file" id="cookieFile" accept=".json">
          <button onclick="uploadCookie()">Upload</button>
          
          <h3>2. Bot Control</h3>
          <button onclick="startBot()">Start Bot</button>
          <button onclick="scanGroups()">Scan Groups</button>

          <h3>3. Post Message</h3>
          <textarea id="messageBox" placeholder="Type message..."></textarea>
          <button onclick="postMsg()">Post to All Groups</button>
          
          <h3>4. Change Admin ID</h3>
          <input type="text" id="adminInput" placeholder="Enter Admin ID">
          <button onclick="changeAdmin()">Save Admin</button>

          <p id="msgBox" style="color:green; font-weight:bold;"></p>
        </div>
      </div>

      <script>
        let currentToken = "";

        async function login() {
          const token = document.getElementById('tokenInput').value;
          const res = await fetch('/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token}) });
          const data = await res.json();
          
          if (data.success) {
            currentToken = token;
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');
            document.getElementById('statusBar').innerText = '✅ Logged In';
            document.getElementById('statusBar').className = 'status online';
          } else {
            document.getElementById('loginMsg').innerText = data.message;
          }
        }

        async function uploadCookie() {
          const file = document.getElementById('cookieFile').files[0];
          if(!file) return alert('File select kor!');
          
          const formData = new FormData();
          formData.append('appstate', file);
          formData.append('token', currentToken);
          
          const res = await fetch('/upload', { method: 'POST', body: formData });
          const data = await res.json();
          document.getElementById('msgBox').innerText = data.message;
        }

        async function startBot() {
          const res = await fetch('/start', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: currentToken}) });
          const data = await res.json();
          document.getElementById('msgBox').innerText = data.message;
          if (data.success) {
            document.getElementById('statusBar').innerText = '✅ Bot Online';
            document.getElementById('statusBar').className = 'status online';
          }
        }

        async function scanGroups() {
          const res = await fetch('/scan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: currentToken}) });
          const data = await res.json();
          document.getElementById('msgBox').innerText = data.message;
        }

        async function postMsg() {
          const msg = document.getElementById('messageBox').value;
          const res = await fetch('/post', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: currentToken, message: msg}) });
          const data = await res.json();
          document.getElementById('msgBox').innerText = data.message;
        }

        async function changeAdmin() {
          const adminId = document.getElementById('adminInput').value;
          const res = await fetch('/admin', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: currentToken, adminId}) });
          const data = await res.json();
          document.getElementById('msgBox').innerText = data.message;
        }
      </script>
    </body>
    </html>
  `);
});

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));