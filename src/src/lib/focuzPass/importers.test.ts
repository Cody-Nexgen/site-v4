import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsv, parseImportFile, summarizeImport } from './importers';
import { readZip } from './zip';
import { FocuzPassVault, createMemoryStorage } from './vaultCore';

/** A tiny zip writer for fixtures (deflate or stored; CRCs aren't checked by the reader). */
async function makeZip(files: Record<string, string>, deflate = true): Promise<Blob> {
    const enc = new TextEncoder();
    const locals: Uint8Array[] = [];
    const centrals: Uint8Array[] = [];
    let offset = 0;
    for (const [name, text] of Object.entries(files)) {
        const raw = enc.encode(text);
        const data = deflate
            ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
            : raw;
        const nameBytes = enc.encode(name);
        const local = new Uint8Array(30 + nameBytes.length + data.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(8, deflate ? 8 : 0, true);
        lv.setUint32(18, data.length, true);
        lv.setUint32(22, raw.length, true);
        lv.setUint16(26, nameBytes.length, true);
        local.set(nameBytes, 30);
        local.set(data, 30 + nameBytes.length);
        const central = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(10, deflate ? 8 : 0, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, raw.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint32(42, offset, true);
        central.set(nameBytes, 46);
        locals.push(local);
        centrals.push(central);
        offset += local.length;
    }
    const centralSize = centrals.reduce((n, c) => n + c.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, centrals.length, true);
    ev.setUint16(10, centrals.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    return new Blob([...locals, ...centrals, eocd] as BlobPart[]);
}

const blob = (text: string) => new Blob([text]);

test('CSV parser handles quotes, doubled quotes, commas and line breaks inside fields, CRLF and BOM', () => {
    const rows = parseCsv('﻿name,notes\r\n"Acme, Inc","line one\nline ""two"""\r\n\r\nplain,\n');
    assert.deepEqual(rows, [
        ['name', 'notes'],
        ['Acme, Inc', 'line one\nline "two"'],
        ['plain', ''],
    ]);
});

test('Chrome / Edge CSV becomes logins; a row with no username becomes a Password item', async () => {
    const csv = 'name,url,username,password,note\ngithub.com,https://github.com/login,sam@acme.test,gh-pass-1,work account\n,https://wifi.local,,router-pass,\n';
    const r = await parseImportFile('chrome', blob(csv));
    assert.equal(r.items.length, 2);
    assert.deepEqual(
        { type: r.items[0].type, title: r.items[0].title, identity: r.items[0].identity, domain: r.items[0].domain, password: r.items[0].password, note: r.items[0].note },
        { type: 'login', title: 'github.com', identity: 'sam@acme.test', domain: 'https://github.com/login', password: 'gh-pass-1', note: 'work account' },
    );
    assert.equal(r.items[1].type, 'custom');
    assert.equal(r.items[1].kind, 'password');
    assert.equal(r.items[1].title, 'wifi.local');
    assert.deepEqual(r.items[1].fields, { username: '', password: 'router-pass' });
});

test('Firefox CSV (no name column) titles logins by site', async () => {
    const csv = '"url","username","password","httpRealm","formActionOrigin","guid","timeCreated","timeLastUsed","timePasswordChanged"\n"https://www.reddit.com","sam","rd-pass","","https://www.reddit.com","{1}","1","1","1"\n';
    const r = await parseImportFile('firefox', blob(csv));
    assert.equal(r.items[0].title, 'reddit.com');
    assert.equal(r.items[0].identity, 'sam');
});

test('LastPass CSV: secure notes (http://sn) are skipped and counted, favorites and TOTP kept', async () => {
    const csv = 'url,username,password,totp,extra,name,grouping,fav\nhttps://x.com,sam,x-pass,JBSWY3DPEHPK3PXP,,X,Social,1\nhttp://sn,,,,"NoteType:Server",Server note,,0\n';
    const r = await parseImportFile('lastpass', blob(csv));
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].favorite, true);
    assert.match(r.items[0].note ?? '', /One-time code secret \(TOTP\): JBSWY3DPEHPK3PXP/);
    assert.equal(r.totpInNotes, 1);
    assert.deepEqual(r.skipped, [{ reason: 'Secure notes (FocuzPass doesn\'t have notes yet)', count: 1 }]);
});

test('NordPass CSV: logins, cards and notes by type', async () => {
    const csv =
        'name,url,additional_urls,username,password,note,cardholdername,cardnumber,cvc,expirydate,zipcode,folder,full_name,phone_number,email,address1,address2,city,country,state,type\n' +
        'Spotify,https://spotify.com,,sam@acme.test,sp-pass,,,,,,,,,,,,,,,,password\n' +
        'Visa,,,,,,Sam Lee,4111 1111 1111 1111,123,04/2027,,,,,,,,,,,credit_card\n' +
        'Diary,,,,,secret,,,,,,,,,,,,,,,note\n';
    const r = await parseImportFile('nordpass', blob(csv));
    assert.deepEqual(summarizeImport(r.items), { logins: 1, cards: 1, identities: 0, other: 0 });
    const card = r.items.find((i) => i.type === 'card')!;
    assert.deepEqual({ holder: card.identity, number: card.cardNumber, expiry: card.expiry, cvv: card.cvv }, { holder: 'Sam Lee', number: '4111111111111111', expiry: '04/27', cvv: '123' });
    assert.equal(r.skipped[0].count, 1);
});

test('Apple, KeePassXC, RoboForm and Bitwarden CSV headers map correctly', async () => {
    const apple = await parseImportFile('apple', blob('Title,URL,Username,Password,Notes,OTPAuth\nAcme,https://acme.test,sam,a-pass,,otpauth://totp/Acme?secret=ABC\n'));
    assert.equal(apple.items[0].title, 'Acme');
    assert.match(apple.items[0].note ?? '', /otpauth:\/\/totp/);
    const kp = await parseImportFile('keepass', blob('"Group","Title","Username","Password","URL","Notes","TOTP","Icon","Last Modified","Created"\n"Root","Bank","sam","b-pass","https://bank.test","","","0","",""\n'));
    assert.equal(kp.items[0].domain, 'https://bank.test');
    const rf = await parseImportFile('roboform', blob('Name,Url,MatchUrl,Login,Pwd,Note,Folder,RfFieldsV2\nShop,https://shop.test,https://shop.test,sam,s-pass,,,\n'));
    assert.equal(rf.items[0].password, 's-pass');
    const bw = await parseImportFile('bitwarden', blob('folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\n,1,login,Mail,,,0,https://mail.test,sam,m-pass,\n,,note,Recipe,flour,,0,,,,\n'));
    assert.equal(bw.items.length, 1);
    assert.equal(bw.items[0].favorite, true);
    assert.equal(bw.skipped[0].count, 1);
});

test('Keeper CSV without a header row is read by position', async () => {
    const r = await parseImportFile('keeper', blob('Work,Jira,sam@acme.test,jira-pass,https://acme.atlassian.net,team login\n'));
    assert.deepEqual({ title: r.items[0].title, identity: r.items[0].identity, password: r.items[0].password, domain: r.items[0].domain }, { title: 'Jira', identity: 'sam@acme.test', password: 'jira-pass', domain: 'https://acme.atlassian.net' });
});

test('A binary file that is not a zip is refused with a plain message', async () => {
    await assert.rejects(parseImportFile('1password', new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 13])])), /doesn't look like a password export/);
});

