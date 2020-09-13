import path from 'path';
import fs from 'fs';
import {
  returnAllFiles,
  searchWholeWord,
  getLines,
  detectEndOfImports,
} from './utils';
import allFiles from './allTheFiles';
const babelParser = require('@babel/parser');

const rootPath = '/Users/prabhasjoshi/code/x/src/js';

//getting all the files
//const allFiles = returnAllFiles(rootPath);

//console.log(JSON.stringify(allFiles));

const allJs = allFiles.filter((file) => path.extname(file) === '.js');
const allSss = allFiles.filter((file) => path.extname(file) === '.sss');

const exportDefaultFromBeginning = /^export default/;

const namedExportReg1 = /^export (const|let) (\w+)\s/;
const namedExportReg2 = /^export function (\w+)/;
//for this - split the match(",")
const namedExportReg3 = /^export \{ (.*) \}/;
const namedExportReg4 = /^export class (\w+)\s/;

//this is for a re-export
const namedExportReg5 = /^export (\w+) from/;
const namedExportReg6 = /^export function\* (\w+)/;

//need to find every named export until the end of this block:
const namedExportReg7 = /^export \{$/;
const endOfNamedExportReg7 = /^\};$/;
const wordBetweenParethesis = /^(\s+)(\w+),/;

const inlineCommentRegex = /^\/\//;

//regex for paths starting with api
const startingWithApiRegex = /^api/;

const allBasePaths = /^(api|model|modules|ui|views)\//;

function extractTrimmedExportNamesBetweenParenthesis(line) {
  return line
    .match(namedExportReg3)[1]
    .split(',')
    .map((v) => v.trim());
}

//print all lines that have the word export
/* allJs.forEach((file) => {
  const lines = getLines(file);
  let found = false;
  lines.forEach((line) => {
    if (searchWholeWord(line, 'export') && !inlineCommentRegex.test(line)) {
      if (!exportDefaultFromBeginning.test(line)) {
        if (
          !namedExportReg1.test(line) &&
          !namedExportReg2.test(line) &&
          !namedExportReg3.test(line) &&
          !namedExportReg4.test(line) &&
          !namedExportReg5.test(line) &&
          !namedExportReg6.test(line)
        ) {
          found = true;
          console.log(line);
        }
      }
    }
  });
  if (found) {
    console.log('^--------------------------------------------^');
    console.log(file);
  }
}); */

function findAllNamedExportsFromAFile(filePath) {
  const lines = getLines(filePath);
  let namedExportNames = [];
  let iter;
  for (iter = 0; iter < lines.length; iter++) {
    const line = lines[iter];
    if (searchWholeWord(line, 'export') && !inlineCommentRegex.test(line)) {
      if (!exportDefaultFromBeginning.test(line)) {
        if (namedExportReg1.test(line)) {
          namedExportNames.push(line.match(namedExportReg1)[2]);
          continue;
        }
        if (namedExportReg2.test(line)) {
          namedExportNames.push(line.match(namedExportReg2)[1]);
          continue;
        }
        if (namedExportReg3.test(line)) {
          namedExportNames = namedExportNames.concat(
            extractTrimmedExportNamesBetweenParenthesis(line),
          );
          continue;
        }
        if (namedExportReg4.test(line)) {
          namedExportNames.push(line.match(namedExportReg4)[1]);
          continue;
        }

        if (namedExportReg5.test(line)) {
          namedExportNames.push(line.match(namedExportReg5)[1]);
          continue;
        }

        if (namedExportReg6.test(line)) {
          namedExportNames.push(line.match(namedExportReg6)[1]);
          continue;
        }

        if (namedExportReg7.test(line)) {
          let innerIter = iter;
          while (endOfNamedExportReg7.test(lines[innerIter])) {
            ++innerIter;
            let test = lines[innerIter].match(wordBetweenParethesis);
            if (test && test[2]) {
              namedExportNames.push(test[2]);
            }
          }
          iter = innerIter + 1;
        }
      }
    }
  }

  return namedExportNames;
}

//small test - once all imports are finished - then there is no import word singly used across the entire file
//fixed the files with something between imports
/* allJs.forEach((filePath) => {
  const lines = getLines(filePath);
  const endOfImport = detectEndOfImports(lines);
  const newLines = lines.slice(endOfImport);
  let found = false;
  newLines.forEach((line) => {
    if (searchWholeWord(line, 'import')) {
      found = true;
      console.log(line);
    }
  });
  if (found) {
    console.log(filePath + '-----------------------------\n');
  }
}); */

function isLibraryImport(importPath) {
  return !importPath.includes('/');
}

