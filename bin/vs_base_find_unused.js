// @ts-check

const { dirname } = require("path");
const ts = require("typescript");
const fs = require("fs");

function findUnusedSymbols(
  /** @type string */ tsconfigPath
) {
  // Initialize a program using the project's tsconfig.json
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(tsconfigPath));

  // Initialize a program with the parsed configuration
  const program = ts.createProgram(parsedConfig.fileNames, {
    ...parsedConfig.options,
    noUnusedLocals: true
  });
  const sourceFiles = program.getSourceFiles();
  const usedBaseSourceFiles = sourceFiles.filter(e => e.fileName.includes('src/vs/base/'));
  const usedFilesInBase = usedBaseSourceFiles.map(e => e.fileName.replace(/^.+\/src\//, 'src/')).sort((a, b) => a.localeCompare(b));
  // console.log('Source files used in src/vs/base/:', used);

  // Get an array of all files that exist in src/vs/base/
  const allFilesInBase = (
    fs.readdirSync('src/vs/base', { recursive: true, withFileTypes: true })
      .filter(e => e.isFile())
      // @ts-ignore HACK: This is only available in Node 20
      .map(e => `${e.parentPath}/${e.name}`.replace(/\\/g, '/'))
  );
  const unusedFilesInBase = allFilesInBase.filter(e => !usedFilesInBase.includes(e));

  console.log({
    allFilesInBase,
    usedFilesInBase,
    unusedFilesInBase
  });
}

// Example usage
findUnusedSymbols("./src/browser/tsconfig.json");
