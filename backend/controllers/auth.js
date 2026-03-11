const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { JWT_SECRET } = require('../middleware/auth');

const USERS_FILE = path.join(__dirname, '..', 'db' , 'users.json');

// Helper function to read users from the JSON file

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, '[]');
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, 'utf-8').trim();
    if (!data) {
      fs.writeFileSync(USERS_FILE, '[]');
      return [];
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading users file:', err);
    fs.writeFileSync(USERS_FILE, '[]');
    return [];
  }
}

function writeUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('Error writing users file:', err);
    }
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', err => {
            reject(err);
        });
    });
}

// Cookie builder
function buildCookie(token){
    const parts = [
        `token=${token}`,
        'HttpOnly',
        'Path=/',
        'Max-Age=3600' // 1 hour
    ];

    // Solo en producción se añade el flag Secure
    if (process.env.NODE_ENV === 'production') {
        parts.push('Secure');
    }

    return parts.join('; ');

}

function buildClearCookie(){
    return `token=; HttpOnly; Path=/; Max-Age=0`;
}

// Controllers

// POST /auth/login
async function register(req, res) {
    try {
        const body = await parseBody(req);

        if (!body.username || !body.password) {
            res.sendJSON(400, { error: 'Username and password are required' });
            return;
        }

        const users = readUsers();

        if (users.some(u => u.username === body.username)) {
            res.sendJSON(400, { error: 'Username already exists' });
            return;
        }

        const hashedPassword = await bcrypt.hash(body.password, 10);

        const newUser = {
            id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
            username: body.username,
            password: hashedPassword
        };

        users.push(newUser);
        writeUsers(users);

        const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '1h' });
        const cookie = buildCookie(token);
        res.setHeader('Set-Cookie', cookie);
        res.sendJSON(201, { message: 'User registered successfully' });


    } catch (err) {
        console.error('Error in register:', err);
        res.sendJSON(500, { error: 'Internal server error' });
    }
}

// POST /auth/login
async function login(req, res) {
    try {
        const body = await parseBody(req);
        if (!body.username || !body.password) {
            res.sendJSON(400, { error: 'Username and password are required' });
            return;
        }

        const users = readUsers();
        const user = users.find(u => u.username === body.username);
        if (!user) {
            res.sendJSON(400, { error: 'Invalid username or password' });
            return;
        }
        const passwordMatch = await bcrypt.compare(body.password, user.password);
        if (!passwordMatch) {
            res.sendJSON(400, { error: 'Invalid username or password' });
            return;
        }
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        const cookie = buildCookie(token);
        res.setHeader('Set-Cookie', cookie);
        res.sendJSON(200, { message: 'Login successful' });

    } catch (err) {
        console.error('Error in login:', err);
        res.sendJSON(500, { error: 'Internal server error' });
    }   
}

// POST /auth/logout
function logout(req, res) {
    const cookie = buildClearCookie();
    res.setHeader('Set-Cookie', cookie);
    res.sendJSON(200, { message: 'Logout successful' });
}

// GET /auth/me
function me(req, res) {
    if (!req.user) {
        res.sendJSON(401, { error: 'Unauthorized' });
        return;
    }   
    res.sendJSON(200, { id: req.user.id, username: req.user.username });
}

module.exports = { register, login, logout, me };