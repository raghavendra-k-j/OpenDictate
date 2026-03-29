/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

declare const OVERLAY_WINDOW_VITE_DEV_SERVER_URL: string;
declare const OVERLAY_WINDOW_VITE_NAME: string;

declare namespace Electron {
  interface App {
    isQuitting: boolean;
  }
}
