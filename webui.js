const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const upload = multer({ dest: "uploads/" });
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

let sessions = {}; 

// ==========================================
// LOGIN API
// ==========================================
app.post("/login", (req, res) => {
  const { token } = req.body;
  const validTokens = ["ehan123", "user456", "admin789"]; 
  
  if (!validTokens.includes(token)) {
    return res.json({ success: false, message: "❌ Invalid Token!" });
  }
  
  if (!sessions[token]) {
    sessions[token] = { api: null, groups: [], adminId: "", appstateFile: `uploads/${token}.json` };
  }
  
  res.json({ success: true, message: "✅ Login Successful!", hasCookies: fs.existsSync(`uploads/${token}.json`) });
});

// ==========================================
// UPLOAD COOKIES
// ==========================================
app.post("/upload", upload.single("appstate"), (req, res) => {
  const { token } = req.body;
  if (!sessions[token]) return res.json({ success: false, message: "Age login kor!" });
  if (!req.file) return res.json({ success: false, message: "File nai!" });

  fs.renameSync(req.file.path, `uploads/${token}.json`);
  sessions[token].appstateFile = `uploads/${token}.json`;
  res.json({ success: true, message: "✅ Cookies Uploaded Successfully!" });
});

// ==========================================
// SCAN GROUPS (Auto)
// ==========================================
app.post("/scan", (req, res) => {
  const { token } = req.body;
  if (!sessions[token] || !sessions[token].api) return res.json({ success: false, message: "❌ Bot offline!" });

  sessions[token].api.getThreadList(100, null, ["INBOX"], (err, list) => {
    if (err) return res.json({ success: false, message: "❌ Facebook block koreche. Manual ID dao." });
    
    sessions[token].groups = list.filter(t => t.isGroup).map(t => t.threadID);
    res.json({ success: true, message: `✅ ${sessions[token].groups.length} ta group paoa geche!`, groups: sessions[token].groups });
  });
});

// ==========================================
// SAVE MANUAL GROUPS
// ==========================================
app.post("/save-groups", (req, res) => {
  const { token, groupIds } = req.body;
  if (!sessions[token]) return res.json({ success: false, message: "Age login kor!" });
  
  if (!groupIds || groupIds.trim() === "") {
    return res.json({ success: false, message: "❌ Group ID dao!" });
  }

  sessions[token].groups = groupIds.split(",").map(id => id.trim()).filter(id => id !== "");
  res.json({ success: true, message: `✅ ${sessions[token].groups.length} ta group ID save hoyeche!`, groups: sessions[token].groups });
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
  
  setTimeout(() => {
    login({ appState }, (err, api) => {
      if (err) return res.json({ success: false, message: "❌ Login Failed: " + err });
      
      sessions[token].api = api;
      api.listenMqtt((err, event) => { if (err) console.error(err); });
      
      res.json({ success: true, message: "✅ Bot Online!" });
    });
  }, 3000);
});

