import { createApp } from 'vue'
import { createHead } from '@unhead/vue/client'

import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './styles/base.css'
import { ingestDecryptionFragmentFromLocation } from './utils/mail-fragment'
import { initKeyStore } from './utils/mail-key-store'
import { registerRawImportOfferCapture } from './utils/key-backup-prompts'
import { setLoggedInAddressResolver } from './utils/email-parser'
import { useGlobalState } from './store'

const bootstrap = async () => {
    // Load persisted keys (and migrate the legacy plaintext store) before
    // ingesting `#k=` fragments or mounting, so the first render already
    // sees the keys.
    await initKeyStore()

    // Capture raw `#k=` imports for the backup offer before ingesting: the
    // fragment is processed before the app (and KeyBackupHost) mounts.
    registerRawImportOfferCapture()

    // Ingest `#k=<privateKey>&a=<address>` before the router runs so the
    // fragment survives any redirect/replace performed by the jwt auto-login
    // or locale canonicalization flows, then strip it from the address bar.
    try {
        await ingestDecryptionFragmentFromLocation();
    } catch (error) {
        console.warn('Failed to ingest mail decryption fragment', error);
    }

    setLoggedInAddressResolver(() => useGlobalState().settings.value.address || '');

    const head = createHead()
    const app = createApp(App)
    app.use(i18n)
    app.use(router)
    app.use(head)
    app.mount('#app')
}

void bootstrap()
