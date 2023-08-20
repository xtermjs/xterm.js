import { spawn } from "child_process";
import { readdir } from "fs/promises";
import { argv } from "process";

const addons = (await readdir('addons')).map(e => e.replace('xterm-addon-', ''));

const cps = [];
for (const addon of addons) {
  log(`Starting \x1b[32mxterm-addon-${addon}\x1b[0m...`);
  cps.push(spawn(
    'node',
    [
      'bin/esbuild.mjs',
      `--addon=${addon}`,
      ...argv
    ],
    {
      stdio: ["inherit", "inherit", "inherit"]
    }
  ));
}

await Promise.all(cps.map((cp, i) => {
  return new Promise(r => {
    cp.on('exit', code => {
      log(`Finished \x1b[32mxterm-addon-${addons[i]}\x1b[0m${code ? ' \x1b[31mwith errors\x1b[0m' : ''}`);
      r(code);
    });
  });
}));

function log(message) {
  console.info(`[\x1b[2m${new Date().toLocaleTimeString('en-GB')}\x1b[0m] ${message}`);
}
