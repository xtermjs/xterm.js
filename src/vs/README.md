This folder contains the `base/` module from the [Visual Studio Code repository](https://github.com/microsoft/vscode) which has many helpers that are useful to xterm.js.

Rarely we want to update these sources when an important bug is fixed upstream or when there is a new feature we want to leverage. To update against upstream:

```
./bin/vs_base_update.ps1
```

If new functions are being used from the project then import them from another project.

Before committing we need to clean up the diff so that files that aren't being used are not inlcuded. The following script uses the typescript compiler to find any files that are not being imported into the project:

```
node ./bin/vs_base_find_unused.js
```

The last step is to do a once over of the resulting bundled xterm.js file to ensure it isn't too large:

1. Run `yarn esbuild`
2. Open up `xterm.mjs`
3. Search for `src/vs/base/`

This will show you all the parts of base that will be included in the final minified bundle. Unfortunately tree shaking doesn't find everything, be on the lookout for large arrays or classes that aren't being used. If your editor has find decorations in the scroll bar it's easy to find which parts of base are consuming a lot of lines.
