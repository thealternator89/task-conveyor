import { ipcMain } from 'electron';
import { getMainWindow, hideSpotlightWindow } from '../windows';

export const registerTaskHandlers = (): void => {
  ipcMain.on('submit-task', (_event, text: string) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('task-added', text);
    }
    hideSpotlightWindow();
  });

  ipcMain.on('hide-spotlight', () => {
    hideSpotlightWindow();
  });
};
