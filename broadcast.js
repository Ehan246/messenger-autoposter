const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

const appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));

const MESSAGE_TO_POST = "Hello everyone! Ei ta ekta test broadcast."; 

let GROUP_IDS = [];
if (fs.existsSync("my-groups.txt")) {
  GROUP_IDS = fs.readFileSync("my-groups.txt", "utf8").split("\n").filter(id => id.trim() !== "");
} else {
  console.log("❌ my-groups.txt file nei! Age auto-list.js run kor.");
  process.exit(1);
}

login({ appState }, (err, api) => {
  if (err) return console.error("Login failed:", err);

  console.log(`✅ Logged in! Found ${GROUP_IDS.length} groups.`);

  // 🛠️ FIX: MQTT client initialize korte hobe
  api.listenMqtt((listenErr, event) => {
    if (listenErr) console.error("Listen error:", listenErr);
  });

  // MQTT connect hote ektu somoy lagte pare, tai 5 sec wait korbo
  setTimeout(() => {
    let count = 0;
    
    GROUP_IDS.forEach((threadID, index) => {
      setTimeout(() => {
        // 🛠️ FIX: api.sendMessage er bodole api.sendMessage use korchi
        api.sendMessage(MESSAGE_TO_POST, threadID, (e) => {
          if (e) {
            console.error(`❌ Failed to post in ${threadID}: ${e.error || e}`);
          } else {
            console.log(`✅ Posted in: ${threadID}`);
            count++;
          }

          if (index === GROUP_IDS.length - 1) {
            setTimeout(() => {
              console.log(`\n🚀 Done! Broadcast sent to ${count}/${GROUP_IDS.length} groups.`);
              process.exit(0);
            }, 2000);
          }
        });
      }, index * 3000); 
    });
  }, 5000); // 5 sec wait MQTT connect er jonno
});