"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bibtexSortFields = exports.bibtexFormat = exports.bibtexSort = exports.getBibtexFormatTab = void 0;
/**
 * Read the indentation from vscode configuration
 *
 * @param config VSCode workspace configuration
 * @return the indentation as a string or undefined if the configuration variable is not correct
 */
function getBibtexFormatTab(config) {
    const tab = config.get('bibtex-format.tab');
    if (tab === 'tab') {
        return '\t';
    }
    else {
        const res = /^(\d+)( spaces)?$/.exec(tab);
        if (res) {
            const nSpaces = parseInt(res[1], 10);
            return ' '.repeat(nSpaces);
        }
        else {
            return undefined;
        }
    }
}
exports.getBibtexFormatTab = getBibtexFormatTab;
/**
 * Sorting function for bibtex entries
 * @param keys Array of sorting keys
 */
function bibtexSort(keys, duplicates) {
    return function (a, b) {
        let r = 0;
        for (const key of keys) {
            // Select the appropriate sort function
            switch (key) {
                case 'key':
                    r = bibtexSortByKey(a, b);
                    break;
                case 'year-desc':
                    r = -bibtexSortByField('year', a, b);
                    break;
                case 'type':
                    r = bibtexSortByType(a, b);
                    break;
                default:
                    r = bibtexSortByField(key, a, b);
            }
            // Compare until different
            if (r !== 0) {
                break;
            }
        }
        if (r === 0) {
            // It seems that items earlier in the list appear as the variable b here, rather than a
            duplicates.add(a);
        }
        return r;
    };
}
exports.bibtexSort = bibtexSort;
/**
 * Handles all sorting keys that are some bibtex field name
 * @param fieldName which field name to sort by
 */
function bibtexSortByField(fieldName, a, b) {
    let fieldA = '';
    let fieldB = '';
    for (let i = 0; i < a.content.length; i++) {
        if (a.content[i].name === fieldName) {
            fieldA = fieldToString(a.content[i].value, '', '');
            break;
        }
    }
    for (let i = 0; i < b.content.length; i++) {
        if (b.content[i].name === fieldName) {
            fieldB = fieldToString(b.content[i].value, '', '');
            break;
        }
    }
    // Remove braces to sort properly
    fieldA = fieldA.replace(/{|}/g, '');
    fieldB = fieldB.replace(/{|}/g, '');
    return fieldA.localeCompare(fieldB);
}
function bibtexSortByKey(a, b) {
    if (!a.internalKey && !b.internalKey) {
        return 0;
    }
    else if (!a.internalKey) {
        return -1; // sort undefined keys first
    }
    else if (!b.internalKey) {
        return 1;
    }
    else {
        return a.internalKey.localeCompare(b.internalKey);
    }
}
function bibtexSortByType(a, b) {
    return a.entryType.localeCompare(b.entryType);
}
/**
 * Creates an aligned string from a bibtexParser.Entry
 * @param entry the bibtexParser.Entry
 * @param config the bibtex format options
 */
function bibtexFormat(entry, config) {
    let s = '';
    s += '@' + entry.entryType + '{' + (entry.internalKey ? entry.internalKey : '');
    // Find the longest field name in entry
    let maxFieldLength = 0;
    if (config.alignOnEqual) {
        entry.content.forEach(field => {
            maxFieldLength = Math.max(maxFieldLength, field.name.length);
        });
    }
    let fields = entry.content;
    if (config.sortFields) {
        fields = entry.content.sort(bibtexSortFields(config.fieldsOrder));
    }
    fields.forEach(field => {
        s += ',\n' + config.tab + (config.case === 'lowercase' ? field.name : field.name.toUpperCase());
        if (config.alignOnEqual) {
            s += ' '.repeat(maxFieldLength - field.name.length);
        }
        s += ' = ';
        s += fieldToString(field.value, config.left, config.right);
    });
    if (config.trailingComma) {
        s += ',';
    }
    s += '\n}';
    return s;
}
exports.bibtexFormat = bibtexFormat;
/**
 * Convert a bibtexParser.FieldValue to a string
 * @param field the bibtexParser.FieldValue to parse
 * @param left what to put before a text_string (i.e. `{` or `"`)
 * @param right what to put after a text_string (i.e. `}` or `"`)
 */
function fieldToString(field, left, right) {
    switch (field.kind) {
        case 'abbreviation':
        case 'number':
            return field.content;
        case 'text_string':
            return left + field.content + right;
        case 'concat':
            return field.content.map(value => fieldToString(value, left, right)).reduce((acc, cur) => { return acc + ' # ' + cur; });
        default:
            return '';
    }
}
/**
 * Sorting function for bibtex entries
 * @param keys Array of sorting keys
 */
function bibtexSortFields(keys) {
    return function (a, b) {
        const indexA = keys.indexOf(a.name);
        const indexB = keys.indexOf(b.name);
        if (indexA === -1 && indexB === -1) {
            return a.name.localeCompare(b.name);
        }
        else if (indexA === -1) {
            return 1;
        }
        else if (indexB === -1) {
            return -1;
        }
        else {
            return indexA - indexB;
        }
    };
}
exports.bibtexSortFields = bibtexSortFields;
//# sourceMappingURL=bibtexutils.js.map