import { app, shell, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AutocompleteConfig {
  tags: string[];
  projects: string[];
  mentions: string[];
}

const DEFAULT_CONFIG: AutocompleteConfig = {
  tags: [],
  projects: [],
  mentions: []
};

let fileWatcher: fs.FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

export const getAutocompleteFilePath = (): string => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'autocomplete.json');
};

export const ensureAutocompleteFile = (): string => {
  const filePath = getAutocompleteFilePath();
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to create default autocomplete.json:', err);
    }
  }

  return filePath;
};

const sanitizeList = (arr: unknown): string[] => {
  if (!Array.isArray(arr)) return [];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of arr) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      // Strip leading '#', '$', '@' if the user accidentally included them in the JSON string
      const clean = trimmed.replace(/^[#$@]/, '');
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        result.push(clean);
      }
    }
  }
  return result;
};

export const loadAutocompleteConfig = (): AutocompleteConfig => {
  const filePath = ensureAutocompleteFile();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    return {
      tags: sanitizeList(parsed.tags),
      projects: sanitizeList(parsed.projects),
      mentions: sanitizeList(parsed.mentions)
    };
  } catch (err) {
    console.error('Error reading autocomplete.json:', err);
    return DEFAULT_CONFIG;
  }
};

export const openAutocompleteConfigFile = async (): Promise<void> => {
  const filePath = ensureAutocompleteFile();
  try {
    await shell.openPath(filePath);
  } catch (err) {
    console.error('Failed to open autocomplete.json:', err);
  }
};

export const startWatchingAutocompleteConfig = (
  onUpdate: (config: AutocompleteConfig) => void
): void => {
  const filePath = ensureAutocompleteFile();

  if (fileWatcher) {
    try {
      fileWatcher.close();
    } catch {
      // Ignore
    }
    fileWatcher = null;
  }

  try {
    fileWatcher = fs.watch(filePath, (eventType) => {
      if (eventType === 'change' || eventType === 'rename') {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const updated = loadAutocompleteConfig();
          onUpdate(updated);
        }, 150);
      }
    });
  } catch (err) {
    console.error('Failed to watch autocomplete.json:', err);
  }
};

export const broadcastAutocompleteUpdate = (
  windows: Array<BrowserWindow | null | undefined>
): void => {
  const config = loadAutocompleteConfig();
  for (const win of windows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('autocomplete-updated', config);
    }
  }
};

export const stopWatchingAutocompleteConfig = (): void => {
  if (fileWatcher) {
    try {
      fileWatcher.close();
    } catch {
      // Ignore
    }
    fileWatcher = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
};