test('A CSV with no password column gives a clear error', async () => {
    await assert.rejects(parseImportFile('csv', blob('foo,bar\n1,2\n')), /couldn't find a password column/);
});

test('Repeated rows inside one export are imported once', async () => {
    const csv = 'name,url,username,password\nA,https://a.test,sam,p1\nA again,https://www.a.test/login,sam,p1\n';
    const r = await parseImportFile('csv', blob(csv));
    assert.equal(r.items.length, 1);
    assert.equal(r.skipped[0].count, 1);
});

test('Bitwarden JSON: logins, cards, identities, notes; encrypted exports are refused', async () => {
    const json = JSON.stringify({
        encrypted: false,
        items: [
            { type: 1, name: 'GitLab', favorite: true, login: { username: 'sam', password: 'gl-pass', totp: 'otpauth://totp/x', uris: [{ uri: 'https://gitlab.com' }] } },
            { type: 3, name: 'Amex', card: { cardholderName: 'Sam Lee', number: '378282246310005', expMonth: '9', expYear: '2028', code: '1234' } },
            { type: 4, name: 'Me', identity: { firstName: 'Sam', lastName: 'Lee', email: 'sam@acme.test', city: 'Austin' } },
            { type: 2, name: 'Note', notes: 'x' },
        ],
    });
    const r = await parseImportFile('bitwarden', blob(json));
    assert.deepEqual(summarizeImport(r.items), { logins: 1, cards: 1, identities: 1, other: 0 });
    assert.equal(r.items[1].expiry, '09/28');
    assert.deepEqual(r.items[2].fields, { fullName: 'Sam Lee', email: 'sam@acme.test', address: 'Austin' });
    await assert.rejects(parseImportFile('bitwarden', blob('{"encrypted":true,"items":[]}')), /encrypted Bitwarden export/);
});

test('1Password .1pux: logins, passwords, cards, identities; notes and archived items left out', async () => {
    const exportData = {
        accounts: [{
            attrs: { accountName: 'Sam' },
            vaults: [{
                attrs: { name: 'Private' },
                items: [
                    { item: { categoryUuid: '001', favIndex: 1, state: 'active', overview: { title: 'Dropbox', url: 'https://dropbox.com' }, details: { loginFields: [{ value: 'sam@acme.test', designation: 'username', fieldType: 'E' }, { value: 'db-pass', designation: 'password', fieldType: 'P' }], notesPlain: 'shared', sections: [{ fields: [{ id: 'otp', value: { totp: 'otpauth://totp/Dropbox?secret=XYZ' } }] }] } } },
                    { item: { categoryUuid: '005', overview: { title: 'Router' }, details: { password: 'rt-pass', sections: [] } } },
                    { item: { categoryUuid: '002', overview: { title: 'Chase' }, details: { sections: [{ fields: [{ id: 'cardholder', value: { string: 'Sam Lee' } }, { id: 'ccnum', value: { creditCardNumber: '4111111111111111' } }, { id: 'cvv', value: { concealed: '321' } }, { id: 'expiry', value: { monthYear: 202711 } }] }] } } },
                    { item: { categoryUuid: '004', overview: { title: 'Sam' }, details: { sections: [{ fields: [{ id: 'firstname', value: { string: 'Sam' } }, { id: 'lastname', value: { string: 'Lee' } }, { id: 'email', value: { email: 'sam@acme.test' } }] }] } } },
                    { item: { categoryUuid: '003', overview: { title: 'Note' }, details: { notesPlain: 'x' } } },
                    { item: { categoryUuid: '001', state: 'archived', overview: { title: 'Old' }, details: { loginFields: [{ value: 'a', designation: 'username' }, { value: 'b', designation: 'password' }] } } },
                    { item: { categoryUuid: '006', overview: { title: 'Passport scan' }, details: {} } },
                ],
            }],
        }],
    };
    const zip = await makeZip({ 'export.attributes': '{}', 'export.data': JSON.stringify(exportData), 'files/': '' });
    const r = await parseImportFile('1password', zip);
    assert.deepEqual(summarizeImport(r.items), { logins: 2, cards: 1, identities: 1, other: 0 });
    const login = r.items[0];
    assert.equal(login.favorite, true);
    assert.match(login.note ?? '', /^shared\n\nOne-time code secret/);
    assert.equal(r.items.find((i) => i.type === 'card')!.expiry, '11/27');
    assert.deepEqual(r.items.find((i) => i.kind === 'identity')!.fields, { fullName: 'Sam Lee', email: 'sam@acme.test' });
    assert.deepEqual(
        r.skipped.map((s) => s.count),
        [1, 1],
    );
});

test('Dashlane .zip: credentials and payment cards read, secure notes counted as skipped', async () => {
    const zip = await makeZip({
        'credentials.csv': 'username,username2,username3,title,password,note,url,category,otpSecret\nsam,,,Netflix,nf-pass,,https://netflix.com,Entertainment,\n',
        'payments.csv': 'type,account_name,account_holder,cc_number,code,expiration_month,expiration_year,routing_number,account_number,country,issuing_bank,note,name\npayment_card,Visa,Sam Lee,4111111111111111,123,03,2029,,,US,,,Visa\n',
        'securenotes.csv': 'title,note\nA,1\nB,2\n',
    }, false);
    const r = await parseImportFile('dashlane', zip);
    assert.deepEqual(summarizeImport(r.items), { logins: 1, cards: 1, identities: 0, other: 0 });
    assert.equal(r.items.find((i) => i.type === 'card')!.expiry, '03/29');
    assert.equal(r.skipped.find((s) => /notes/.test(s.reason))!.count, 2);
});

test('Proton Pass JSON inside a .zip', async () => {
    const data = { encrypted: false, vaults: { v1: { name: 'Personal', items: [
        { data: { type: 'login', metadata: { name: 'Proton', note: '' }, content: { itemEmail: 'sam@proton.me', itemUsername: '', password: 'pp-pass', urls: ['https://account.proton.me'], totpUri: '' } } },
        { data: { type: 'alias', metadata: { name: 'alias' }, content: {} } },
    ] } } };
    const r = await parseImportFile('proton', await makeZip({ 'Proton Pass/data.json': JSON.stringify(data) }));
    assert.equal(r.items[0].identity, 'sam@proton.me');
    assert.equal(r.skipped[0].count, 1);
});

test('readZip reads stored and deflated entries', async () => {
    const files = await readZip(new Uint8Array(await (await makeZip({ 'a.txt': 'hello', 'b/c.txt': 'world '.repeat(50) })).arrayBuffer()));
    assert.equal(new TextDecoder().decode(files.get('a.txt')), 'hello');
    assert.equal(new TextDecoder().decode(files.get('b/c.txt')).length, 300);
});

test('Vault importItems saves once, skips what is already there, and tags the import', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup('master-password-strong');
    await vault.upsert({ type: 'login', title: 'GitHub', identity: 'sam@acme.test', domain: 'github.com', password: 'gh-pass-1' });

    let writes = 0;
    const set = storage.set.bind(storage);
    storage.set = async (items) => {
        writes++;
        return set(items);
    };
    const r = await parseImportFile('chrome', blob('name,url,username,password\nGitHub,https://github.com/login,sam@acme.test,gh-pass-1\nFigma,https://figma.com,sam,fg-pass\nLinear,https://linear.app,sam,ln-pass\n'));
    const result = await vault.importItems(r.items, { tagName: 'Imported from Chrome' });
    assert.deepEqual(result, { added: 2, duplicates: 1, failed: 0 });
    assert.equal(writes, 1);

    const snapshot = vault.snapshot();
    const tag = snapshot.tags.find((t) => t.name === 'Imported from Chrome')!;
    assert.ok(tag);
    const imported = snapshot.items.filter((i) => i.tagIds.includes(tag.id));
    assert.deepEqual(imported.map((i) => i.title), ['Figma', 'Linear']);
    // Imported items sit above the existing ones, in the export's order.
    assert.deepEqual(snapshot.items.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.title), ['Figma', 'Linear', 'GitHub']);

    // Importing the same file again adds nothing.
    assert.deepEqual(await vault.importItems(r.items, { tagName: 'Imported from Chrome' }), { added: 0, duplicates: 3, failed: 0 });
    assert.equal(vault.snapshot().tags.filter((t) => t.name === 'Imported from Chrome').length, 1);
});

