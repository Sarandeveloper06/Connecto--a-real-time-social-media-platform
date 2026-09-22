# Connecto

A real-time, X (Twitter)-style social media app. Full stack, self-contained, ready to push to GitHub.

> **Status: fully built and tested.** Backend verified end-to-end (register → post → like → comment →
> follow, all working). Frontend production build verified clean. No placeholder/dummy code anywhere.
> The only steps left are ones that need *your* accounts (GitHub, Render, Vercel) — see
> "Pushing this to GitHub" and "Deploying it live" below. Total time: about 5 minutes.

**Stack**
- Backend: Node.js, Express, Socket.IO (real-time), SQLite (`better-sqlite3`), JWT auth, bcrypt
- Frontend: React (Vite), React Router, Axios, Socket.IO client, plain CSS (dark X-style theme)

**Features**
- Sign up / log in (JWT-based auth)
- Post, delete your own posts
- Like / unlike posts, with live counts pushed to every connected client
- Comment on posts, live-updated
- Follow / unfollow users, live follower counts
- Public profile pages with a user's posts and stats
- New posts appear instantly for everyone via WebSockets — no refresh needed

## Project structure

```
connecto/
  backend/     Express API + Socket.IO server + SQLite database
  frontend/    React (Vite) client
```

## Running locally

### 1. Backend

```bash
cd backend
cp .env.example .env   # edit JWT_SECRET to a long random string
npm install
npm start               # runs on http://localhost:5000
```

The SQLite database file (`social.db`) is created automatically on first run — no external database needed.

### 2. Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env   # VITE_API_URL should point at your backend
npm install
npm run dev             # runs on http://localhost:5173
```

Open http://localhost:5173, sign up two accounts in two browser windows, and try posting, liking, commenting, and following — updates appear live in both windows.

## Pushing this to GitHub

From the `connecto` folder:

```bash
git init
git add .
git commit -m "Initial commit: Connecto full-stack app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(`.env` files and `node_modules` are already excluded via `.gitignore` — only source code gets pushed.)

## Deploying it live

GitHub itself only hosts **static** files (e.g. via GitHub Pages), so it can't run the Node/Socket.IO backend. The usual free/low-cost split is:

- **Backend** (Express + Socket.IO): deploy to a Node-friendly host such as **Render**, **Railway**, or **Fly.io**.
  - Set environment variables `JWT_SECRET` and `CLIENT_ORIGIN` (your deployed frontend URL) in the host's dashboard.
  - Note: `better-sqlite3` writes to a local file, which works fine on these hosts for a demo/small app, but the file resets on redeploy unless you attach a persistent disk (Render/Railway both support this). For a production app, swap in a hosted Postgres/MySQL database.
- **Frontend** (static Vite build): deploy to **GitHub Pages**, **Vercel**, or **Netlify**.
  - Build with `npm run build` in `frontend/`, which outputs static files to `frontend/dist/`.
  - Set `VITE_API_URL` (build-time env var) to your deployed backend's URL before building.

Once both are live, update the backend's `CLIENT_ORIGIN` to match the deployed frontend's URL so CORS and Socket.IO connections are allowed.

## API overview

| Method | Route                          | Auth | Description                          |
|--------|---------------------------------|------|---------------------------------------|
| POST   | /api/auth/register              | No   | Create an account                     |
| POST   | /api/auth/login                 | No   | Log in, get a JWT                     |
| GET    | /api/auth/me                    | Yes  | Get current user                      |
| GET    | /api/posts                      | No   | Get the global feed                   |
| POST   | /api/posts                      | Yes  | Create a post                         |
| DELETE | /api/posts/:id                  | Yes  | Delete your own post                  |
| POST   | /api/posts/:id/like             | Yes  | Toggle like on a post                 |
| GET    | /api/posts/:id/comments         | No   | List comments on a post               |
| POST   | /api/posts/:id/comments         | Yes  | Add a comment                         |
| GET    | /api/users/:username            | No   | Get a user's profile + posts          |
| POST   | /api/users/:username/follow     | Yes  | Toggle follow on a user               |

Real-time events emitted over Socket.IO: `new_post`, `post_deleted`, `post_liked`, `new_comment`, `follow_changed`.

## Notes / next steps

This is a solid, working MVP covering the core X-like loop (post, like, comment, follow, live feed). Natural next additions if you want to extend it: image uploads, retweets/quote-posts, hashtags & search, notifications inbox, direct messages, and pagination/infinite scroll on the feed.
