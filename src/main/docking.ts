import { BrowserWindow, screen } from 'electron';
import {
  ABE_LEFT,
  ABE_RIGHT,
  ABM_NEW,
  ABM_QUERYPOS,
  ABM_REMOVE,
  ABM_SETPOS,
  callAppBar,
  getWindowHwnd,
  isAppBarSupported,
  RECTType
} from './ffi/appbar';

export type DockSide = 'left' | 'right';

let isAppBarRegistered = false;
let currentDockSide: DockSide | null = null;
let registeredHwnd: bigint | null = null;
let isAdjusting = false;

export const getDockState = (): { isAppBarRegistered: boolean; currentDockSide: DockSide | null } => ({
  isAppBarRegistered,
  currentDockSide
});

export const dockWindow = (mainWindow: BrowserWindow | null, side: DockSide): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  isAdjusting = true;
  try {
    const uEdge = side === 'left' ? ABE_LEFT : ABE_RIGHT;
    const currentBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(currentBounds);
    const scale = display.scaleFactor || 1;
    const dockWidth = 400;

    if (isAppBarSupported()) {
      const hwnd = getWindowHwnd(mainWindow);

      // If registered with a different side or needs clean re-query, remove previous registration first
      if (isAppBarRegistered && registeredHwnd) {
        const prevEdge = currentDockSide === 'left' ? ABE_LEFT : ABE_RIGHT;
        callAppBar(ABM_REMOVE, registeredHwnd, prevEdge);
        isAppBarRegistered = false;
      }

      // Register as an AppBar
      callAppBar(ABM_NEW, hwnd, uEdge);
      isAppBarRegistered = true;
      registeredHwnd = hwnd;

      // Convert display bounds to physical pixels for Win32 API
      const monLeftPhysical = Math.round(display.bounds.x * scale);
      const monTopPhysical = Math.round(display.bounds.y * scale);
      const monRightPhysical = Math.round((display.bounds.x + display.bounds.width) * scale);
      const monBottomPhysical = Math.round((display.bounds.y + display.bounds.height) * scale);
      const dockWidthPhysical = Math.round(dockWidth * scale);

      const initialRc: RECTType = {
        left: side === 'left' ? monLeftPhysical : monRightPhysical - dockWidthPhysical,
        top: monTopPhysical,
        right: side === 'left' ? monLeftPhysical + dockWidthPhysical : monRightPhysical,
        bottom: monBottomPhysical
      };

      // ABM_QUERYPOS: request position
      const queryResult = callAppBar(ABM_QUERYPOS, hwnd, uEdge, initialRc);

      // Maintain requested width on the chosen edge
      const adjustedRc: RECTType = { ...queryResult.rc };
      if (uEdge === ABE_LEFT) {
        adjustedRc.right = adjustedRc.left + dockWidthPhysical;
      } else {
        adjustedRc.left = adjustedRc.right - dockWidthPhysical;
      }

      // ABM_SETPOS: reserve space in the OS desktop work area
      const setPosResult = callAppBar(ABM_SETPOS, hwnd, uEdge, adjustedRc);

      // Convert result back from physical pixels to DIPs for Electron
      const finalBounds = {
        x: Math.round(setPosResult.rc.left / scale),
        y: Math.round(setPosResult.rc.top / scale),
        width: Math.round((setPosResult.rc.right - setPosResult.rc.left) / scale),
        height: Math.round((setPosResult.rc.bottom - setPosResult.rc.top) / scale)
      };

      // Set window state flags prior to setting final bounds so style changes don't snap position
      if (!mainWindow.isAlwaysOnTop()) {
        mainWindow.setAlwaysOnTop(true);
        mainWindow.webContents.send('always-on-top-changed', true);
      }
      mainWindow.setSkipTaskbar(true);

      mainWindow.setBounds(finalBounds);
      currentDockSide = side;
    } else {
      // Non-Windows fallback
      const { x, y, width: workAreaWidth, height: workAreaHeight } = display.workArea;

      if (!mainWindow.isAlwaysOnTop()) {
        mainWindow.setAlwaysOnTop(true);
        mainWindow.webContents.send('always-on-top-changed', true);
      }
      mainWindow.setSkipTaskbar(true);

      mainWindow.setBounds({
        x: side === 'left' ? x : x + workAreaWidth - dockWidth,
        y: y,
        width: dockWidth,
        height: workAreaHeight
      });
      currentDockSide = side;
    }
  } finally {
    // Delay resetting isAdjusting to allow the Windows message pump to drain any synchronous ABN_POSCHANGED notifications
    setTimeout(() => {
      isAdjusting = false;
    }, 200);
  }
};

export const floatWindow = (mainWindow: BrowserWindow | null): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  isAdjusting = true;
  try {
    if (isAppBarSupported() && isAppBarRegistered) {
      const hwnd = registeredHwnd || getWindowHwnd(mainWindow);
      const uEdge = currentDockSide === 'left' ? ABE_LEFT : ABE_RIGHT;
      callAppBar(ABM_REMOVE, hwnd, uEdge);
      isAppBarRegistered = false;
      registeredHwnd = null;
    }

    currentDockSide = null;

    if (mainWindow.isAlwaysOnTop()) {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.webContents.send('always-on-top-changed', false);
    }
    mainWindow.setSkipTaskbar(false);

    const currentBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(currentBounds);
    const { x, y, width, height } = display.workArea;
    const defaultWidth = 400;
    const defaultHeight = 600;

    mainWindow.setBounds({
      x: Math.round(x + (width - defaultWidth) / 2),
      y: Math.round(y + (height - defaultHeight) / 2),
      width: defaultWidth,
      height: defaultHeight
    });
  } finally {
    setTimeout(() => {
      isAdjusting = false;
    }, 200);
  }
};

export const cleanupAppBar = (mainWindow?: BrowserWindow | null): void => {
  if (isAppBarSupported() && isAppBarRegistered) {
    try {
      const hwnd = (mainWindow && !mainWindow.isDestroyed())
        ? getWindowHwnd(mainWindow)
        : registeredHwnd;

      if (hwnd) {
        const uEdge = currentDockSide === 'left' ? ABE_LEFT : ABE_RIGHT;
        callAppBar(ABM_REMOVE, hwnd, uEdge);
      }
    } catch (err) {
      console.error('Failed to unregister AppBar on exit:', err);
    }
    isAppBarRegistered = false;
    registeredHwnd = null;
    currentDockSide = null;
  }
};

export const handleAppBarPositionChange = (mainWindow: BrowserWindow | null): void => {
  if (isAdjusting) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (isAppBarRegistered && currentDockSide) {
    dockWindow(mainWindow, currentDockSide);
  }
};
