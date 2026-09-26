import { registerWindowHandlers } from './windowHandlers';
import { registerTaskHandlers } from './taskHandlers';
import { registerConfigHandlers } from './configHandlers';
import { registerAutocompleteHandlers } from './autocompleteHandlers';
import { registerThemeHandlers } from './themeHandlers';

export const registerIpcHandlers = (): void => {
  registerWindowHandlers();
  registerTaskHandlers();
  registerConfigHandlers();
  registerAutocompleteHandlers();
  registerThemeHandlers();
};
