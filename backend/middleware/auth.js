const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
};

const verifyPatientToken = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'PATIENT') {
      return res.status(403).json({ success: false, message: 'Forbidden: Requires patient access' });
    }
    req.user = decoded; // { id, mobile, role }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token' });
  }
};

const optionalPatientToken = (req, res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // Ignore invalid or expired token for guest kiosk check-in
    }
  }
  next();
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userRole = (decoded.role || '').toUpperCase();
      const allowedUpper = allowedRoles.map(r => r.toUpperCase());
      if (!allowedUpper.includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
      }
      req.user = decoded; // { id, username, role }
      next();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token' });
    }
  };
};

module.exports = {
  verifyPatientToken,
  optionalPatientToken,
  requireRole,
  JWT_SECRET
};
