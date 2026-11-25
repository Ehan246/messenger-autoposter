const fs = require("fs");
const path = "./data.json";

let data = {
  messages: [],
  autoPosting: false,
  intervalMinutes: 30,
  dailyCount: 0,
  dailyDate: new Date().toDateString(),
  history: []
};

if (fs.existsSync(path)) {
  try {
    data = { ...data, ...JSON.parse(fs.readFileSync(path, "utf8")) };
  } catch (e) {
    console.error("data.json load failed, using fresh");
  }
}

function save() {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function resetDailyIfNeeded() {
  const today = new Date().toDateString();
  if (data.dailyDate !== today) {
    data.dailyDate = today;
    data.dailyCount = 0;
    save();
  }
}

module.exports = {
  get: () => data,
  save,
  resetDailyIfNeeded,
  addMessage(msg) {
    data.messages.push(msg);
    save();
  },
  clearMessages() {
    data.messages = [];
    save();
  },
  setAutoPosting(val) {
    data.autoPosting = val;
    save();
  },
  setInterval(min) {
    data.intervalMinutes = min;
    save();
  },
  incrementDaily() {
    resetDailyIfNeeded();
    data.dailyCount++;
    save();
  },
  addHistory(entry) {
    data.history.push(entry);
    if (data.history.length > 100) data.history.shift();
    save();
  }
};