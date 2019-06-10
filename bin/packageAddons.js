/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const addons = fs.readdirSync(path.resolve(__dirname, '../addons'));
addons.forEach(addon => {  
  cp.spawnSync(
    'npm', ['run', 'package'],
    {
      cwd: path.resolve(__dirname, `../addons/${addon}`),
      stdio: 'inherit'
    }
  );
});