test('Common weak passwords and shared usernames save (no false "leak" alarms)', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup('master-password-strong');
    await vault.upsert({ type: 'login', title: 'GitHub', identity: 'sam@acme.test', password: 'gh-pass-1' });
    // "password" is also a field name in the stored document; "test" is inside "sam@acme.test".
    await vault.upsert({ type: 'login', title: 'Old forum', identity: 'sam', domain: 'forum.test', password: 'password' });
    await vault.upsert({ type: 'login', title: 'Router', identity: 'admin', password: 'test' });
    await vault.upsert({ type: 'custom', kind: 'identity', title: 'Me', identity: 'Sam', fields: { fullName: 'Sam', email: 'sam@acme.test' } });
    assert.equal(vault.list().length, 4);
    const raw = JSON.stringify(await storage.get(['focuzpass.blob.v1', 'focuzpass.meta.v1']));
    for (const secret of ['gh-pass-1', 'forum.test"', '"password":"password"']) assert.ok(!raw.includes(secret), secret);
});

test('The persist check still refuses plaintext secrets', async () => {
    const { assertStoredItemsEncrypted } = await import('./vaultCore');
    const base = { id: 'x', title: 'Site', identity: 'sam', mark: 'S', markTone: '#fff', createdAt: '', updatedAt: '', authMethod: 'PASSWORD' } as const;
    // A secret field written as plain text.
    assert.throws(() => assertStoredItemsEncrypted([{ ...base, type: 'login', password: 'hunter2' } as never], []), /leaked/);
    // An item's own password copied into a clear-text field.
    assert.throws(
        () => assertStoredItemsEncrypted(
            [{ ...base, type: 'login', identity: 'correct-horse-battery', password: { iv: 'a', ct: 'b' } } as never],
            [{ ...base, type: 'login', password: 'correct-horse-battery' } as never],
        ),
        /leaked/,
    );
    assert.doesNotThrow(() => assertStoredItemsEncrypted([{ ...base, type: 'login', password: { iv: 'a', ct: 'b' } } as never], [{ ...base, type: 'login', password: 'hunter2' } as never]));
});

