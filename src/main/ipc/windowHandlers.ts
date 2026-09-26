import { app, ipcMain } from 'electron';
import { dockWindow, floatWindow, DockSide } from '../docking';
import { getMainWindow } from '../windows';

export const registerWindowHandlers = (): void => {
  ipcMain.on('quit-app', () => {
    app.quit();
  });

  ipcMain.on('dock-window', (_event, side: DockSide) => {
    dockWindow(getMainWindow(), side);
  });

  ipcMain.on('float-window', () => {
    floatWindow(getMainWindow());
  });

  ipcMain.on('toggle-always-on-top', () => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const state = !mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(state);
      mainWindow.webContents.send('always-on-top-changed', state);
    }
  });

  ipcMain.handle('get-always-on-top', () => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      return mainWindow.isAlwaysOnTop();
    }
    return false;
  });
};
