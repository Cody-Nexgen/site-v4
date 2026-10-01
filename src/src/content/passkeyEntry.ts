import { initPasskeyRequests } from './passkeyRequests';

// At document_start, so it's listening before a page can ask for a passkey: the page script falls
// back to the browser's own passkeys if nothing answers within 1.5 s.
initPasskeyRequests();
