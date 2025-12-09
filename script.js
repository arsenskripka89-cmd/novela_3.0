const canvas = document.getElementById('canvas');
const sceneList = document.getElementById('scene-list');
const addSceneBtn = document.getElementById('add-scene');
const insertImageBtn = document.getElementById('insert-image');
const inspectorContent = document.getElementById('inspector-content');
const connectionsSvg = document.getElementById('connections');
const exportJsonBtn = document.getElementById('export-json');
const exportHtmlBtn = document.getElementById('export-html');
const imageFileInput = document.getElementById('image-file-input');

let scenes = [];
let selectedSceneId = null;
let looseImages = [];

const DEFAULT_IMAGE_SIZE = 220;

const storageKey = 'novella-scenes';

function uid() {
  return crypto.randomUUID();
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({ scenes, looseImages }));
}

function loadState() {
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      scenes = parsed;
      looseImages = [];
    } else {
      scenes = parsed.scenes || [];
      looseImages = parsed.looseImages || [];
    }
    scenes.forEach(renderScene);
    renderLooseImages();
    updateSceneList();
    refreshConnections();
  }
}

function fitImageSize(width, height, maxWidth, maxHeight) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function imagePlacementPosition(scene, dropPosition) {
  if (scene) {
    const frame = document.querySelector(`[data-id="${scene.id}"]`);
    if (frame && dropPosition) {
      const frameRect = frame.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      return {
        x: dropPosition.x - (frameRect.left - canvasRect.left),
        y: dropPosition.y - (frameRect.top - canvasRect.top),
      };
    }
    return { x: scene.width / 2, y: scene.height / 2 };
  }
  const canvasRect = canvas.getBoundingClientRect();
  if (dropPosition) return dropPosition;
  return { x: canvasRect.width / 2, y: canvasRect.height / 2 };
}

function createLooseImageElement(layer) {
  const el = document.createElement('div');
  el.className = 'layer image-layer loose-image';
  el.style.left = `${layer.x}px`;
  el.style.top = `${layer.y}px`;
  el.style.width = `${layer.width}px`;
  el.style.height = `${layer.height}px`;
  el.innerHTML = `<img src="${layer.src}" alt="Зображення" />`;
  canvas.appendChild(el);
  enableLayerDrag(el, layer);
}

function renderLooseImages() {
  document.querySelectorAll('.loose-image').forEach((el) => el.remove());
  looseImages.forEach(createLooseImageElement);
}

function addImageLayer(src, naturalWidth, naturalHeight, sceneId = null, dropPosition = null) {
  const scene = sceneId ? scenes.find((s) => s.id === sceneId) : scenes.find((s) => s.id === selectedSceneId);
  if (scene) {
    const targetSize = fitImageSize(naturalWidth, naturalHeight, scene.width - 40, scene.height - 60);
    const { x, y } = imagePlacementPosition(scene, dropPosition);
    const layerState = {
      id: uid(),
      type: 'image',
      src,
      x: Math.max(0, x - targetSize.width / 2),
      y: Math.max(0, y - targetSize.height / 2),
      width: targetSize.width,
      height: targetSize.height,
    };
    scene.layers.push(layerState);
    renderScene(scene);
    saveState();
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const targetSize = fitImageSize(naturalWidth, naturalHeight, DEFAULT_IMAGE_SIZE, DEFAULT_IMAGE_SIZE);
  const { x, y } = imagePlacementPosition(null, dropPosition);
  looseImages.push({
    id: uid(),
    src,
    x: Math.min(Math.max(0, x - targetSize.width / 2), canvasRect.width - targetSize.width),
    y: Math.min(Math.max(0, y - targetSize.height / 2), canvasRect.height - targetSize.height),
    width: targetSize.width,
    height: targetSize.height,
  });
  renderLooseImages();
  saveState();
}

function placeImageFromFile(file, dropPosition, sceneId = null) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const src = e.target.result;
    const img = new Image();
    img.onload = () => addImageLayer(src, img.naturalWidth, img.naturalHeight, sceneId, dropPosition);
    img.src = src;
  };
  reader.readAsDataURL(file);
}

