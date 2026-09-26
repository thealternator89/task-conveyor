import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import {
  loadAutocompleteConfig,
  openAutocompleteConfigFile
} from './autocomplete';
import {
  loadConfig,
  saveConfig,
  openConfigFile,
  formatHotkeyForDisplay,
  DEFAULT_CONFIG,
  ThemeMode
} from './config';

export interface IpcHandlersContext {
  getMainWindow: () => BrowserWindow | null;
  getSpotlightWindow: () => BrowserWindow | null;
  dockWindow: (side: 'left' | 'right') => void;
  floatWindow: () => void;
  getActiveHotkey: () => string | null;
}

export type WindowTarget =
  | BrowserWindow
  | null
  | undefined
  | Array<BrowserWindow | null | undefined>;

const HANDLER_CHANNELS = [
  'get-always-on-top',
  'get-autocomplete-data',
  'open-autocomplete-config',
  'get-config',
  'open-config',
  'get-hotkey-string',
  'get-theme',
  'set-theme',
] as const;

const LISTENER_CHANNELS = [
  'submit-task',
  'hide-spotlight',
  'quit-app',
  'dock-window',
  'float-window',
  'toggle-always-on-top',
] as const;

/**
 * Executes an action on a window only if it exists and has not been destroyed.
 */
export const ifWindowExists = <T>(
  window: BrowserWindow | null | undefined,
  action: (win: BrowserWindow) => T
): T | undefined => {
  if (window && !window.isDestroyed()) {
    return action(window);
  }
  return undefined;
};

/**
 * Sends an IPC message to one or more windows, safely verifying each window exists and is not destroyed.
 */
export const sendMessage = (
  target: WindowTarget,
  channel: string,
  ...args: unknown[]
): void => {
  const windows = Array.isArray(target) ? target : [target];
  for (const win of windows) {
    ifWindowExists(win, (w) => {
      w.webContents.send(channel, ...args);
    });
  }
};

export const broadcastThemeUpdate = (
  windows: Array<BrowserWindow | null | undefined>
): void => {
  const data = {
    theme: (nativeTheme.themeSource || 'system') as ThemeMode,
    isDark: nativeTheme.shouldUseDarkColors
  };
  sendMessage(windows, 'theme-changed', data);
};

export const sendAlwaysOnTopChanged = (
  window: BrowserWindow | null | undefined,
  state: boolean
): void => {
  sendMessage(window, 'always-on-top-changed', state);
};

export const sendSpotlightShown = (
  window: BrowserWindow | null | undefined
): void => {
  sendMessage(window, 'spotlight-shown');
};

export const sendHotkeyConfigChanged = (
  window: BrowserWindow | null | undefined,
  data: { newHotkey: string; activeHotkey: string }
): void => {
  sendMessage(window, 'hotkey-config-changed', data);
};

export const sendTaskAdded = (
  window: BrowserWindow | null | undefined,
  text: string
): void => {
  sendMessage(window, 'task-added', text);
};

export const unregisterIpcHandlers = (): void => {
  for (const channel of HANDLER_CHANNELS) {
    ipcMain.removeHandler(channel);
  }
  for (const channel of LISTENER_CHANNELS) {
    ipcMain.removeAllListeners(channel);
  }
};

export const registerIpcHandlers = (context: IpcHandlersContext): void => {
  // Ensure any previous registrations are cleaned up
  unregisterIpcHandlers();

  // Listeners (ipcMain.on)
  ipcMain.on('submit-task', (_event, text: string) => {
    sendTaskAdded(context.getMainWindow(), text);
    ifWindowExists(context.getSpotlightWindow(), (win) => win.hide());
  });

  ipcMain.on('hide-spotlight', () => {
    ifWindowExists(context.getSpotlightWindow(), (win) => win.hide());
  });

  ipcMain.on('quit-app', () => {
    app.quit();
  });

  ipcMain.on('dock-window', (_event, side: 'left' | 'right') => {
    context.dockWindow(side);
  });

  ipcMain.on('float-window', () => {
    context.floatWindow();
  });

  ipcMain.on('toggle-always-on-top', () => {
    ifWindowExists(context.getMainWindow(), (win) => {
      const state = !win.isAlwaysOnTop();
      win.setAlwaysOnTop(state);
      sendAlwaysOnTopChanged(win, state);
    });
  });

  // Handlers (ipcMain.handle)
  ipcMain.handle('get-always-on-top', () => {
    return ifWindowExists(context.getMainWindow(), (win) => win.isAlwaysOnTop()) ?? false;
  });

  ipcMain.handle('get-autocomplete-data', () => {
    return loadAutocompleteConfig();
  });

  ipcMain.handle('open-autocomplete-config', async () => {
    await openAutocompleteConfigFile();
  });

  ipcMain.handle('get-config', () => {
    return loadConfig();
  });

  ipcMain.handle('open-config', async () => {
    await openConfigFile();
  });

  ipcMain.handle('get-hotkey-string', () => {
    const activeHotkey = context.getActiveHotkey();
    return formatHotkeyForDisplay(
      activeHotkey || loadConfig().globalHotkey || DEFAULT_CONFIG.globalHotkey
    );
  });

  ipcMain.handle('get-theme', () => {
    return {
      theme: (nativeTheme.themeSource || 'system') as ThemeMode,
      isDark: nativeTheme.shouldUseDarkColors
    };
  });

  ipcMain.handle('set-theme', (_event, theme: ThemeMode) => {
    if (theme === 'system' || theme === 'light' || theme === 'dark') {
      nativeTheme.themeSource = theme;
      saveConfig({ theme });
      broadcastThemeUpdate([context.getMainWindow(), context.getSpotlightWindow()]);
    }
    return {
      theme: (nativeTheme.themeSource || 'system') as ThemeMode,
      isDark: nativeTheme.shouldUseDarkColors
    };
  });
};
