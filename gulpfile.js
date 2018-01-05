/**
 * @license MIT
 */

const browserify = require('browserify');
const buffer = require('vinyl-buffer');
const coveralls = require('gulp-coveralls');
const fs = require('fs-extra');
const gulp = require('gulp');
const path = require('path');
const istanbul = require('gulp-istanbul');
const merge = require('merge-stream');
const mocha = require('gulp-mocha');
const sorcery = require('sorcery');
const source = require('vinyl-source-stream');
const sourcemaps = require('gulp-sourcemaps');
const ts = require('gulp-typescript');
const util = require('gulp-util');
const webpack = require('webpack-stream');

let buildDir = process.env.BUILD_DIR || 'build';
let tsProject = ts.createProject('tsconfig.json');
let srcDir = tsProject.config.compilerOptions.rootDir;
let outDir = tsProject.config.compilerOptions.outDir;

// Under some environments like TravisCI, this comes out at absolute which can
// break the build. This ensures that the outDir is absolute.
if (path.normalize(outDir).indexOf(__dirname) !== 0) {
  outDir = `${__dirname}/${path.normalize(outDir)}`;
}

/**
 * Compile TypeScript sources to JavaScript files and create a source map file for each TypeScript
 * file compiled.
 */
gulp.task('tsc', function () {
  // Remove the ${outDir}/ directory to prevent confusion if files were deleted in ${srcDir}/
  fs.emptyDirSync(`${outDir}`);

  // Build all TypeScript files (including tests) to ${outDir}/, based on the configuration defined in
  // `tsconfig.json`.
  let tsResult = tsProject.src().pipe(sourcemaps.init()).pipe(tsProject());
  let tsc = merge(
    tsResult.js.pipe(sourcemaps.write('.', {includeContent: false, sourceRoot: ''})).pipe(gulp.dest(outDir)),
    tsResult.dts.pipe(sourcemaps.write('.', {includeContent: false, sourceRoot: ''})).pipe(gulp.dest(outDir))
  );

  let addons = ['attach', 'fit', 'fullscreen', 'search', 'terminado', 'winptyCompat', 'zmodem'];
  let addonStreams = addons.map(function(addon) {
    fs.emptyDirSync(`${outDir}/addons/${addon}`);

    let tsProjectAddon = ts.createProject(`./src/addons/${addon}/tsconfig.json`);
    let tsResultAddon = tsProjectAddon.src().pipe(sourcemaps.init()).pipe(tsProjectAddon());
    let tscAddon = tsResultAddon.js
      .pipe(sourcemaps.write('.', {includeContent: false, sourceRoot: ''}))
      .pipe(gulp.dest(`${outDir}/addons/${addon}`));

    return tscAddon;
  });

  // Copy all addons from ${srcDir}/ to ${outDir}/
  let copyAddons = gulp.src([
    `${srcDir}/addons/**/**`
  ]).pipe(gulp.dest(`${outDir}/addons`));

  // Copy stylesheets from ${srcDir}/ to ${outDir}/
  let copyStylesheets = gulp.src(`${srcDir}/**/*.css`).pipe(gulp.dest(outDir));

  // Join all streams into a single array
  let streams = [tsc].concat(addonStreams).concat([copyAddons, copyStylesheets]);

  return merge.apply(this, streams);
});

/**
 * Bundle JavaScript files produced by the `tsc` task, into a single file named `xterm.js` with
 * Browserify.
 */
gulp.task('browserify', ['tsc'], function() {
  // Ensure that the build directory exists
  fs.ensureDirSync(buildDir);

  let browserifyOptions = {
    basedir: buildDir,
    debug: true,
    entries: [`${outDir}/xterm.js`],
    standalone: 'Terminal',
    cache: {},
    packageCache: {}
  };
  let bundleStream = browserify(browserifyOptions)
        .bundle()
        .pipe(source('xterm.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true, sourceRoot: '..'}))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(buildDir));

  // Copy stylesheets from ${outDir}/ to ${buildDir}/
  let copyStylesheets = gulp.src(`${outDir}/**/*.css`).pipe(gulp.dest(buildDir));

  return merge(bundleStream, copyStylesheets);
});

gulp.task('browserify-addons', ['tsc'], function() {
  let searchOptions = {
    basedir: `${buildDir}/addons/search`,
    debug: true,
    entries: [`${outDir}/addons/search/search.js`],
    cache: {},
    packageCache: {}
  };
  let searchBundle = browserify(searchOptions)
        .external(path.join(outDir, 'Terminal.js'))
        .bundle()
        .pipe(source('./addons/search/search.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true, sourceRoot: ''}))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(buildDir));

  let winptyCompatOptions = {
    basedir: `${buildDir}/addons/winptyCompat`,
    debug: true,
    entries: [`${outDir}/addons/winptyCompat/winptyCompat.js`],
    cache: {},
    packageCache: {}
  };
  let winptyCompatBundle = browserify(winptyCompatOptions)
        .external(path.join(outDir, 'Terminal.js'))
        .bundle()
        .pipe(source('./addons/winptyCompat/winptyCompat.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true, sourceRoot: ''}))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(buildDir));

  // Copy all add-ons from outDir to buildDir
  let copyAddons = gulp.src([
    // Copy JS addons
    `${outDir}/addons/**/*`
  ]).pipe(gulp.dest(`${buildDir}/addons`));

  return merge(searchBundle, winptyCompatBundle, copyAddons);
});

gulp.task('instrument-test', function () {
  return gulp.src([`${outDir}/**/*.js`])
    // Covering files
    .pipe(istanbul())
    // Force `require` to return covered files
    .pipe(istanbul.hookRequire());
});

gulp.task('mocha', ['instrument-test'], function () {
  return gulp.src([
    `${outDir}/*test.js`,
    `${outDir}/**/*test.js`,
    `${outDir}/*integration.js`,
    `${outDir}/**/*integration.js`
  ], {read: false})
      .pipe(mocha())
      .once('error', () => process.exit(1))
      .pipe(istanbul.writeReports());
});

/**
 * Run single test file by file name(without file extension). Example of the command:
 * gulp mocha-test --test InputHandler.test
 */
gulp.task('mocha-test', ['instrument-test'], function () {
  let testName = util.env.test;
  util.log("Run test by Name: " + testName);
  return gulp.src([`${outDir}/${testName}.js`, `${outDir}/**/${testName}.js`], {read: false})
         .pipe(mocha())
         .once('error', () => process.exit(1))
         .pipe(istanbul.writeReports());
});

/**
 * Use `sorcery` to resolve the source map chain and point back to the TypeScript files.
 * (Without this task the source maps produced for the JavaScript bundle points into the
 * compiled JavaScript files in ${outDir}/).
 */
gulp.task('sorcery', ['browserify'], function () {
  let chain = sorcery.loadSync(`${buildDir}/xterm.js`);
  chain.apply();
  chain.writeSync();
});

gulp.task('sorcery-addons', ['browserify-addons'], function () {
  var chain = sorcery.loadSync(`${buildDir}/addons/search/search.js`);
  chain.apply();
  chain.writeSync();
});

gulp.task('webpack', ['build'], function() {
  return gulp.src('demo/main.js')
    .pipe(webpack(require('./webpack.config.js')))
    .pipe(gulp.dest('demo/dist/'));
});

/**
 * Submit coverage results to coveralls.io
 */
gulp.task('coveralls', function () {
  gulp.src('coverage/**/lcov.info')
    .pipe(coveralls());
});

gulp.task('build', ['sorcery', 'sorcery-addons']);
gulp.task('test', ['mocha']);
gulp.task('default', ['build']);
