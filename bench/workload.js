'use strict';

// xterm.js EscapeSequenceParser throughput benchmark
// Runs against compiled output in out-esbuild/
// Measures weighted MB/s across representative terminal workloads

process.env.NODE_PATH = require('path').resolve(__dirname, '../out-esbuild');
require('module').Module._initPaths();

var EscapeSequenceParser = require('common/parser/EscapeSequenceParser').EscapeSequenceParser;
var C0 = require('common/data/EscapeSequences').C0;

function toUtf32(s) {
    var result = new Uint32Array(s.length);
    for (var i = 0; i < s.length; i++) {
        result[i] = s.charCodeAt(i);
    }
    return result;
}

function makeParser() {
    var parser = new EscapeSequenceParser();
    parser.setPrintHandler(function() {});
    parser.setExecuteHandler(C0.LF, function() {});
    parser.setExecuteHandler(C0.CR, function() {});
    parser.setExecuteHandler('\t', function() {});
    parser.setExecuteHandler('\b', function() {});
    parser.registerCsiHandler({ final: 'm' }, function() { return true; });
    parser.registerCsiHandler({ final: 'H' }, function() { return true; });
    parser.registerCsiHandler({ final: 'J' }, function() { return true; });
    parser.registerCsiHandler({ final: 'K' }, function() { return true; });
    parser.registerCsiHandler({ final: 'A' }, function() { return true; });
    parser.registerCsiHandler({ final: 'B' }, function() { return true; });
    parser.registerCsiHandler({ final: 'C' }, function() { return true; });
    parser.registerCsiHandler({ final: 'D' }, function() { return true; });
    parser.registerEscHandler({ final: '7' }, function() { return true; });
    parser.registerEscHandler({ final: '8' }, function() { return true; });
    return parser;
}

var SIZE = 2000000;

var cases = [
    ['print_ascii', (function() {
        var s = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.\n';
        var content = '';
        while (content.length < SIZE) content += s;
        return toUtf32(content);
    })(), 4],

    ['sgr_heavy', (function() {
        var s = '\x1b[0;32mfile.txt\x1b[0m  \x1b[0;34mdir/\x1b[0m  \x1b[1;31merror.log\x1b[0m\n';
        var content = '';
        while (content.length < SIZE) content += s;
        return toUtf32(content);
    })(), 4],

    ['cursor_move', (function() {
        var s = '\x1b[1;1H\x1b[2JStatus: OK\x1b[2;1HLine 2 content here\x1b[3;1HAnother line\n';
        var content = '';
        while (content.length < SIZE) content += s;
        return toUtf32(content);
    })(), 2],

    ['params_heavy', (function() {
        var s = '\x1b[38;5;196mred\x1b[0m \x1b[38;2;0;255;128mgreen\x1b[0m \x1b[48;5;21mblue_bg\x1b[0m\n';
        var content = '';
        while (content.length < SIZE) content += s;
        return toUtf32(content);
    })(), 3],

    ['mixed_realistic', (function() {
        var lines = [
            '\x1b[33mabcd123\x1b[0m fix: resolve parser edge case\n',
            '\x1b[33mef45678\x1b[0m feat: add new feature\n',
            '\x1b[33m9abc012\x1b[0m \x1b[1;31m(HEAD -> main)\x1b[0m chore: update deps\n',
            '\x1b[33m3def456\x1b[0m docs: update readme\n',
            '\x1b[33m789abcd\x1b[0m refactor: clean up utils\n',
        ];
        var content = '';
        while (content.length < SIZE) {
            for (var j = 0; j < lines.length; j++) content += lines[j];
        }
        return toUtf32(content);
    })(), 4],
];

function benchOne(parser, data) {
    for (var w = 0; w < 5; w++) parser.parse(data, data.length);
    var runs = [];
    for (var r = 0; r < 7; r++) {
        var t0 = process.hrtime.bigint();
        parser.parse(data, data.length);
        var dt = Number(process.hrtime.bigint() - t0) / 1e9;
        var mbps = (data.length * 4) / (1024 * 1024) / dt;
        runs.push(mbps);
    }
    runs.sort(function(a, b) { return a - b; });
    return runs[Math.floor(runs.length / 2)];
}

var parser = makeParser();
var totalWeight = 0;
var weightedSum = 0;
var perCase = [];

for (var c = 0; c < cases.length; c++) {
    var name = cases[c][0];
    var data = cases[c][1];
    var weight = cases[c][2];
    var mbps = benchOne(parser, data);
    perCase.push([name, mbps]);
    weightedSum += mbps * weight;
    totalWeight += weight;
}

var weighted = weightedSum / totalWeight;

process.stderr.write('per-case MB/s:\n');
for (var p = 0; p < perCase.length; p++) {
    process.stderr.write('  ' + perCase[p][0] + ': ' + perCase[p][1].toFixed(1) + '\n');
}
process.stderr.write('weighted: ' + weighted.toFixed(1) + ' MB/s\n');

process.stdout.write(weighted.toFixed(1) + '\n');
