/**
 * Dev only (vault.html?demo): the web vault against an in-memory cloud with a sample vault, so the
 * page can be tried and checked without a real account. main.tsx loads this behind
 * import.meta.env.DEV, so production builds leave it out.
 */
import { FocuzPassVault, createMemoryStorage } from '@focuz/lib/focuzPass/vaultCore';
import { createMemoryCloud, memoryCloudStore, type CloudStore } from '@focuz/lib/focuzPass/cloud/store';

export const DEMO_MASTER_PASSWORD = 'demo-master-1';

export async function demoCloud(): Promise<{ store: CloudStore; email: string; secretKey: string }> {
    const userId = '0d3b6f1e-0000-4000-8000-00000000de30';
    const cloud = createMemoryCloud();
    cloud.users.set(userId, { email: 'maya@focuznow.com', pro: true });
    const store = memoryCloudStore(cloud, () => userId);
    const vault = new FocuzPassVault(createMemoryStorage());
    await vault.setup(DEMO_MASTER_PASSWORD);
    const work = await vault.createVault({ name: 'Work', color: '#4e91da', icon: 'vault' });
    const finance = await vault.createTag({ name: 'Finance', color: '#e0af68', icon: 'tag' });
    await vault.upsert({ type: 'login', title: 'GitHub', identity: 'maya@focuznow.com', domain: 'github.com', password: 'kX9!mQ2#vL7p', vaultId: work.id });
    await vault.upsert({ type: 'login', title: 'Linear', identity: 'maya', domain: 'linear.app', password: 'river-cobalt-88', vaultId: work.id });
    await vault.upsert({ type: 'login', title: 'Notion', identity: 'maya@focuznow.com', domain: 'notion.so', password: 'Notion-2026-maya', note: 'Team workspace: FocuzNow' });
    await vault.upsert({ type: 'card', title: 'Amex Gold', identity: 'Maya Chen', cardNumber: '378282246310005', expiry: '09/28', cvv: '4821', tagIds: [finance.id] });
    await vault.upsert({ type: 'custom', kind: 'wireless_router', title: 'Home Wi-Fi', identity: 'FocuzHouse', fields: { networkName: 'FocuzHouse', wifiPassword: 'quiet-maple-41' } });
    await vault.upsert({ type: 'custom', kind: 'bank_account', title: 'Chase Checking', identity: 'Maya Chen', fields: { bankName: 'Chase', accountNumber: '000123456789', routingNumber: '021000021' }, tagIds: [finance.id] });
    const kit = await vault.prepareCloud(DEMO_MASTER_PASSWORD, { id: userId, email: 'maya@focuznow.com' });
    await vault.enableCloud(store);
    return { store, email: 'maya@focuznow.com', secretKey: kit.secretKey };
}
