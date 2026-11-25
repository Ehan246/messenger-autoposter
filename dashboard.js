const fs = require("fs");
const readline = require("readline");
const login = require("@dongdev/fca-unofficial");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Files check koro
if (!fs.existsSync("appstate.json")) {
  console.log("❌ appstate.json nai! Age file ta folder e rakho.");
  process.exit(1);
}

const appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));

// Load config ba default
let config = { ADMIN_ID: "100024128466507", TARGET_THREAD_ID: "" };
if (fs.existsSync("config.json")) {
  config = JSON.parse(fs.readFileSync("config.json", "utf8"));
}

function saveConfig() {
  fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
}

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function showMenu() {
  console.log("\n=================================");
  console.log("🤖 MESSENGER AUTO-POSTER DASHBOARD");
  console.log("=================================");
  console.log("1. Login & Start Bot");
  console.log("2. Change Admin ID (Current: " + config.ADMIN_ID + ")");
  console.log("3. Change Appstate (Cookies)");
  console.log("4. Post Message to All Groups");
  console.log("5. Exit");
  console.log("=================================");

  const choice = await askQuestion("Choose option (1-5): ");

  if (choice === "1") {
    startBot();
  } else if (choice === "2") {
    const newAdmin = await askQuestion("Enter New Admin ID: ");
    config.ADMIN_ID = newAdmin.trim();
    saveConfig();
    console.log("✅ Admin ID Updated!");
    showMenu();
  } else if (choice === "3") {
    console.log("\n👉 Age c3c-fbstate ba extension theke notun 'appstate.json' download koro.");
    const confirm = await askQuestion("File ta ki 'appstate.json' name e folder e rakha hoyeche? (y/n): ");
    if (confirm.toLowerCase() === 'y') {
      console.log("✅ Appstate updated! Bot restart koro (Option 1)");
      // Note: Appstate update hoye gele bot restart korte hobe
    }
    showMenu();
  } else if (choice === "4") {
    const msg = await askQuestion("Enter message to post: ");
    postToAll(msg);
  } else if (choice === "5") {
    console.log("Bye!");
    process.exit(0);
  } else {
    console.log("❌ Invalid option!");
    showMenu();
  }
}

function startBot() {
  console.log("\n⏳ Logging in...");
  
  login({ appState }, (err, api) => {
    if (err) {
      console.error("❌ Login Failed:", err);
      return showMenu();
    }

    console.log("✅ Logged in as:", config.ADMIN_ID);
    
    // MQTT init koro
    api.listenMqtt((err, event) => {
      if (err) return console.error("Listen error:", err);
      
      // Admin command check
      if (event.body && event.senderID === config.ADMIN_ID) {
        const cmd = event.body.trim().toLowerCase();
        if (cmd === "!start") {
          api.sendMessage("✅ Bot is online and listening!", event.threadID);
        }
      }
    });

    console.log("🤖 Bot is listening in background!");
    console.log("👉 Tui ekhon jekono group e giye bot ke message pathate parbi.");
    
    // Bot chalu hoye gele abar menu te jabe
    setTimeout(() => {
      showMenu();
    }, 3000);
  });
}

async function postToAll(msg) {
  console.log("⏳ Fetching groups from my-groups.txt...");
  
  if (!fs.existsSync("my-groups.txt")) {
    console.log("❌ my-groups.txt nai! Age 'auto-list.js' chaliye list banao.");
    return showMenu();
  }

  const groups = fs.readFileSync("my-groups.txt", "utf8").split("\n").filter(id => id.trim() !== "");
  
  if (groups.length === 0) {
    console.log("❌ Kono group ID nai!");
    return showMenu();
  }

  console.log(`🚀 Posting to ${groups.length} groups...`);

  login({ appState }, (err, api) => {
    if (err) return console.error("Login failed:", err);
    
    api.listenMqtt(() => {}); // MQTT init

    setTimeout(() => {
      let count = 0;
      groups.forEach((id, i) => {
        setTimeout(() => {
          api.sendMessage(msg, id, (e) => {
            if (!e) {
              count++;
              console.log(`✅ Posted in: ${id}`);
            } else {
              console.error(`❌ Failed in: ${id}`);
            }

            if (i === groups.length - 1) {
              setTimeout(() => {
                console.log(`\n🎉 DONE! ${count}/${groups.length} groups e post hoyeche.`);
                showMenu();
              }, 2000);
            }
          });
        }, i * 3000);
      });
    }, 5000);
  });
}

// Start the dashboard
showMenu();