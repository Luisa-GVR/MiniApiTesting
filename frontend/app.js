//  CONFIGURACIÓN
//  - Local (node server.js):  cambia a 'http://localhost:3000/tasks'
//  - Render / producción:     '/tasks' 

const API_URL = 'http://localhost:3000/tasks';

document.getElementById('apiLabel').textContent =
  API_URL.startsWith('/') ? window.location.host + API_URL : API_URL;


// DOM
const listTodo    = document.getElementById('list-todo');
const listDone    = document.getElementById('list-done');
const countTodo   = document.getElementById('count-todo');
const countDone   = document.getElementById('count-done');
const totalChip   = document.getElementById('totalChip');
const doneChip    = document.getElementById('doneChip');
const taskInput   = document.getElementById('taskInput');
const taskForm    = document.getElementById('taskForm');
const addBtn      = document.getElementById('addBtn');
const taskDialog  = document.getElementById('taskDialog');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn   = document.getElementById('cancelBtn');
const toastEl     = document.getElementById('toast');
const inputError  = document.getElementById('taskInputError');


// Fetch unificado
async function apiFetch(path, options = {}, signal = null) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    signal,
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(API_URL + path, config);

  // Intentar parsear JSON para incluir el mensaje de error del servidor
  let data;
  try { data = await res.json(); }
  catch { data = null; }

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return data;
}


// API
const API = {
  getTasks:    (signal)           => apiFetch('',          {},                             signal),
  createTask:  (title, signal)    => apiFetch('',          { method: 'POST',   body: { title, completed: false } }, signal),
  updateTask:  (id, patch, signal)=> apiFetch(`/${id}`,    { method: 'PUT',    body: patch }, signal),
  reorder:     (order, signal)    => apiFetch('/reorder',  { method: 'PUT',    body: { order } }, signal),
  deleteTask:  (id, signal)       => apiFetch(`/${id}`,    { method: 'DELETE' },           signal),
};


// Local state
let tasks = [];

let loadController = null;


// Validación de input
const TITLE_MIN = 1;
const TITLE_MAX = 200;

function validateTitle(raw) {
  const title = raw.trim();
  if (title.length < TITLE_MIN) return 'El título no puede estar vacío';
  if (title.length > TITLE_MAX) return `Máximo ${TITLE_MAX} caracteres`;
  // No caracteres de control
  if (/[\x00-\x1F]/.test(title)) return 'El título contiene caracteres no válidos.';
  return null; // null = válido
}

function setInputError(msg) {
  inputError.textContent = msg || '';
  taskInput.setAttribute('aria-invalid', msg ? 'true' : 'false');
}


// Toast
let toastTimer;
function showToast(msg, isError = false) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.toggle('error', isError);
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}


// Modal
function openModal() {
  setInputError(null);
  taskInput.value = '';
  taskDialog.showModal();
  taskInput.focus();
}

function closeModal() {
  taskDialog.close();
  setInputError(null);
}


// Render
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createCard(task) {
  const li = document.createElement('li');
  li.className  = 'task-card';
  li.draggable  = true;
  li.dataset.id = task.id;

  li.innerHTML = `
    <svg class="drag-handle" width="14" height="14" viewBox="0 0 14 14"
         fill="none" aria-hidden="true">
      <circle cx="4"  cy="3"  r="1.2" fill="currentColor"/>
      <circle cx="4"  cy="7"  r="1.2" fill="currentColor"/>
      <circle cx="4"  cy="11" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="3"  r="1.2" fill="currentColor"/>
      <circle cx="10" cy="7"  r="1.2" fill="currentColor"/>
      <circle cx="10" cy="11" r="1.2" fill="currentColor"/>
    </svg>
    <div class="card-content">
      <p class="card-id">TASK-${String(task.id).padStart(3, '0')}</p>
      <p class="card-title">${escapeHtml(task.title)}</p>
    </div>
    <button class="card-delete"
            data-action="delete"
            data-id="${task.id}"
            aria-label="Eliminar tarea: ${escapeHtml(task.title)}">×</button>
  `;

  li.addEventListener('dragstart', onDragStart);
  li.addEventListener('dragend',   onDragEnd);

  return li;
}

