require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const { getOrCreateUser } = require('./db');
const chatRoutes = require('./routes/chat');
const factcheckRoutes = require('./routes/factcheck');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  let userId = req.cookies.loom_uid;
  if (!userId) {
    userId = crypto.randomUUID();
    res.cookie('loom_uid', userId, { maxAge: 1000 * 60 * 60 * 24 * 365, httpOnly: true, sameSite: 'lax' });
  }
  getOrCreateUser(userId);
  req.userId = userId;
  next();
});

app.use('/api', chatRoutes);
app.use('/api', factcheckRoutes);
app.use('/api', adminRoutes);

app.listen(PORT, () => {
  console.log(`Loom (OpenRouter, free model) running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin.html?key=${process.env.ADMIN_KEY || 'changeme'}`);
});
