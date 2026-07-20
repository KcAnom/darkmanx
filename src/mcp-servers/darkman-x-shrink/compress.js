'use strict';

const PROTECT_OPEN = '';
const PROTECT_CLOSE = '';

const PROTECT_PATTERNS = [
  /```[\s\S]*?```/g, // fenced code blocks
  /`[^`\n]+`/g, // inline code
  /\bhttps?:\/\/[^\s)>\]]+/g, // URLs
  /(?:\.{1,2}\/|~\/|\/)?(?:[\w.-]+\/)+[\w.-]+/g, // file-ish paths
];

const FILLER_PHRASES = [
  'in order to',
  'please note that',
  'it should be noted that',
  'it seems that',
  'kind of',
  'sort of',
  'i think that',
  'i believe that',
];

const FILLER_WORDS = [
  'a',
  'an',
  'the',
  'just',
  'really',
  'actually',
  'basically',
  'simply',
  'quite',
  'very',
  'literally',
  'essentially',
  'perhaps',
  'maybe',
  'probably',
  'possibly',
  'please',
];

const LEADING_DISCOURSE_MARKERS = [
  'well,',
  'so,',
  'now,',
  'look,',
  'listen,',
  'basically,',
  'actually,',
];

function protect(text) {
  const stash = [];
  let out = text;
  for (const pattern of PROTECT_PATTERNS) {
    out = out.replace(pattern, (match) => {
      const idx = stash.push(match) - 1;
      return `${PROTECT_OPEN}${idx}${PROTECT_CLOSE}`;
    });
  }
  return { text: out, stash };
}

function restore(text, stash) {
  return text.replace(
    new RegExp(`${PROTECT_OPEN}(\\d+)${PROTECT_CLOSE}`, 'g'),
    (_, idx) => stash[Number(idx)]
  );
}

function stripFillerPhrases(text) {
  let out = text;
  for (const phrase of FILLER_PHRASES) {
    out = out.replace(new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '');
  }
  return out;
}

function stripLeadingDiscourseMarkers(text) {
  return text.replace(/^\s*/, (leading) => leading).split(/\n/).map((line) => {
    let stripped = line;
    for (const marker of LEADING_DISCOURSE_MARKERS) {
      const re = new RegExp(`^\\s*${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
      if (re.test(stripped)) {
        stripped = stripped.replace(re, '');
        break;
      }
    }
    return stripped;
  }).join('\n');
}

function stripFillerWords(text) {
  let out = text;
  for (const word of FILLER_WORDS) {
    out = out.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  }
  return out;
}

function collapseWhitespace(text) {
  return text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?;:])/g, '$1')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

/**
 * Compresses natural-language description text: drops articles, filler
 * words, hedges, and leading discourse markers, while leaving fenced code,
 * inline code, URLs, and file paths byte-exact.
 */
function compress(text) {
  if (typeof text !== 'string' || text.length === 0) return text;

  const { text: protectedText, stash } = protect(text);

  let out = protectedText;
  out = stripLeadingDiscourseMarkers(out);
  out = stripFillerPhrases(out);
  out = stripFillerWords(out);
  out = collapseWhitespace(out);

  return restore(out, stash);
}

function resolveFields(fields) {
  if (Array.isArray(fields) && fields.length > 0) return fields;
  const envFields = process.env.DARKMANX_SHRINK_FIELDS;
  if (envFields) {
    return envFields
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
  }
  return ['description'];
}

const DESCRIPTION_ARRAYS = ['tools', 'prompts', 'resources', 'resourceTemplates'];

/**
 * Mutates (and returns) a parsed JSON-RPC message in place, compressing the
 * configured metadata fields on any result.{tools,prompts,resources,resourceTemplates}
 * entries. Never touches actual data/results — description-style fields only.
 */
function compressDescriptionsInPlace(mcpMessageObj, fields) {
  try {
    if (!mcpMessageObj || typeof mcpMessageObj !== 'object') return mcpMessageObj;
    const result = mcpMessageObj.result;
    if (!result || typeof result !== 'object') return mcpMessageObj;

    const targetFields = resolveFields(fields);

    for (const arrayKey of DESCRIPTION_ARRAYS) {
      const items = result[arrayKey];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        for (const field of targetFields) {
          if (typeof item[field] === 'string') {
            item[field] = compress(item[field]);
          }
        }
      }
    }
  } catch {
    /* never break the proxy over a malformed message */
  }
  return mcpMessageObj;
}

module.exports = {
  compress,
  compressDescriptionsInPlace,
};
