const state = {
  index: null,
  modelMap: new Map(),
  currentFolder: '',
  query: ''
};

const els = {
  search: document.getElementById('search'),
  folders: document.getElementById('folders'),
  gallery: document.getElementById('gallery'),
  count: document.getElementById('count'),
  status: document.getElementById('status'),
  empty: document.getElementById('empty'),
  lightbox: document.getElementById('lightbox'),
  lbImg: document.getElementById('lb-img'),
  lbInfo: document.getElementById('lb-info'),
  sizeCtl: document.querySelector('.size-ctl')
};

function applySize(size) {
  state.size = size;
  els.gallery.classList.remove('size-s', 'size-m', 'size-l');
  els.gallery.classList.add('size-' + size);
  els.sizeCtl.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.size === size));
  localStorage.setItem('thumbSize', size);
}

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

function displayPath(m) {
  return (m.dir && m.dir !== '.') ? m.dir + '/' + m.name : m.name;
}

async function loadIndex() {
  const resp = await fetch('./index.json', { cache: 'no-cache' });
  if (!resp.ok) throw new Error('无法加载 index.json');
  const data = await resp.json();
  state.index = data;
  state.modelMap = new Map(data.models.map((m) => [m.id, m]));
}

function buildFolderTree(folders) {
  const root = new Map();
  for (const f of folders) {
    const parts = f.split('/').filter((p) => p && p !== '.');
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
  const tree = buildFolderTree(state.index.folders || []);
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
      return (m.name + ' ' + m.dir).toLowerCase().includes(q);
    }
    return true;
  });
}

function renderGallery() {
  const list = filteredModels();
  els.count.textContent = `${list.length} / ${state.index.modelCount} 个模型`;
  els.empty.classList.toggle('hidden', list.length > 0);

  const html = list.map((m) => {
    const img = m.thumbReady
      ? `<img src="thumbs/${m.id}.png" loading="lazy" decoding="async" alt="">`
      : '';
    const fallback = `<div class="thumb-fallback"><span class="badge">${escapeHtml(m.ext.toUpperCase())}</span><span class="fname">${escapeHtml(m.name)}</span></div>`;
    return `<div class="card" data-id="${m.id}">
      <div class="thumb">${img}${fallback}</div>
      <div class="card-name" title="${escapeHtml(displayPath(m))}">${escapeHtml(m.name)}</div>
    </div>`;
  }).join('');

  els.gallery.innerHTML = html;

  els.gallery.querySelectorAll('.thumb img').forEach((img) => {
    img.addEventListener('error', () => img.classList.add('img-error'));
  });
}

function openLightbox(card) {
  const model = state.modelMap.get(card.dataset.id);
  if (!model) return;
  if (model.thumbReady) {
    els.lbImg.src = 'thumbs/' + model.id + '.png';
    els.lbImg.alt = model.name;
    els.lbImg.classList.remove('hidden');
  } else {
    els.lbImg.removeAttribute('src');
    els.lbImg.classList.add('hidden');
  }
  els.lbInfo.textContent = `${displayPath(model)}\n格式：${model.ext.toUpperCase()} · 大小：${formatSize(model.size)}`;
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

  els.gallery.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) openLightbox(card);
  });

  els.sizeCtl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) applySize(btn.dataset.size);
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
    applySize(localStorage.getItem('thumbSize') || 'm');
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
