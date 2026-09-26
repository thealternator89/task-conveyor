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

export const broadcastThemeUpdate = (
  windows: Array<BrowserWindow | null | undefined>
): void => {
  const data = {
    theme: (nativeTheme.themeSource || 'system') as ThemeMode,
    isDark: nativeTheme.shouldUseDarkColors
  };
  for (const win of windows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('theme-changed', data);
    }
  }
};

export const sendAlwaysOnTopChanged = (
  window: BrowserWindow | null | undefined,
  state: boolean
): void => {
  if (window && !window.isDestroyed()) {
    window.webContents.send('always-on-top-changed', state);
  }
};

export const sendSpotlightShown = (
  window: BrowserWindow | null | undefined
): void => {
  if (window && !window.isDestroyed()) {
    window.webContents.send('spotlight-shown');
  }
};

export const sendHotkeyConfigChanged = (
  window: BrowserWindow | null | undefined,
  data: { newHotkey: string; activeHotkey: string }
): void => {
  if (window && !window.isDestroyed()) {
    window.webContents.send('hotkey-config-changed', data);
  }
};

export const sendTaskAdded = (
  window: BrowserWindow | null | undefined,
  text: string
): void => {
  if (window && !window.isDestroyed()) {
    window.webContents.send('task-added', text);
  }
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
    const mainWindow = context.getMainWindow();
    sendTaskAdded(mainWindow, text);

    const spotlightWindow = context.getSpotlightWindow();
    if (spotlightWindow && !spotlightWindow.isDestroyed()) {
      spotlightWindow.hide();
    }
  });

  ipcMain.on('hide-spotlight', () => {
    const spotlightWindow = context.getSpotlightWindow();
    if (spotlightWindow && !spotlightWindow.isDestroyed()) {
      spotlightWindow.hide();
    }
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
    const mainWindow = context.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const state = !mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(state);
      sendAlwaysOnTopChanged(mainWindow, state);
    }
  });

  // Handlers (ipcMain.handle)
  ipcMain.handle('get-always-on-top', () => {
    const mainWindow = context.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      return mainWindow.isAlwaysOnTop();
    }
    return false;
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
