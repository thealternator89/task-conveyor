export interface AutocompleteConfig {
  tags: string[];
  projects: string[];
  mentions: string[];
}

export type AutocompleteType = 'tag' | 'project' | 'mention';

export interface AutocompleteMatch {
  type: AutocompleteType;
  prefix: '#' | '$' | '@';
  value: string; // Canonical casing from config (e.g. "Fran")
  query: string; // User typed text after prefix
  startIndex: number;
  endIndex: number;
}

export interface AutocompleteResult {
  matches: AutocompleteMatch[];
  activeToken: {
    prefix: '#' | '$' | '@';
    query: string;
    startIndex: number;
    endIndex: number;
  } | null;
  ghostSuffix: string;
}

export const detectTokenAtCaret = (
  text: string,
  caretPos: number
): { prefix: '#' | '$' | '@'; query: string; startIndex: number; endIndex: number } | null => {
  if (caretPos < 0 || caretPos > text.length) {
    return null;
  }

  // Find the start of the word containing the caret
  let startIndex = caretPos;
  while (startIndex > 0 && !/\s/.test(text[startIndex - 1])) {
    startIndex--;
  }

  // Check if there are command prefixes like '!' or '!!' right before '#'/'$'/'@'
  if (startIndex === 0) {
    if (text.startsWith('!!') && text.length > 2 && (text[2] === '#' || text[2] === '$' || text[2] === '@')) {
      if (caretPos >= 2) {
        startIndex = 2;
      }
    } else if (text.startsWith('!') && text.length > 1 && (text[1] === '#' || text[1] === '$' || text[1] === '@')) {
      if (caretPos >= 1) {
        startIndex = 1;
      }
    }
  }

  const prefixChar = text[startIndex];
  if (prefixChar !== '#' && prefixChar !== '$' && prefixChar !== '@') {
    return null;
  }

  // Find the end of the word
  let endIndex = caretPos;
  while (endIndex < text.length && !/\s/.test(text[endIndex])) {
    endIndex++;
  }

  // Query is everything from after prefix up to the caret
  const query = text.slice(startIndex + 1, caretPos);

  return {
    prefix: prefixChar,
    query,
    startIndex,
    endIndex
  };
};

export const getSuggestions = (
  config: AutocompleteConfig,
  text: string,
  caretPos: number
): AutocompleteResult => {
  const token = detectTokenAtCaret(text, caretPos);
  if (!token) {
    return { matches: [], activeToken: null, ghostSuffix: '' };
  }

  const { prefix, query, startIndex, endIndex } = token;
  let candidates: string[] = [];
  let type: AutocompleteType = 'tag';

  if (prefix === '#') {
    candidates = config.tags || [];
    type = 'tag';
  } else if (prefix === '$') {
    candidates = config.projects || [];
    type = 'project';
  } else if (prefix === '@') {
    candidates = config.mentions || [];
    type = 'mention';
  }

  const queryLower = query.toLowerCase();

  // Tier 1: startsWith match
  const startsWithMatches: string[] = [];
  // Tier 2: contains match
  const containsMatches: string[] = [];

  for (const item of candidates) {
    const itemLower = item.toLowerCase();
    if (queryLower === '') {
      startsWithMatches.push(item);
    } else if (itemLower.startsWith(queryLower)) {
      startsWithMatches.push(item);
    } else if (itemLower.includes(queryLower)) {
      containsMatches.push(item);
    }
  }

  const sortedCandidates = [...startsWithMatches, ...containsMatches];

  const matches: AutocompleteMatch[] = sortedCandidates.map((val) => ({
    type,
    prefix,
    value: val,
    query,
    startIndex,
    endIndex
  }));

  let ghostSuffix = '';
  if (matches.length > 0 && caretPos === endIndex) {
    const topMatch = matches[0].value;
    if (topMatch.toLowerCase().startsWith(queryLower)) {
      ghostSuffix = topMatch.slice(query.length);
    }
  }

  return {
    matches,
    activeToken: token,
    ghostSuffix
  };
};

export const applyCompletion = (
  text: string,
  match: AutocompleteMatch
): { newText: string; newCaretPos: number } => {
  // Canonical casing from config, with a trailing space
  const replacement = `${match.prefix}${match.value} `;
  const before = text.slice(0, match.startIndex);
  const after = text.slice(match.endIndex);
  const newText = before + replacement + after;
  const newCaretPos = match.startIndex + replacement.length;

  return {
    newText,
    newCaretPos
  };
};