function createScene() {
  const id = uid();
  const newScene = {
    id,
    title: 'Нова сцена',
    x: 60 + scenes.length * 40,
    y: 60 + scenes.length * 40,
    width: 260,
    height: 240,
    body: 'Подвійний клік для редагування тексту…',
    background: '#ffffff',
    layers: [],
    choices: [],
  };
  scenes.push(newScene);
  renderScene(newScene);
  updateSceneList();
  selectScene(id);
  saveState();
}

function renderScene(scene) {
  let el = canvas.querySelector(`[data-id="${scene.id}"]`);
  if (!el) {
    const tmpl = document.getElementById('scene-template').content.cloneNode(true);
    el = tmpl.querySelector('.scene-frame');
    canvas.appendChild(el);
  }
  el.dataset.id = scene.id;
  el.style.transform = `translate(${scene.x}px, ${scene.y}px)`;
  el.style.width = `${scene.width}px`;
  el.style.height = `${scene.height}px`;
  el.style.background = scene.background;

  const titleInput = el.querySelector('.scene-title');
  const body = el.querySelector('.scene-body');
  const choicesContainer = el.querySelector('.scene-choices');

  titleInput.value = scene.title;
  body.innerHTML = scene.body;

  titleInput.oninput = (e) => {
    scene.title = e.target.value;
    updateSceneList();
    refreshConnections();
    saveState();
  };

  body.oninput = (e) => {
    scene.body = e.target.innerHTML;
    saveState();
  };

  el.querySelector('.add-choice').onclick = () => {
    const choiceId = uid();
    scene.choices.push({ id: choiceId, text: 'Новий вибір', target: scenes[0]?.id || null });
    renderScene(scene);
    refreshConnections();
    saveState();
  };

  el.querySelector('.add-text').onclick = () => {
    const textLayer = document.getElementById('text-layer-template').content.cloneNode(true).firstElementChild;
    textLayer.style.left = '20px';
    textLayer.style.top = '150px';
    el.appendChild(textLayer);
    scene.layers.push({ id: uid(), type: 'text', content: 'Новий текст', x: 20, y: 150, width: 120, height: 40 });
    enableLayerDrag(textLayer, scene.layers.at(-1));
    saveState();
  };

  el.querySelector('.add-image').onclick = () => {
    const imgLayer = document.getElementById('image-layer-template').content.cloneNode(true).firstElementChild;
    imgLayer.style.left = '40px';
    imgLayer.style.top = '150px';
    el.appendChild(imgLayer);
    const layerState = { id: uid(), type: 'image', src: '', x: 40, y: 150, width: 180, height: 140 };
    scene.layers.push(layerState);
    imgLayer.querySelector('.apply-image').onclick = () => {
      const url = imgLayer.querySelector('.image-url').value.trim();
      if (url) {
        layerState.src = url;
        imgLayer.innerHTML = `<img src="${url}" alt="Зображення" />`;
        saveState();
      }
    };
    enableLayerDrag(imgLayer, layerState);
    saveState();
  };

  enableFrameInteraction(el, scene);
  renderChoices(scene, choicesContainer);
  renderLayers(scene, el);

  el.onclick = (e) => {
    e.stopPropagation();
    selectScene(scene.id);
  };
}

function renderLayers(scene, frameEl) {
  frameEl.querySelectorAll('.layer').forEach((n) => n.remove());
  scene.layers.forEach((layer) => {
    let layerEl;
    if (layer.type === 'text') {
      layerEl = document.createElement('div');
      layerEl.className = 'layer text-layer';
      layerEl.contentEditable = 'true';
      layerEl.innerHTML = layer.content;
      layerEl.oninput = () => {
        layer.content = layerEl.innerHTML;
        saveState();
      };
    } else if (layer.type === 'image') {
      layerEl = document.createElement('div');
      layerEl.className = 'layer image-layer';
      if (layer.src) {
        layerEl.innerHTML = `<img src="${layer.src}" alt="Зображення" />`;
      } else {
        layerEl.innerHTML = '<div>URL зображення ще не вказано</div>';
      }
    }
    if (!layerEl) return;
    layerEl.style.left = `${layer.x}px`;
    layerEl.style.top = `${layer.y}px`;
    layerEl.style.width = `${layer.width}px`;
    layerEl.style.height = `${layer.height}px`;
    frameEl.appendChild(layerEl);
    enableLayerDrag(layerEl, layer);
  });
}

