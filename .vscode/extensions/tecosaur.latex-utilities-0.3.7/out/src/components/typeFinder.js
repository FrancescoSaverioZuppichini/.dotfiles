"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const DEBUG_CONSOLE_LOG = false;
let debuglog;
if (DEBUG_CONSOLE_LOG) {
    debuglog = function (start, lines, mode, reason) {
        console.log(`⚪ TypeFinder took ${+new Date() - start}ms and ${lines} lines to determine: ${mode === 'text' ? '𝘁𝗲𝘅𝘁' : '𝗺𝗮𝘁𝗵𝘀'} ${reason}`);
    };
}
else {
    debuglog = (_s, _l, _m, _r) => { };
}
class TypeFinder {
    constructor() {
        this.envs = {
            '\\(': {
                mode: 'maths',
                type: 'start',
                pair: '\\)'
            },
            '\\[': {
                mode: 'maths',
                type: 'start',
                pair: '\\]'
            },
            '\\begin{equation}': {
                mode: 'maths',
                type: 'start',
                pair: '\\end{equation}'
            },
            '\\begin{displaymath}': {
                mode: 'maths',
                type: 'start',
                pair: '\\end{displaymath}'
            },
            '\\begin{align}': {
                mode: 'maths',
                type: 'start',
                pair: '\\end{align}'
            },
            '\\begin{gather}': {
                mode: 'maths',
                type: 'start',
                pair: '\\end{gather}'
            },
            '\\begin{flalign}': {
                mode: 'maths',
                type: 'start',
                pair: '\\end{flalign}'
            },
            '\\begin{multline}': {
                mode: 'maths',
                type: 'start',
                pair: '\\end{multline}'
            },
            '\\begin{alignat}': {
                mode: 'maths',
                type: 'start',
                pair: '\\end{alignat}'
            },
            '\\begin{split}': {
                mode: 'maths',
                type: 'start',
                pair: '\\end{split}'
            },
            '\\text': {
                mode: 'text',
                type: 'start',
                pair: null
            },
            '\\begin{document}': {
                mode: 'text',
                type: 'start',
                pair: null
            },
            '\\chapter': {
                mode: 'text',
                type: 'start',
                pair: null
            },
            '\\section': {
                mode: 'text',
                type: 'start',
                pair: null
            },
            '\\subsection': {
                mode: 'text',
                type: 'start',
                pair: null
            },
            '\\subsubsection': {
                mode: 'text',
                type: 'start',
                pair: null
            },
            '\\paragraph': {
                mode: 'text',
                type: 'start',
                pair: null
            },
            '\\subparagraph': {
                mode: 'text',
                type: 'start',
                pair: null
            }
        };
        this.allEnvRegex = this.constructEnvRegexs();
    }
    constructEnvRegexs() {
        function escapeRegExp(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        const regexStrs = [];
        const properStartEnvs = [];
        const properCloseEnvs = [];
        const properEnvPattern = /\\begin{(\w+)}/;
        for (const env of Object.keys(this.envs)) {
            const theEnv = this.envs[env];
            if (theEnv.type === 'end') {
                continue;
            }
            const properEnvName = env.match(properEnvPattern);
            if (properEnvName) {
                properStartEnvs.push(properEnvName[1]);
                this.envs[`\\begin{${properEnvName[1]}*}`] = {
                    mode: theEnv.mode,
                    type: 'start',
                    pair: `\\end{${properEnvName[1]}*}`
                };
                if (theEnv.pair !== null) {
                    properCloseEnvs.push(properEnvName[1]);
                    this.envs[`\\end{${properEnvName[1]}*}`] = {
                        mode: theEnv.mode,
                        type: 'end',
                        pair: `\\begin{${properEnvName[1]}*}`
                    };
                }
            }
            else {
                regexStrs.push(escapeRegExp(env));
                if (theEnv.pair !== null) {
                    regexStrs.push(escapeRegExp(theEnv.pair));
                }
            }
            if (theEnv.pair !== null) {
                this.envs[theEnv.pair] = {
                    mode: theEnv.mode,
                    type: 'end',
                    pair: env
                };
            }
        }
        regexStrs.push(`\\\\begin{(?:${properStartEnvs.join('|')})\\*?}`);
        regexStrs.push(`\\\\end{(?:${properCloseEnvs.join('|')})\\*?}`);
        return new RegExp(`(?:^|[^\\\\])(${regexStrs.join('|')})`, 'g');
    }
    getTypeAtPosition(document, position, lastKnown) {
        const start = +new Date();
        let lineNo = position.line;
        const tokenStack = [];
        let minLine = 0;
        let minChar = -1;
        if (lastKnown !== undefined && lastKnown.position.isBefore(position)) {
            minLine = lastKnown.position.line;
            minChar = lastKnown.position.character;
        }
        do {
            let lineContents = document.lineAt(lineNo--).text;
            if (lineNo + 1 === position.line) {
                lineContents = lineContents.substr(0, position.character + 1);
            }
            lineContents = utils_1.stripComments(lineContents, '%');
            // treat inside a comment as text
            if (lineNo + 1 === position.line && position.character > lineContents.length) {
                debuglog(start, position.line - lineNo, 'text', "since it's a comment");
                return 'text';
            }
            let tokens = [];
            let match;
            do {
                match = this.allEnvRegex.exec(lineContents);
                if (match !== null) {
                    tokens.push(match);
                }
            } while (match);
            if (tokens.length === 0) {
                if (lineNo + 1 === minLine && 0 <= minChar && lastKnown) {
                    // if last seen token closes the 'last known' environment, then we DON'T want to use it
                    if (tokenStack.length > 0) {
                        const lastEnv = this.envs[tokenStack[tokenStack.length - 1]];
                        if (lastEnv.type === 'end' && lastEnv.mode === lastKnown.mode) {
                            minLine = 0;
                            continue;
                        }
                    }
                    debuglog(start, position.line - lineNo, lastKnown.mode, 'using lastknown (1)');
                    return lastKnown.mode;
                }
                else {
                    continue;
                }
            }
            else {
                tokens = tokens.reverse();
            }
            let curlyBracketDepth = 0;
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                const env = this.envs[token[1]];
                for (let j = lineContents.length - 1; j >= 0; j--) {
                    if (token[1] === '\\text' && token.index === j) {
                        if (curlyBracketDepth > 0) {
                            debuglog(start, position.line - lineNo, env.mode, 'from \\text');
                            return env.mode;
                        }
                    }
                    if (lineContents[j] === '}') {
                        curlyBracketDepth--;
                    }
                    else if (lineContents[j] === '{') {
                        curlyBracketDepth++;
                    }
                }
                if (env.type === 'end') {
                    if (env.pair === null) {
                        debuglog(start, position.line - lineNo, env.mode, 'from env with no pair');
                        return env.mode;
                    }
                    else {
                        tokenStack.push(token[1]);
                    }
                }
                else if ((tokenStack.length === 0 || tokenStack[tokenStack.length - 1] !== env.pair) &&
                    token[1] !== '\\text') {
                    debuglog(start, position.line - lineNo, env.mode, 'from unpaired env token');
                    return env.mode;
                }
                else if (tokenStack.length > 0 && token[1] !== '\\text') {
                    // this token matches the last seen token
                    tokenStack.pop();
                    // if it opens the env of last known then lastKnown is suspicious
                    // this may be unnecessarily strict, think about this later
                    if (lastKnown && env.mode === lastKnown.mode) {
                        continue;
                    }
                }
                // if before a last known location
                if (lineNo + 1 === minLine && token.index < minChar && lastKnown) {
                    // if last seen token closes the 'last known' environment, then we DON'T want to use it
                    if (tokenStack.length > 0) {
                        const lastEnv = this.envs[tokenStack[tokenStack.length - 1]];
                        if (lastEnv.type === 'end' && lastEnv.mode === lastKnown.mode) {
                            minLine = 0;
                            continue;
                        }
                    }
                    debuglog(start, position.line - lineNo, lastKnown.mode, 'using lastknown (2)');
                    return lastKnown.mode;
                }
            }
        } while (lineNo >= minLine);
        debuglog(start, position.line - lineNo, 'text', 'by default');
        return 'text';
    }
}
exports.TypeFinder = TypeFinder;
//# sourceMappingURL=typeFinder.js.map