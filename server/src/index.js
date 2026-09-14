require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const ridesRouter = require('./routes/rides');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/rides', ridesRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Database ─────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ride-dispatch');
    console.log('[MongoDB] Connected ✓');

    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      console.log('[Server] POST /rides  → book a ride');
      console.log('[Server] GET  /rides/:id → check status');
    });
  } catch (err) {
    console.error('[Server] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

startServer();
