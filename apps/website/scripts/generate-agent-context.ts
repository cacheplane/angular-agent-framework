import fs from 'fs';
import path from 'path';

// Read version from library package.json (not website)
const libPkgPath = path.join(__dirname, '..', '..', '..', 'libs', 'angular', 'package.json');
let version = '0.1.0';
if (fs.existsSync(libPkgPath)) {
  const libPkg = JSON.parse(fs.readFileSync(libPkgPath, 'utf8')) as { version?: string };
  version = libPkg.version ?? version;
}

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function generate(templateFile: string, outFile: string): void {
  const templatePath = path.join(CONTENT_DIR, templateFile);
  if (!fs.existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    process.exit(1);
  }
  const template = fs.readFileSync(templatePath, 'utf8');
  const output = template.replace(/@VERSION@/g, version);
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DIR, outFile), output);
  console.log(`✓ ${outFile} (v${version})`);
}

generate('CLAUDE.md.template', 'CLAUDE.md');
generate('AGENTS.md.template', 'AGENTS.md');
