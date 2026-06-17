import type { KrakenApi } from '../../electron/preload';

declare global {
  interface Window {
    kraken: KrakenApi;
  }
}

export {};
