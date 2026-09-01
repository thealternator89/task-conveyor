import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  globalHotkey: string;
}

export const getDefaultHotkey = (): string => {
  return process.platform === 'darwin' ? 'Option+Space' : 'Ctrl+Space';
};

export const DEFAULT_CONFIG: AppConfig = {
  get globalHotkey() {
    return getDefaultHotkey();
  }
};

let fileWatcher: fs.FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

export const getConfigFilePath = (): string => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'config.json');
};

export const ensureConfigFile = (): string => {
  const filePath = getConfigFilePath();
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to create default config.json:', err);
    }
  }

  return filePath;
};

export const loadConfig = (): AppConfig => {
  const filePath = ensureConfigFile();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    const globalHotkey =
      typeof parsed?.globalHotkey === 'string' && parsed.globalHotkey.trim().length > 0
        ? parsed.globalHotkey.trim()
        : DEFAULT_CONFIG.globalHotkey;

    return {
      globalHotkey
    };
  } catch (err) {
    console.error('Error reading config.json:', err);
    return { globalHotkey: getDefaultHotkey() };
  }
};

export const openConfigFile = async (): Promise<void> => {
  const filePath = ensureConfigFile();
  try {
    await shell.openPath(filePath);
  } catch (err) {
    console.error('Failed to open config.json:', err);
  }
};

export const formatHotkeyForDisplay = (accelerator: string): string => {
  if (!accelerator) return '';

  if (process.platform === 'darwin') {
    return accelerator
      .split('+')
      .map((part) => {
        const p = part.trim();
        if (/^(cmdorctrl|commandorcontrol|cmd|command)$/i.test(p)) return '⌘';
        if (/^(option|alt)$/i.test(p)) return '⌥';
        if (/^shift$/i.test(p)) return '⇧';
        if (/^(ctrl|control)$/i.test(p)) return '⌃';
        return p;
      })
      .join('');
  }

  // Windows and Linux formatting
  return accelerator
    .split('+')
    .map((part) => {
      const p = part.trim();
      if (/^(cmdorctrl|commandorcontrol)$/i.test(p)) return 'Ctrl';
      if (/^option$/i.test(p)) return 'Alt';
      if (/^(command|cmd)$/i.test(p)) return 'Win';
      if (/^(ctrl|control)$/i.test(p)) return 'Ctrl';
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join('+');
};

export const startWatchingConfig = (
  onChange: (newConfig: AppConfig) => void
): void => {
  const filePath = ensureConfigFile();

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
          const updated = loadConfig();
          onChange(updated);
        }, 200);
      }
    });
  } catch (err) {
    console.error('Failed to watch config.json:', err);
  }
};

export const stopWatchingConfig = (): void => {
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
