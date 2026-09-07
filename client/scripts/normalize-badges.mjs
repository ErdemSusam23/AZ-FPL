import { readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const badgeDirectory = join(currentDirectory, '..', 'public', 'badges');
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const canvasSize = 256;
const crestSize = 224;

const filenames = (await readdir(badgeDirectory)).filter((filename) => filename.endsWith('.webp'));

await Promise.all(filenames.map(async (filename) => {
  const filepath = join(badgeDirectory, filename);
  const normalized = await sharp(filepath)
    .trim({ background: transparent })
    .resize(crestSize, crestSize, { fit: 'contain', background: transparent })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: transparent })
    .webp({ quality: 95, alphaQuality: 100 })
    .toBuffer();

  await writeFile(filepath, normalized);
}));

console.log(`${filenames.length} rozet ${canvasSize}×${canvasSize} kanvasa normalize edildi.`);
