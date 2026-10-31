const Setting = require("../models/Setting");

const TYPES = ["plain", "photo_a4", "passport"];

// Which paper the staff told us is in the printer
async function getLoadedPaper() {
  const doc = await Setting.findOne({ key: "paper" });
  const v = (doc && doc.value) || {};
  return {
    loaded: TYPES.includes(v.loaded) ? v.loaded : "plain",
    passportPaper: v.passportPaper === "4x6" ? "4x6" : "a4",
  };
}

async function setLoadedPaper({ loaded, passportPaper }, username) {
  await Setting.findOneAndUpdate(
    { key: "paper" },
    { value: { loaded, passportPaper, since: new Date() }, updatedBy: username || "" },
    { upsert: true, new: true }
  );
}

module.exports = { TYPES, getLoadedPaper, setLoadedPaper };