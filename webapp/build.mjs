import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const webappDir = dirname(fileURLToPath(import.meta.url));
const libDir = join(webappDir, 'lib');
const srcIndex = join(webappDir, '..', 'src', 'index.ts');

if (existsSync(libDir)) rmSync(libDir, { recursive: true });
mkdirSync(libDir, { recursive: true });

execSync(`npx tsc -p "${join(webappDir, 'tsconfig.webapp.json')}"`, {
  stdio: 'inherit',
  cwd: join(webappDir, '..'),
});

const indexBlacklist = /\n\s*const\s+o\s*=\s*date_tz[\s\S]*/m;

function patchFile(path) {
  let content = readFileSync(path, 'utf8');
  content = content.replace(/from\s+(["'])(\.{1,2}\/[^"']+)\1/g, (m, q, p) => {
    if (p.endsWith('.js')) return m;
    return `from ${q}${p}.js${q}`;
  });
  writeFileSync(path, content);
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) patchFile(full);
  }
}

walk(libDir);

const indexJs = join(libDir, 'index.js');
if (existsSync(indexJs)) {
  let content = readFileSync(indexJs, 'utf8');
  content = content.replace(/export\s*\*\s*from\s*(["'])(\.[^"']+)(\.js)?\1\s*;?/g,
    (_, q, p) => `export * from ${q}${p.endsWith('.js') ? p : p + '.js'}${q};`);
  content = content.split('\n').filter(l => !/DateTz\.parse|DateTz\.now|\.compare\(n\)|console\.log/.test(l)).join('\n');
  writeFileSync(indexJs, content);
}

console.log('Webapp library built at:', libDir);
