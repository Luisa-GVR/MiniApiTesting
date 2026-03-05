const http = require('http');
const fs   = require('fs');
const path = require('path');
const router = require('./Router'); //No clue porque lo pide en ingles


const PORT = process.env.PORT || 3000;  // Local 3000, Render dinámico
const DATA_FILE = path.join(__dirname, 'tasks.json');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');


const MIME_TYPES = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.ico':  'image/x-icon',
};

// Helpers de servidor

function serveStatic(res, filePath) {
  const mime = MIME_TYPES[path.extname(filePath)] || 'text/plain';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// CORS json

function decorateResponse(res) {
  res.sendJSON = (status, data) => {
    res.writeHead(status, {
      'Content-Type':                 'application/json',
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
  };
}


// Prender servidor

const server = http.createServer((req, res) => {
  decorateResponse(res);

  // Rutas
  if (req.url.startsWith('/tasks') || req.method === 'OPTIONS') {
    router(req, res); return;
  }

  // Leer el index.html
  if (req.method === 'GET') {
    const fileName = req.url === '/' ? 'index.html' : req.url.replace(/^\//, '');
    serveStatic(res, path.join(FRONTEND_DIR, fileName)); return;
  }

  res.sendJSON(404, { error: 'Ruta no encontrada' });
});

server.listen(PORT, () => {
  console.log(`✅  Task Manager en http://localhost:${PORT}`);
  console.log(`    GET    /tasks`);
  console.log(`    POST   /tasks`);
  console.log(`    PUT    /tasks/:id`);
  console.log(`    PUT    /tasks/reorder`);
  console.log(`    DELETE /tasks/:id`);
});
