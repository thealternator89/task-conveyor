import { app, BrowserWindow, globalShortcut, dialog, Tray, Menu, nativeImage, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  startWatchingAutocompleteConfig,
  broadcastAutocompleteUpdate,
  stopWatchingAutocompleteConfig
} from './autocomplete';
import {
  loadConfig,
  startWatchingConfig,
  stopWatchingConfig,
  DEFAULT_CONFIG
} from './config';
import {
  registerIpcHandlers,
  unregisterIpcHandlers,
  broadcastThemeUpdate,
  sendHotkeyConfigChanged
} from './ipc';
import {
  initAppBarApi,
  createMainWindow,
  createSpotlightWindow,
  toggleSpotlightWindow,
  dockMainWindow,
  floatMainWindow,
  cleanupAppBar,
  restoreMainWindow,
  getMainWindow,
  getSpotlightWindow,
  getAppWindows,
  getAppIcon
} from './window';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

app.name = 'TaskConveyor';

// Migrate user data from legacy 'task-conveyor' directory if necessary
try {
  const newUserData = app.getPath('userData');
  const appData = app.getPath('appData');
  const oldUserData = path.join(appData, 'task-conveyor');

  if (fs.existsSync(oldUserData)) {
    if (!fs.existsSync(newUserData)) {
      fs.cpSync(oldUserData, newUserData, { recursive: true });
    } else {
      const filesToMigrate = ['config.json', 'autocomplete.json'];
      for (const file of filesToMigrate) {
        const oldFile = path.join(oldUserData, file);
        const newFile = path.join(newUserData, file);
        if (fs.existsSync(oldFile) && !fs.existsSync(newFile)) {
          fs.copyFileSync(oldFile, newFile);
        }
      }
    }
  }
} catch (err) {
  console.error('Failed to migrate userData from task-conveyor to TaskConveyor:', err);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  dialog.showErrorBox(
    'TaskConveyor',
    'Another instance of TaskConveyor is already running.'
  );
  app.quit();
}

let tray: Tray | null = null;
let activeHotkey: string | null = null;

const createTray = async (): Promise<void> => {
  let icon = getAppIcon();
  if (icon.isEmpty()) {
    try {
      icon = await app.getFileIcon(process.execPath);
    } catch {
      icon = nativeImage.createEmpty();
    }
  }

  const trayIcon = icon.resize({ width: 16, height: 16 });
  // Explicitly ensure the icon is not treated as a template mask on macOS,
  // preserving its full colors in the menu bar.
  trayIcon.setTemplateImage(false);

  tray = new Tray(trayIcon);
  tray.setToolTip('TaskConveyor');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Exit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    restoreMainWindow();
  });
};

const registerGlobalHotkey = (accelerator: string): boolean => {
  try {
    return globalShortcut.register(accelerator, () => {
      toggleSpotlightWindow();
    });
  } catch (err) {
    console.error(`Error registering hotkey "${accelerator}":`, err);
    return false;
  }
};

if (gotTheLock) {
  app.on('second-instance', () => {
    restoreMainWindow();
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', async () => {
    initAppBarApi();

    registerIpcHandlers({
      getMainWindow,
      getSpotlightWindow,
      dockWindow: dockMainWindow,
      floatWindow: floatMainWindow,
      getActiveHotkey: () => activeHotkey,
    });

    const config = loadConfig();
    nativeTheme.themeSource = config.theme || DEFAULT_CONFIG.theme || 'system';

    nativeTheme.on('updated', () => {
      broadcastThemeUpdate(getAppWindows());
    });

    const appIcon = getAppIcon();
    if (process.platform === 'darwin' && app.dock && !appIcon.isEmpty()) {
      app.dock.setIcon(appIcon);
    }

    createMainWindow();
    createSpotlightWindow();
    await createTray();

    startWatchingAutocompleteConfig(() => {
      broadcastAutocompleteUpdate(getAppWindows());
    });

    const targetHotkey = config.globalHotkey || DEFAULT_CONFIG.globalHotkey;
    if (registerGlobalHotkey(targetHotkey)) {
      activeHotkey = targetHotkey;
    } else {
      console.error(`Failed to register global hotkey "${targetHotkey}"`);
      dialog.showErrorBox(
        'Global Hotkey Error',
        `Failed to register global hotkey "${targetHotkey}".\n\nIt may be invalid or already in use by another application.`
      );
    }

    startWatchingConfig((newConfig) => {
      const newHotkey = newConfig.globalHotkey || DEFAULT_CONFIG.globalHotkey;
      if (newHotkey !== activeHotkey) {
        sendHotkeyConfigChanged(getMainWindow(), {
          newHotkey,
          activeHotkey: activeHotkey || ''
        });
      }

      const newTheme = newConfig.theme || DEFAULT_CONFIG.theme || 'system';
      if (newTheme !== nativeTheme.themeSource) {
        nativeTheme.themeSource = newTheme;
        broadcastThemeUpdate(getAppWindows());
      }
    });
  });

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    stopWatchingAutocompleteConfig();
    stopWatchingConfig();
    cleanupAppBar();
    unregisterIpcHandlers();
    globalShortcut.unregisterAll();
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
      tray = null;
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}
