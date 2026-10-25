import jsonServer from 'json-server';
import { readFile } from 'node:fs/promises';

// An isolated in-memory server for previews and verification; source fixtures are never mutated.
const seed = JSON.parse(await readFile(new URL('./demo-seed.json', import.meta.url), 'utf8'));
const app = jsonServer.create();
app.use(jsonServer.defaults({ logger: false }));
app.use(jsonServer.bodyParser);
app.use(jsonServer.rewriter({ '/api/v1/*': '/$1' }));
app.use(jsonServer.router(seed));
app.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('VitalTrek in-memory demo API ready.'));
