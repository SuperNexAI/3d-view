const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const JSZip = require('jszip');

const THUMB_CANDIDATES = [
  'Auxiliaries/.thumbnails/thumbnail_3mf.png',
  'Auxiliaries/.thumbnails/thumbnail_middle.png',
  'Auxiliaries/.thumbnails/thumbnail_small.png',
  'Metadata/plate_1.png',
  'Metadata/plate_1_small.png',
  'Metadata/top_1.png',
  'Metadata/plate_no_light_1.png',
  'Metadata/pick_1.png'
];

async function extractThumbFrom3mf(absPath) {
  const data = await fs.promises.readFile(absPath);
  let zip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch (e) {
    return extractThumbViaPython(absPath);
  }
  for (const name of THUMB_CANDIDATES) {
    const entry = zip.file(name);
    if (!entry) continue;
    try {
      const buf = await entry.async('nodebuffer');
      if (buf && buf.length > 0) return buf;
    } catch (e) {
      continue;
    }
  }
  return null;
}

async function getOrCreateThumb(model, absPath, thumbPath) {
  if (fs.existsSync(thumbPath)) {
    return fs.promises.readFile(thumbPath);
  }
  if (model.ext !== '3mf') return null;
  const buf = await extractThumbFrom3mf(absPath);
  if (buf) {
    await fs.promises.writeFile(thumbPath, buf);
  }
  return buf;
}

function extractThumbViaPython(absPath) {
  return new Promise((resolve) => {
    const tmp = path.join(os.tmpdir(), 'thumb-' + Date.now() + '-' + Math.random().toString(16).slice(2) + '.png');
    const script = path.join(__dirname, 'extract_thumb.py');
    execFile('python3', [script, absPath, tmp], { timeout: 30000 }, (err) => {
      if (err) {
        fs.promises.unlink(tmp).catch(() => {});
        return resolve(null);
      }
      fs.promises.readFile(tmp)
        .then((buf) => {
          fs.promises.unlink(tmp).catch(() => {});
          resolve(buf && buf.length > 0 ? buf : null);
        })
        .catch(() => resolve(null));
    });
  });
}

module.exports = { getOrCreateThumb, extractThumbFrom3mf };