function enableLayerDrag(el, layer) {
  interact(el)
    .draggable({
      modifiers: [interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true })],
      listeners: {
        move(event) {
          const x = (parseFloat(el.dataset.x) || layer.x || 0) + event.dx;
          const y = (parseFloat(el.dataset.y) || layer.y || 0) + event.dy;
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.dataset.x = x;
          el.dataset.y = y;
        },
        end() {
          const x = parseFloat(el.dataset.x) || 0;
          const y = parseFloat(el.dataset.y) || 0;
          layer.x = x;
          layer.y = y;
          el.style.left = `${layer.x}px`;
          el.style.top = `${layer.y}px`;
          el.style.transform = 'none';
          el.dataset.x = 0;
          el.dataset.y = 0;
          saveState();
        },
      },
    })
    .resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      listeners: {
        move(event) {
          const { x, y } = event.target.dataset;
          const newX = (parseFloat(x) || 0) + event.deltaRect.left;
          const newY = (parseFloat(y) || 0) + event.deltaRect.top;
          layer.width = event.rect.width;
          layer.height = event.rect.height;
          layer.x = newX;
          layer.y = newY;
          Object.assign(event.target.style, {
            width: `${event.rect.width}px`,
            height: `${event.rect.height}px`,
            transform: `translate(${newX}px, ${newY}px)`,
          });
        },
        end(event) {
          const target = event.target;
          const x = parseFloat(target.dataset.x) || 0;
          const y = parseFloat(target.dataset.y) || 0;
          layer.x = x;
          layer.y = y;
          target.style.left = `${x}px`;
          target.style.top = `${y}px`;
          target.style.transform = 'none';
          saveState();
        },
      },
      modifiers: [interact.modifiers.restrictEdges({ outer: 'parent' })],
    });
}

function enableFrameInteraction(el, scene) {
  interact(el)
    .draggable({
      listeners: {
        move(event) {
          const x = (parseFloat(el.dataset.x) || scene.x) + event.dx;
          const y = (parseFloat(el.dataset.y) || scene.y) + event.dy;
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.dataset.x = x;
          el.dataset.y = y;
          refreshConnections();
        },
        end() {
          const x = parseFloat(el.dataset.x) || scene.x;
          const y = parseFloat(el.dataset.y) || scene.y;
          scene.x = x;
          scene.y = y;
          el.style.transform = `translate(${scene.x}px, ${scene.y}px)`;
          el.dataset.x = 0;
          el.dataset.y = 0;
          refreshConnections();
          saveState();
        },
      },
      inertia: true,
    })
    .resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      listeners: {
        move(event) {
          const { x, y } = event.target.dataset;
          const newX = (parseFloat(x) || scene.x) + event.deltaRect.left;
          const newY = (parseFloat(y) || scene.y) + event.deltaRect.top;
          scene.width = event.rect.width;
          scene.height = event.rect.height;
          scene.x = newX;
          scene.y = newY;
          Object.assign(event.target.style, {
            width: `${event.rect.width}px`,
            height: `${event.rect.height}px`,
            transform: `translate(${newX}px, ${newY}px)`,
          });
          refreshConnections();
        },
        end(event) {
          const target = event.target;
          const x = parseFloat(target.dataset.x) || scene.x;
          const y = parseFloat(target.dataset.y) || scene.y;
          scene.x = x;
          scene.y = y;
          target.style.transform = `translate(${scene.x}px, ${scene.y}px)`;
          target.dataset.x = 0;
          target.dataset.y = 0;
          refreshConnections();
          saveState();
        },
      },
      inertia: true,
    });
}

function updateSceneList() {
  sceneList.innerHTML = '';
  scenes.forEach((scene) => {
    const li = document.createElement('li');
    li.textContent = scene.title || 'Без назви';
    li.dataset.id = scene.id;
    if (scene.id === selectedSceneId) li.classList.add('active');
    li.onclick = () => selectScene(scene.id);
    sceneList.appendChild(li);
  });
  refreshChoiceTargets();
}

