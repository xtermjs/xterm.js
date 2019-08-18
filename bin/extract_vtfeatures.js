/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 * 
 * Script to extract vt features documented in docstrings.
 */
const fs = require('fs');
const Mustache = require('mustache');

/**
 * regexp to fetch all comments
 * Fetches all multiline comments and single lines containing '// @vt:'.
 */
const REX_COMMENTS = /^\s*?[/][*][*]([\s\S]*?)[*][/]|^\s*?\/\/ ([@]vt[:].*?)$/mug;

// expected - "@vt: type name "sequence" "short description"
/**
 * regexp to parse the @vt line
 * expected data - "@vt: <status> <kind> <mnemonic> <"name"> "<sequence>" "<short description>"
 */
const REX_VT_LINE = /^[@]vt\:\s*(\w+)\s*(\w+)\s*(\w+)\s*"(.*?)"\s*"(.*?)"\s*"(.*?)".*$/;

// known vt command types
const TYPES = [
  'C0',
  'C1',
  'ESC',
  'CSI',
  'DCS',
  'OSC',
  'APC',
  'PM',
  'SOS'
];

const MARKDOWN_TMPL = `
# Supported VT features by xterm.js
Version: {{version}}
### C0

| Mnemonic | Name | Sequence | Short Description | Status |
| -------- | ---- | -------- | ----------------- | ------ |
{{#C0}}
| {{mnemonic}} | {{name}} | \`{{sequence}}\` | {{shortDescription}} | {{status}} |
{{/C0}}


### C1

| Mnemonic | Name | Sequence | Short Description | Status |
| -------- | ---- | -------- | ----------------- | ------ |
{{#C1}}
| {{mnemonic}} | {{name}} | \`{{sequence}}\` | {{shortDescription}} | {{status}} |
{{/C1}}


### CSI

| Mnemonic | Name | Sequence | Short Description | Status |
| -------- | ---- | -------- | ----------------- | ------ |
{{#CSI}}
| {{mnemonic}} | {{name}} | \`{{sequence}}\` | {{shortDescription}} | {{status}} |
{{/CSI}}


### DCS

| Mnemonic | Name | Sequence | Short Description | Status |
| -------- | ---- | -------- | ----------------- | ------ |
{{#DCS}}
| {{mnemonic}} | {{name}} | \`{{sequence}}\` | {{shortDescription}} | {{status}} |
{{/DCS}}


### ESC

| Mnemonic | Name | Sequence | Short Description | Status |
| -------- | ---- | -------- | ----------------- | ------ |
{{#ESC}}
| {{mnemonic}} | {{name}} | \`{{sequence}}\` | {{shortDescription}} | {{status}} |
{{/ESC}}


### OSC

| Mnemonic | Name | Sequence | Short Description | Status |
| -------- | ---- | -------- | ----------------- | ------ |
{{#OSC}}
| {{mnemonic}} | {{name}} | \`{{sequence}}\` | {{shortDescription}} | {{status}} |
{{/OSC}}
`

function parseMultiLine(filename, s) {
  if (!~s.indexOf('@vt:')) {
    return;
  }
  const lines = s.split('\n').map(el => el.trim().replace(/[*]/, '').replace(/\s/, ''));
  let grabLine = false;
  const longDescription = [];
  let feature;
  for (const line of lines) {
    if (grabLine) {
      if (!line) {
        break;
      }
      longDescription.push(line);
    }
    if (~line.indexOf('@vt:')) {
      feature = parseSingleLine(filename, line);
      grabLine = true;
    }
  }
  if (feature) {
    feature.longDescription = longDescription;
    return feature;
  }
}

function parseSingleLine(filename, s) {
  const line = s.trim();
  const match = line.match(REX_VT_LINE);
  if (match !== null) {
    if (!~TYPES.indexOf(match[2])) {
      throw new Error(`unkown vt-command type "${match[2]}" specified in "${filename}"`);
    }
    return {
      status: match[1],
      type: match[2],
      mnemonic: match[3],
      name: match[4],
      sequence: match[5],
      shortDescription: match[6],
      longDescription: [],
      source: filename
    };
  }
}

function postProcessData(features) {
  const featureTable = {};
  for (const feature of features) {
    if (featureTable[feature.type] === undefined) {
      featureTable[feature.type] = [];
    }
    featureTable[feature.type].push(feature);
  }
  for (const entry in featureTable) {
    featureTable[entry].sort((a, b) => a.sequence.slice(-1) > b.sequence.slice(-1));
  }
  // console.error(featureTable);
  featureTable.version = require('../package.json').version;
  console.log(Mustache.render(MARKDOWN_TMPL, featureTable));
}

function main(filenames) {
  // console.error(filenames);
  let leftToProcess = filenames.length;
  const features = [];
  for (const filename of filenames) {
    fs.readFile(filename, 'utf-8', (err, data) => {
      let match;
      while ((match = REX_COMMENTS.exec(data)) !== null) {
        if (match.index === REX_COMMENTS.lastIndex) {
          REX_COMMENTS.lastIndex++;
        }
        const feature = match[1]
          ? parseMultiLine(filename, match[1])
          : parseSingleLine(filename, match[2]);
        if (feature) {
          features.push(feature);
        }
      }
      leftToProcess--;
      if (!leftToProcess) {
        postProcessData(features);
      }
    });
  }
}

main(process.argv.slice(2))
