/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

declare namespace Electron {
  interface App {
    isQuitting: boolean;
  }
}
