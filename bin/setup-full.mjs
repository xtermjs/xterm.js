// @ts-check

import { cpSync, existsSync, lstatSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const nodeModulesPath = resolve(repoRoot, 'node_modules');
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/** @typedef {{ folder: string; reason: string }} Candidate */

/** @param {string} message */
function log(message) {
  console.info(`[setup-fast] ${message}`);
}

/** @param {string[]} args */
function runNpm(args) {
  log(`Running: npm ${args.join(' ')}`);
  const result = spawnSync(npmExecutable, args, {
    cwd: repoRoot,
    stdio: 'inherit'
  });
  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * @param {Candidate[]} candidates
 * @param {string | undefined} folder
 * @param {string} reason
 */
function addCandidate(candidates, folder, reason) {
  if (!folder) {
    return;
  }
  if (candidates.some(candidate => candidate.folder === folder)) {
    return;
  }
  candidates.push({ folder, reason });
  log(`Candidate found (${reason}): ${folder}`);
}

function detectMainSiblingFolder() {
  const currentFolderName = basename(repoRoot);
  if (!currentFolderName.startsWith('xterm.js') || currentFolderName === 'xterm.js') {
    log(`Current folder is "${currentFolderName}", skipping xterm.js sibling lookup.`);
    return undefined;
  }
  const siblingFolder = resolve(dirname(repoRoot), 'xterm.js');
  log(`Current folder is "${currentFolderName}", sibling main folder candidate: ${siblingFolder}`);
  return siblingFolder;
}

function detectWorktreeMainFolder() {
  const gitPath = resolve(repoRoot, '.git');
  if (!existsSync(gitPath)) {
    log('No .git entry found at repo root.');
    return undefined;
  }
  const gitStat = lstatSync(gitPath);
  if (!gitStat.isFile()) {
    log('.git is not a file, this repo does not appear to be a worktree checkout.');
    return undefined;
  }
  const gitFileContent = readFileSync(gitPath, 'utf8').trim();
  const gitDirMatch = /^gitdir:\s*(.+)$/m.exec(gitFileContent);
  if (!gitDirMatch) {
    log('Could not parse gitdir from .git file.');
    return undefined;
  }

  const gitDirPath = resolve(repoRoot, gitDirMatch[1].trim());
  log(`Parsed gitdir from .git file: ${gitDirPath}`);

  const normalizedGitDirPath = gitDirPath.replace(/\\/g, '/');
  const worktreeMarker = '/.git/worktrees/';
  const markerIndex = normalizedGitDirPath.indexOf(worktreeMarker);
  if (markerIndex === -1) {
    log('gitdir path does not contain /.git/worktrees/, skipping worktree main folder lookup.');
    return undefined;
  }

  const normalizedMainFolder = normalizedGitDirPath.slice(0, markerIndex);
  const mainFolder = sep === '/' ? normalizedMainFolder : normalizedMainFolder.split('/').join(sep);
  log(`Worktree main folder candidate: ${mainFolder}`);
  return mainFolder;
}

function resolveSourceFolder() {
  /** @type {Candidate[]} */
  const candidates = [];
  addCandidate(candidates, detectMainSiblingFolder(), 'xterm.js sibling');
  addCandidate(candidates, detectWorktreeMainFolder(), 'worktree main repo');

  for (const candidate of candidates) {
    const candidateNodeModulesPath = resolve(candidate.folder, 'node_modules');
    if (existsSync(candidateNodeModulesPath)) {
      log(`Using candidate (${candidate.reason}) with node_modules: ${candidate.folder}`);
      return candidate.folder;
    }
    log(`Candidate skipped (${candidate.reason}), node_modules missing: ${candidateNodeModulesPath}`);
  }

  log('No candidate folder with node_modules was found.');
  return undefined;
}

if (!existsSync(nodeModulesPath)) {
  log(`node_modules missing: ${nodeModulesPath}`);
  const sourceFolder = resolveSourceFolder();
  if (sourceFolder) {
    const sourceNodeModulesPath = resolve(sourceFolder, 'node_modules');
    log(`Copying node_modules from ${sourceNodeModulesPath} to ${nodeModulesPath}`);
    try {
      cpSync(sourceNodeModulesPath, nodeModulesPath, { recursive: true });
      log('node_modules copy completed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`node_modules copy failed: ${message}`);
      log('Falling back to npm ci.');
      runNpm(['ci']);
    }
  } else {
    log('No source folder available, running npm ci.');
    runNpm(['ci']);
  }
} else {
  log(`node_modules already exists: ${nodeModulesPath}`);
}

runNpm(['run', 'setup']);
