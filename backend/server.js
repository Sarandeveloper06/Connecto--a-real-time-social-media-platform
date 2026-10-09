require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const languageRoutes = require('./routes/language');
const { router: subscriptionRoutes, webhookHandler } = require('./routes/subscriptions');

const app = express();
const server = http.createServer(app);

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: { origin: clientOrigin, methods: ['GET', 'POST'] },
});

app.set('io', io);
app.use(cors({ origin: clientOrigin }));

// Stripe's webhook needs the raw, unparsed body to verify its signature, so
// this route is registered BEFORE express.json() and given its own raw parser.
app.post('/api/subscriptions/webhook', express.raw({ type: 'application/json' }), webhookHandler);

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/language', languageRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Connecto backend listening on port ${PORT}`);
});
