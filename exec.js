const { spawn } = require("child_process");

const exec = (cmd, args = [], options = {}) =>
  new Promise((resolve, reject) => {
    const app = spawn(cmd, args, {
      stdio: "inherit",
      ...options,
    });

    app.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed: ${cmd}`));
        return;
      }

      resolve(code);
    });

    app.on("error", reject);
  });

module.exports = exec;
