const TasksController = require('./controllers/tasks');

// Rutas
// GET    /tasks
// POST   /tasks
// PUT    /tasks/:id
// PUT    /tasks/reorder
// DELETE /tasks/:id

function router(req, res) {
  const { method, url } = req;

  // CORS
  if (method === 'OPTIONS') {
    res.sendJSON(200, {}); 
    return;
  }

  // GET /tasks
  if (method === 'GET' && url === '/tasks') {
    TasksController.getTasks(req, res); 
    return;
  }

  // POST /tasks
  if (method === 'POST' && url === '/tasks') {
    TasksController.createTask(req, res); 
    return;
  }

  // PUT /tasks/reorder
  if (method === 'PUT' && url === '/tasks/reorder') {
    TasksController.reorderTasks(req, res); 
    return;
  }

  // PUT /tasks/:id
  const putMatch = url.match(/^\/tasks\/(\d+)$/);
  if (method === 'PUT' && putMatch) {
    TasksController.updateTask(req, res, parseInt(putMatch[1])); 
    return;
  }

  // DELETE /tasks/:id
  const deleteMatch = url.match(/^\/tasks\/(\d+)$/);
  if (method === 'DELETE' && deleteMatch) {
    TasksController.deleteTask(req, res, parseInt(deleteMatch[1])); 
    return;
  }

  // Ruta no encontrada
  res.sendJSON(404, { 
    error: 'Ruta no encontrada' 
});
}

module.exports = router;
