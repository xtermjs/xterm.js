const browserify = require('browserify');
const buffer = require('vinyl-buffer');
const coveralls = require('gulp-coveralls');
const fs = require('fs-extra');
const gulp = require('gulp');
const istanbul = require('gulp-istanbul');
const merge = require('merge-stream');
const mocha = require('gulp-mocha');
const sorcery = require('sorcery');
const source = require('vinyl-source-stream');
const sourcemaps = require('gulp-sourcemaps');
const ts = require('gulp-typescript');


let buildDir = process.env.BUILD_DIR || 'build';
let tsProject = ts.createProject('tsconfig.json');
let srcDir = tsProject.config.compilerOptions.rootDir;
let outDir = tsProject.config.compilerOptions.outDir;

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
  let tsc = tsResult.js.pipe(sourcemaps.write('.', {includeContent: false, sourceRoot: ''})).pipe(gulp.dest(outDir));

  // Copy all addons from ${srcDir}/ to ${outDir}/
  let copyAddons = gulp.src(`${srcDir}/addons/**/*`).pipe(gulp.dest(`${outDir}/addons`));

  // Copy stylesheets from ${srcDir}/ to ${outDir}/
  let copyStylesheets = gulp.src(`${srcDir}/**/*.css`).pipe(gulp.dest(outDir));

  return merge(tsc, copyAddons, copyStylesheets);
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
    entries: [`../${outDir}/xterm.js`],
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

  // Copy all add-ons from ${outDir}/ to buildDir
  let copyAddons = gulp.src(`${outDir}/addons/**/*`).pipe(gulp.dest(`${buildDir}/addons`));

  // Copy stylesheets from ${outDir}/ to ${buildDir}/
  let copyStylesheets = gulp.src(`${outDir}/**/*.css`).pipe(gulp.dest(buildDir));

  return merge(bundleStream, copyAddons, copyStylesheets);
});

gulp.task('instrument-test', function () {
  return gulp.src([`${outDir}/**/*.js`])
    // Covering files
    .pipe(istanbul())
    // Force `require` to return covered files
    .pipe(istanbul.hookRequire());
});

gulp.task('mocha', ['instrument-test'], function () {
  return gulp.src([`${outDir}/*test.js`, `${outDir}/**/*test.js`], {read: false})
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
  var chain = sorcery.loadSync(`${buildDir}/xterm.js`);
  chain.apply();
  chain.writeSync();
});

/**
 * Submit coverage results to coveralls.io
 */
gulp.task('coveralls', function () {
  gulp.src('coverage/**/lcov.info')
    .pipe(coveralls());
});

gulp.task('build', ['sorcery']);
gulp.task('test', ['mocha']);
gulp.task('default', ['build']);