test('A failed import save leaves the vault exactly as it was', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup('master-password-strong');
    await vault.upsert({ type: 'login', title: 'GitHub', identity: 'sam', password: 'gh-pass-1' });
    const set = storage.set.bind(storage);
    storage.set = async () => {
        throw new Error('disk full');
    };
    await assert.rejects(
        vault.importItems([{ type: 'login', title: 'Figma', identity: 'sam', password: 'fg-pass' }], { tagName: 'Imported from X' }),
        /disk full/,
    );
    storage.set = set;
    assert.deepEqual(vault.list().map((i) => i.title), ['GitHub']);
    assert.equal(vault.snapshot().tags.some((t) => t.name === 'Imported from X'), false);
});

test('Real exports: a secret that also shows in the item\'s own text still imports and saves', async () => {
    const storage = createMemoryStorage();
    const vault = new FocuzPassVault(storage);
    await vault.setup('master-password-strong');
    const result = await vault.importItems([
        // Username and password are the same (happens with PINs, API keys, shared logins).
        { type: 'login', title: 'Old router', identity: 'router-admin-2019', domain: '192.168.1.1', password: 'router-admin-2019' },
        // The password is part of the title.
        { type: 'login', title: 'Wi-Fi guest: sunflower-guest-44', identity: 'guest', password: 'sunflower-guest-44' },
        // The card number is in the card's name.
        { type: 'card', title: 'Visa 4111111111111111', identity: 'Sam Lee', cardNumber: '4111111111111111', expiry: '11/27', cvv: '321' },
    ]);
    assert.deepEqual(result, { added: 3, duplicates: 0, failed: 0 });
    // And the vault keeps saving afterwards.
    await vault.upsert({ type: 'login', title: 'GitHub', identity: 'sam', password: 'gh-pass-1' });
    assert.equal(vault.list().length, 4);
    // Secrets that aren't also in visible text stay out of the stored payload.
    const raw = JSON.stringify(await storage.get(['focuzpass.blob.v1', 'focuzpass.meta.v1']));
    assert.ok(!raw.includes('gh-pass-1'));
    assert.ok(!raw.includes('"cvv":"321"'));
});