function findAllImportsOfAFile(file) {
  const lines = getLines(file);
  const importEnd = detectEndOfImports(lines);
  if (importEnd > 0) {
    const importLines = lines.slice(0, importEnd);
    const importBlock = importLines.join('\n');
    let ast = babelParser.parse(importBlock, { sourceType: 'module' });

    ast = ast.program.body;
    console.log('------------------------');
    console.log(file);
    ast.forEach((importDeclaration) => {
      const importPath = importDeclaration.source.value;
      let foundAnImport = false;
      if (!isLibraryImport(importPath)) {
        let defaultImport = importDeclaration.specifiers.filter(
          (s) => s.type === 'ImportDefaultSpecifier',
        );
        if (defaultImport && defaultImport[0]) {
          foundAnImport = true;
          //console.log(defaultImport[0].local.name);
        } else {
          defaultImport = false;
        }
        let namedImports = importDeclaration.specifiers
          .filter((s) => s.type === 'ImportSpecifier')
          .map((v) => v.local.name);
        if (namedImports.length) {
          foundAnImport = true;
        }
        if (foundAnImport) {
          if (!allBasePaths.test(importPath)) {
            if (importPath !== 'api') {
              console.log(importPath);
            }
          }
        }
      }
    });
  }
}

function isDefultExportPresentInFile(file) {
  const lines = getLines(file);
  for (let i = 0; i < lines.length; i++) {
    if (exportDefaultFromBeginning.test(lines[i])) {
      return true;
    }
  }
  return false;
}

const createFileNames = (importPath) => {
  let basePath = '/Users/prabhasjoshi/code/x/src/js/';
  const p = importPath.split('/');
  const name = p[p.length - 1];
  let fileHash = {};
  const base = importPath.substring(0, importPath.length - name.length);
  const op1 = basePath + importPath + '/' + name + '.js';
  const op2 = basePath + importPath + '/' + 'index.js';
  const op3 = basePath + importPath + '.js';

  if (isAFileWhichExists(op1)) {
    fileHash[op1] = true;
  }
  if (isAFileWhichExists(op2)) {
    fileHash[op2] = true;
  }
  if (isAFileWhichExists(op3)) {
    fileHash[op3] = true;
  }
  return fileHash;
};

const isAFileWhichExists = (filePath) =>
  fs.existsSync(filePath) && !fs.lstatSync(filePath).isDirectory();

const createFileNamesCss = (importPath) => {
  let basePath = '/Users/prabhasjoshi/code/x/src/js/';
  const p = importPath.split('/');
  const name = p[p.length - 1];

  const op1 = basePath + importPath + '/' + name + '.sss';

  const op2 = basePath + importPath;

  if (isAFileWhichExists(op1)) {
    return op1;
  }

  if (isAFileWhichExists(op2)) {
    return op2;
  }

  return false;
};

const createFileNamesFromRelativePath = (currentPath, defaultImportPath) => {
  let currentRelativePath = path.dirname(currentPath);

  let joinedPath = path.join(currentRelativePath, defaultImportPath);
  let parsedPath = path.parse(joinedPath);
  let fileHash = {};

  let op1 = parsedPath.dir + '/' + parsedPath.name + '.js';
  let op2 = parsedPath.dir + '/' + parsedPath.name + '/' + 'index.js';
  let op3 =
    parsedPath.dir + '/' + parsedPath.name + '/' + parsedPath.name + '.js';

  if (isAFileWhichExists(op1)) {
    fileHash[op1] = true;
  }
  if (isAFileWhichExists(op2)) {
    fileHash[op2] = true;
  }
  if (isAFileWhichExists(op3)) {
    fileHash[op3] = true;
  }

  return fileHash;
};

