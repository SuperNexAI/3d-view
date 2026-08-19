import { renderStlToPng } from './stl.js';

const state = {
  index: null,
  modelMap: new Map(),
  currentFolder: '',
  query: ''
};

const els = {
  search: document.getElementById('search'),
  rescan: document.getElementById('rescan'),
  folders: document.getElementById('folders'),
  gallery: document.getElementById('gallery'),
  count: document.getElementById('count'),
  status: document.getElementById('status'),
  empty: document.getElementById('empty'),
  lightbox: document.getElementById('lightbox'),
  lbImg: document.getElementById('lb-img'),
  lbInfo: document.getElementById('lb-info')
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

async function loadIndex() {
  const resp = await fetch('/api/index');
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || '无法加载索引');
  }
  const data = await resp.json();
  state.index = data;
  state.modelMap = new Map(data.models.map((m) => [m.id, m]));
}

function buildFolderTree(folders) {
  const root = new Map();
  for (const f of folders) {
    const parts = f.split('/').filter(Boolean);
    let node = root;
    for (const part of parts) {
      if (!node.has(part)) node.set(part, new Map());
      node = node.get(part);
    }
  }
  return root;
}

function makeFolderItem(name, path, depth) {
  const div = document.createElement('div');
  div.className = 'folder-item' + (path === state.currentFolder ? ' active' : '');
  div.style.paddingLeft = (8 + depth * 12) + 'px';
  div.textContent = name;
  div.title = path;
  div.addEventListener('click', () => {
    state.currentFolder = path;
    renderFolders();
    renderGallery();
  });
  return div;
}

function renderFolders() {
  els.folders.innerHTML = '';
  els.folders.appendChild(makeFolderItem('全部模型', '', 0));
  const tree = buildFolderTree(state.index.folders);
  const render = (node, prefix, depth) => {
    for (const [name, children] of node) {
      const path = prefix ? prefix + '/' + name : name;
      els.folders.appendChild(makeFolderItem(name, path, depth));
      if (children.size) render(children, path, depth + 1);
    }
  };
  render(tree, '', 1);
}

function filteredModels() {
  const q = state.query.trim().toLowerCase();
  return state.index.models.filter((m) => {
    if (state.currentFolder) {
      if (!(m.dir === state.currentFolder || m.dir.startsWith(state.currentFolder + '/'))) return false;
    }
    if (q) {
      return m.name.toLowerCase().includes(q) || m.relPath.toLowerCase().includes(q);
    }
    return true;
  });
}

function renderGallery() {
  const list = filteredModels();
  els.count.textContent = `${list.length} / ${state.index.modelCount} 个模型`;
  els.empty.classList.toggle('hidden', list.length > 0);

  const html = list.map((m) => {
    const isPendingStl = m.ext === 'stl' && !m.thumbReady;
    const img = isPendingStl
      ? '<img loading="lazy" decoding="async" alt="">'
      : `<img src="/api/thumb/${m.id}" loading="lazy" decoding="async" alt="${escapeHtml(m.name)}">`;
    const thumbClass = isPendingStl ? 'thumb pending' : 'thumb';
    const label = isPendingStl ? ` data-label="${m.ext.toUpperCase()}"` : '';
    return `<div class="card" data-id="${m.id}">
      <div class="${thumbClass}"${label}>${img}</div>
      <div class="card-name" title="${escapeHtml(m.relPath)}">${escapeHtml(m.name)}</div>
    </div>`;
  }).join('');

  els.gallery.innerHTML = html;
  observeStlPending();
}

const stlQueue = [];
let stlActive = 0;

function enqueueStl(fn) {
  stlQueue.push(fn);
  pumpStl();
}

function pumpStl() {
  while (stlActive < 2 && stlQueue.length) {
    stlActive++;
    const fn = stlQueue.shift();
    fn().catch(() => {}).finally(() => {
      stlActive--;
      pumpStl();
    });
  }
}

async function renderStlThumb(model, thumb) {
  const resp = await fetch('/api/file/' + model.id);
  if (!resp.ok) throw new Error('无法读取模型文件');
  const buf = await resp.arrayBuffer();
  const png = await renderStlToPng(buf, 320);
  const img = thumb.querySelector('img');
  img.src = png;
  thumb.classList.remove('pending');
  model.thumbReady = true;

  const blob = await (await fetch(png)).blob();
  await fetch('/api/thumb/' + model.id, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: blob
  });
}

const stlObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const thumb = entry.target;
    stlObserver.unobserve(thumb);
    const card = thumb.closest('.card');
    if (!card) continue;
    const model = state.modelMap.get(card.dataset.id);
    if (!model || model.ext !== 'stl' || model.thumbReady) continue;
    enqueueStl(() => renderStlThumb(model, thumb));
  }
}, { rootMargin: '300px' });

function observeStlPending() {
  els.gallery.querySelectorAll('.thumb.pending').forEach((el) => stlObserver.observe(el));
}

function openLightbox(card) {
  const model = state.modelMap.get(card.dataset.id);
  if (!model) return;
  const img = card.querySelector('img');
  const src = img.getAttribute('src');
  if (src) {
    els.lbImg.src = src;
    els.lbImg.alt = model.name;
  } else {
    els.lbImg.removeAttribute('src');
    els.lbImg.alt = model.name + '（渲染中）';
  }
  els.lbInfo.textContent = `${model.relPath}\n格式：${model.ext.toUpperCase()} · 大小：${formatSize(model.size)}`;
  els.lightbox.classList.remove('hidden');
}

function closeLightbox() {
  els.lightbox.classList.add('hidden');
  els.lbImg.removeAttribute('src');
}

function bindEvents() {
  let timer = null;
  els.search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.query = els.search.value;
      renderGallery();
    }, 180);
  });

  els.rescan.addEventListener('click', async () => {
    els.rescan.disabled = true;
    els.status.textContent = '正在扫描…';
    try {
      const resp = await fetch('/api/rescan', { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || '扫描失败');
      await loadIndex();
      state.currentFolder = '';
      els.search.value = '';
      state.query = '';
      renderFolders();
      renderGallery();
      els.status.textContent = `已重新索引 ${data.modelCount} 个模型`;
    } catch (e) {
      els.status.textContent = '扫描失败：' + e.message;
    } finally {
      els.rescan.disabled = false;
    }
  });

  els.gallery.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) openLightbox(card);
  });

  els.lightbox.querySelector('.lb-close').addEventListener('click', closeLightbox);
  els.lightbox.querySelector('.lb-backdrop').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

async function init() {
  try {
    els.status.textContent = '正在加载索引…';
    await loadIndex();
    renderFolders();
    renderGallery();
    els.status.textContent = `已索引 ${state.index.modelCount} 个模型 · ${state.index.folders.length} 个目录`;
  } catch (e) {
    els.status.textContent = '加载失败：' + e.message;
    els.empty.textContent = '加载失败：' + e.message;
    els.empty.classList.remove('hidden');
  }
  bindEvents();
}

init();
