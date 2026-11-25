const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

const appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));

login({ appState }, (err, api) => {
  if (err) return console.error("Login failed:", err);
  console.log("✅ Logged in! Group list collect korchi... (10 sec wait)");

  let foundGroups = [];

  api.listenMqtt((err, event) => {
    if (err) return console.error(err);
    
    // Jodi group er message ashe
    if (event.threadID && event.isGroup) {
       const id = event.threadID;
       if (!foundGroups.includes(id)) {
         foundGroups.push(id);
         console.log(`📌 New Group Found: ${id}`);
         fs.writeFileSync("groups.txt", foundGroups.join("\n"));
         console.log(`💾 Saved to groups.txt (Total: ${foundGroups.length})`);
       }
    }
  });

  console.log("\n👉 Ebar tomar joto gulo group ache, sob gulo te giye ekta kore message pathao (jekono kichu).");
  console.log("Bot automatic group ID gulo dhore 'groups.txt' file e save korbe.");
});