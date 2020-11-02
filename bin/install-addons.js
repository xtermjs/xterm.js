/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Script to initialize addon packages under "addons/" with outer deps.
 */

const path = require('path');
const cp = require('child_process');
const fs = require('fs');

const PACKAGE_ROOT = path.join(__dirname, '..');

// install addon deps
const addonsPath = path.join(PACKAGE_ROOT, 'addons');
if (fs.existsSync(addonsPath)) {
  console.log('pulling addon dependencies...');

  // whether to use yarn or npm
  let hasYarn = false;
  try {
    cp.execSync('yarn --version').toString();
    hasYarn = true;
  } catch(e) {}

  // walk all addon folders
  fs.readdir(addonsPath, (err, files) => {
    for (const folder of files) {
      const addonPath = path.join(addonsPath, folder);

      // install only if there are dependencies listed
      let packageJson;
      try {
        packageJson = require(path.join(addonPath, 'package.json'));
      } catch (e) {
        // swallow as changing branches can leave folders around
      }
      if (packageJson
            && (
              (packageJson.devDependencies && Object.keys(packageJson.devDependencies).length)
              || (packageJson.dependencies && Object.keys(packageJson.dependencies).length)
            )
          )
      {
        console.log('Preparing', folder);
        if (hasYarn) {
          cp.execSync('yarn', {cwd: addonPath});
        } else {
          cp.execSync('npm install', {cwd: addonPath});
        }
      } else {
        console.log('Skipped', folder);
      }
    }
  });
}
