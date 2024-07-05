// @ts-check

import { spawn } from "child_process";
import { readdir } from "fs/promises";
import { argv } from "process";

/** @type {{cp: import("child_process").ChildProcessByStdio, name: string}[]} */
const jobs = [];

// Core job
jobs.push(createJob('xterm', []));

// Addon jobs
const addons = (await readdir('addons')).map(e => e.replace('addon-', ''));
for (const addon of addons) {
  jobs.push(createJob(`xterm-addon-${addon}`, [`--addon=${addon}`]));
}

// Demo job - This requires the others to be built so it's not included when building all
// jobs.push(createJob('demo-client', [`--demo-client`]));

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
 * @param {string[]} extraArgs
 */
function createJob(name, extraArgs) {
  log(`Starting \x1b[32m${name}\x1b[0m...`);
  const args = [
    'bin/esbuild.mjs',
    ...extraArgs,
    ...argv
  ];
  return {
    name,
    cp: spawn('node', args, { stdio: ["inherit", "inherit", "inherit"] })
  };
}
