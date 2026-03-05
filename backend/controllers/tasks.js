const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'tasks.json');

// Helpers de escritura

function readTasks() {
    
  try {
    if (!fs.existsSync(DATA_FILE)) {
      throw new Error('no file');
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf-8').trim();
    if (!raw) {
        throw new Error('empty');
    }

    return JSON.parse(raw);

  } catch {
    const defaultTasks = [{ id: 1, title: 'Estudiar Web APIs', completed: false }];
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultTasks, null, 2));
    return defaultTasks;
  }
}

function writeTasks(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', function(chunk) {
      raw += chunk;
    });

    req.on('end', function() {
      try {
        const parsed = JSON.parse(raw || '{}');
        resolve(parsed);
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}


// Controllers

// GET /tasks
function getTasks(req, res) {
  const tasks = readTasks();
  res.sendJSON(200, tasks);
}

// POST /tasks
async function createTask(req, res) {
  try {
    const body = await parseBody(req);

    if (!body.title || !body.title.trim()) {
      res.sendJSON(400, { error: 'El campo title es requerido' });
      return;
    }

    const tasks   = readTasks();

    if (tasks.length > 0) {
      const ids = tasks.map(function(t) { return t.id; });
      nextId = Math.max(...ids) + 1;
    } else {
      nextId = 1;
    }
    
    const newTask = {
      id:        nextId,
      title:     body.title.trim(),
      completed: Boolean(body.completed !== undefined ? body.completed : false),
    };

    tasks.push(newTask);
    writeTasks(tasks);
    res.sendJSON(201, newTask);
  } catch {
    res.sendJSON(400, { error: 'JSON invalido' });
  }
}


// PUT /tasks/:id
async function updateTask(req, res, id) {
  try {
    const body  = await parseBody(req);
    const tasks = readTasks();
    const idx   = tasks.findIndex(function(t) { 
        return t.id === id; 
    });

    if (idx === -1) {
      res.sendJSON(404, { error: 'Tarea no encontrada' });
      return;
    }

    if (body.completed !== undefined) {
      tasks[idx].completed = Boolean(body.completed);
    }

    if (body.title !== undefined) {
      tasks[idx].title = body.title.trim();
    }

    writeTasks(tasks);
    res.sendJSON(200, tasks[idx]);

  } catch {
    res.sendJSON(400, { error: 'JSON invalido' });
  }
}



// PUT /tasks/reorder
async function reorderTasks(req, res) {
  try {
    const body = await parseBody(req);

    if (!Array.isArray(body.order)) {
      res.sendJSON(400, { error: 'Se esperaba { order: [...ids] }' });
      return;
    }

    const tasks = readTasks();

    const map = {};
    tasks.forEach(function(t) {
      map[t.id] = t;
    });

    const reordered = [];

    //Reasignar ids con nueva posicion
    body.order.forEach(function(oldId, index) {
      const task = map[oldId];

      if (task) {
        const reorderedTask = {
          id:        index + 1,
          title:     task.title,
          completed: task.completed,
        };
        reordered.push(reorderedTask);
      }
    });

    // Agregar tareas que no estaban en el orden
    const includedIds = new Set(body.order);
    let nextId = reordered.length + 1;
    tasks.forEach(function(t) {
      if (!includedIds.has(t.id)) {
        const extraTask = {
          id:        nextId,
          title:     t.title,
          completed: t.completed,
        };
        reordered.push(extraTask);
        nextId++;
      }
    });

    writeTasks(reordered);
    res.sendJSON(200, reordered);
    
  } catch {
    res.sendJSON(400, { error: 'JSON inválido' });
  }
}


// DELETE /tasks/:id
function deleteTask(req, res, id) {
  const tasks    = readTasks();
  const filtered = tasks.filter(t => t.id !== id);

  if (filtered.length === tasks.length) {
    res.sendJSON(404, { error: 'Tarea no encontrada' });
    return;
  }

  writeTasks(filtered);
  res.sendJSON(200, { message: 'Tarea eliminada' });
}


module.exports = { getTasks, createTask, updateTask, reorderTasks, deleteTask };