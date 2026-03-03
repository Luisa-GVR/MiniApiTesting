const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;  // Local 3000, Render dinámico
const DATA_FILE = path.join(__dirname, 'tasks.json');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');


const MIME_TYPES = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.ico':  'image/x-icon',
};

// Helpers

function readTasks() {
  try {
    if (!fs.existsSync(DATA_FILE)) throw new Error('no file');
    const raw = fs.readFileSync(DATA_FILE, 'utf-8').trim();
    if (!raw) throw new Error('empty');
    return JSON.parse(raw);
  } catch {
    const seed = [{ id: 1, title: 'Estudiar Web APIs', completed: false }];
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
}

function writeTasks(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type':                 'application/json',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function serveStatic(res, filePath) {
  const mime = MIME_TYPES[path.extname(filePath)] || 'text/plain';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

// Router


const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  // CORS preflight
  if (method === 'OPTIONS') { sendJSON(res, 200, {}); return; }

  // GET /tasks : obtener todas las tareas
  if (method === 'GET' && url === '/tasks') {
    sendJSON(res, 200, readTasks()); return;
  }

  // POST /tasks : crear nueva tarea
  if (method === 'POST' && url === '/tasks') {
    try {
      const body = await parseBody(req);
      if (!body.title || !body.title.trim()) {
        sendJSON(res, 400, { error: 'El campo title es requerido' }); return;
      }
      const tasks   = readTasks();
      const newTask = {
        id:        tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
        title:     body.title.trim(),
        completed: Boolean(body.completed ?? false),
      };
      tasks.push(newTask);
      writeTasks(tasks);
      sendJSON(res, 201, newTask);
    } catch { sendJSON(res, 400, { error: 'JSON invalido' }); }
    return;
  }

  const taskIdMatch = url.match(/^\/tasks\/(\d+)$/);

  // PUT /tasks/:id : actualizar completed de una tarea
  if (method === 'PUT' && taskIdMatch) {
    try {
      const id   = parseInt(taskIdMatch[1]);
      const body = await parseBody(req);
      const tasks = readTasks();
      const idx   = tasks.findIndex(t => t.id === id);

      if (idx === -1) { sendJSON(res, 404, { error: 'Tarea no encontrada' }); return; }

      // actualizar solo los campos enviados (completed y/o title)
      if (body.completed !== undefined) tasks[idx].completed = Boolean(body.completed);
      if (body.title     !== undefined) tasks[idx].title     = body.title.trim();

      writeTasks(tasks);
      sendJSON(res, 200, tasks[idx]);
    } catch { sendJSON(res, 400, { error: 'JSON invalido' }); }
    return;
  }

  // PUT /tasks/reorder : reordenar IDs según el orden recibido
  // Body: { order: [id1, id2, id3, ...] }

  if (method === 'PUT' && url === '/tasks/reorder') {
    try {
      const body = await parseBody(req);
      if (!Array.isArray(body.order)) {
        sendJSON(res, 400, { error: 'Se esperaba { order: [...ids] }' }); return;
      }
      const tasks = readTasks();

      // Construir mapa oldId → task
      const map = {};
      tasks.forEach(t => (map[t.id] = t));

      // reasignar IDs según posicion
      const reordered = body.order.map((oldId, index) => {
        const task = map[oldId];
        if (!task) return null;
        return { ...task, id: index + 1 };
      }).filter(Boolean);

      // agregar tareas que no estaban en el order
      const includedOldIds = new Set(body.order);
      let nextId = reordered.length + 1;
      tasks.forEach(t => {
        if (!includedOldIds.has(t.id)) {
          reordered.push({ ...t, id: nextId++ });
        }
      });

      writeTasks(reordered);
      sendJSON(res, 200, reordered);
    } catch { sendJSON(res, 400, { error: 'JSON invalido' }); }
    return;
  }

  // DELETE /tasks/:id : eliminar tarea
  if (method === 'DELETE' && taskIdMatch) {
    const id       = parseInt(taskIdMatch[1]);
    const tasks    = readTasks();
    const filtered = tasks.filter(t => t.id !== id);
    if (filtered.length === tasks.length) {
      sendJSON(res, 404, { error: 'Tarea no encontrada' }); return;
    }
    writeTasks(filtered);
    sendJSON(res, 200, { message: 'Tarea eliminada' }); return;
  }

  // Archivos estáticos del frontend
  if (method === 'GET') {
    const fileName = url === '/' ? 'index.html' : url.replace(/^\//, '');
    serveStatic(res, path.join(FRONTEND_DIR, fileName)); return;
  }

  sendJSON(res, 404, { error: 'Ruta no encontrada' });
});


server.listen(PORT, () => {
  console.log('    GET    /tasks');
  console.log('    POST   /tasks');
  console.log('    PUT    /tasks/:id');
  console.log('    PUT    /tasks/reorder');
  console.log('    DELETE /tasks/:id');
});