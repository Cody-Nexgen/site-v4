import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySender, isTrustedSiteOrigin } from './trustedOrigins';
import { isWebBridgeType } from './webBridgeProtocol';

const ID = 'abcdefghijklmnopabcdefghijklmnop';
const env = (devInstall: boolean) => ({ extensionId: ID, extensionOrigin: `chrome-extension://${ID}`, devInstall });

test('Site origins: FocuzNow always; local dev servers only on unpacked installs', () => {
    assert.equal(isTrustedSiteOrigin('https://focuznow.com', false), true);
    assert.equal(isTrustedSiteOrigin('https://dashboard.focuznow.com', false), true);
    assert.equal(isTrustedSiteOrigin('http://localhost:3000', false), false, 'store install ignores localhost');
    assert.equal(isTrustedSiteOrigin('http://localhost:3000', true), true);
    assert.equal(isTrustedSiteOrigin('http://localhost:8123', true), false, 'only the site dev ports');
    assert.equal(isTrustedSiteOrigin('http://127.0.0.1:3000', true), false);
    assert.equal(isTrustedSiteOrigin('https://focuznow.com.evil.test', true), false);
    assert.equal(isTrustedSiteOrigin('http://focuznow.com', true), false, 'https only');
    assert.equal(isTrustedSiteOrigin(undefined, true), false);
});

test('Senders: our pages, the site top frame through the bridge, everything else', () => {
    const page = { id: ID, url: `chrome-extension://${ID}/src/options/index.html`, origin: `chrome-extension://${ID}` };
    assert.equal(classifySender(page, env(false)), 'extension-page');
    assert.equal(classifySender({ id: ID, url: 'https://focuznow.com/pwcode', frameId: 0 }, env(false)), 'trusted-site');
    assert.equal(classifySender({ id: ID, url: 'https://focuznow.com/pwcode', frameId: 3 }, env(false)), 'other', 'framed site');
    assert.equal(classifySender({ id: ID, url: 'http://localhost:3000/', frameId: 0 }, env(false)), 'other');
    assert.equal(classifySender({ id: ID, url: 'http://localhost:3000/', frameId: 0 }, env(true)), 'trusted-site');
    assert.equal(classifySender({ id: ID, url: 'http://localhost:8123/', frameId: 0 }, env(true)), 'other');
    assert.equal(classifySender({ id: ID, url: 'https://github.com/login', frameId: 0 }, env(true)), 'other');
    assert.equal(classifySender({ id: 'someotherextension', url: `chrome-extension://${ID}/x.html` }, env(true)), 'other');
    assert.equal(classifySender({ id: ID, url: 'not a url', frameId: 0 }, env(true)), 'other');
    assert.equal(classifySender(undefined, env(true)), 'other');
});

test('Bridge: the dashboard messages only, and nothing from FocuzPass', () => {
    for (const type of ['BLOCK_DOMAIN', 'FUTURE_SELF_GET', 'EXPORT_LOCAL_STATS', 'START_NUCLEAR']) {
        assert.equal(isWebBridgeType(type), true, type);
    }
    for (const type of ['FOCUZPASS_SNAPSHOT', 'FOCUZPASS_LIST', 'FOCUZPASS_UNLOCK', 'FOCUZPASS_EXPORT_PACKAGE', 'FOCUZPASS_IMPORT_PACKAGE', 'FOCUZPASS_STATUS', 'GET_SESSION', 'SYNC_SESSION', 'SB_SESSION_SYNC', 'FOCUZPASS_CAPTURE_LOGIN', 'OPEN_OPTIONS', '', undefined, 42]) {
        assert.equal(isWebBridgeType(type), false, String(type));
    }
});
