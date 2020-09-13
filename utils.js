import fs from 'fs';
const actions = require('./node_modules/react-propTypes-generate/src/actions');
const astHelper = require('./node_modules/react-propTypes-generate/src/astHelper');
const codeBuilder = require('./node_modules/react-propTypes-generate/src/utils/codeBuilder');
const Promise = require('bluebird');

const PROPS_NOT_FOUND = 'propsNotFount';
export const GET_BOTH_CLASS_AND_FUNCTIONAL = 'class&functional';

const classLineRegex = /class(.*)extends/;
const propsChainedRegex = /props\.[a-zA-Z0-9]+[^a-zA-Z0-9]/;
const propsEndRegex = /props\.[a-zA-Z0-9]+$/;
const propTypesLineStartingRegex = /^[a-zA-Z0-9]+\:/;
const justAValidName = /^\w*$/;
const propsConstThisDeclarationRegex = /const \{(.*)\} = this.props/;
const propsLetThisDeclarationRegex = /let \{(.*)\} = this.props/;
const propsConstDeclarationRegex = /const \{(.*)\} = props/;
const propsLetDeclarationRegex = /let \{(.*)\} = props/;
const propsPlainDeclarationRegex = /\{(.*)\} = (this.props|props)/;

const constructorLine = /constructor\(props\)/;
const superLineRegex = /super\(props\)/;
const propsDestructureRegex = /^\s+} = this\.props(;|,)/;
const propsDestructureRegex2 = /^\s+} = props(;|,)/;
const constDeclarationStart = /^\s+const {/;
const letDeclarationStart = /^\s+let {/;
const partsBetweenDestructureParenthesis = /(.*),/;
const somethingAlphanumberThenNonAlphaNumeric = /[a-zA-Z0-9]+[^a-zA-Z0-9]/;
const getInDifferentLineExtractionRegex = /getIn\((this\.props|props), \[$/;
const getInSameLineExtractionRegex = /getIn\((this\.props|props), \[\'(.*)\'/;
const propsBetweenSingleQuote = /\'(.*)\'/;
const getDerivedStateFromPropsRegex = /static getDerivedStateFromProps\(/;

const classDeclaration = /class \w* extends/;

//import based regexes
export const importEndOnSameLineRegex = /^import(.*);$/;
const importEndOnDifferentLineRegex = /^import(.*){$/;
const endOfNamedImport = /} from (.*);/;

//whitespace based regex
const validTabbedLineRegex = /^\s+(.*)/;
const noWhiteSpaceAtBeginningRegex = /^\S+(.*)/;
const validEndOfCodeBlock = /^(\}|\))(;?)$/;

//ignore regexes for codeblocks
const defaultPropsRegex = /\.defaultProps = \{/;
const propTypesDeclarationRegex = /\.propTypes = \{/;
const mapDispatchToPropsRegex = /const mapDispatchToProps =/;
const mapStateToPropsRegex = /const mapStateToProps =/;
const composeRegex = /export default compose\(/;
const connectDeclaration = /const \w* = connect\(/;

//invalid end of code-blocks
const continuingArrowFunctionRegex = /^\}\) => \{$/;
const continuingFunctionRegex = /^\}\) \{$/;

// comment regexes
const inlineCommentRegex = /^\/\//;
const blockCommentStartRegex = /^\/\*/;
const blockCommentEndRegex = /\*\/$/;

//extract props from util returned prop string
const extractPropObject = /^  \w*\: PropTypes\.\w*/;

const ignoreFiles = {
  'duck.js': 1,
  'saga.js': 1,
  'ga.js': 1,
  'constants.js': 1,
  '.DS_Store': 1,
};

const ignoreDir = {
  __tests__: 1,
};

export function getLines(filePath) {
  let fileText = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
  let fileLines = fileText.split('\n');
  return fileLines;
}

export function invertObject(obj) {
  let newObj = {};

  for (let i in obj) {
    newObj[obj[i]] = i;
  }
  return newObj;
}

export function lastChar(s) {
  return s[s.length - 1];
}
export const startsWithNoTab = (line) => line[0] && line[0] !== ' ';
export const startsWithTab = (line) => line[0] === ' ' && line[1] === ' ';
export const isEmptyLine = (line) => line.trim().length === 0;
const isAlphaNumeric = (f) =>
  (f >= 'a' && f <= 'z') || (f >= 'A' && f <= 'Z') || (f >= '0' && f <= '9');

export const searchWholeWord = (line, word) => {
  let regExp = new RegExp('\\b' + word + '\\b');

  const index =
    regExp.test(line) && line.match(regExp) && line.match(regExp).index;

  if (index && index !== -1) {
    if (
      !isAlphaNumeric(line[index - 1]) &&
      !isAlphaNumeric(line[index + word.length])
    ) {
      return true;
    }
    return false;
  }
  return false;
};

export const searchWordInLines = (lines, word) => {
  let line;
  for (line of lines) {
    if (searchWholeWord(line, word)) {
      return true;
    }
  }
  return false;
};

export function findClassName(classLine) {
  let splitLine = classLine.split(' ');
  let index = splitLine.findIndex((v) => v === 'extends');
  return splitLine[index - 1];
}

//returns the line at which the imports end
export function detectEndOfImports(lines) {
  let namedImportBlock = false;
  let i;
  for (i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (importEndOnSameLineRegex.test(line)) continue;
    if (importEndOnDifferentLineRegex.test(line)) {
      namedImportBlock = true;
    }
    if (namedImportBlock) {
      if (endOfNamedImport.test(line)) {
        namedImportBlock = false;
      }
      continue;
    }
    if (line.trim().length === 0) {
      continue;
    }
    if (line.trim().length !== 0) {
      break;
    }
  }
  return i;
}

/* function getCodeBlocks(lines) {
  let codeBlocks = [],
    currentCodeBlock = [],
    isCodeBlock = false;

  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    if (isCodeBlock) {
      currentCodeBlock.push(line);
      if (startsWithNoTab(nextLine) && startsWithTab(line)) {
        codeBlocks.push([...currentCodeBlock]);
        currentCodeBlock = [];
        isCodeBlock = false;
      }
    }

    if (!isCodeBlock && startsWithNoTab(line) && startsWithTab(nextLine)) {
      isCodeBlock = true;
      currentCodeBlock.push(line);
    }
  }
  return codeBlocks;
} */

export function getCodeBlocks2(lines) {
  let codeBlocks = [],
    currentCodeBlock = [],
    isCodeBlock = false;

  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i];
    if (isCodeBlock) {
      currentCodeBlock.push(line);
      if (line === '}') {
        codeBlocks.push([...currentCodeBlock]);
        currentCodeBlock = [];
        isCodeBlock = false;
      }
    }

    if (!isCodeBlock && classLineRegex.test(line)) {
      isCodeBlock = true;
      currentCodeBlock.push(line);
    }
  }
  return codeBlocks;
}

export const removeExtraLines = (lines) => {
  let contentStart = 0,
    endContentStart = lines.length - 1;

  for (let i = 0; i <= lines.length; i++) {
    if (lines[i].trim() !== '') {
      contentStart = i;
      break;
    }
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() !== '') {
      endContentStart = i;
      break;
    }
  }
  return lines.slice(contentStart, endContentStart + 1);
};

export function getCodeBlock(lines, isClassBased) {
  let codeBlocks = [],
    currentCodeBlock = [];

  let linesAfterImports = detectEndOfImports(lines);
  let i, currentLine, line;
  for (i = linesAfterImports; i < lines.length; i++) {
    line = lines[i];
    //ignoring inline comments
    if (inlineCommentRegex.test(line)) {
      continue;
    }
    //ignoring block comments
    if (blockCommentStartRegex.test(line)) {
      currentLine = i;
      while (!blockCommentEndRegex.test(lines[currentLine])) {
        currentLine++;
      }

      i = currentLine + 1;
      line = lines[i];
    }
    if (noWhiteSpaceAtBeginningRegex.test(line)) {
      if (validEndOfCodeBlock.test(line)) {
        currentCodeBlock.push(line);
        codeBlocks.push(currentCodeBlock);
        currentCodeBlock = [];
      } else {
        if (
          !continuingArrowFunctionRegex.test(line) &&
          !continuingFunctionRegex.test(line)
        ) {
          if (currentCodeBlock.length) {
            codeBlocks.push(currentCodeBlock);
          }
          currentCodeBlock = [];
        }
        currentCodeBlock.push(line);
      }
    } else {
      currentCodeBlock.push(line);
    }
  }

  const filteredCodeBlocks = codeBlocks
    .filter((block) => block.length >= 3)
    .map((block) => removeExtraLines(block))
    .filter((block) => {
      const line = block[0];
      return !(
        defaultPropsRegex.test(line) ||
        propTypesDeclarationRegex.test(line) ||
        mapDispatchToPropsRegex.test(line) ||
        mapStateToPropsRegex.test(line) ||
        composeRegex.test(line) ||
        connectDeclaration.test(line)
      );
    })
    .filter((block) => {
      return isReactCodeBlock(block);
      /* if (isClassBased === GET_BOTH_CLASS_AND_FUNCTIONAL) {
        return true;
      }

      return isClassBased
        ? classLineRegex.test(block[0])
        : !classLineRegex.test(block[0]); */
    });

  return filteredCodeBlocks;
}

export function doesCodeBlockHaveProps(codeBlockLines) {
  if (codeBlockLines.find) {
    return codeBlockLines.find((line) => searchWholeWord(line, 'props'));
  }
}

function createObjectFromEntries(arr, prevObj) {
  arr.forEach((element) => (prevObj[element] = true));
  return prevObj;
}

const findLinesWithProps = (lines) => {
  return lines.reduce((acc, line, currentIndex) => {
    let test =
      superLineRegex.test(line) ||
      constructorLine.test(line) ||
      getDerivedStateFromPropsRegex.test(line);
    if (!test && searchWholeWord(line, 'props')) {
      acc.push({ line, index: currentIndex });
    }
    return acc;
  }, []);
};

const extractPropsFromLine = (lineWithProps) => {
  const testWithPropsEnd = propsEndRegex.test(lineWithProps);
  if (propsChainedRegex.test(lineWithProps) || testWithPropsEnd) {
    if (testWithPropsEnd) {
      return [lineWithProps.match(propsEndRegex)[0].substr(6)];
    } else {
      const match = lineWithProps.match(propsChainedRegex);
      return [match[0].substring(6, match[0].length - 1)];
    }
  } else {
    if (propsConstThisDeclarationRegex.test(lineWithProps)) {
      return lineWithProps
        .match(propsConstThisDeclarationRegex)[1]
        .trim()
        .split(',');
    }
    if (propsLetThisDeclarationRegex.test(lineWithProps)) {
      return lineWithProps
        .match(propsLetThisDeclarationRegex)[1]
        .trim()
        .split(',');
    }
    if (propsConstDeclarationRegex.test(lineWithProps)) {
      return lineWithProps
        .match(propsConstDeclarationRegex)[1]
        .trim()
        .split(',');
    }
    if (propsLetDeclarationRegex.test(lineWithProps)) {
      return lineWithProps.match(propsLetDeclarationRegex)[1].trim().split(',');
    }

    if (propsPlainDeclarationRegex.test(lineWithProps)) {
      return lineWithProps
        .match(propsPlainDeclarationRegex)[1]
        .trim()
        .split(',');
    }

    return PROPS_NOT_FOUND;
  }
};

const extractPropsFromDestructureBlock = (block, index) => {
  let props = [],
    i = index - 1;
  while (
    !(
      constDeclarationStart.test(block[i]) || letDeclarationStart.test(block[i])
    ) &&
    block[i]
  ) {
    let test = block[i].match(partsBetweenDestructureParenthesis);
    if (!test) {
      //console.log('test failed for this line');
      //console.log(block[i]);
    } else {
      let furtherExtract =
        test[1] && test[1].match(somethingAlphanumberThenNonAlphaNumeric);
      if (furtherExtract && furtherExtract[0]) {
        props.push(furtherExtract[0].trim());
      } else if (!furtherExtract && test[1]) {
        props.push(test[1].trim());
      }
    }
    i--;
  }
  return props;
};

export const extractProps = (block) => {
  const isPropsPresent = doesCodeBlockHaveProps(block);
  if (isPropsPresent) {
    let collectProps = {},
      couldNotFindPropsForSomeLines = false;
    const className = findClassName(block[0]);
    let linesWithProps = findLinesWithProps(block);

    linesWithProps.forEach(({ line, index }) => {
      //extract props 1 way
      let props = extractPropsFromLine(line);
      //extract props other way
      if (
        propsDestructureRegex.test(line) ||
        propsDestructureRegex2.test(line)
      ) {
        props = extractPropsFromDestructureBlock(block, index);
      }

      if (getInSameLineExtractionRegex.test(line)) {
        const test = line.match(getInSameLineExtractionRegex);
        if (test && test[2]) {
          props = [test[2]];
        }
      }

      if (
        getInDifferentLineExtractionRegex.test(line) &&
        propsBetweenSingleQuote.test(block[index + 1])
      ) {
        const nextLine = block[index + 1];
        const prop = nextLine.match(propsBetweenSingleQuote);
        if (prop && prop[1]) {
          props = [prop[1]];
        }
      }
      if (Array.isArray(props)) {
        createObjectFromEntries(
          props
            .filter((prop) => justAValidName.test(prop.trim()))
            .map((prop) => prop.trim()),
          collectProps,
        );
      } else {
        if (!Array.isArray(couldNotFindPropsForSomeLines)) {
          couldNotFindPropsForSomeLines = [];
        }
        couldNotFindPropsForSomeLines.push(line);
      }
    });

    return {
      name: className,
      props: collectProps,
      couldNotFindPropsForSomeLines,
    };
  } else {
    return false;
  }
};

export const extractProps2 = (block) => {
  const blockLines = block.join('\n');
  const ast = astHelper.flowAst(blockLines);
  const componentName = actions.findComponentNames(ast);
  const options = {
    name: componentName[0].name,
  };
  return Promise.all([
    actions.findComponentNode(ast, options),
    actions.findPropTypesNode(ast, options),
    actions.findPropTypesNode(
      ast,
      Object.assign({}, options, {
        alias: 'defaultProps',
      }),
    ),
  ])
    .then((nodes) => {
      let componentNode = nodes[0];
      let propTypesNode = nodes[1];
      let defaultPropsNode = nodes[2];
      return actions
        .findPropTypes(
          {
            componentNode,
            propTypesNode,
            defaultPropsNode,
          },
          options,
        )
        .then((propTypes) => {
          let code = codeBuilder.buildPropTypes(propTypes, options);

          return {
            name: componentName[0].name,
            props: convertLineToPropObject(code),
          };
        });
    })
    .catch((error) => {
      console.error(error);
    });
};

function convertLineToPropObject(line) {
  if (line.trim() === '') return {};
  const start = line.indexOf('{');
  const split = line.substring(start).split('\n');
  let props = {};
  split.forEach((l) => {
    let test = l.match(extractPropObject);
    if (test && test[0]) {
      let key = test[0].split(':')[0].trim();
      let value = test[0].split(':')[1].trim();
      //small hack here for props.children
      if (key === 'children') {
        value = 'PropTypes.node';
      }
      if (key === 'className') {
        value = 'PropTypes.string';
      }
      props[key] = value;
    }
  });
  return props;
}

export const findExistingPropsInFile = (filePath, componentName) => {
  const lines = getLines(filePath);
  let start = 0,
    end = 0;
  const proptypeString = `${componentName}.propTypes = {`;
  const endOfPropTypes = '};';
  let isExtractOn = false;
  let lines2 = [];
  let propsArray = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes(proptypeString)) {
      start = i;
      isExtractOn = true;
      continue;
    }
    if (line === endOfPropTypes) {
      end = i;
      isExtractOn = false;
      break;
    }

    if (isExtractOn) {
      lines2.push(line.trim());
    }
  }

  isExtractOn = false;

  for (let i = 0; i < lines2.length; i++) {
    let line = lines2[i];

    if (propTypesLineStartingRegex.test(line)) {
      isExtractOn = false;
      propsArray.push(line);
      if (lastChar(line) !== ',') {
        isExtractOn = true;
        continue;
      }
    }
    if (isExtractOn) {
      propsArray[propsArray.length - 1] =
        propsArray[propsArray.length - 1] + ' ' + line;
    }
  }

  return propsArray.length > 0 ? { propsArray, start, end } : false;
};

export const transformPropArray = (existingProps) => {
  let transformedObject;
  transformedObject = existingProps.reduce((acc, current) => {
    let splitted = current.split(':');
    let key = splitted[0].trim();
    let value = removeEndComma(splitted[1]);
    acc[key] = value;
    return acc;
  }, {});
  return transformedObject;
};

export const combineObject = (typedObject, plainObject) => {
  let plainObjectCopy = {
    ...plainObject,
  };
  for (let key in typedObject) {
    if (key in plainObject) {
      plainObjectCopy[key] = typedObject[key];
    } else {
      plainObjectCopy[key] = typedObject[key];
    }
  }
  return plainObjectCopy;
};

export function writeToFile(pathToJsFile, data) {
  fs.writeFile(pathToJsFile, data, (err) => {
    console.log('the file is written');
  });
}

export function removeEndComma(str) {
  let x = str.trim();
  if (lastChar(x) === ',') {
    return x.substring(0, x.length - 1);
  }
  return x;
}

export const createPropType = (componentName, propObject) => {
  const lines = [];
  lines.push(`${componentName}.propTypes = {`);
  Object.keys(propObject).forEach((key) => {
    lines.push(`  ${key}: ${propObject[key]},`);
  });
  lines.push(`};`);
  return lines;
};

export const doesFileContainClass = (file) => {
  const lines = getLines(file);
  const blocks = getCodeBlocks2(lines);
  return blocks.length !== 0;
};

export const walkSync = (dir, filelist) => {
  var path = path || require('path');
  var fs = fs || require('fs'),
    files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function (file) {
    if (!(file in ignoreDir)) {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
        filelist = walkSync(path.join(dir, file), filelist);
      } else {
        if (file.split('.')[1] === 'js' && !(file in ignoreFiles)) {
          filelist.push(path.join(dir, file));
        }
      }
    }
  });
  return filelist;
};

