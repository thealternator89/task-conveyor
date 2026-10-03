export interface ExpansionResult {
  expanded: boolean;
  newText: string;
  newCaretPos: number;
}

/**
 * Checks if the word immediately preceding the caret matches an expansion from config,
 * and if so, returns the expanded text with a trailing space.
 *
 * Expansions are case-insensitive if entered as the first word of the task (accounting for
 * optional priority prefixes '!' or '!!'), and adhere to the auto-capitalization rule.
 * Expansions in subsequent words are case-sensitive.
 */
export const expandOnSpace = (
  text: string,
  caretPos: number,
  expansions?: Record<string, string>
): ExpansionResult => {
  if (!expansions || Object.keys(expansions).length === 0) {
    return { expanded: false, newText: text, newCaretPos: caretPos };
  }

  if (caretPos <= 0 || caretPos > text.length) {
    return { expanded: false, newText: text, newCaretPos: caretPos };
  }

  // If the character right before the caret is whitespace, do not expand (e.g. multiple spaces)
  if (/\s/.test(text[caretPos - 1])) {
    return { expanded: false, newText: text, newCaretPos: caretPos };
  }

  // Scan backwards from caretPos to find the start of the current word
  let wordStartIndex = caretPos;
  while (wordStartIndex > 0 && !/\s/.test(text[wordStartIndex - 1])) {
    wordStartIndex--;
  }

  let isFirstWord = false;
  let wordKeyStartIndex = wordStartIndex;

  if (wordStartIndex === 0) {
    // Check if task starts with priority prefixes '!!' or '!' directly attached to word
    if (text.startsWith('!!') && text.length >= 2 && caretPos >= 2) {
      wordKeyStartIndex = 2;
    } else if (text.startsWith('!') && text.length >= 1 && caretPos >= 1) {
      wordKeyStartIndex = 1;
    }
    isFirstWord = true;
  } else {
    // Preceding characters before the current word
    const preceding = text.slice(0, wordStartIndex);
    if (/^(!{0,2}\s*)$/.test(preceding)) {
      isFirstWord = true;
    }
  }

  const rawWord = text.slice(wordKeyStartIndex, caretPos);
  if (!rawWord) {
    return { expanded: false, newText: text, newCaretPos: caretPos };
  }

  // Don't expand slash commands or autocomplete tags/projects/mentions
  if (rawWord.startsWith('/') || /^[#$@]/.test(rawWord)) {
    return { expanded: false, newText: text, newCaretPos: caretPos };
  }

  let matchedValue: string | undefined = undefined;

  if (isFirstWord) {
    // Case-insensitive match if entered as the first word
    if (Object.prototype.hasOwnProperty.call(expansions, rawWord)) {
      matchedValue = expansions[rawWord];
    } else {
      const lowerWord = rawWord.toLowerCase();
      for (const [key, val] of Object.entries(expansions)) {
        if (key.toLowerCase() === lowerWord) {
          matchedValue = val;
          break;
        }
      }
    }
  } else {
    // Case-sensitive match for subsequent words
    if (Object.prototype.hasOwnProperty.call(expansions, rawWord)) {
      matchedValue = expansions[rawWord];
    }
  }

  if (matchedValue === undefined) {
    return { expanded: false, newText: text, newCaretPos: caretPos };
  }

  let expandedText = matchedValue;

  // If first word, adhere to the auto-capitalization rule: capitalize the first letter
  if (isFirstWord && expandedText.length > 0) {
    expandedText = expandedText.charAt(0).toUpperCase() + expandedText.slice(1);
  }

  const replacement = `${expandedText} `;
  const before = text.slice(0, wordKeyStartIndex);
  const after = text.slice(caretPos);
  const newText = before + replacement + after;
  const newCaretPos = wordKeyStartIndex + replacement.length;

  return {
    expanded: true,
    newText,
    newCaretPos
  };
};
