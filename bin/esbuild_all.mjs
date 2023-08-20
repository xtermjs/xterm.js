// @ts-check

import { spawn } from "child_process";
import { readdir } from "fs/promises";
import { argv } from "process";

const addons = (await readdir('addons')).map(e => e.replace('xterm-addon-', ''));

/** @type {{cp: import("child_process").ChildProcessByStdio, name: string}[]} */
const jobs = [];
jobs.push(createJob('xterm', undefined));
for (const addon of addons) {
  jobs.push(createJob(`xterm-addon-${addon}`, addon));
}

await Promise.all(jobs.map((job, i) => {
  return new Promise(r => {
    job.cp.on('exit', code => {
      log(`Finished \x1b[32m${job.name}\x1b[0m${code ? ' \x1b[31mwith errors\x1b[0m' : ''}`);
      r(code);
    });
  });
}));

/**
 * @param {string} message
 */
function log(message) {
  console.info(`[\x1b[2m${new Date().toLocaleTimeString('en-GB')}\x1b[0m] ${message}`);
}

/**
 * @param {string} name
 * @param {string | undefined} addon
 */
function createJob(name, addon) {
  log(`Starting \x1b[32m${name}\x1b[0m...`);
  const args = ['bin/esbuild.mjs'];
  if (addon) {
    args.push(`--addon=${addon}`);
  }
  args.push(...argv);
  return {
    name,
    cp: spawn('node', args, { stdio: ["inherit", "inherit", "inherit"] })
  };
}