export const returnAllFiles = (dir, filelist) => {
  var path = path || require('path');
  var fs = fs || require('fs'),
    files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function (file) {
    if (!(file in ignoreDir)) {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
        filelist = returnAllFiles(path.join(dir, file), filelist);
      } else {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

function doesFileHaveReactCodeBlocks(file) {
  const lines = getLines(file);
  const blocks = getCodeBlock(lines, GET_BOTH_CLASS_AND_FUNCTIONAL);
  let i,
    error,
    foundReactBlock = false;
  for (i = 0; i < blocks.length; i++) {
    const block = blocks[i].join('\n');

    const ast = astHelper.flowAst(block);
    const componentName = actions.findComponentNames(ast);
    if (componentName[0] && componentName[0].name) {
      error = false;
      const options = {
        name: componentName[0].name,
      };
      try {
        actions.findComponentNode(ast, options);
      } catch (e) {
        error = true;
        continue;
      } finally {
        if (!error) {
          foundReactBlock = true;
        }
      }
    }
  }
  return foundReactBlock;
}

function isReactCodeBlock(block) {
  const blockLines = block.join('\n');
  const ast = astHelper.flowAst(blockLines);
  const componentName = actions.findComponentNames(ast);
  return !!(componentName[0] && componentName[0].name);
}

export const findListOfFiles = (rootPath) => {
  const list = fs.statSync(rootPath).isFile() ? [rootPath] : walkSync(rootPath);
  return list.filter((file) => doesFileHaveReactCodeBlocks(file));
};
