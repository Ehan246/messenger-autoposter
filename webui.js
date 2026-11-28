const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const login = require("@dongdev/fca-unofficial");

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://gamerehan65_db_user:QlhgqsCvdc1TBTel@messengerbot.rwt58x0.mongodb.net/?retryWrites=true&w=majority';
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected!"))
  .catch(err => console.error("❌ MongoDB Error:", err));

const User = require("./models/User");
const Token = require("./models/Token");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public")); // HTML file gulo serve korbe

const upload = multer({ dest: "uploads/" });
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

let sessions = {}; 
let liveLogs = []; 

// ==========================================
// LOGGER
// ==========================================
function logMessage(msg) {
  const time = new Date().toLocaleTimeString();
  const fullMsg = `[${time}] ${msg}`;
  console.log(fullMsg); 
  liveLogs.push(fullMsg); 
  if (liveLogs.length > 100) liveLogs.shift(); 
}

// ==========================================
// AUTHENTICATION MIDDLEWARE (JWT Verify)
// ==========================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "❌ Access Denied! Please login." });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded; // req.user e userId ar username thakbe
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "❌ Invalid or expired token!" });
  }
}

// ==========================================
// SIGNUP API
// ==========================================
app.post('/api/signup', async (req, res) => {
  const { username, email, password, token } = req.body;
  if (!username || !email || !password || !token) {
    return res.status(400).json({ success: false, message: "Sob field puron koren!" });
  }
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Username ba Email already exists!" });
    }
    const tokenDoc = await Token.findOneAndUpdate(
      { token: token, isUsed: false, active: true },
      { $set: { isUsed: true } },
      { new: true, returnDocument: 'after' }
    );
    if (!tokenDoc) {
      return res.status(400).json({ success: false, message: "❌ Ei token ti already used ba invalid!" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword, tokenId: tokenDoc._id });
    await newUser.save();
    tokenDoc.usedBy = newUser._id;
    await tokenDoc.save();
    res.json({ success: true, message: "✅ Account successfully toiri hoyeche!" });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ success: false, message: "❌ Server Error: " + error.message });
  }
});

// ==========================================
// LOGIN API
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email ar Password din!" });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "❌ Bhul Email ba Password!" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "❌ Bhul Email ba Password!" });
    }
    const jwtToken = jwt.sign(
      { userId: user._id, username: user.username }, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '1d' }
    );
    res.json({ 
      success: true, 
      message: "✅ Login Successful!", 
      token: jwtToken,
      username: user.username
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "❌ Server Error: " + error.message });
  }
});

// ==========================================
// LIVE TERMINAL
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
// UPLOAD COOKIES (Auth Protected)
// ==========================================
app.post("/upload", authMiddleware, upload.single("appstate"), (req, res) => {
  const userId = req.user.userId;
  if (!req.file) return res.json({ success: false, message: "File nai!" });

  const appstatePath = `uploads/${userId}.json`;
  fs.renameSync(req.file.path, appstatePath);
  
  if (!sessions[userId]) sessions[userId] = { api: null, groups: [], appstateFile: appstatePath };
  else sessions[userId].appstateFile = appstatePath;

  logMessage(`✅ Cookies uploaded for ${userId}`);
  res.json({ success: true, message: "✅ Cookies Uploaded Successfully!" });
});

// ==========================================
// START BOT (Auth Protected)
// ==========================================
app.post("/start", authMiddleware, (req, res) => {
  const userId = req.user.userId;
  if (!sessions[userId] || !fs.existsSync(sessions[userId].appstateFile)) {
    return res.json({ success: false, message: "❌ Age Cookies Upload koren!" });
  }
  if (sessions[userId].api) return res.json({ success: true, message: "✅ Bot already online!" });

  logMessage(`⏳ Bot starting for ${req.user.username}...`);
  const appState = JSON.parse(fs.readFileSync(sessions[userId].appstateFile, "utf8"));
  
  setTimeout(() => {
    login({ appState }, (err, api) => {
      if (err) {
        logMessage(`❌ Login Failed: ${err}`);
        return res.json({ success: false, message: "❌ Login Failed: " + err });
      }
      sessions[userId].api = api;
      logMessage(`✅ Bot Online for ${req.user.username}!`);
      api.listenMqtt((err) => { if (err) console.error(err); });
      res.json({ success: true, message: "✅ Bot Online!" });
    });
  }, 3000);
});

// ==========================================
// SCAN DIRECT (Auth Protected)
// ==========================================
app.post("/scan-direct", authMiddleware, (req, res) => {
  const userId = req.user.userId;
  if (!sessions[userId] || !sessions[userId].api) return res.json({ success: false, message: "❌ Bot offline!" });

  logMessage(`🔍 Direct API scan starting...`);
  sessions[userId].api.getThreadList(100, null, ["INBOX"], (err, list) => {
    if (err) {
      logMessage(`❌ Scan Failed: ${err.error || err}`);
      return res.json({ success: false, message: "❌ Facebook block koreche." });
    }
    const groups = list.filter(t => t.isGroup).map(t => t.threadID);
    sessions[userId].groups = groups;
    logMessage(`✅ Direct scan complete! Found ${groups.length} groups.`);
    res.json({ success: true, message: `✅ ${groups.length} ta group paoa geche!`, groupsList: groups.join(",") });
  });
});

// ==========================================
// SAVE GROUPS (Auth Protected)
// ==========================================
app.post("/save-groups", authMiddleware, (req, res) => {
  const userId = req.user.userId;
  const { groupIds } = req.body;
  if (!sessions[userId]) return res.json({ success: false, message: "Age login koren!" });
  if (!groupIds || groupIds.trim() === "") return res.json({ success: false, message: "❌ Group ID din!" });

  sessions[userId].groups = groupIds.split(",").map(id => id.trim()).filter(id => id !== "");
  logMessage(`💾 ${sessions[userId].groups.length} groups saved.`);
  res.json({ success: true, message: `✅ ${sessions[userId].groups.length} ta group ID save hoyeche!` });
});

// ==========================================
// POST MESSAGE (Auth Protected)
// ==========================================
app.post("/post", authMiddleware, (req, res) => {
  const userId = req.user.userId;
  const { message } = req.body;
  
  if (!sessions[userId] || !sessions[userId].api) return res.json({ success: false, message: "❌ Bot offline!" });
  if (!message) return res.json({ success: false, message: "❌ Message khali!" });
  if (sessions[userId].groups.length === 0) return res.json({ success: false, message: "❌ Age Group ID save koren!" });

  logMessage(`📤 Posting message to ${sessions[userId].groups.length} groups...`);
  let count = 0;
  const groups = sessions[userId].groups;

  groups.forEach((id, i) => {
    setTimeout(() => {
      sessions[userId].api.sendMessage(message, id, (e) => {
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
// DASHBOARD UI (HTML)
// ==========================================
app.get("/dashboard", (req, res) => {
  res.sendFile(__dirname + "/public/dashboard.html");
});

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));