const fs = require('fs');
const vm = require('vm');

function findArrayBounds(content, exportName) {
  const declaration = new RegExp(`export\\s+const\\s+${exportName}\\b`);
  const declarationMatch = declaration.exec(content);
  if (!declarationMatch) {
    throw new Error(`Export ${exportName} introuvable.`);
  }

  const assignment = content.indexOf(
    '=',
    declarationMatch.index + declarationMatch[0].length,
  );
  if (assignment === -1) {
    throw new Error(`Affectation ${exportName} introuvable.`);
  }

  const start = content.indexOf('[', assignment + 1);
  if (start === -1) {
    throw new Error(`Tableau ${exportName} introuvable.`);
  }

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return { start, end: index };
    }
  }

  throw new Error(`Fin du tableau ${exportName} introuvable.`);
}

function readExportedArray(content, exportName) {
  const bounds = findArrayBounds(content, exportName);
  const source = content.slice(bounds.start, bounds.end + 1);
  const value = vm.runInNewContext(`(${source})`, Object.create(null), {
    timeout: 1000,
  });
  if (!Array.isArray(value)) {
    throw new Error(`${exportName} doit etre un tableau.`);
  }
  return { value, bounds };
}

function quoteString(value) {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}'`;
}

function formatValue(value, level = 0) {
  const indent = '  '.repeat(level);
  const childIndent = '  '.repeat(level + 1);

  if (typeof value === 'string') return quoteString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value
      .map((item) => `${childIndent}${formatValue(item, level + 1)},`)
      .join('\n')}\n${indent}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    return `{\n${entries
      .map(([key, item]) => `${childIndent}${key}: ${formatValue(item, level + 1)},`)
      .join('\n')}\n${indent}}`;
  }

  throw new Error(`Valeur non prise en charge dans les notes de version: ${typeof value}.`);
}

function replaceExportedArray(content, exportName, value) {
  const { bounds } = readExportedArray(content, exportName);
  return `${content.slice(0, bounds.start)}${formatValue(value)}${content.slice(bounds.end + 1)}`;
}

function itemIdentity(item) {
  return `${String(item.targetVersion || '').trim().toLowerCase()}::${String(item.title || '')
    .trim()
    .toLowerCase()}`;
}

function buildArchive(devItems, releaseSections, stableVersion) {
  const completed = devItems.filter(
    (item) => item.status === 'done' && item.targetVersion === stableVersion,
  );
  if (completed.length === 0) {
    return {
      devItems,
      releaseSections,
      archived: 0,
      added: 0,
      updated: 0,
      duplicatesRemoved: 0,
    };
  }

  const nextSections = releaseSections.map((section) => ({
    ...section,
    items: [...section.items],
  }));
  let section = nextSections.find((item) => item.version === stableVersion);
  if (!section) {
    section = { version: stableVersion, items: [] };
    nextSections.unshift(section);
  }

  const uniqueItems = [];
  const positions = new Map();
  for (const item of section.items) {
    const identity = itemIdentity(item);
    if (positions.has(identity)) continue;
    positions.set(identity, uniqueItems.length);
    uniqueItems.push(item);
  }
  const duplicatesRemoved = section.items.length - uniqueItems.length;
  section.items = uniqueItems;
  let added = 0;
  let updated = 0;

  for (const item of completed) {
    const identity = itemIdentity(item);
    const existingIndex = positions.get(identity);
    if (existingIndex === undefined) {
      positions.set(identity, section.items.length);
      section.items.push(item);
      added += 1;
    } else {
      section.items[existingIndex] = item;
      updated += 1;
    }
  }

  return {
    devItems: devItems.filter(
      (item) => !(item.status === 'done' && item.targetVersion === stableVersion),
    ),
    releaseSections: nextSections,
    archived: completed.length,
    added,
    updated,
    duplicatesRemoved,
  };
}

function archiveReleaseNotes({ devTodoFile, releaseNotesFile, stableVersion }) {
  const devContent = fs.readFileSync(devTodoFile, 'utf8');
  const releaseContent = fs.readFileSync(releaseNotesFile, 'utf8');
  const devItems = readExportedArray(devContent, 'DEV_TODO_ITEMS').value;
  const releaseSections = readExportedArray(
    releaseContent,
    'RELEASE_NOTES_HISTORY',
  ).value;
  const result = buildArchive(devItems, releaseSections, stableVersion);

  if (result.archived === 0) return result;

  const nextDevContent = replaceExportedArray(
    devContent,
    'DEV_TODO_ITEMS',
    result.devItems,
  );
  const nextReleaseContent = replaceExportedArray(
    releaseContent,
    'RELEASE_NOTES_HISTORY',
    result.releaseSections,
  );

  try {
    fs.writeFileSync(releaseNotesFile, nextReleaseContent, 'utf8');
    fs.writeFileSync(devTodoFile, nextDevContent, 'utf8');
  } catch (error) {
    fs.writeFileSync(releaseNotesFile, releaseContent, 'utf8');
    fs.writeFileSync(devTodoFile, devContent, 'utf8');
    throw error;
  }

  return result;
}

module.exports = {
  archiveReleaseNotes,
  buildArchive,
  readExportedArray,
  replaceExportedArray,
};