function selectScene(id) {
  selectedSceneId = id;
  document.querySelectorAll('.scene-frame').forEach((el) => {
    el.classList.toggle('selected', el.dataset.id === id);
  });
  updateSceneList();
  renderInspector();
}

function renderInspector() {
  const scene = scenes.find((s) => s.id === selectedSceneId);
  if (!scene) {
    inspectorContent.innerHTML = '<p class="empty-state">Оберіть сцену, щоб побачити налаштування.</p>';
    return;
  }
  inspectorContent.innerHTML = '';
  inspectorContent.appendChild(buildLabeledInput('Назва', scene.title, (value) => {
    scene.title = value;
    renderScene(scene);
    updateSceneList();
    saveState();
  }));

  inspectorContent.appendChild(buildLabeledInput('Фон (колір або URL)', scene.background, (value) => {
    scene.background = value;
    renderScene(scene);
    saveState();
  }));

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Видалити сцену';
  deleteBtn.style.background = '#fee2e2';
  deleteBtn.style.color = '#b91c1c';
  deleteBtn.style.border = '1px solid #fecaca';
  deleteBtn.style.padding = '8px';
  deleteBtn.style.borderRadius = '6px';
  deleteBtn.onclick = () => deleteScene(scene.id);
  inspectorContent.appendChild(deleteBtn);
}

function buildLabeledInput(label, value, onChange) {
  const wrapper = document.createElement('div');
  const lbl = document.createElement('label');
  lbl.textContent = label;
  const input = document.createElement('input');
  input.value = value || '';
  input.oninput = (e) => onChange(e.target.value);
  wrapper.append(lbl, input);
  return wrapper;
}

function renderChoices(scene, container) {
  container.innerHTML = '';
  const tmpl = document.getElementById('choice-template');
  scene.choices.forEach((choice) => {
    const clone = tmpl.content.cloneNode(true);
    const choiceEl = clone.querySelector('.choice-item');
    const textSpan = choiceEl.querySelector('span');
    const select = choiceEl.querySelector('.choice-target');
    const removeBtn = choiceEl.querySelector('.remove-choice');

    textSpan.textContent = choice.text;
    textSpan.oninput = (e) => {
      choice.text = e.target.textContent;
      saveState();
    };

    populateTargetSelect(select, choice.target);
    select.onchange = (e) => {
      choice.target = e.target.value || null;
      refreshConnections();
      saveState();
    };

    removeBtn.onclick = () => {
      scene.choices = scene.choices.filter((c) => c.id !== choice.id);
      renderScene(scene);
      refreshConnections();
      saveState();
    };

    container.appendChild(choiceEl);
  });
}

function refreshChoiceTargets() {
  document.querySelectorAll('.choice-target').forEach((select) => {
    const current = select.value;
    populateTargetSelect(select, current);
  });
}

function populateTargetSelect(select, value) {
  select.innerHTML = '<option value="">—</option>';
  scenes.forEach((scene) => {
    const opt = document.createElement('option');
    opt.value = scene.id;
    opt.textContent = scene.title;
    if (scene.id === value) opt.selected = true;
    select.appendChild(opt);
  });
}

function refreshConnections() {
  connectionsSvg.innerHTML = '';
  scenes.forEach((scene) => {
    const fromEl = document.querySelector(`[data-id="${scene.id}"]`);
    if (!fromEl) return;
    const fromRect = fromEl.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    scene.choices.forEach((choice) => {
      if (!choice.target) return;
      const targetScene = scenes.find((s) => s.id === choice.target);
      if (!targetScene) return;
      const targetEl = document.querySelector(`[data-id="${targetScene.id}"]`);
      if (!targetEl) return;
      const targetRect = targetEl.getBoundingClientRect();

      const x1 = fromRect.left - canvasRect.left + fromRect.width / 2;
      const y1 = fromRect.top - canvasRect.top + fromRect.height;
      const x2 = targetRect.left - canvasRect.left + targetRect.width / 2;
      const y2 = targetRect.top - canvasRect.top;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      path.setAttribute('x1', x1);
      path.setAttribute('y1', y1);
      path.setAttribute('x2', x2);
      path.setAttribute('y2', y2);
      path.setAttribute('stroke', '#2563eb');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('marker-end', 'url(#arrow)');
      connectionsSvg.appendChild(path);
    });
  });
  ensureArrowMarker();
}

