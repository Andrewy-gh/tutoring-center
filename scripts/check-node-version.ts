import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const expectedNodeVersion = readFileSync(path.resolve(__dirname, '../.node-version'), 'utf8').trim();
const currentNodeVersion = process.versions.node;

if (currentNodeVersion !== expectedNodeVersion) {
  process.stderr.write(`Node ${expectedNodeVersion} is required; found ${currentNodeVersion}.\n`);
  process.exit(1);
}
