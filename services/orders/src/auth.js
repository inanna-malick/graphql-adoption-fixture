const jwt = require('jsonwebtoken');

const SECRET = process.env.MERIDIAN_JWT_SECRET;

function unauthorized(res) {
  return res.status(401).json({
    error: 'unauthorized',
    message: 'missing or invalid bearer token',
  });
}

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) return unauthorized(res);

  try {
    jwt.verify(token, SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return unauthorized(res);
  }

  next();
}

module.exports = { requireAuth };