function renderColumn(container, items) {
  container.innerHTML = '';

  if (items.length === 0) {

    const empty = document.createElement('li');
    empty.className = 'col-empty';
    empty.setAttribute('aria-label', 'Sin tareas');
    empty.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="4" y="8"  width="24" height="3" rx="1.5" fill="currentColor"/>
        <rect x="4" y="15" width="18" height="3" rx="1.5" fill="currentColor"/>
        <rect x="4" y="22" width="21" height="3" rx="1.5" fill="currentColor"/>
      </svg>
      <span>Sin tareas aquí</span>`;
    container.appendChild(empty);
    return;
  }

  items.forEach(task => container.appendChild(createCard(task)));
}

function renderAll() {
  const todo = tasks.filter(t => !t.completed).sort((a, b) => a.id - b.id);
  const done = tasks.filter(t =>  t.completed).sort((a, b) => a.id - b.id);

  renderColumn(listTodo, todo);
  renderColumn(listDone, done);

  countTodo.textContent = todo.length;
  countDone.textContent = done.length;
  totalChip.textContent = `${tasks.length} tarea${tasks.length !== 1 ? 's' : ''}`;
  doneChip.textContent  = `${done.length} hecha${done.length !== 1 ? 's' : ''}`;
}


// Dreng and drop
let draggedId   = null;
let draggedCard = null;
let placeholder = null;

function onDragStart(e) {
  draggedId   = parseInt(this.dataset.id);
  draggedCard = this;
  this.classList.add('dragging');

  const ghost = this.cloneNode(true);
  ghost.classList.add('drag-ghost');
  Object.assign(ghost.style, { position: 'fixed', top: '-1000px', width: this.offsetWidth + 'px' });
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, this.offsetWidth / 2, 30);
  setTimeout(() => ghost.remove(), 0);

  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd() {
  this.classList.remove('dragging');
  removePlaceholder();
  [listTodo, listDone].forEach(l => l.classList.remove('drag-over'));
  draggedId = draggedCard = null;
}

function getDragAfterElement(container, y) {
  const cards = [...container.querySelectorAll('.task-card:not(.dragging)')];
  return cards.reduce((closest, child) => {
    const offset = y - child.getBoundingClientRect().top - child.getBoundingClientRect().height / 2;
    return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function removePlaceholder() {
  placeholder?.remove();
  placeholder = null;
}

[listTodo, listDone].forEach(col => {
  col.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    col.classList.add('drag-over');

    const afterEl = getDragAfterElement(col, e.clientY);
    removePlaceholder();
    placeholder = document.createElement('li');
    placeholder.className = 'drop-placeholder';
    afterEl ? col.insertBefore(placeholder, afterEl) : col.appendChild(placeholder);
  });

  col.addEventListener('dragleave', e => {
    if (!col.contains(e.relatedTarget)) {
      col.classList.remove('drag-over');
      removePlaceholder();
    }
  });

  col.addEventListener('drop', e => {
    e.preventDefault();
    col.classList.remove('drag-over');
    removePlaceholder();
    if (!draggedId) return;

    const newCompleted = col.dataset.completed === 'true';
    const afterEl      = getDragAfterElement(col, e.clientY);
    const cards        = [...col.querySelectorAll('.task-card:not(.dragging)')];
    const afterIdx     = afterEl ? cards.indexOf(afterEl) : cards.length;
    const sameColIds   = cards.map(c => parseInt(c.dataset.id));
    sameColIds.splice(afterIdx, 0, draggedId);

    handleDrop(draggedId, newCompleted, sameColIds);
  });
});


// Funciones de interacción con API

async function loadTasks() {
  // Cancelar petición anterior si aún estaba en curso
  loadController?.abort();
  loadController = new AbortController();

  [listTodo, listDone].forEach(col => {
    col.innerHTML = '<li class="skeleton"></li><li class="skeleton"></li>';
  });

  try {
    tasks = await API.getTasks(loadController.signal);
    renderAll();
  } catch (err) {
    if (err.name === 'AbortError') return; // Cancelado intencionalmente, no es un error real
    showToast('Error al cargar tareas: ' + err.message, true);
    [listTodo, listDone].forEach(col => { col.innerHTML = ''; });
  } finally {
    loadController = null;
  }
}

async function addTask() {
  const raw   = taskInput.value;
  const error = validateTitle(raw);
  if (error) { setInputError(error); taskInput.focus(); return; }
  setInputError(null);

  const title = raw.trim();
  addBtn.disabled = true;

  const ctrl = new AbortController();

  try {
    const newTask = await API.createTask(title, ctrl.signal);
    tasks.push(newTask);
    renderAll();
    closeModal();
    showToast('✓ Tarea creada');
  } catch (err) {
    if (err.name === 'AbortError') return;
    showToast('Error al crear tarea: ' + err.message, true);
  } finally {
    addBtn.disabled = false;
  }
}

async function deleteTask(id) {
  const prev = [...tasks];
  tasks = tasks.filter(t => t.id !== id);
  renderAll();

  const ctrl = new AbortController();

  try {
    await API.deleteTask(id, ctrl.signal);
    showToast('Tarea eliminada');
  } catch (err) {
    if (err.name === 'AbortError') return;
    tasks = prev; // rollback
    renderAll();
    showToast('Error al eliminar: ' + err.message, true);
  }
}

async function handleDrop(id, newCompleted, newColOrder) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const completedChanged = task.completed !== newCompleted;
  const prev = tasks.map(t => ({ ...t })); // snapshot para rollback

  task.completed = newCompleted;
  renderAll();

  const otherIds  = tasks.filter(t => t.completed !== newCompleted).sort((a,b) => a.id - b.id).map(t => t.id);
  const fullOrder = [...newColOrder, ...otherIds];

  const ctrl = new AbortController();

  try {

    const calls = [];
    if (completedChanged) calls.push(API.updateTask(id, { completed: newCompleted }, ctrl.signal));
    calls.push(API.reorder(fullOrder, ctrl.signal));

    const results  = await Promise.all(calls);
    const reordered = results[results.length - 1];

    if (Array.isArray(reordered)) {
      tasks = reordered;
      renderAll();
    }

    showToast(completedChanged
      ? (newCompleted ? 'Marcada como hecha' : 'Movida a pendientes')
      : 'Orden actualizado');

  } catch (err) {
    if (err.name === 'AbortError') return;
    tasks = prev; // rollback
    renderAll();
    showToast('Error al mover tarea: ' + err.message, true);
  }
}


// Listeners globales
document.addEventListener('click', e => {
  const target = e.target;

  // Botón abrir modal
  if (target.closest('#openModalBtn')) { openModal(); return; }

  // Botones cerrar modal
  if (target.closest('#closeModalBtn') || target.closest('#cancelBtn')) { closeModal(); return; }

  // Click en el backdrop del dialog
  if (target === taskDialog) { closeModal(); return; }

  // Botón eliminar tarjeta (data-action="delete")
  const deleteBtn = target.closest('[data-action="delete"]');
  if (deleteBtn) {
    e.stopPropagation();
    deleteTask(parseInt(deleteBtn.dataset.id));
    return;
  }
});

// Submit del form
taskForm.addEventListener('submit', e => {
  e.preventDefault();
  addTask();
});

// Limpiar error con escape
taskInput.addEventListener('input', () => {
  if (inputError.textContent) setInputError(null);
});

// Init
loadTasks();