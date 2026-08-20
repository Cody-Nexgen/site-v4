import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = globSync('src/lib/**/*.test.ts', { cwd: root }).map((file) => path.join(root, file));

if (files.length === 0) {
    console.error('No test files found');
    process.exit(1);
}

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
});

process.exit(result.status ?? 1);
