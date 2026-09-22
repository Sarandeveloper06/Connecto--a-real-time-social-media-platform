# Connecto — 14-Day Progress Log

How to use this: each day, check off what you finished and add a one-line note.
Commit this file to GitHub along with your code so the log lives alongside the project
(`git add PROGRESS_LOG.md && git commit -m "Day X progress"`).

Legend: `[x]` done · `[ ]` not done · `[~]` in progress

---

## Day 1 — Backend foundation
- [x] Express server + SQLite database setup
- [x] User auth (register/login) with JWT + bcrypt
- [x] Posts table + create/read post endpoints
**Notes:**

## Day 2 — Backend core features
- [x] Likes (toggle like/unlike, live count)
- [x] Comments (add/list comments)
- [x] Follow/unfollow endpoints
- [x] Socket.IO real-time events (new_post, post_liked, new_comment, follow_changed)
**Notes:**

## Day 3 — Backend testing & cleanup
- [x] End-to-end API smoke test (register → post → like → comment → follow)
- [ ] Add input validation edge cases (empty strings, long text, special characters)
- [ ] Add basic rate limiting on auth routes
**Notes:**

## Day 4 — Frontend foundation
- [x] React + Vite project scaffolded
- [x] Auth context (login/register/logout, token persistence)
- [x] Routing (Home, Login, Register, Profile)
**Notes:**

## Day 5 — Frontend core UI
- [x] Navbar, Avatar, ComposeBox components
- [x] PostCard component (like/comment/delete actions)
- [x] Dark X-style theme (CSS)
**Notes:**

## Day 6 — Frontend real-time wiring
- [x] Socket.IO client connected to feed (live new posts)
- [x] Live like counts and comment counts
- [x] Live follower counts on profile
**Notes:**

## Day 7 — Frontend build verification
- [x] `npm run build` succeeds with no errors
- [ ] Manual click-through test in an actual browser (not just API calls)
- [ ] Test on mobile screen width
**Notes:**

## Day 8 — Polish pass
- [ ] Loading states / empty states reviewed
- [ ] Error messages reviewed (bad login, duplicate username, etc.)
- [ ] Character limits and form validation double-checked in the UI
**Notes:**

## Day 9 — Push to GitHub
- [ ] `git init`, initial commit, push to a real GitHub repo
- [ ] Confirm `.env` files are excluded (check `.gitignore` worked)
- [ ] Add repo description / topics on GitHub
**Notes:**

## Day 10 — Deploy backend
- [ ] Create Render/Railway account, connect GitHub repo
- [ ] Set root directory to `backend`, add `JWT_SECRET` env var
- [ ] Confirm backend is reachable at its public URL (`/api/health`)
**Notes:**

## Day 11 — Deploy frontend
- [ ] Create Vercel/Netlify account, connect same GitHub repo
- [ ] Set root directory to `frontend`, set `VITE_API_URL` to deployed backend URL
- [ ] Confirm frontend loads and can register/login against live backend
**Notes:**

## Day 12 — Connect & test live
- [ ] Set backend's `CLIENT_ORIGIN` to live frontend URL, redeploy
- [ ] Test full flow live: register, post, like, comment, follow — in two browser tabs
- [ ] Fix any CORS/socket connection issues
**Notes:**

## Day 13 — Data persistence check
- [ ] Confirm whether SQLite file survives a redeploy on your host
- [ ] If not, attach a persistent disk (Render/Railway) or migrate to hosted Postgres
- [ ] Re-test after this change
**Notes:**

## Day 14 — Wrap-up
- [ ] Update README with live demo links
- [ ] Final review of open bugs / known issues
- [ ] Decide next features (image uploads, notifications, search, pagination)
**Notes:**

---

## Backlog (not scheduled yet)
- [ ] Image/media uploads on posts
- [ ] Notifications inbox
- [ ] Hashtags & search
- [ ] Direct messages
- [ ] Infinite scroll / pagination on feed
- [ ] Retweets / quote posts
