/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const cp = require('child_process');
const fs = require('fs');
const path = require('path');

// Setup auth
fs.writeFileSync(`${process.env['HOME']}/.npmrc`, `//registry.npmjs.org/:_authToken=${process.env['NPM_AUTH_TOKEN']}`);

const isDryRun = process.argv.indexOf('--dry') !== -1;
if (isDryRun) {
  console.log('Publish dry run');
}

const changedFiles = getChangedFilesInCommit('HEAD');

// Publish xterm if any files were changed outside of the addons directory
if (changedFiles.some(e => e.search(/^addons\//) === -1)) {
  checkAndPublishPackage(path.resolve(__dirname, '..'));
}

// Publish addons if any files were changed inside of the addon
const addonPackageDirs = [
  path.resolve(__dirname, '../addons/xterm-addon-attach'),
  path.resolve(__dirname, '../addons/xterm-addon-fit'),
  path.resolve(__dirname, '../addons/xterm-addon-search'),
  path.resolve(__dirname, '../addons/xterm-addon-web-links')
];
addonPackageDirs.forEach(p => {
  const addon = path.basename(p);
  if (changedFiles.some(e => e.indexOf(addon) !== -1)) {
    checkAndPublishPackage(p);
  }
});

function checkAndPublishPackage(packageDir) {
  const packageJson = require(path.join(packageDir, 'package.json'));

  // Determine if this is a stable or beta release
  const publishedVersions = getPublishedVersions(packageJson);
  const isStableRelease = publishedVersions.indexOf(packageJson.version) === -1;

  // Get the next version
  let nextVersion = isStableRelease ? packageJson.version : getNextBetaVersion(packageJson);
  console.log(`Publishing version: ${nextVersion}`);

  // Set the version in package.json
  const packageJsonFile = path.join(packageDir, 'package.json');
  packageJson.version = nextVersion;
  console.log(`Set version of ${packageJsonFile} to ${nextVersion}`);
  if (!isDryRun) {
    fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2));
  }

  // Publish
  const args = ['publish'];
  if (!isStableRelease) {
    args.push('--tag', 'beta');
  }
  console.log(`Spawn: npm ${args.join(' ')}`);
  if (!isDryRun) {
    const result = cp.spawnSync('npm', args, {
      cwd: packageDir,
      stdio: 'inherit'
    });
    if (result.status) {
      console.error(`Spawn exited with code ${result.status}`);
      process.exit(result.status);
    }
  }

  console.groupEnd();
}

function getNextBetaVersion(packageJson) {
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.exec(packageJson.version)) {
    console.error('The package.json version must be of the form x.y.z');
    process.exit(1);
  }
  const tag = 'beta';
  const stableVersion = packageJson.version.split('.');
  const nextStableVersion = `${stableVersion[0]}.${parseInt(stableVersion[1]) + 1}.0`;
  const publishedVersions = getPublishedVersions(packageJson, nextStableVersion, tag);
  if (publishedVersions.length === 0) {
    return `${nextStableVersion}-${tag}1`;
  }
  const latestPublishedVersion = publishedVersions.sort((a, b) => {
    const aVersion = parseInt(a.substr(a.search(/[0-9]+$/)));
    const bVersion = parseInt(b.substr(b.search(/[0-9]+$/)));
    return aVersion > bVersion ? -1 : 1;
  })[0];
  const latestTagVersion = parseInt(latestPublishedVersion.substr(latestPublishedVersion.search(/[0-9]+$/)), 10);
  return `${nextStableVersion}-${tag}${latestTagVersion + 1}`;
}

function getPublishedVersions(packageJson, version, tag) {
  const versionsProcess = cp.spawnSync('npm', ['view', packageJson.name, 'versions', '--json']);
  const versionsJson = JSON.parse(versionsProcess.stdout);
  if (tag) {
    return versionsJson.filter(v => !v.search(new RegExp(`${version}-${tag}[0-9]+`)));
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