test('Card numbers with spaces count as the same card when importing', async () => {
    const vault = new FocuzPassVault(createMemoryStorage());
    await vault.setup('master-password-strong');
    await vault.importItems([{ type: 'card', title: 'Visa', identity: 'Sam', cardNumber: '4111 1111 1111 1111' }]);
    assert.deepEqual(await vault.importItems([{ type: 'card', title: 'Visa', identity: 'Sam', cardNumber: '4111111111111111' }]), { added: 0, duplicates: 1, failed: 0 });
});

test('1Password .1pux: the username never falls back to a field holding the password', async () => {
    const pw = 'Tr0ub4dor&3-horse';
    const exportData = {
        accounts: [{ vaults: [{ items: [
            // Saved from a form: no designations; a "confirm password" text field and an email field.
            { item: { categoryUuid: '001', overview: { title: 'Forum', url: 'https://forum.test' }, details: { loginFields: [
                { fieldType: 'T', name: 'confirm_password', value: pw },
                { fieldType: 'E', name: 'email', value: 'sam@forum.test' },
                { fieldType: 'P', name: 'password', value: pw },
            ] } } },
            // Only a text field that is the password: no username rather than showing the password.
            { item: { categoryUuid: '001', overview: { title: 'Kiosk', url: 'https://kiosk.test' }, details: { loginFields: [
                { fieldType: 'T', name: 'pin', value: pw },
                { fieldType: 'P', name: 'pass', value: pw },
            ] } } },
        ] }] }],
    };
    const zip = await makeZip({ 'export.attributes': '{}', 'export.data': JSON.stringify(exportData) });
    const r = await parseImportFile('1password', zip);
    const forum = r.items.find((i) => i.title === 'Forum');
    assert.equal(forum?.identity, 'sam@forum.test');
    for (const item of r.items) assert.notEqual(item.identity, pw, `${item.title} shows the password as its username`);
});

