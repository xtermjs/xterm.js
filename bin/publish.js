/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Setup auth
if (process.env['NPM_AUTH_TOKEN']) {
  fs.writeFileSync(`${process.env['HOME']}/.npmrc`, `//registry.npmjs.org/:_authToken=${process.env['NPM_AUTH_TOKEN']}`);
}

log('Configuration:', 'green')
const isDryRun = process.argv.includes('--dry');
if (isDryRun) {
  log('  Publish dry run');
}

const allAddons = process.argv.includes('--all-addons');
if (allAddons) {
  log('  Publish all addons');
}

const repoCommit = getRepoCommit();
const changedFiles = getChangedFilesInCommit('HEAD');

// Always publish xterm, technically this isn't needed if
// `changedFiles.some(e => e.search(/^addons\//)`, but it's here for convenience to get the right
// peer dependencies for addons.
const result = checkAndPublishPackage(path.resolve(__dirname, '..'), repoCommit);
const isStableRelease = result.isStableRelease;
const peerDependencies = result.nextVersion.includes('beta') ? {
  '@xterm/xterm': `^${result.nextVersion}`,
} : undefined;
checkAndPublishPackage(path.resolve(__dirname, '../headless'), repoCommit);

// Addon peer dependencies

// Publish addons if any files were changed inside of the addon
const addonPackageDirs = [
  path.resolve(__dirname, '../addons/addon-attach'),
  path.resolve(__dirname, '../addons/addon-clipboard'),
  path.resolve(__dirname, '../addons/addon-fit'),
  path.resolve(__dirname, '../addons/addon-image'),
  path.resolve(__dirname, '../addons/addon-ligatures'),
  path.resolve(__dirname, '../addons/addon-progress'),
  path.resolve(__dirname, '../addons/addon-search'),
  path.resolve(__dirname, '../addons/addon-serialize'),
  path.resolve(__dirname, '../addons/addon-unicode11'),
  // path.resolve(__dirname, '../addons/addon-unicode-graphemes'),
  path.resolve(__dirname, '../addons/addon-web-links'),
  path.resolve(__dirname, '../addons/addon-webgl')
];
log(`Checking if addons need to be published`, 'green');
for (const p of addonPackageDirs) {
  const addon = path.basename(p);
  if (allAddons || changedFiles.some(e => e.includes(addon))) {
    checkAndPublishPackage(p, repoCommit, peerDependencies);
  }
}

// Publish website if it's a stable release
if (isStableRelease) {
  updateWebsite();
}

function checkAndPublishPackage(packageDir, repoCommit, peerDependencies) {
  const packageJson = require(path.join(packageDir, 'package.json'));

  // Determine if this is a stable or beta release
  const publishedVersions = getPublishedVersions(packageJson);
  const isStableRelease = !publishedVersions.includes(packageJson.version);

  // Get the next version
  let nextVersion = isStableRelease ? packageJson.version : getNextBetaVersion(packageJson);
  log(`Publishing version: ${nextVersion}`, 'green');

  // Set the version in package.json
  const packageJsonFile = path.join(packageDir, 'package.json');
  packageJson.version = nextVersion;

  // Set the commit in package.json
  if (repoCommit) {
    packageJson.commit = repoCommit;
    log(`Set commit of ${packageJsonFile} to ${repoCommit}`);
  } else {
    throw new Error(`No commit set`);
  }

  // Set peer dependencies
  if (peerDependencies) {
    packageJson.peerDependencies = peerDependencies;
    log(`Set peerDependencies of ${packageJsonFile} to ${JSON.stringify(peerDependencies)}`);
  } else {
    log(`Skipping peerDependencies`);
  }

  // Write new package.json
  fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2));

  // Publish
  const args = ['publish', '--access', 'public'];
  if (!isStableRelease) {
    args.push('--tag', 'beta');
  }
  if (isDryRun) {
    args.push('--dry-run');
  }
  log(`Spawn: npm ${args.join(' ')}`);
  const result = cp.spawnSync('npm', args, {
    cwd: packageDir,
    stdio: 'inherit'
  });
  if (result.status) {
    throw new Error(`Spawn exited with code ${result.status}`);
  }

  return { isStableRelease, nextVersion };
}

