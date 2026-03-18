const fs   = require('fs');
const path = require('path');
 
const DATA_FILE = path.join(__dirname, '..', 'db', 'comments.json');


// Helpers de escritura


function readComments() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8').trim();
    if (!raw) {
      fs.writeFileSync(DATA_FILE, '[]');
      return [];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading comments file:', err);
    fs.writeFileSync(DATA_FILE, '[]');
    return [];
  }
}


function writeComments(comments) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(comments, null, 2));
  } catch (err) {
    console.error('Error writing comments file:', err);
  }
}


function parseBody(req) {
  return new Promise(function(resolve, reject) {
    let raw = '';
    req.on('data', function(chunk) { raw += chunk; });
    req.on('end', function() {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', function(err) { reject(err); });
  });
}
 
function nextId(comments) {
  if (comments.length === 0) return 1;
  return Math.max(...comments.map(function(c) { return c.id; })) + 1;
}


// Controllers

// GET /comments?taskUid=123
function getComments(req, res) {
    const urlParts = new URL(req.url, `http://${req.headers.host}`);
    const taskUid  = urlParts.searchParams.get('taskUid');

    if (!taskUid) {
        res.sendJSON(400, { error: 'taskUid query parameter is required' });
        return;
    }

    const filtered = readComments().filter(function(c) { return c.taskUid === taskUid; });

    // sort reciente
    filtered.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

    res.sendJSON(200, filtered);
}

//POST /comments
async function createComment(req, res) {
    try {
        const body = await parseBody(req);
        if (!body.taskUid || !body.username || !body.message) {
            res.sendJSON(400, { error: 'taskUid, username and message are required' });
            return;
        }

        if (body.message.trim().length  < 5) {
            res.sendJSON(400, { error: 'message must be at least 5 characters long' });
            return;
        }

        const comments = readComments();


        if (body.parentId) {
            const parent = comments.find(function(c) { return c.id === parseInt(body.parentId); });
            if (!parent) {
                res.sendJSON(404, { error: 'parent comment not found' });
                return;
            }
            if (parent.parentId !== null) {
                res.sendJSON(400, { error: 'cannot reply to this comment' });
                return;
            }
        }


        const newComment = {
            id: nextId(comments),
            taskUid: body.taskUid,
            parentId: body.parentId || null,
            username: body.username.trim(),
            message: body.message.trim(),
            date: new Date().toISOString(),
            deleted: false
        };

        comments.push(newComment);
        writeComments(comments);
        res.sendJSON(201, newComment);
    } catch (err) {
        console.error('Error in createComment:', err);
        res.sendJSON(500, { error: 'Internal server error' });
    }   
}

// DELETE /comments/:id
function deleteComment(req, res, id) {
    const comments = readComments();
    const idx = comments.findIndex(function(c) { return c.id === id; });
    if (idx === -1) {
        res.sendJSON(404, { error: 'Comment not found' });
        return;
    }
    // Si tiene respuestas marcar como eliminado
    const hasReplies = comments.some(function(c) { 
        return c.parentId === id && !c.deleted; 
    });
    if (hasReplies) {
        comments[idx].deleted = true;
        comments[idx].username = 'Deleted';
        comments[idx].message = '[Comment deleted]';
    } else {
        //hard "delete"
        comments.splice(idx, 1);
    }

    writeComments(comments);
    res.sendJSON(200, { message: 'Comment deleted successfully' });
}

module.exports = {
    getComments,
    createComment,
    deleteComment
};