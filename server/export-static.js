const fs = require('fs');
const path = require('path');

const { scan } = require('./scanner');
const { extractThumbFrom3mf } = require('./thumbs');

const DEFAULT_ROOT = '/Volumes/DATA（2TB）/macbook/3d打印/labubu74G大合集';
const MODEL_ROOT = process.env.MODEL_ROOT || DEFAULT_ROOT;

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const THUMB_DIR = path.join(CACHE_DIR, 'thumbs');
const SITE_DIR = path.join(__dirname, '..', 'site');
const SITE_THUMB_DIR = path.join(SITE_DIR, 'thumbs');

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function dirSize(dir) {
  let total = 0;
  for (const name of fs.readdirSync(dir)) {
    total += fs.statSync(path.join(dir, name)).size;
  }
  return total;
}

async function main() {
  if (!fs.existsSync(MODEL_ROOT)) {
    throw new Error('模型目录不存在：' + MODEL_ROOT);
  }
  fs.mkdirSync(SITE_THUMB_DIR, { recursive: true });

  const { models, folders } = scan(MODEL_ROOT, THUMB_DIR);

  const outModels = [];
  const missing = [];
  let ready = 0;

  for (const model of models) {
    const cached = path.join(THUMB_DIR, model.id + '.png');
    const destPath = path.join(SITE_THUMB_DIR, model.id + '.png');
    let ok = false;

    if (fs.existsSync(cached)) {
      fs.copyFileSync(cached, destPath);
      ok = true;
    } else if (model.ext === '3mf') {
      const absPath = path.join(MODEL_ROOT, model.relPath);
      let buf = null;
      try {
        buf = await extractThumbFrom3mf(absPath);
      } catch (e) {
        buf = null;
      }
      if (buf) {
        fs.writeFileSync(cached, buf);
        fs.writeFileSync(destPath, buf);
        ok = true;
      }
    }

    if (ok) ready++;
    else missing.push(model.ext.toUpperCase() + ' | ' + model.relPath);

    outModels.push({
      id: model.id,
      name: model.name,
      dir: model.dir,
      ext: model.ext,
      size: model.size,
      thumbReady: ok
    });
  }

  const index = {
    generatedAt: Date.now(),
    modelCount: outModels.length,
    folders,
    models: outModels
  };
  fs.writeFileSync(path.join(SITE_DIR, 'index.json'), JSON.stringify(index));

  console.log('导出目录：' + SITE_DIR);
  console.log('模型总数：' + outModels.length);
  console.log('缩略图：' + ready + ' 张，缺失：' + missing.length + ' 张');
  console.log('缩略图总体积：' + formatSize(dirSize(SITE_THUMB_DIR)));
  if (missing.length) {
    console.log('\n缺少缩略图的模型：');
    for (const line of missing) console.log('  ' + line);
  }
}

main().catch((e) => {
  console.error('导出失败：' + e.message);
  process.exit(1);
});
