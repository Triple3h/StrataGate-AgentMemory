/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cross-origin gateway origin (e.g. http://127.0.0.1:43731). Empty means same origin. */
  readonly VITE_GATEWAY_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
