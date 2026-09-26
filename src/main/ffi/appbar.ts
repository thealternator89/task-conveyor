import { BrowserWindow } from 'electron';

export interface RECTType {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const MY_APPBAR_MSG_ID = 1124;

export const ABM_NEW = 0;
export const ABM_REMOVE = 1;
export const ABM_QUERYPOS = 2;
export const ABM_SETPOS = 3;

export const ABE_LEFT = 0;
export const ABE_RIGHT = 2;

export const ABN_POSCHANGED = 1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SHAppBarMessage: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let APPBARDATA: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let koffi: any = null;

let isInitialized = false;

export const initAppBarFfi = (): boolean => {
  if (isInitialized) {
    return isAppBarSupported();
  }
  isInitialized = true;

  if (process.platform === 'win32') {
    try {
      // Dynamic require so non-Windows builds and environments don't crash
      koffi = require('koffi');

      const RECT = koffi.struct('RECT', {
        left: 'int32',
        top: 'int32',
        right: 'int32',
        bottom: 'int32'
      });

      APPBARDATA = koffi.struct('APPBARDATA', {
        cbSize: 'uint32',
        hWnd: 'intptr_t',
        uCallbackMessage: 'uint32',
        uEdge: 'uint32',
        rc: RECT,
        lParam: 'intptr_t'
      });

      const shell32 = koffi.load('shell32.dll');
      SHAppBarMessage = shell32.func('uintptr_t __stdcall SHAppBarMessage(uint32_t dwMessage, _Inout_ APPBARDATA *pData)');
      return true;
    } catch (err) {
      console.error('Failed to initialize Windows AppBar API:', err);
      return false;
    }
  }

  return false;
};

export const isAppBarSupported = (): boolean => {
  return Boolean(process.platform === 'win32' && SHAppBarMessage && APPBARDATA && koffi);
};

export const getWindowHwnd = (win: BrowserWindow): bigint => {
  const buf = win.getNativeWindowHandle();
  return process.arch === 'ia32' ? BigInt(buf.readUInt32LE(0)) : buf.readBigUInt64LE(0);
};

export const callAppBar = (
  dwMessage: number,
  hwndBigInt: bigint,
  uEdge: number,
  rc?: RECTType
): { res: number; rc: RECTType; uEdge: number } => {
  if (!isAppBarSupported()) {
    return { res: 0, rc: rc || { left: 0, top: 0, right: 0, bottom: 0 }, uEdge };
  }

  const pData = koffi.alloc(APPBARDATA, 1);
  koffi.encode(pData, APPBARDATA, {
    cbSize: koffi.sizeof(APPBARDATA),
    hWnd: hwndBigInt,
    uCallbackMessage: MY_APPBAR_MSG_ID,
    uEdge: uEdge,
    rc: rc || { left: 0, top: 0, right: 0, bottom: 0 },
    lParam: 0
  });

  const res = SHAppBarMessage(dwMessage, pData);
  const decoded = koffi.decode(pData, APPBARDATA);
  return { res: Number(res), rc: decoded.rc, uEdge: decoded.uEdge };
};
