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
let liveLogs = []; 

// ==========================================
// LOGGER FUNCTION
// ==========================================
function logMessage(msg) {
  const time = new Date().toLocaleTimeString();
  const fullMsg = `[${time}] ${msg}`;
  console.log(fullMsg); 
  liveLogs.push(fullMsg); 
  if (liveLogs.length > 100) liveLogs.shift(); 
}

// ==========================================
// LIVE TERMINAL (SSE)
// ==========================================
app.get("/live-logs", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const interval = setInterval(() => {
    if (liveLogs.length > 0) {
      res.write(`data: ${JSON.stringify(liveLogs)}\n\n`);
      liveLogs = []; 
    }
  }, 1000);

  req.on("close", () => clearInterval(interval));
});

// ==========================================
// LOGIN API
// ==========================================
app.post("/login", (req, res) => {
  const { token } = req.body;
  const validTokens = ["ehan123", "user456", "admin789"]; 
  
  if (!validTokens.includes(token)) {
    logMessage("❌ Invalid Token attempt!");
    return res.json({ success: false, message: "❌ Invalid Token!" });
  }
  
  if (!sessions[token]) {
    sessions[token] = { api: null, groups: [], adminId: "", appstateFile: `uploads/${token}.json`, scanning: false };
  }
  
  logMessage(`✅ Token login successful: ${token}`);
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
  logMessage(`✅ Cookies uploaded for ${token}`);
  res.json({ success: true, message: "✅ Cookies Uploaded Successfully!" });
});

// ==========================================
// START BOT
// ==========================================
app.post("/start", (req, res) => {
  const { token } = req.body;
  if (!sessions[token]) return res.json({ success: false, message: "Age login kor!" });
  if (!fs.existsSync(sessions[token].appstateFile)) return res.json({ success: false, message: "❌ Age Cookies Upload kor!" });

  if (sessions[token].api) return res.json({ success: true, message: "✅ Bot already online!" });

  logMessage(`⏳ Bot starting for ${token}...`);
  const appState = JSON.parse(fs.readFileSync(sessions[token].appstateFile, "utf8"));
  
  setTimeout(() => {
    login({ appState }, (err, api) => {
      if (err) {
        logMessage(`❌ Login Failed for ${token}: ${err}`);
        return res.json({ success: false, message: "❌ Login Failed: " + err });
      }
      
      sessions[token].api = api;
      logMessage(`✅ Bot Online for ${token}!`);
      
      api.listenMqtt((err, event) => { 
        if (err) return console.error(err);
        
        if (sessions[token].scanning && event.type === "message" && event.threadID) {
          if (event.threadID !== event.senderID) {
            if (!sessions[token].groups.includes(event.threadID)) {
              sessions[token].groups.push(event.threadID);
              logMessage(`📌 [${token}] New Group ID: ${event.threadID}`);
            }
          }
        }
      });
      
      res.json({ success: true, message: "✅ Bot Online!" });
    });
  }, 3000);
});

// ==========================================
// START SCAN
// ==========================================
app.post("/scan-start", (req, res) => {
  const { token } = req.body;
  if (!sessions[token] || !sessions[token].api) return res.json({ success: false, message: "❌ Bot offline!" });

  sessions[token].scanning = true;
  sessions[token].groups = [];
  logMessage(`🔍 Scanning started for ${token}`);
  
  res.json({ success: true, message: "✅ Scan chalu! Ebar tomar group gulo te ekta kore message patha." });
});

