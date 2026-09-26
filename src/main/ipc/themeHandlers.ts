import { ipcMain } from 'electron';
import { ThemeMode } from '../config';
import { getThemeData, setTheme } from '../theme';

export const registerThemeHandlers = (): void => {
  ipcMain.handle('get-theme', () => {
    return getThemeData();
  });

  ipcMain.handle('set-theme', (_event, theme: ThemeMode) => {
    return setTheme(theme);
  });
};
