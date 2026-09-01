import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  sendTaskCommand: (text: string) => ipcRenderer.send('submit-task', text),
  hideSpotlight: () => ipcRenderer.send('hide-spotlight'),
  quitApp: () => ipcRenderer.send('quit-app'),
  dockWindow: (side: 'left' | 'right') => ipcRenderer.send('dock-window', side),
  floatWindow: () => ipcRenderer.send('float-window'),
  onTaskAdded: (callback: (text: string) => void) => {
    const subscription = (_event: unknown, text: string) => callback(text);
    ipcRenderer.on('task-added', subscription);
    return () => {
      ipcRenderer.removeListener('task-added', subscription);
    };
  },
  onSpotlightShown: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('spotlight-shown', subscription);
    return () => {
      ipcRenderer.removeListener('spotlight-shown', subscription);
    };
  },
  toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),
  onAlwaysOnTopChanged: (callback: (state: boolean) => void) => {
    const subscription = (_event: unknown, state: boolean) => callback(state);
    ipcRenderer.on('always-on-top-changed', subscription);
    return () => {
      ipcRenderer.removeListener('always-on-top-changed', subscription);
    };
  },
  getInitialAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  getHotkeyString: () => process.platform === 'win32' ? 'Ctrl+Space' : '⌥Space',
  getAutocompleteData: () => ipcRenderer.invoke('get-autocomplete-data'),
  openAutocompleteConfig: () => ipcRenderer.invoke('open-autocomplete-config'),
  onAutocompleteUpdated: (callback: (data: { tags: string[]; projects: string[]; mentions: string[] }) => void) => {
    const subscription = (_event: unknown, data: { tags: string[]; projects: string[]; mentions: string[] }) => callback(data);
    ipcRenderer.on('autocomplete-updated', subscription);
    return () => {
      ipcRenderer.removeListener('autocomplete-updated', subscription);
    };
  },
});
