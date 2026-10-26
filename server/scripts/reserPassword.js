const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();
const readline = require("readline");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const username = (process.argv[2] || "").toLowerCase();
if (!username) {
  console.log("Usage: node scripts/resetPassword.js <username>");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("New password (12+ characters): ", async (password) => {
  rl.close();
  if (password.length < 12) {
    console.log("Password too short.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ username });
  if (!user) {
    console.log(`No user named "${username}". Check the spelling.`);
    process.exit(1);
  }
  user.passwordHash = await bcrypt.hash(password, 10);
  user.active = true;
  await user.save();
  console.log(`Password updated for "${username}".`);
  process.exit(0);
});


//cmd for reseting superadmin pass
//cd D:\Git\print-shop\server
//node scripts/resetPassword.js owner