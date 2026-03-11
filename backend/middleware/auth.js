const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';

function requireAuth(req, res) {
    const token = parseCookies(req).token;

    if (!token) {
        res.sendJSON(401, { error: 'Not authenticated.' });
        return false;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        return true;
    } catch (err) {
        res.sendJSON(401, { error: 'Invalid session.' });
        return false;
    }

}


function parseCookies(req) {
     const cookieHeader = req.headers['cookie'] || '';
    const cookies = {};

    cookieHeader.split(';').forEach(function(pair) {
    const parts = pair.trim().split('=');
    const key   = parts[0];
    const value = parts.slice(1).join('=');
    if (key) {
      cookies[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  });

    return cookies;
}


module.exports = {
    requireAuth,
    JWT_SECRET
};