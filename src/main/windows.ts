import { BrowserWindow, screen, nativeTheme } from 'electron';
import { cleanupAppBar, handleAppBarPositionChange } from './docking';
import { ABN_POSCHANGED, isAppBarSupported, MY_APPBAR_MSG_ID } from './ffi/appbar';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let spotlightWindow: BrowserWindow | null = null;

export const getMainWindow = (): BrowserWindow | null => mainWindow;
export const getSpotlightWindow = (): BrowserWindow | null => spotlightWindow;

export const getAllManagedWindows = (): BrowserWindow[] => {
  const windows: BrowserWindow[] = [];
  if (mainWindow && !mainWindow.isDestroyed()) windows.push(mainWindow);
  if (spotlightWindow && !spotlightWindow.isDestroyed()) windows.push(spotlightWindow);
  return windows;
};

export const createMainWindow = (): BrowserWindow => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  const dockWidth = 400;
  const defaultHeight = 600;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.workArea;

  // Create the browser window in floating mode by default
  mainWindow = new BrowserWindow({
    x: Math.round(x + (width - dockWidth) / 2),
    y: Math.round(y + (height - defaultHeight) / 2),
    height: defaultHeight,
    width: dockWidth,
    minWidth: 320,
    frame: false,
    skipTaskbar: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141618' : '#f8f9fa',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Hook window message for position changes from Windows AppBar notifications
  if (process.platform === 'win32' && isAppBarSupported()) {
    mainWindow.hookWindowMessage(MY_APPBAR_MSG_ID, (wParam: Buffer) => {
      const code = wParam.length === 8 ? wParam.readBigUInt64LE(0) : BigInt(wParam.readUInt32LE(0));
      if (code === BigInt(ABN_POSCHANGED)) {
        handleAppBarPositionChange(mainWindow);
      }
    });
  }

  mainWindow.on('close', () => {
    cleanupAppBar(mainWindow);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
};

export const createSpotlightWindow = (): BrowserWindow => {
  if (spotlightWindow && !spotlightWindow.isDestroyed()) {
    return spotlightWindow;
  }

  spotlightWindow = new BrowserWindow({
    width: 500,
    height: 72,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    show: false,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e2124' : '#ffffff',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  spotlightWindow.loadURL(`${MAIN_WINDOW_WEBPACK_ENTRY}?window=spotlight`);

  spotlightWindow.on('blur', () => {
    if (spotlightWindow) {
      spotlightWindow.hide();
    }
  });

  spotlightWindow.on('closed', () => {
    spotlightWindow = null;
  });

  return spotlightWindow;
};

export const toggleSpotlightWindow = (): void => {
  if (!spotlightWindow || spotlightWindow.isDestroyed()) {
    createSpotlightWindow();
  }

  if (spotlightWindow && !spotlightWindow.isDestroyed()) {
    if (spotlightWindow.isVisible()) {
      spotlightWindow.hide();
    } else {
      spotlightWindow.show();
      spotlightWindow.center();
      spotlightWindow.focus();
      spotlightWindow.webContents.send('spotlight-shown');
    }
  }
};

export const hideSpotlightWindow = (): void => {
  if (spotlightWindow && !spotlightWindow.isDestroyed()) {
    spotlightWindow.hide();
  }
};

export const restoreAndFocusMainWindow = (): void => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
  }
};
