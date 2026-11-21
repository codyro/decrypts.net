import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import wasm from "vite-plugin-wasm";
import csp from "./vite-plugin-csp.js";

// Fork version, injected as import.meta.env.DECRYPTS_VERSION. Read from the
// repo-root VERSION file; fall back to 'dev' when the file is missing.
const decryptsVersion = (() => {
  try {
    return readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim()
  } catch {
    return 'dev'
  }
})()

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: './dist',
  },
  plugins: [
    vue(),
    wasm(),
    csp(),
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': [
            'useMessage',
            'useNotification',
            'NButton',
            'NPopconfirm',
            'NIcon',
          ]
        }
      ]
    }),
    Components({
      resolvers: [NaiveUiResolver()]
    }),
    VitePWA({
      registerType: null,
      devOptions: {
        enabled: false
      },
      workbox: {
        disableDevLogs: true,
        globPatterns: [],
        runtimeCaching: [],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'decrypts',
        short_name: 'decrypts',
        description: 'decrypts: disposable email, encrypted at rest and decrypted only in your browser.',
        theme_color: '#0B0B0C',
        background_color: '#0B0B0C',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url))
      }
    ]
  },
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(process.env.npm_package_version),
    'import.meta.env.DECRYPTS_VERSION': JSON.stringify(decryptsVersion),
  }
})
