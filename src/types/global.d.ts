import type { OctoApi } from '../../electron/preload';

declare global {
  interface Window {
    octo: OctoApi;
  }
}

export {};
