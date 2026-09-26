import { ipcMain } from 'electron';
import { DEFAULT_CONFIG, formatHotkeyForDisplay, loadConfig, openConfigFile } from '../config';
import { getActiveHotkey } from '../hotkeys';

export const registerConfigHandlers = (): void => {
  ipcMain.handle('get-config', () => {
    return loadConfig();
  });

  ipcMain.handle('open-config', async () => {
    await openConfigFile();
  });

  ipcMain.handle('get-hotkey-string', () => {
    const activeHotkey = getActiveHotkey();
    return formatHotkeyForDisplay(activeHotkey || loadConfig().globalHotkey || DEFAULT_CONFIG.globalHotkey);
  });
};
