import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/focuz');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

let updated = 0;
for (const file of walk(root)) {
  const original = fs.readFileSync(file, 'utf8');
  const next = original
    .replaceAll("from '@/", "from '@focuz/")
    .replaceAll('from "@/', 'from "@focuz/');
  if (next !== original) {
    fs.writeFileSync(file, next);
    updated += 1;
  }
}

console.log(`updated ${updated} files`);
