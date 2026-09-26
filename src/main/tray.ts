import { app, Menu, nativeImage, Tray } from 'electron';
import { restoreAndFocusMainWindow } from './windows';

let tray: Tray | null = null;

export const createTray = async (): Promise<Tray> => {
  let icon: Electron.NativeImage;
  try {
    icon = await app.getFileIcon(process.execPath);
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Task Conveyor');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Exit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    restoreAndFocusMainWindow();
  });

  return tray;
};

export const destroyTray = (): void => {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
  }
};
