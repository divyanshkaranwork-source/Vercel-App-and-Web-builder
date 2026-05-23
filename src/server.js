import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import http from 'http';
import { Server } from 'socket.io';
import { spawn } from 'node:child_process';
import QRCode from 'qrcode';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || '/auth/github/callback'
      },
      (accessToken, refreshToken, profile, done) => done(null, profile)
    )
  );
}

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/auth/github', (req, res, next) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.status(500).send('GitHub OAuth is not configured.');
  }
  return passport.authenticate('github', { scope: ['user:email', 'repo'] })(req, res, next);
});

app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/terminal.html');
});

app.post('/demo-login', (req, res) => {
  req.session.user = { username: req.body.username || 'demo' };
  res.redirect('/terminal.html');
});

app.get('/me', (req, res) => {
  if (req.user || req.session.user) {
    return res.json({ user: req.user || req.session.user });
  }
  return res.status(401).json({ error: 'Unauthorized' });
});

function requireAuth(req, res, next) {
  if (req.user || req.session.user) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/start-expo', requireAuth, (req, res) => {
  const { githubRepoUrl = '', branch = 'main' } = req.body;
  const workspace = '/tmp/expo-workspace';

  const bootstrap = `
set -e
mkdir -p ${workspace}
cd ${workspace}
if [ ! -d app ]; then
  git clone --depth 1 ${githubRepoUrl || 'https://github.com/expo/examples.git'} app
fi
cd app
git fetch origin ${branch} || true
git checkout ${branch} || true
npm install
npx expo start --tunnel --clear
`;

  const shell = spawn('bash', ['-lc', bootstrap], { env: process.env });
  const socketId = req.headers['x-socket-id'];

  const send = (event, payload) => {
    if (socketId) io.to(socketId).emit(event, payload);
  };

  shell.stdout.on('data', async (chunk) => {
    const text = chunk.toString();
    send('terminal:data', text);

    const maybeUrl = text.match(/https:\/\/[^\s]*expo\.dev[^\s]*/i) || text.match(/exp:\/\/[^\s]+/i);
    if (maybeUrl) {
      const qrDataUrl = await QRCode.toDataURL(maybeUrl[0]);
      send('expo:url', { url: maybeUrl[0], qrDataUrl });
    }
  });

  shell.stderr.on('data', (chunk) => send('terminal:data', chunk.toString()));
  shell.on('close', (code) => send('terminal:exit', `Process exited with code ${code}`));

  res.json({ started: true });
});

io.on('connection', (socket) => {
  socket.emit('terminal:data', 'Connected. Start your cloud Expo environment.\n');
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