function getRepoCommit() {
  const commitProcess = cp.spawnSync('git', ['log', '-1', '--format="%H"']);
  if (commitProcess.stdout.length === 0 && commitProcess.stderr) {
    const err = versionsProcess.stderr.toString();
    throw new Error('Could not get repo commit\n' + err);
  }
  const output = commitProcess.stdout.toString().trim();
  return output.replace(/^"/, '').replace(/"$/, '');
}

function getNextBetaVersion(packageJson) {
  if (!/^\d+\.\d+\.\d+$/.exec(packageJson.version)) {
    throw new Error('The package.json version must be of the form x.y.z');
  }
  const tag = 'beta';
  const stableVersion = packageJson.version.split('.');
  const nextStableVersion = `${stableVersion[0]}.${parseInt(stableVersion[1]) + 1}.0`;
  const publishedVersions = getPublishedVersions(packageJson, nextStableVersion, tag);
  if (publishedVersions.length === 0) {
    return `${nextStableVersion}-${tag}.1`;
  }
  const latestPublishedVersion = publishedVersions.sort((a, b) => {
    const aVersion = parseInt(a.slice(a.search(/\d+$/)));
    const bVersion = parseInt(b.slice(b.search(/\d+$/)));
    return aVersion > bVersion ? -1 : 1;
  })[0];
  const latestTagVersion = parseInt(latestPublishedVersion.slice(latestPublishedVersion.search(/\d+$/)), 10);
  return `${nextStableVersion}-${tag}.${latestTagVersion + 1}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

function getPublishedVersions(packageJson, version, tag) {
  const versionsProcess = cp.spawnSync(
    os.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['view', packageJson.name, 'versions', '--json'],
    { shell: true }
  );
  if (versionsProcess.stdout.length === 0 && versionsProcess.stderr) {
    const err = versionsProcess.stderr.toString();
    if (err.indexOf('404 Not Found - GET https://registry.npmjs.org/@xterm') > 0) {
      return [];
    }
    throw new Error('Could not get published versions\n' + err);
  }
  const output = JSON.parse(versionsProcess.stdout);
  if (typeof output === 'object' && !Array.isArray(output)) {
    if (output.error?.code === 'E404')  {
      return [];
    }
    throw new Error('Could not get published versions\n' + output);
  }
  if (!output || Array.isArray(output) && output.length === 0) {
    return [];
  }
  const versionsJson = asArray(output);
  if (tag) {
    return versionsJson.filter(v => !v.search(new RegExp(`${version}-${tag}.[0-9]+`)));
  }
  return versionsJson;
}

function getChangedFilesInCommit(commit) {
  const args = ['log', '-m', '-1', '--name-only', `--pretty=format:`, commit];
  const result = cp.spawnSync('git', args);
  const output = result.stdout.toString();
  const changedFiles = output.split('\n').filter(e => e.length > 0);
  return changedFiles;
}

function updateWebsite() {
  log('Updating website', 'green');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'website-'));
  const packageJson = require(path.join(path.resolve(__dirname, '..'), 'package.json'));
  if (!isDryRun) {
    cp.spawnSync('sh', [path.join(__dirname, 'update-website.sh'), packageJson.version], { cwd, stdio: [process.stdin, process.stdout, process.stderr] });
  }
}

/**
 * @param {string} message
 */
function log(message, color) {
  let colorSequence = '';
  switch (color) {
    case 'green': {
      colorSequence = '\x1b[32m';
      break;
    }
  }
  console.info([
    `[\x1b[2m${new Date().toLocaleTimeString('en-GB')}\x1b[0m] `,
    colorSequence,
    message,
    '\x1b[0m',
  ].join(''));
}
