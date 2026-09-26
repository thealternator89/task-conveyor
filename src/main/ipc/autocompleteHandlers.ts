import { ipcMain } from 'electron';
import { loadAutocompleteConfig, openAutocompleteConfigFile } from '../autocomplete';

export const registerAutocompleteHandlers = (): void => {
  ipcMain.handle('get-autocomplete-data', () => {
    return loadAutocompleteConfig();
  });

  ipcMain.handle('open-autocomplete-config', async () => {
    await openAutocompleteConfigFile();
  });
};
