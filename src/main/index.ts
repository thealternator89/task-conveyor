import { app, BrowserWindow, dialog, nativeTheme } from 'electron';
import {
  broadcastAutocompleteUpdate,
  startWatchingAutocompleteConfig,
  stopWatchingAutocompleteConfig
} from './autocomplete';
import {
  DEFAULT_CONFIG,
  loadConfig,
  startWatchingConfig,
  stopWatchingConfig
} from './config';
import { initAppBarFfi } from './ffi/appbar';
import { cleanupAppBar } from './docking';
import {
  createMainWindow,
  createSpotlightWindow,
  getMainWindow,
  getSpotlightWindow,
  restoreAndFocusMainWindow,
  toggleSpotlightWindow
} from './windows';
import { createTray, destroyTray } from './tray';
import {
  getActiveHotkey,
  setupInitialHotkey,
  unregisterAllHotkeys
} from './hotkeys';
import { broadcastThemeUpdate, initTheme } from './theme';
import { registerIpcHandlers } from './ipc';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  dialog.showErrorBox(
    'Task Conveyor',
    'Another instance of Task Conveyor is already running.'
  );
  app.quit();
}

if (gotTheLock) {
  // Initialize native Win32 FFI if running on Windows
  initAppBarFfi();

  app.on('second-instance', () => {
    restoreAndFocusMainWindow();
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  app.on('ready', async () => {
    const config = loadConfig();
    initTheme(config.theme);

    createMainWindow();
    createSpotlightWindow();
    await createTray();

    registerIpcHandlers();

    startWatchingAutocompleteConfig(() => {
      broadcastAutocompleteUpdate([getMainWindow(), getSpotlightWindow()]);
    });

    const targetHotkey = config.globalHotkey || DEFAULT_CONFIG.globalHotkey;
    setupInitialHotkey(targetHotkey, () => {
      toggleSpotlightWindow();
    });

    startWatchingConfig((newConfig) => {
      const activeHotkey = getActiveHotkey();
      const newHotkey = newConfig.globalHotkey || DEFAULT_CONFIG.globalHotkey;
      if (newHotkey !== activeHotkey) {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('hotkey-config-changed', {
            newHotkey,
            activeHotkey: activeHotkey || ''
          });
        }
      }

      const newTheme = newConfig.theme || DEFAULT_CONFIG.theme || 'system';
      if (newTheme !== nativeTheme.themeSource) {
        nativeTheme.themeSource = newTheme;
        broadcastThemeUpdate();
      }
    });
  });

  // Quit when all windows are closed, except on macOS.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    stopWatchingAutocompleteConfig();
    stopWatchingConfig();
    cleanupAppBar(getMainWindow());
    unregisterAllHotkeys();
    destroyTray();
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}