// ==========================================
// STOP SCAN
// ==========================================
app.post("/scan-stop", (req, res) => {
  const { token } = req.body;
  if (!sessions[token]) return res.json({ success: false, message: "Age login kor!" });
  
  sessions[token].scanning = false;
  const commaSeparatedList = sessions[token].groups.join(",");
  
  logMessage(`🛑 Scan stopped for ${token}. Total: ${sessions[token].groups.length}`);
  
  res.json({ 
    success: true, 
    message: `✅ Scan stop! ${sessions[token].groups.length} ta group paoa geche.`,
    groupsList: commaSeparatedList 
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
  logMessage(`💾 ${sessions[token].groups.length} groups saved for ${token}`);
  res.json({ success: true, message: `✅ ${sessions[token].groups.length} ta group ID save hoyeche!` });
});

// ==========================================
// POST MESSAGE
// ==========================================
app.post("/post", (req, res) => {
  const { token, message } = req.body;
  if (!sessions[token] || !sessions[token].api) return res.json({ success: false, message: "❌ Bot offline!" });
  if (!message) return res.json({ success: false, message: "❌ Message khali!" });
  if (sessions[token].groups.length === 0) return res.json({ success: false, message: "❌ Age Group ID save kor!" });

  logMessage(`📤 Posting message to ${sessions[token].groups.length} groups...`);
  
  let count = 0;
  const groups = sessions[token].groups;

  groups.forEach((id, i) => {
    setTimeout(() => {
      sessions[token].api.sendMessage(message, id, (e) => {
        if (!e) count++;
        if (i === groups.length - 1) {
          setTimeout(() => {
            logMessage(`✅ Posting done: ${count}/${groups.length} success.`);
            res.json({ success: true, message: `✅ ${count}/${groups.length} groups e post hoyeche!` });
          }, 1000);
        }
      });
    }, i * 3000);
  });
});

// ==========================================
// WEB UI (HTML) - 2 TABS
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
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        .glass-card { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius: 24px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2); padding: 30px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 24px; font-weight: 700; color: #1a1a1a; }
        
        /* Tabs */
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab-btn { flex: 1; padding: 12px; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; background: #e2e8f0; color: #475569; transition: 0.3s; }
        .tab-btn.active { background: #667eea; color: white; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
        
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        
        .section { background: #f8faff; padding: 20px; border-radius: 16px; margin-bottom: 20px; border: 1px solid #e6ecf5; }
        .section h3 { font-size: 15px; color: #333; margin-bottom: 12px; }
        
        input[type="file"], input[type="text"], textarea { width: 100%; padding: 12px; margin-bottom: 10px; border: 2px solid #e1e5eb; border-radius: 10px; font-size: 14px; }
        textarea:focus, input:focus { border-color: #667eea; outline: none; }
        
        button { width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        button:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4); }
        .btn-secondary { background: #fff; color: #667eea; border: 2px solid #667eea; margin-top: 10px; }
        .btn-danger { background: #ef4444; }
        .hidden { display: none; }
        
        .status { padding: 12px; border-radius: 10px; text-align: center; font-weight: 600; margin-bottom: 20px; font-size: 14px; }
        .online { background: #d1fae5; color: #065f46; }
        .offline { background: #fee2e2; color: #991b1b; }
        
        .terminal-box { background: #1e1e1e; color: #00ff00; font-family: monospace; padding: 15px; border-radius: 10px; height: 200px; overflow-y: auto; font-size: 13px; }
        .terminal-line { margin-bottom: 5px; white-space: pre-wrap; word-break: break-all; }
        
        .group-list-box { background: #fff; border: 1px solid #e1e5eb; border-radius: 10px; max-height: 200px; overflow-y: auto; padding: 10px; font-family: monospace; font-size: 13px; margin-bottom: 10px; }
        .group-item { padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="glass-card">
          <div class="header">
            <h1>🤖 Messenger Bot</h1>
          </div>
          
          <!-- Login Section -->
          <div id="login-section">
            <input type="text" id="tokenInput" placeholder="Enter Access Token">
            <button onclick="login()">Login</button>
            <p id="loginMsg" style="color:red; text-align:center; margin-top:10px;"></p>
          </div>

          <!-- Dashboard Section -->
          <div id="dashboard-section" class="hidden">
            <div id="statusBar" class="status offline">❌ Bot Offline</div>
            
            <!-- Tabs -->
            <div class="tabs">
              <button class="tab-btn active" onclick="switchTab('tool1')">📥 Get Group UID</button>
              <button class="tab-btn" onclick="switchTab('tool2')">🚀 Main Tool</button>
              <button class="tab-btn" onclick="switchTab('settings')">⚙️ Settings</button>
            </div>

            <!-- Tab 1: Get Group UID -->
            <div id="tool1" class="tab-content active">
              <div class="section">
                <h3>Step 1: Upload Cookies</h3>
                <input type="file" id="cookieFile" accept=".json">
                <button onclick="uploadCookie()">Upload appstate.json</button>
              </div>
              <div class="section">
                <h3>Step 2: Start Bot</h3>
                <button onclick="startBot()">🚀 Start Bot</button>
              </div>
              <div class="section">
                <h3>Step 3: Scan Groups</h3>
                <button onclick="startScan()" id="scanBtn">🔍 Start Scan</button>
                <button onclick="stopScan()" id="stopScanBtn" class="btn-danger hidden" style="margin-top:10px;">🛑 Stop Scan</button>
                <p style="font-size:12px; color:#666; margin-top:10px;">*Scan shuru kore prottek group e message pathao.</p>
                <div id="groupListContainer" class="hidden" style="margin-top:10px;">
                  <div id="groupList" class="group-list-box"></div>
                  <button onclick="downloadGroups()" class="btn-secondary">⬇️ Download IDs (.txt)</button>
                </div>
              </div>
            </div>

            <!-- Tab 2: Main Tool -->
            <div id="tool2" class="tab-content">
              <div class="section">
                <h3>Step 1: Load Group IDs</h3>
                <button onclick="document.getElementById('groupFile').click()" class="btn-secondary">📁 Upload .txt File</button>
                <input type="file" id="groupFile" accept=".txt" style="display:none;" onchange="loadFile()">
                <p style="text-align:center; margin:10px 0; font-weight:bold;">OR</p>
                <input type="text" id="groupInput" placeholder="Paste IDs here: 12345678, 87654321">
                <button onclick="saveGroups()">💾 Save Group IDs</button>
              </div>
              <div class="section">
                <h3>Step 2: Post Message</h3>
                <textarea id="messageBox" placeholder="Type your message here..." rows="4"></textarea>
                <button onclick="postMsg()">📤 Post to All Groups</button>
              </div>
            </div>

            <!-- Tab 3: Settings / Terminal -->
            <div id="settings" class="tab-content">
              <div class="section">
                <h3>📟 Live Terminal</h3>
                <div id="terminal" class="terminal-box"></div>
              </div>
            </div>
            
            <div id="msgBox" style="display:none; padding:12px; border-radius:10px; text-align:center; font-weight:600; margin-top:15px;"></div>
          </div>
        </div>
      </div>

      <script>
        let currentToken = "";
        let scannedGroups = [];
        let eventSource = null;

        function switchTab(tabId) {
          document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
          document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
          document.getElementById(tabId).classList.add('active');
          event.target.classList.add('active');
        }

        function setupTerminal() {
          const terminal = document.getElementById('terminal');
          eventSource = new EventSource('/live-logs');
          eventSource.onmessage = function(event) {
            const logs = JSON.parse(event.data);
            logs.forEach(log => {
              const div = document.createElement('div');
              div.className = 'terminal-line';
              div.innerText = log;
              terminal.appendChild(div);
            });
            terminal.scrollTop = terminal.scrollHeight;
          };
        }

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
            document.getElementById('statusBar').innerText = '✅ Logged In';
            document.getElementById('statusBar').className = 'status online';
            setupTerminal();
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

        async function startScan() {
          const res = await fetch('/scan-start', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: currentToken}) });
          const data = await res.json();
          
          if (data.success) {
            document.getElementById('scanBtn').classList.add('hidden');
            document.getElementById('stopScanBtn').classList.remove('hidden');
          } else {
            showMsg(data.message, false);
          }
        }

        async function stopScan() {
          const res = await fetch('/scan-stop', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: currentToken}) });
          const data = await res.json();
          
          if (data.success) {
            showMsg(data.message, true);
            document.getElementById('scanBtn').classList.remove('hidden');
            document.getElementById('stopScanBtn').classList.add('hidden');
            
            if (data.groupsList) {
              scannedGroups = data.groupsList.split(',');
              let html = '';
              scannedGroups.forEach(id => { html += '<div class="group-item">' + id + '</div>'; });
              document.getElementById('groupList').innerHTML = html;
              document.getElementById('groupListContainer').classList.remove('hidden');
            }
          } else {
            showMsg(data.message, false);
          }
        }

        function downloadGroups() {
          if(scannedGroups.length === 0) return;
          const blob = new Blob([scannedGroups.join('\\n')], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'group_ids.txt';
          a.click();
        }

        function loadFile() {
          const file = document.getElementById('groupFile').files[0];
          if(!file) return;
          const reader = new FileReader();
          reader.onload = (e) => {
            document.getElementById('groupInput').value = e.target.result.replace(/\\n/g, ',');
          };
          reader.readAsText(file);
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