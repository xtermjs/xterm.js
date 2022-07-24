/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

const axios = require('axios').default;
const mkdirp = require('mkdirp');
const yauzl = require('yauzl');

const urls = {
  fira: 'https://github.com/tonsky/FiraCode/raw/d42e7276fa925e5f82748f3ec9ea429736611b48/distr/otf/FiraCode-Regular.otf',
  iosevka: 'https://github.com/be5invis/Iosevka/releases/download/v1.14.3/01-iosevka-1.14.3.zip'
};

const writeFile = util.promisify(fs.writeFile);
const fontsFolder = path.join(__dirname, '../fonts');

async function download() {
  await mkdirp(fontsFolder);

  try {
    await downloadFiraCode();
    await downloadIosevka();
    console.log('Loaded all fonts for testing')
  } catch (e) {
    console.warn('Fonts failed to download, ligature tests will not work', e);
  }
}

async function downloadFiraCode() {
  const file = path.join(fontsFolder, 'firaCode.otf');
  if (await util.promisify(fs.exists)(file)) {
    console.log('Fira Code already loaded');
  } else {
    console.log('Downloading Fira Code...');
    await writeFile(
      file,
      (await axios.get(urls.fira, { responseType: 'arraybuffer' })).data
    );
  }
}

async function downloadIosevka() {
  const file = path.join(fontsFolder, 'iosevka.ttf');
  if (await util.promisify(fs.exists)(file)) {
    console.log('Iosevka already loaded');
  } else {
    console.log('Downloading Iosevka...');
    const iosevkaContents = (await axios.get(urls.iosevka, { responseType: 'arraybuffer' })).data;
    const iosevkaZipfile = await util.promisify(yauzl.fromBuffer)(iosevkaContents);
    await new Promise((resolve, reject) => {
      iosevkaZipfile.on('entry', entry => {
        if (entry.fileName === 'ttf/iosevka-regular.ttf') {
          iosevkaZipfile.openReadStream(entry, (err, stream) => {
            if (err) {
              return reject(err);
            }

            const writeStream = fs.createWriteStream(file);
            stream.pipe(writeStream);
            writeStream.on('close', () => resolve());
          });
        }
      });
    });
  }
}

download();

process.on('unhandledRejection', e => {
  console.error(e);
  process.exit(1);
});
