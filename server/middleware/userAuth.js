const jwt = require('jsonwebtoken');

// مصادقة المستخدم العام (اختياري - لا يعيد 401)
const optionalUserAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'user') {
      req.user = decoded;
    } else {
      req.user = null;
    }
    next();
  } catch {
    req.user = null;
    next();
  }
};

// مصادقة المستخدم العام (مطلوبة - تعيد 401)
const requireUserAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'يجب تسجيل الدخول' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'user') {
      return res.status(401).json({ message: 'يجب تسجيل الدخول' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'رمز غير صالح' });
  }
};

module.exports = { optionalUserAuth, requireUserAuth };