// ==========================================
// POST MESSAGE
// ==========================================
app.post("/post", (req, res) => {
  const { token, message } = req.body;
  if (!sessions[token] || !sessions[token].api) return res.json({ success: false, message: "❌ Bot offline!" });
  if (!message) return res.json({ success: false, message: "❌ Message khali!" });
  if (sessions[token].groups.length === 0) return res.json({ success: false, message: "❌ Age Group ID save kor!" });

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
// WEB UI (HTML) - MODERN DESIGN with SCANNER
// ==========================================
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Messenger Bot Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .glass-card { 
          background: rgba(255, 255, 255, 0.95); 
          backdrop-filter: blur(10px);
          width: 100%; max-width: 500px; 
          border-radius: 24px; 
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
          padding: 40px 30px;
        }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { font-size: 24px; font-weight: 700; color: #1a1a1a; }
        .header p { color: #666; font-size: 14px; margin-top: 5px; }
        
        .login-box input { 
          width: 100%; padding: 15px; margin-bottom: 15px; 
          border: 2px solid #e1e5eb; border-radius: 12px; font-size: 15px; transition: 0.3s;
        }
        .login-box input:focus { border-color: #667eea; outline: none; }
        
        .section { background: #f8faff; padding: 20px; border-radius: 16px; margin-bottom: 20px; border: 1px solid #e6ecf5; }
        .section h3 { font-size: 15px; color: #333; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        
        input[type="file"] { width: 100%; margin-bottom: 10px; }
        
        textarea, input[type="text"] { 
          width: 100%; padding: 12px; margin-bottom: 10px; 
          border: 2px solid #e1e5eb; border-radius: 10px; font-size: 14px; transition: 0.3s;
          resize: vertical;
        }
        textarea:focus, input[type="text"]:focus { border-color: #667eea; outline: none; }
        
        button { 
          width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; border: none; border-radius: 12px; font-size: 15px; 
          font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4); }
        button:active { transform: translateY(0); }
        
        .btn-secondary { background: #fff; color: #667eea; border: 2px solid #667eea; margin-top: 10px; }
        .btn-secondary:hover { background: #f0f2ff; }
        
        .hidden { display: none; }
        
        .status { 
          padding: 12px; border-radius: 10px; text-align: center; 
          font-weight: 600; margin-bottom: 20px; font-size: 14px;
        }
        .online { background: #d1fae5; color: #065f46; }
        .offline { background: #fee2e2; color: #991b1b; }
        
        #msgBox { 
          text-align: center; font-weight: 600; padding: 12px; 
          border-radius: 10px; display: none; font-size: 14px; margin-top: 15px;
        }
        
        /* Group List Styles */
        .group-list {
          background: #fff; border: 1px solid #e1e5eb; border-radius: 8px;
          max-height: 150px; overflow-y: auto; margin-bottom: 10px; padding: 10px;
          font-family: monospace; font-size: 13px;
        }
        .group-item { padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
        .group-item:last-child { border-bottom: none; }
      </style>
    </head>
    <body>
      <div class="glass-card">
        <div class="header">
          <h1>🤖 Messenger Bot</h1>
          <p>Secure Multi-User Dashboard</p>
        </div>
        
        <!-- Login Section -->
        <div id="login-section">
          <div class="login-box">
            <input type="text" id="tokenInput" placeholder="Enter Access Token">
            <button onclick="login()">Login</button>
            <p id="loginMsg" style="color:red; text-align:center; margin-top:10px; font-size:14px;"></p>
          </div>
        </div>

        <!-- Dashboard Section -->
        <div id="dashboard-section" class="hidden">
          <div id="statusBar" class="status offline">❌ Bot Offline</div>
          
          <div class="section">
            <h3>1️⃣ Upload Cookies</h3>
            <input type="file" id="cookieFile" accept=".json">
            <button onclick="uploadCookie()">Upload appstate.json</button>
          </div>
          
          <div class="section">
            <h3>2️⃣ Bot Control</h3>
            <button onclick="startBot()">🚀 Start Bot</button>
          </div>

          <div class="section">
            <h3>3️⃣ Group Scanner</h3>
            <button onclick="scanGroups()" class="btn-secondary">🔍 Scan Groups</button>
            <div id="groupListContainer" class="hidden" style="margin-top:10px;">
              <div id="groupList" class="group-list"></div>
              <button onclick="downloadGroups()" class="btn-secondary">⬇️ Download IDs</button>
            </div>
          </div>

          <div class="section">
            <h3>4️⃣ Manual Group IDs</h3>
            <input type="text" id="groupInput" placeholder="Paste IDs here: 12345678, 87654321">
            <button onclick="saveGroups()">💾 Save Group IDs</button>
          </div>

          <div class="section">
            <h3>5️⃣ Post Message</h3>
            <textarea id="messageBox" placeholder="Type your message here..." rows="3"></textarea>
            <button onclick="postMsg()">📤 Post to All Groups</button>
          </div>

          <div id="msgBox"></div>
        </div>
      </div>

      <script>
        let currentToken = "";
        let scannedGroups = [];

        function showMsg(text, isSuccess) {
          const box = document.getElementById('msgBox');
          box.style.display = 'block';
          box.style.background = isSuccess ? '#d1fae5' : '#fee2e2';
          box.style.color = isSuccess ? '#065f46' : '#991b1b';
          box.innerText = text;
        }

        async function login() {
          const token = document.getElementById('tokenInput').value;
          if(!token) return alert('Token dao!');
          
          const res = await fetch('/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token}) });
          const data = await res.json();
          
          if (data.success) {
            currentToken = token;
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');
            document.getElementById('statusBar').innerText = '✅ Logged In Successfully';
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
          showMsg(data.message, data.success);
        }

        async function startBot() {
          const res = await fetch('/start', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: currentToken}) });
          const data = await res.json();
          showMsg(data.message, data.success);
          if (data.success) {
            document.getElementById('statusBar').innerText = '✅ Bot Online';
            document.getElementById('statusBar').className = 'status online';
          }
        }

        async function scanGroups() {
          const res = await fetch('/scan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: currentToken}) });
          const data = await res.json();
          
          if (data.success && data.groups) {
            scannedGroups = data.groups;
            document.getElementById('groupList').innerHTML = scannedGroups.map(id => `<div class="group-item">${id}</div>`).join('');
            document.getElementById('groupListContainer').classList.remove('hidden');
            showMsg(data.message, true);
          } else {
            showMsg(data.message, false);
          }
        }

        function downloadGroups() {
          if(scannedGroups.length === 0) return;
          const blob = new Blob([scannedGroups.join('\\n')], { type: 'text/plain' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'group_ids.txt';
          a.click();
        }

        async function saveGroups() {
          const groupIds = document.getElementById('groupInput').value;
          const res = await fetch('/save-groups', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: currentToken, groupIds}) });
          const data = await res.json();
          showMsg(data.message, data.success);
        }

        async function postMsg() {
          const msg = document.getElementById('messageBox').value;
          if(!msg) return alert('Message likho!');
          
          const res = await fetch('/post', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: currentToken, message: msg}) });
          const data = await res.json();
          showMsg(data.message, data.success);
          if (data.success) document.getElementById('messageBox').value = '';
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