test('The persist check still catches code that copies a secret into clear text', async () => {
    const { assertStoredItemsEncrypted } = await import('./vaultCore');
    const base = { id: 'x', title: 'Site', identity: 'sam', mark: 'S', markTone: '#fff', createdAt: '', updatedAt: '', authMethod: 'PASSWORD' } as const;
    const source = { ...base, type: 'login', password: 'correct-horse-battery' } as never;
    // Stored title/username differ from the item's own: something rewrote clear text.
    assert.throws(() => assertStoredItemsEncrypted([{ ...base, type: 'login', title: 'correct-horse-battery', password: { iv: 'a', ct: 'b' } } as never], [source]), /leaked/);
    // Same clear text as the item itself, secret encrypted: fine even when the user's title contains it.
    const userTitled = { ...base, type: 'login', title: 'pw correct-horse-battery', password: 'correct-horse-battery' } as never;
    assert.doesNotThrow(() => assertStoredItemsEncrypted([{ ...base, type: 'login', title: 'pw correct-horse-battery', password: { iv: 'a', ct: 'b' } } as never], [userTitled]));
});

test('1Password .1pux: bank accounts, Wi-Fi, API keys, SSH keys and more come across as their FocuzPass types', async () => {
    const f = (id: string, title: string, value: Record<string, unknown>) => ({ id, title, value });
    const item = (categoryUuid: string, title: string, fields: ReturnType<typeof f>[], extra: Record<string, unknown> = {}) => ({
        item: { categoryUuid, overview: { title }, details: { sections: [{ title: '', fields }], ...extra } },
    });
    const exportData = {
        accounts: [{ vaults: [{ items: [
            item('101', 'Chase Checking', [
                f('bankName', 'bank name', { string: 'Chase' }),
                f('owner', 'name on account', { string: 'Sam Lee' }),
                f('accountType', 'type', { menu: 'checking' }),
                f('routingNo', 'routing number', { string: '021000021' }),
                f('accountNo', 'account number', { string: '123456789012' }),
                f('iban', 'IBAN', { string: 'GB82WEST12345698765432' }),
                f('telephonePin', 'PIN', { concealed: '4455' }),
            ]),
            item('109', 'Home Wi-Fi', [
                f('name', 'base station name', { string: 'Attic router' }),
                f('password', 'base station password', { concealed: 'admin-pass-77' }),
                f('network_name', 'network name', { string: 'FocuzHouse' }),
                f('wireless_password', 'wireless network password', { concealed: 'wifi-pass-88' }),
            ]),
            item('112', 'Stripe API', [
                f('username', 'username', { string: 'acct_123' }),
                f('credential', 'credential', { concealed: 'sk_live_abcdefgh12345678' }),
                f('type', 'type', { menu: 'bearer' }),
                f('expires', 'expires', { date: 1893456000 }),
            ]),
            item('114', 'Deploy key', [
                f('private_key', 'private key', { sshKey: { privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----', metadata: { publicKey: 'ssh-ed25519 AAAA deploy' } } }),
            ]),
            item('115', 'Cold wallet', [
                f('recoveryPhrase', 'recovery phrase', { concealed: 'abandon ability able about above absent absorb abstract' }),
                f('walletAddress', 'wallet address', { string: 'bc1qxyz' }),
            ]),
            item('106', 'Passport', [f('fullname', 'full name', { string: 'Sam Lee' }), f('number', 'number', { string: 'X1234567' }), f('expiry_date', 'expiry date', { date: 1893456000 })]),
            item('110', 'Build server', [f('url', 'URL', { string: 'https://ci.acme.test' }), f('username', 'username', { string: 'deploy' }), f('password', 'password', { concealed: 'ci-pass-123' }), f('admin_console_url', 'admin console URL', { string: 'https://ci.acme.test/admin' })]),
            item('100', 'Photoshop', [f('reg_name', 'licensed to', { string: 'Sam Lee' }), f('reg_code', 'license key', { string: 'PS-1234-5678-ABCD' }), f('product_version', 'version', { string: '25' })]),
            item('006', 'Scan.pdf', []),
        ] }] }],
    };
    const zip = await makeZip({ 'export.attributes': '{}', 'export.data': JSON.stringify(exportData) });
    const r = await parseImportFile('1password', zip);
    type Custom = { type: string; kind?: string; identity: string; note?: string; fields: Record<string, string> };
    const by = (title: string) => r.items.find((i) => i.title === title) as Custom | undefined;

    const bank = by('Chase Checking');
    assert.equal(bank?.kind, 'bank_account');
    assert.deepEqual(bank?.fields, { bankName: 'Chase', accountHolder: 'Sam Lee', accountType: 'checking', routingNumber: '021000021', accountNumber: '123456789012' });
    assert.equal(bank?.identity, 'Chase');
    assert.match(bank?.note ?? '', /IBAN: GB82WEST12345698765432/);
    assert.match(bank?.note ?? '', /PIN: 4455/);

    const wifi = by('Home Wi-Fi');
    assert.equal(wifi?.kind, 'wireless_router');
    assert.equal(wifi?.fields.password, 'wifi-pass-88');
    assert.equal(wifi?.fields.adminPassword, 'admin-pass-77');
    assert.equal(wifi?.fields.networkName, 'FocuzHouse');
    assert.equal(wifi?.identity, 'FocuzHouse');

    const api = by('Stripe API');
    assert.equal(api?.kind, 'api_credentials');
    assert.equal(api?.fields.password, 'sk_live_abcdefgh12345678');
    assert.equal(api?.fields.expires, '2030-01-01');
    assert.equal(api?.identity, 'acct_123');

    const ssh = by('Deploy key');
    assert.equal(ssh?.kind, 'ssh_key');
    assert.match(ssh?.fields.privateKey ?? '', /BEGIN OPENSSH PRIVATE KEY/);
    assert.equal(ssh?.fields.publicKey, 'ssh-ed25519 AAAA deploy');

    assert.equal(by('Cold wallet')?.fields.recoveryPhrase, 'abandon ability able about above absent absorb abstract');
    assert.equal(by('Passport')?.fields.passportNumber, 'X1234567');

    const server = r.items.find((i) => i.title === 'Build server');
    assert.equal(server?.type, 'login');
    assert.equal(server?.type === 'login' && server.password, 'ci-pass-123');
    assert.match(server?.note ?? '', /admin console URL: https:\/\/ci.acme.test\/admin/);

    const license = by('Photoshop');
    assert.equal(license?.kind, 'password');
    assert.equal(license?.fields.password, 'PS-1234-5678-ABCD');

    // Nothing secret is ever the visible subtitle.
    for (const i of r.items) {
        for (const secret of ['wifi-pass-88', 'admin-pass-77', 'sk_live_abcdefgh12345678', '4455', '123456789012', 'ci-pass-123', 'PS-1234-5678-ABCD']) {
            assert.notEqual(i.identity, secret, `${i.title} subtitle`);
        }
    }
    assert.equal(summarizeImport(r.items).other, 6);
    assert.ok(r.skipped.some((s) => /Documents/.test(s.reason)), 'documents are still left out');

    // And they save.
    const vault = new FocuzPassVault(createMemoryStorage());
    await vault.setup('master-password-strong');
    assert.deepEqual(await vault.importItems(r.items), { added: r.items.length, duplicates: 0, failed: 0 });
});