function isDefaultExportPresentInAnyOtherFile(defaultExportFile, fileSet) {
  let i, j;
  //let basePath = '/Users/prabhasjoshi/code/x/src/js/';
  for (i = 0; i < fileSet.length; i++) {
    const file = fileSet[i];
    const lines = getLines(file);
    const importEnd = detectEndOfImports(lines);
    if (importEnd > 0) {
      const importLines = lines.slice(0, importEnd);
      const importBlock = importLines.join('\n');
      let ast = babelParser.parse(importBlock, { sourceType: 'module' });
      ast = ast.program.body;

      for (j = 0; j < ast.length; j++) {
        let importDeclaration = ast[j];
        let importPath = importDeclaration.source.value;

        if (!isLibraryImport(importPath)) {
          let defaultImport = importDeclaration.specifiers.filter(
            (s) => s.type === 'ImportDefaultSpecifier',
          );
          if (defaultImport && defaultImport[0]) {
            if (allBasePaths.test(importPath)) {
              const possibleFiles = createFileNames(importPath);
              //console.log('predefined path: ' + importPath);
              if (defaultExportFile in possibleFiles) {
                return true;
              }
            } else {
              //it's a relative path
              if (!startingWithApiRegex.test(importPath)) {
                const possibleFiles = createFileNamesFromRelativePath(
                  file,
                  importPath,
                );
                if (Object.keys(possibleFiles).length) {
                  //console.log(possibleFiles);
                }

                if (defaultExportFile in possibleFiles) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }
  return false;
}

function isNamedExportPresentInAnyOtherfile(
  namedImport,
  namedImportFile,
  fileSet,
) {
  let i, j;
  for (i = 0; i < fileSet.length; i++) {
    const file = fileSet[i];
    const lines = getLines(file);
    const importEnd = detectEndOfImports(lines);
    if (importEnd > 0) {
      const importLines = lines.slice(0, importEnd);
      const importBlock = importLines.join('\n');
      let ast = babelParser.parse(importBlock, { sourceType: 'module' });
      ast = ast.program.body;
      for (j = 0; j < ast.length; j++) {
        let importDeclaration = ast[j];
        let importPath = importDeclaration.source.value;
        if (!isLibraryImport(importPath)) {
          let namedImports = importDeclaration.specifiers
            .filter((s) => s.type === 'ImportSpecifier')
            .map((v) => v.local.name);
          if (namedImports.length && namedImports.includes(namedImport)) {
            if (allBasePaths.test(importPath)) {
              const possibleFiles = createFileNames(importPath);
              //console.log(possibleFiles);
              if (namedImportFile in possibleFiles) {
                return true;
              }
            } else {
              //it's a relative path
              if (!startingWithApiRegex.test(importPath)) {
                const possibleFiles = createFileNamesFromRelativePath(
                  file,
                  importPath,
                );
                //console.log(possibleFiles);
                if (namedImportFile in possibleFiles) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }
  return false;
}

function isCssDeclarationPresentInAnyOtherFile(cssFile, fileSet) {
  let i, j;
  for (i = 0; i < fileSet.length; i++) {
    const file = fileSet[i];
    const lines = getLines(file);
    const importEnd = detectEndOfImports(lines);
    if (importEnd > 0) {
      const importLines = lines.slice(0, importEnd);
      const importBlock = importLines.join('\n');
      let ast = babelParser.parse(importBlock, { sourceType: 'module' });
      ast = ast.program.body;

      for (j = 0; j < ast.length; j++) {
        let importDeclaration = ast[j];
        let importPath = importDeclaration.source.value;
        let isCssDeclaration = importPath.includes('.sss');
        if (!isLibraryImport(importPath) && isCssDeclaration) {
          const directory = path.dirname(file);
          let possibleName;
          if (allBasePaths.test(importPath)) {
            possibleName = createFileNamesCss(importPath);
          } else {
            possibleName = path.join(directory, importPath);
          }

          if (possibleName === cssFile) {
            return true;
          }
        }
      }
    }
  }
  return false;
}


function namedExportIsPresentInFileSource(namedExport, file) {
  const lines = getLines(file);
  let i,
    count = 0;

  for (i = 0; i < lines.length; i++) {
    if (searchWholeWord(lines[i], namedExport)) {
      count++;
    }
  }

  return count >= 2;
}

function refactor() {
  const allFiles = returnAllFiles(rootPath);
  const allJs = allFiles.filter((file) => path.extname(file) === '.js');
  const allSss = allFiles.filter((file) => path.extname(file) === '.sss');
  let i;
  for (i = 0; i < allJs.length; i++) {
    console.log(i);
    const jsFile = allJs[i];
    const hasDefaultExport = isDefultExportPresentInFile(jsFile);
    const namedExports = findAllNamedExportsFromAFile(jsFile);
    if (hasDefaultExport) {
      let isDfPresent = isDefaultExportPresentInAnyOtherFile(jsFile, allJs);
      if (!isDfPresent) {
        console.log('Default export not present anywhere ' + jsFile);
      }
    }
    if (namedExports.length) {
      namedExports.forEach((nmExport) => {
        let isNamedExportPresentAnywhere = isNamedExportPresentInAnyOtherfile(
          nmExport,
          jsFile,
          allJs,
        );
        if (!isNamedExportPresentAnywhere) {
          if (namedExportIsPresentInFileSource(nmExport, jsFile)) {
            console.log(
              `named export used only inside the file : ${jsFile} export named: ${nmExport}`,
            );
          } else {
            console.log(
              `unused named export - file: ${jsFile} export named: ${nmExport}`,
            );
          }
        }
      });
    }
  }
  /* for (i = 0; i < allSss.length; i++) {
    const sssFile = allSss[i];
    const result = isCssDeclarationPresentInAnyOtherFile(sssFile, allJs);
    if (!result) {
      console.log('unused css file: ' + sssFile);
    }
  } */
}

refactor();

/* allJs.forEach((file) => {
  const exportNames = findAllNamedExportsFromAFile(file);
  console.log(exportNames);
}); */

/* allJs.forEach((file) => {
  findAllImportsOfAFile(file);
}); */

//test the files to be sss or js files
/*const testAllFilesAreEitherJSOrCss = allFiles.forEach((file) => {
  if (!(path.extname(file) === '.js' || path.extname(file) === '.sss')) {
    console.log(file);
  }
});
*/
