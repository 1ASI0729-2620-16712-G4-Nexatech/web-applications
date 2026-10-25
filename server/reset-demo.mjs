import { copyFile } from 'node:fs/promises';
await copyFile(new URL('./demo-seed.json', import.meta.url), new URL('./db.json', import.meta.url));
console.log('Demo database reset. Previously saved json-server changes were replaced.');
