const express = require('express');
const path = require('path');
const fs = require('fs');

const { scan } = require('./scanner');
const { getOrCreateThumb } = require('./thumbs');

const DEFAULT_ROOT = '/Volumes/DATA（2TB）/macbook/3d打印/labubu74G大合集';
const MODEL_ROOT = process.env.MODEL_ROOT || DEFAULT_ROOT;
const PORT = Number(process.env.PORT || 3000);

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const THUMB_DIR = path.join(CACHE_DIR, 'thumbs');
const INDEX_PATH = path.join(CACHE_DIR, 'index.json');

let index = null;

function refreshThumbReadyFlags(idx) {
  for (const m of idx.models) {
    m.thumbReady = fs.existsSync(path.join(THUMB_DIR, m.id + '.png'));
  }
  return idx;
}

function loadIndex(force) {
  if (!force && index) return index;
  if (!fs.existsSync(MODEL_ROOT)) {
    throw new Error('模型目录不存在：' + MODEL_ROOT);
  }
  fs.mkdirSync(THUMB_DIR, { recursive: true });

  if (force || !fs.existsSync(INDEX_PATH)) {
    index = scan(MODEL_ROOT, THUMB_DIR);
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index));
  } else {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    refreshThumbReadyFlags(index);
  }
  return index;
}

function findModel(id) {
  return loadIndex().models.find((m) => m.id === id);
}

const app = express();

app.get('/api/index', (req, res) => {
  try {
    res.json(loadIndex());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/rescan', (req, res) => {
  try {
    const idx = loadIndex(true);
    res.json({ ok: true, modelCount: idx.modelCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/thumb/:id', async (req, res) => {
  const model = findModel(req.params.id);
  if (!model) return res.status(404).end();
  const absPath = path.join(index.root, model.relPath);
  const thumbPath = path.join(THUMB_DIR, model.id + '.png');
  try {
    const buf = await getOrCreateThumb(model, absPath, thumbPath);
    if (buf) {
      model.thumbReady = true;
      res.type('png').send(buf);
    } else {
      res.status(404).end();
    }
  } catch (e) {
    console.error('提取缩略图失败:', model.relPath, e.message);
    res.status(500).end();
  }
});

app.post('/api/thumb/:id', express.raw({ type: 'image/png', limit: '15mb' }), async (req, res) => {
  const model = findModel(req.params.id);
  if (!model) return res.status(404).end();
  if (!req.body || !req.body.length) return res.status(400).end();
  const thumbPath = path.join(THUMB_DIR, model.id + '.png');
  try {
    await fs.promises.writeFile(thumbPath, req.body);
    model.thumbReady = true;
    res.json({ ok: true });
  } catch (e) {
    console.error('保存缩略图失败:', model.relPath, e.message);
    res.status(500).end();
  }
});

app.get('/api/file/:id', (req, res) => {
  const model = findModel(req.params.id);
  if (!model) return res.status(404).end();
  const absPath = path.join(index.root, model.relPath);
  res.sendFile(absPath, (err) => {
    if (err) {
      res.status(404).end();
    }
  });
});

app.use('/vendor/three', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build')));
app.use('/vendor/three/examples', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'examples', 'jsm')));
app.use(express.static(path.join(__dirname, '..', 'public')));

try {
  loadIndex();
  console.log(`已加载索引：${index.modelCount} 个模型`);
  console.log(`模型目录：${MODEL_ROOT}`);
} catch (e) {
  console.warn(`启动警告：${e.message}`);
}

app.listen(PORT, () => {
  console.log(`缩略图浏览器已启动：http://localhost:${PORT}`);
});
