import { nativeTheme } from 'electron';
import { DEFAULT_CONFIG, saveConfig, ThemeMode } from './config';
import { getAllManagedWindows } from './windows';

export interface ThemeData {
  theme: ThemeMode;
  isDark: boolean;
}

export const getThemeData = (): ThemeData => {
  return {
    theme: (nativeTheme.themeSource || 'system') as ThemeMode,
    isDark: nativeTheme.shouldUseDarkColors
  };
};

export const broadcastThemeUpdate = (): void => {
  const data = getThemeData();
  const windows = getAllManagedWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('theme-changed', data);
    }
  }
};

export const setTheme = (theme: ThemeMode): ThemeData => {
  if (theme === 'system' || theme === 'light' || theme === 'dark') {
    nativeTheme.themeSource = theme;
    saveConfig({ theme });
    broadcastThemeUpdate();
  }
  return getThemeData();
};

export const initTheme = (initialTheme?: ThemeMode): void => {
  nativeTheme.themeSource = initialTheme || DEFAULT_CONFIG.theme || 'system';
  nativeTheme.on('updated', () => {
    broadcastThemeUpdate();
  });
};
