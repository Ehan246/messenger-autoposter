const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

const appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));

// 👇 Ekhane tomar message ta likho
const MESSAGE = "Hello everyone! Ei ta ekta test broadcast.";

login({ appState }, (err, api) => {
  if (err) return console.error("❌ Login failed:", err);

  console.log(`⏳ Bot login hoyeche. Sob group khuje ber korchi... (ektu wait koro)`);

  // Ektu delay diye list anbo jate facebook block na kore
  setTimeout(() => {
    api.getThreadList(100, null, ["INBOX"], (err, list) => {
      if (err) {
        return console.log("❌ Facebook API block koreche. 10 minute wait kore abar try kor.");
      }

      const groups = list.filter(t => t.isGroup);
      if (groups.length === 0) return console.log("❌ Kono group pai nai!");

      console.log(`✅ ${groups.length} ta group paoa geche. Ekhon post korchi...`);

      let count = 0;
      groups.forEach((g, i) => {
        setTimeout(() => {
          api.sendMessage(MESSAGE, g.threadID, (e) => {
            if (!e) {
              count++;
              console.log(`✅ Post hoyeche: ${g.name || g.threadID}`);
            }
          });

          // Sob post shesh hole exit
          if (i === groups.length - 1) {
            setTimeout(() => {
              console.log(`\n🚀 Sob shesh! ${count} ta group e post kora hoyeche.`);
              process.exit(0);
            }, 3000);
          }
        }, i * 2000); // Protita group er majhe 2 sec gap
      });
    });
  }, 3000); 
});