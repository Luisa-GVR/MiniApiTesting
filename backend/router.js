const TasksController = require('./controllers/tasks');
const AuthController  = require('./controllers/auth');
const { requireAuth } = require('./middleware/auth');

// Rutas de taska
// GET    /tasks
// POST   /tasks
// PUT    /tasks/:id
// PUT    /tasks/reorder
// DELETE /tasks/:id
// GET  /auth/me

// Publicas:
//   POST /auth/register
//   POST /auth/login
//   POST /auth/logout

function router(req, res) {
  const { method, url } = req;

  // CORS
  if (method === 'OPTIONS') {
    res.sendJSON(200, {}); 
    return;
  }

  //Rutas de autenticacion

  // POST /auth/register
  if (method === 'POST' && url === '/auth/register') {
    AuthController.register(req, res);
    return;
  }

  // POST /auth/login
  if (method === 'POST' && url === '/auth/login') {
    AuthController.login(req, res);
    return;
  }

  // POST /auth/logout
  if (method === 'POST' && url === '/auth/logout') {
    AuthController.logout(req, res);
    return;
  }

  //Con usuario

  // GET /auth/me
  if (method === 'GET' && url === '/auth/me') {
    const authenticated = requireAuth(req, res);
    if (!authenticated) return;
    AuthController.me(req, res);
    return;
  }

  // Requerir autenticacion para las rutas de tareas

  const authenticated = requireAuth(req, res);
  if (!authenticated) return;


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
