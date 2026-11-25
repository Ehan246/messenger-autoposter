const fs = require("fs");
const readline = require("readline");
const login = require("@dongdev/fca-unofficial");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const APPSTATE_FILE = "appstate.json";
const GROUPS_FILE = "my-groups.txt";
let client = null;
let groupsList = [];

function ask(q) {
  return new Promise(r => rl.question(q, r));
}

async function loginBot() {
  if (!fs.existsSync(APPSTATE_FILE)) {
    return console.log(`❌ ${APPSTATE_FILE} nai! Age file ta rakho.`);
  }
  
  const appState = JSON.parse(fs.readFileSync(APPSTATE_FILE, "utf8"));
  console.log("⏳ Logging in...");

  login({ appState }, (err, api) => {
    if (err) return console.log("❌ Login failed:", err);
    client = api;
    console.log("✅ Login successful!");

    api.listenMqtt((err, event) => {
      if (err) return console.error(err);
      if (event.body) {
        console.log(`📌 Message dhora porlo: "${event.body}"`);
      }
    });

    if (fs.existsSync(GROUPS_FILE)) {
      groupsList = fs.readFileSync(GROUPS_FILE, "utf8").split("\n").filter(id => id.trim());
    }
    setTimeout(showMenu, 2000);
  });
}

async function scanGroups() {
  if (!client) return console.log("❌ Age login kor!");
  console.log("⏳ Group scan korchi... (wait)");

  setTimeout(() => {
    client.getThreadList(100, null, ["INBOX"], (err, list) => {
      if (err) return console.log("❌ Facebook temporary block koreche. 10 min wait kore abar try kor.");
      
      groupsList = list.filter(t => t.isGroup).map(t => t.threadID);
      fs.writeFileSync(GROUPS_FILE, groupsList.join("\n"));
      console.log(`✅ ${groupsList.length} ta group scan hoyeche!`);
      showMenu();
    });
  }, 5000);
}

async function postMessage() {
  if (!client) return console.log("❌ Age login kor!");
  if (groupsList.length === 0) return console.log("❌ Group list khali! Age scan kor.");

  const msg = await ask("👉 Type your message to post: ");
  if (!msg.trim()) return showMenu();

  console.log(`🚀 ${groupsList.length} ta group e pathachhi...`);
  let count = 0;

  groupsList.forEach((id, i) => {
    setTimeout(() => {
      client.sendMessage(msg, id, (e) => {
        if (!e) count++;
        if (i === groupsList.length - 1) {
          setTimeout(() => {
            console.log(`🎉 Done! ${count}/${groupsList.length} groups e post hoyeche.`);
            showMenu();
          }, 3000);
        }
      });
    }, i * 3000);
  });
}

function changeAdmin() {
  fs.writeFileSync("config.json", JSON.stringify({ ADMIN_ID: "NEW_ID" }, null, 2));
  console.log("✅ config.json e Admin ID change kor.");
  showMenu();
}

async function showMenu() {
  console.log("\n==========================");
  console.log("🤖 MESSENGER DASHBOARD");
  console.log("==========================");
  console.log(`Status: ${client ? "✅ Logged in" : "❌ Not Logged in"}`);
  console.log(`Groups: ${groupsList.length}`);
  console.log("1. Login");
  console.log("2. Scan Groups");
  console.log("3. Post Message");
  console.log("4. Change Admin ID");
  console.log("5. Exit");

  const c = await ask("Choose (1-5): ");

  if (c === "1") loginBot();
  else if (c === "2") scanGroups();
  else if (c === "3") postMessage();
  else if (c === "4") changeAdmin();
  else if (c === "5") process.exit(0);
  else showMenu();
}

showMenu();