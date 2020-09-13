import path from 'path';
import fs from 'fs';

import {
  returnAllFiles,
  searchWordInLines,
  searchWholeWord,
  getLines,
  detectEndOfImports,
  importEndOnSameLineRegex,
} from './utils';

const babelParser = require('@babel/parser');
import generate from '@babel/generator';

const rootPath = '/Users/prabhasjoshi/code/x/src/js';
const allFiles = returnAllFiles(rootPath);
const allJs = allFiles.filter((file) => path.extname(file) === '.js');

allJs.forEach((file) => {
  let i;
  const lines = getLines(file);
  const endOfImport = detectEndOfImports(lines);
  let newLines = lines.slice(endOfImport);

  const importLines = lines.slice(0, endOfImport);
  const importBlock = importLines.join('\n');

  let newImports = [];
  let ast = babelParser.parse(importBlock, { sourceType: 'module' }).program
    .body;
  let foundUnusedImport = false;

  for (i = 0; i < ast.length; i++) {
    const importDeclaration = ast[i];

    //line of import
    let lineIndexStart = importDeclaration.loc.start.line - 1;
    let lineIndexEnd = importDeclaration.loc.end.line;

    let deleteHash = {};

    let localImportedLines = importLines.slice(lineIndexStart, lineIndexEnd);

    let astForConversion = JSON.parse(
      JSON.stringify(
        babelParser.parse(localImportedLines.join('\n'), {
          sourceType: 'module',
        }),
      ),
    );

    let localAst = babelParser.parse(localImportedLines.join('\n'), {
      sourceType: 'module',
    }).program.body[0];

    if (!localAst.specifiers || !localAst.specifiers.length) {
      newImports = newImports.concat(localImportedLines);
    } else {
      let specifiers = localAst.specifiers;
      specifiers.forEach((specifier) => {
        let nameOfImport = specifier.local.name;
        if (nameOfImport && nameOfImport !== 'React') {
          let isFoundAndUsed = searchWordInLines(newLines, nameOfImport);
          if (!isFoundAndUsed) {
            foundUnusedImport = true;
            deleteHash[nameOfImport] = true;
          }
        }
      });

      let newSpecifiers = JSON.parse(JSON.stringify(specifiers));
      newSpecifiers = newSpecifiers.filter(
        (v) => !(v.local.name in deleteHash),
      );

      if (newSpecifiers.length === 0) {
        continue;
      }
      astForConversion.program.body[0].specifiers = newSpecifiers;

      let newImportLines = generate(astForConversion, { retainLines: true });
      let linesTransform = newImportLines.code
        .split('\n')
        .filter((line) => line.trim().length !== 0);

      newImports = newImports.concat(linesTransform);
    }
  }

  if (foundUnusedImport) {
    if (newLines[0].trim().length !== 0) {
      newLines.unshift('');
    }
    let final = newImports.concat(newLines);
    fs.writeFileSync(file, final.join('\n'));
    console.log(file);
  }
});
