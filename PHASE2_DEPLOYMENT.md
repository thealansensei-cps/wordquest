# WordQuest Phase 2 - Deployment Guide

## 📋 Files to Upload to GitHub

Upload these **3 NEW files** to your GitHub repo root (`wordquest/`):

1. **login-v2.html** — New login system with:
   - Student roster dropdown (160 CPS P4 students)
   - Password creation on first login
   - Teacher password reset interface

2. **leaderboard.html** — Public leaderboard with 3 tabs:
   - Top Students (aggregated scores)
   - By Game (per-game rankings)
   - By Class (per-class rankings)

3. **supabase-games-client.js** — ALREADY UPDATED with correct API key

## 🔄 Files to Update in GitHub

4. **games-hub.html** — ALREADY UPDATED with:
   - Link to leaderboard: `<a href="leaderboard.html">`
   - Link to login-v2: `<a href="login-v2.html">`

## ⚙️ Supabase Setup (REQUIRED)

Run this SQL in your Supabase SQL Editor:

```sql
-- Student Authentication Table
CREATE TABLE public.student_auth (
  id SERIAL PRIMARY KEY,
  student_name TEXT NOT NULL UNIQUE,
  class_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.student_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_auth_select_public" ON public.student_auth FOR SELECT USING (true);
CREATE POLICY "student_auth_insert_public" ON public.student_auth FOR INSERT WITH CHECK (true);
CREATE POLICY "student_auth_update_public" ON public.student_auth FOR UPDATE USING (true) WITH CHECK (true);

-- Leaderboard Views
CREATE VIEW public.leaderboard_students AS
SELECT 
  student_name,
  class_name,
  COUNT(*) as games_played,
  SUM(score) as total_score,
  SUM(total) as total_questions,
  ROUND(100.0 * SUM(score) / NULLIF(SUM(total), 0)) as accuracy_pct,
  SUM(stars) as total_stars,
  MAX(created_at) as last_played
FROM public.legacy_scores
GROUP BY student_name, class_name
ORDER BY total_score DESC;

CREATE VIEW public.leaderboard_by_game AS
SELECT 
  zone,
  topic,
  student_name,
  class_name,
  score,
  total,
  pct,
  stars,
  created_at
FROM public.legacy_scores
ORDER BY zone, score DESC;

CREATE VIEW public.leaderboard_by_class AS
SELECT 
  class_name,
  student_name,
  SUM(score) as total_score,
  COUNT(*) as games_played,
  SUM(stars) as total_stars,
  MAX(created_at) as last_played
FROM public.legacy_scores
GROUP BY class_name, student_name
ORDER BY class_name, total_score DESC;

CREATE POLICY "leaderboard_students_select" ON public.leaderboard_students FOR SELECT USING (true);
CREATE POLICY "leaderboard_by_game_select" ON public.leaderboard_by_game FOR SELECT USING (true);
CREATE POLICY "leaderboard_by_class_select" ON public.leaderboard_by_class FOR SELECT USING (true);
```

## 🚀 Deployment Steps

### 1️⃣ Upload Phase 2 Files to GitHub

```
https://github.com/thealansensei-cps/wordquest
```

Upload these files:
- `login-v2.html`
- `leaderboard.html`
- `games-hub.html` (updated version)

### 2️⃣ Run SQL in Supabase

Go to SQL Editor and execute the schema above.

### 3️⃣ Test End-to-End

**New Student Flow:**
```
1. Go to: https://thealansensei-cps.github.io/wordquest/games-hub.html
2. Click "Log In Now"
3. Select your name from dropdown (e.g., "Alan Integrity")
4. Leave password blank (first-time user)
5. Create a password (e.g., "test123")
6. Play a game
7. Submit score
8. Go to Leaderboard → see your score
```

**Existing Student Flow (with password):**
```
1. Go to login-v2.html
2. Select name
3. Enter password
4. Play games
5. Scores auto-save
```

**Teacher Password Reset:**
```
1. Go to login-v2.html
2. Click "Reset Student Password" link
3. Select student name
4. Enter new temporary password
5. Student logs in with new password next time
```

**View Leaderboards (Public):**
```
1. Any student or teacher can go to: leaderboard.html
2. View 3 tabs:
   - Top Students (global ranking by total score)
   - By Game (rankings per game)
   - By Class (rankings per class)
```

## 📊 Phase 2 Features Summary

| Feature | Status |
|---------|--------|
| ✅ Student roster dropdown (160 students) | READY |
| ✅ Password creation on first login | READY |
| ✅ Password persistence in Supabase | READY |
| ✅ Teacher password reset | READY |
| ✅ Public leaderboard (Top Students) | READY |
| ✅ Per-game leaderboard | READY |
| ✅ Per-class leaderboard | READY |

## 🔒 Security Notes

- **Passwords are hashed** (simple hash function - not production crypto)
- **No student authentication** — anyone can create account
- **Teachers can reset passwords** without authentication
- **All leaderboards are public** — no restrictions

For production, add:
- Bcrypt password hashing
- Teacher authentication (email/password)
- Student account verification (via class list)
- HTTPS requirement

## ❓ Troubleshooting

**Leaderboard shows no data:**
- Wait 30 seconds for GitHub Pages CDN to refresh
- Hard refresh: `Ctrl+Shift+R`
- Check Supabase SQL Editor to verify scores are in `legacy_scores` table

**Password reset not working:**
- Verify `student_auth` table exists in Supabase
- Check student name matches exactly (case-sensitive)

**Dropdown doesn't show students:**
- Check browser console (F12) for JS errors
- Verify `login-v2.html` is uploaded to GitHub

---

**Phase 2 Complete!** 🎉

Next: Phase 3 (composition scoring, multiplayer, CSV export)
