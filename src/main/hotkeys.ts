import { dialog, globalShortcut } from 'electron';

let activeHotkey: string | null = null;

export const getActiveHotkey = (): string | null => activeHotkey;

export const setActiveHotkey = (hotkey: string | null): void => {
  activeHotkey = hotkey;
};

export const registerGlobalHotkey = (accelerator: string, onTrigger: () => void): boolean => {
  try {
    return globalShortcut.register(accelerator, onTrigger);
  } catch (err) {
    console.error(`Error registering hotkey "${accelerator}":`, err);
    return false;
  }
};

export const setupInitialHotkey = (targetHotkey: string, onTrigger: () => void): boolean => {
  if (registerGlobalHotkey(targetHotkey, onTrigger)) {
    activeHotkey = targetHotkey;
    return true;
  }

  console.error(`Failed to register global hotkey "${targetHotkey}"`);
  dialog.showErrorBox(
    'Global Hotkey Error',
    `Failed to register global hotkey "${targetHotkey}".\n\nIt may be invalid or already in use by another application.`
  );
  return false;
};

export const unregisterAllHotkeys = (): void => {
  globalShortcut.unregisterAll();
};
