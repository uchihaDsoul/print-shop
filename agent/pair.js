// Run once: node pair.js --server http://localhost:5000 --code ABCD2345
const { save } = require("./config");
const { call } = require("./api");

function readArgs() {
  const out = {};
  const list = process.argv.slice(2);
  for (let i = 0; i < list.length; i += 2) {
    if (list[i].startsWith("--")) out[list[i].slice(2)] = list[i + 1];
  }
  return out;
}

async function main() {
  const { server, code } = readArgs();
  if (!server || !/^https?:\/\//.test(server)) {
    console.error('Missing --server, for example --server "http://localhost:5000"');
    process.exit(1);
  }
  if (!code) {
    console.error("Missing --code (the 8-letter code from the Computers page)");
    process.exit(1);
  }

  const serverUrl = server.replace(/\/+$/, "");
  try {
    const result = await call({ serverUrl }, "/pair", { code }, false);
    save({ serverUrl, computerId: result.computerId, name: result.name, key: result.key });
    console.log(`Paired as "${result.name}". The key was saved in config.json (never share that file).`);
    console.log("Now start the agent with: node index.js");
  } catch (err) {
    console.error("Pairing failed: " + err.message);
    process.exit(1);
  }
}

main();