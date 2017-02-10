const browserify = require('browserify');
const buffer = require('vinyl-buffer');
const fs = require('fs-extra');
const gulp = require('gulp');
const merge = require('merge-stream');
const sorcery = require('sorcery');
const source = require('vinyl-source-stream');
const sourcemaps = require('gulp-sourcemaps');
const ts = require('gulp-typescript');


let buildDir = process.env.BUILD_DIR || 'build';


/**
 * Compile TypeScript sources to JavaScript files and create a source map file for each TypeScript
 * file compiled.
 */
gulp.task('tsc', function () {
  // Remove the lib/ directory to prevent confusion if files were deleted in src/
  fs.emptyDirSync('lib');

  // Build all TypeScript files (including tests) to lib/, based on the configuration defined in
  // `tsconfig.json`.
  let tsProject = ts.createProject('tsconfig.json');
  let tsResult = tsProject.src().pipe(sourcemaps.init()).pipe(tsProject());
  let tsc = tsResult.js.pipe(sourcemaps.write('.', {includeContent: false, sourceRoot: ''})).pipe(gulp.dest('lib'));

  // Copy all addons from src/ to lib/
  let copyAddons = gulp.src('src/addons/**/*').pipe(gulp.dest('lib/addons'));

  // Copy stylesheets from src/ to lib/
  let copyStylesheets = gulp.src('src/**/*.css').pipe(gulp.dest('lib'));

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
    entries: ['../lib/xterm.js'],
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

  // Copy all add-ons from lib/ to buildDir
  let copyAddons = gulp.src('lib/addons/**/*').pipe(gulp.dest(`${buildDir}/addons`));

  // Copy stylesheets from src/ to lib/
  let copyStylesheets = gulp.src('lib/**/*.css').pipe(gulp.dest(buildDir));

  return merge(bundleStream, copyAddons, copyStylesheets);
});


/**
 * Use `sorcery` to resolve the source map chain and point back to the TypeScript files.
 * (Without this task the source maps produced for the JavaScript bundle points into the
 * compiled JavaScript files in lib/).
 */
gulp.task('sorcery', ['browserify'], function () {
  var chain = sorcery.loadSync(`${buildDir}/xterm.js`);
  var map = chain.apply();
  chain.writeSync();
});

gulp.task('build', ['sorcery']);

gulp.task('default', ['build']);
