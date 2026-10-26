const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();
const readline = require("readline");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const username = process.argv[2];
const name = process.argv[3] || "Owner";

if (!username) {
  console.log('Usage: node scripts/createSuperAdmin.js <username> "<Full Name>"');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Choose a password (12+ characters): ", async (password) => {
  rl.close();
  if (password.length < 12) {
    console.log("Password too short.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  await User.create({
    username,
    name,
    role: "superadmin",
    passwordHash: await bcrypt.hash(password, 10),
  });
  console.log(`Super admin "${username}" created.`);
  process.exit(0);
});