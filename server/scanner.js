const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MODEL_EXTS = new Set(['.3mf', '.stl']);

function hashId(relPath) {
  return crypto.createHash('sha1').update(relPath).digest('hex').slice(0, 16);
}

function walkFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs));
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

function scan(root, thumbDir) {
  const models = [];
  for (const abs of walkFiles(root)) {
    const ext = path.extname(abs).toLowerCase();
    if (!MODEL_EXTS.has(ext)) continue;
    const relPath = path.relative(root, abs);
    const stat = fs.statSync(abs);
    const id = hashId(relPath);
    const thumbPath = path.join(thumbDir, id + '.png');
    models.push({
      id,
      name: path.basename(relPath),
      relPath,
      dir: path.dirname(relPath),
      ext: ext.slice(1),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      thumbReady: fs.existsSync(thumbPath)
    });
  }

  models.sort((a, b) => a.relPath.localeCompare(b.relPath, 'zh-Hans-CN'));

  const folderSet = new Set(models.map((m) => m.dir));
  const folders = [...folderSet].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

  return {
    root,
    scannedAt: Date.now(),
    modelCount: models.length,
    folders,
    models
  };
}

module.exports = { scan, hashId };