function ensureArrowMarker() {
  if (connectionsSvg.querySelector('#arrow')) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrow');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '10');
  marker.setAttribute('refX', '10');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
  path.setAttribute('fill', '#2563eb');
  marker.appendChild(path);
  defs.appendChild(marker);
  connectionsSvg.appendChild(defs);
}

function deleteScene(id) {
  scenes = scenes.filter((s) => s.id !== id);
  document.querySelector(`[data-id="${id}"]`)?.remove();
  scenes.forEach((scene) => {
    scene.choices = scene.choices.filter((c) => c.target !== id);
  });
  selectedSceneId = scenes[0]?.id || null;
  updateSceneList();
  renderInspector();
  refreshConnections();
  saveState();
}

function exportJSON() {
  const dataStr = JSON.stringify({ scenes, looseImages }, null, 2);
  downloadFile('project.json', dataStr, 'application/json');
}

function exportHTML() {
  const project = { scenes, looseImages };
  const html = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8" />
<title>Novella Preview</title>
<style>
body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #0f172a; color: #e5e7eb; }
.scene-view { max-width: 720px; margin: 0 auto; background: #111827; padding: 20px; border-radius: 12px; }
.scene-view h1 { margin-top: 0; }
.choice-btn { display: block; margin: 8px 0; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; width: 100%; text-align: left; }
.choice-btn:hover { background: #1d4ed8; }
</style>
</head>
<body>
<div class="scene-view">
  <h1 id="view-title"></h1>
  <div id="view-body"></div>
  <div id="view-choices"></div>
</div>
<script>
const data = ${JSON.stringify(project)};
let current = data.scenes[0]?.id;
function render() {
  const scene = data.scenes.find(s => s.id === current);
  if (!scene) return;
  document.getElementById('view-title').textContent = scene.title;
  document.getElementById('view-body').innerHTML = scene.body;
  const choices = document.getElementById('view-choices');
  choices.innerHTML = '';
  scene.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = choice.text;
    btn.onclick = () => { current = choice.target; render(); };
    choices.appendChild(btn);
  });
}
render();
</script>
</body>
</html>`;
  downloadFile('project.html', html, 'text/html');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function bootstrap() {
  addSceneBtn.onclick = createScene;
  insertImageBtn.onclick = () => imageFileInput.click();
  imageFileInput.onchange = () => {
    const [file] = imageFileInput.files || [];
    if (file && file.type.startsWith('image/')) {
      const dropX = parseFloat(imageFileInput.dataset.dropX);
      const dropY = parseFloat(imageFileInput.dataset.dropY);
      const sceneId = imageFileInput.dataset.sceneId || null;
      const position = Number.isFinite(dropX) && Number.isFinite(dropY) ? { x: dropX, y: dropY } : null;
      placeImageFromFile(file, position, sceneId);
    }
    imageFileInput.value = '';
    delete imageFileInput.dataset.dropX;
    delete imageFileInput.dataset.dropY;
    delete imageFileInput.dataset.sceneId;
  };
  exportJsonBtn.onclick = exportJSON;
  exportHtmlBtn.onclick = exportHTML;
  canvas.onclick = () => selectScene(null);
  canvas.addEventListener('dragover', (event) => {
    const items = event.dataTransfer?.items;
    if (items && [...items].some((item) => item.type.startsWith('image/'))) {
      event.preventDefault();
      canvas.classList.add('dragover');
    }
  });
  canvas.addEventListener('dragleave', () => canvas.classList.remove('dragover'));
  canvas.addEventListener('drop', (event) => {
    event.preventDefault();
    canvas.classList.remove('dragover');
    const file = [...event.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    const canvasRect = canvas.getBoundingClientRect();
    const dropPosition = { x: event.clientX - canvasRect.left, y: event.clientY - canvasRect.top };
    const sceneTarget = event.target.closest('.scene-frame');
    placeImageFromFile(file, dropPosition, sceneTarget?.dataset.id || null);
  });
  loadState();
  if (scenes.length === 0) createScene();
}

document.addEventListener('DOMContentLoaded', bootstrap);
