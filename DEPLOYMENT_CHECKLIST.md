# WordQuest Deployment Checklist
## Go-Live Steps for 4 Supabase Games + Games Hub

---

## ✅ PHASE 1: Supabase Database Setup

### Step 1: Run legacy_scores Schema
- [ ] Log in to Supabase → **SQL Editor**
- [ ] Copy this code block from `wordquest-backend/schema.sql`:

```sql
-- legacy_scores table for standalone games (Synthesis, Reported Speech, Spelling, Grammar MCQ)
CREATE TABLE public.legacy_scores (
  id SERIAL PRIMARY KEY,
  student_name TEXT NOT NULL,
  class_name TEXT,
  zone TEXT NOT NULL,  -- 'gc','syn','rs','sp','gmcq','vmcq'
  topic TEXT,
  score INT NOT NULL,
  total INT NOT NULL,
  pct INT GENERATED ALWAYS AS (ROUND(100.0 * score / NULLIF(total, 0))) STORED,
  stars INT DEFAULT 1,
  pts INT DEFAULT 0,
  ts BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Allow anyone to insert scores (anon key)
ALTER TABLE public.legacy_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legacy_scores_insert_public" ON public.legacy_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "legacy_scores_select_public" ON public.legacy_scores FOR SELECT USING (true);
```

- [ ] **Paste into SQL Editor**
- [ ] **Execute**
- [ ] Verify table created in **Database** → **Tables** → `legacy_scores` appears
- [ ] Check RLS is enabled: **Policies** tab should show 2 policies

✅ **Done:** Supabase is now ready to receive game scores.

---

## ✅ PHASE 2: GitHub Upload

### Step 2: Upload 5 Game Files to GitHub

**Repository:** `https://github.com/thealansensei-cps/wordquest`  
**Folder:** `/wordquest/`

Files to upload:
- [ ] `games-hub.html` — **Main entry point**
- [ ] `grammar-cloze-supabase.html` — (from last session)
- [ ] `synthesis-supabase.html` — (NEW)
- [ ] `reported-speech-supabase.html` — (NEW)
- [ ] `spelling-supabase.html` — (NEW)
- [ ] `supabase-games-client.js` — Shared client library (from last session)

**How to upload (GitHub Web UI):**
1. Navigate to `https://github.com/thealansensei-cps/wordquest`
2. Click **Go to file** or navigate to `/wordquest/` folder
3. Click **Upload files** (right side, "Add file" dropdown)
4. **Drag & drop** the 6 files OR click to select
5. Add commit message: `feat: Add Synthesis, Reported Speech, Spelling games + Games Hub`
6. Click **Commit changes**

**Verify upload:**
- [ ] All 6 files appear in `/wordquest/` folder
- [ ] File preview shows correct content (no truncation)
- [ ] Created timestamps update to today

✅ **Done:** Games are now live on GitHub Pages.

---

## ✅ PHASE 3: Test Locally (Before Real Students)

### Step 3: Test games-hub.html

**Setup:**
- [ ] Open `games-hub.html` in browser (drag file to tab)
- [ ] **OR** visit live URL: `https://thealansensei-cps.github.io/wordquest/games-hub.html`

**Test Flow:**

1. **Login Test**
   - [ ] Page shows "Not Logged In" prompt
   - [ ] Click "Log In Now"
   - [ ] Enter name: `TestStudent` / class: `4 Integrity`
   - [ ] Hero bar appears with name + class
   - [ ] "Change Hero" + "Logout" buttons appear

2. **Game Card Test**
   - [ ] All 4 game cards visible (Grammar Cloze, Synthesis, Reported Speech, Spelling)
   - [ ] Card descriptions readable
   - [ ] Hover effect works (card highlights, lifts)

3. **Launch Test (Grammar Cloze)**
   - [ ] Click "Grammar Cloze" card
   - [ ] Game launches with URL params: `?hero=TestStudent&cls=4%20Integrity`
   - [ ] Hero bar shows login status
   - [ ] Question 1 renders correctly
   - [ ] Answer one question (select an option)
   - [ ] Feedback appears (correct/incorrect)
   - [ ] Navigate to next question (auto-advance)

4. **Complete Test**
   - [ ] Finish all 10 questions
   - [ ] Results screen shows score/stars/points
   - [ ] "Submit & Return to Island" button appears
   - [ ] Click "Submit"
   - [ ] Spinner shows "⏳ Submitting..."
   - [ ] **Browser redirects to games-hub.html?hero=..&cls=..&zone=gc&score=..&total=..&stars=..**

5. **Score Verification (Supabase)**
   - [ ] Log in to Supabase → **SQL Editor**
   - [ ] Run: `SELECT * FROM legacy_scores ORDER BY created_at DESC LIMIT 5;`
   - [ ] **Verify:** New row appears with:
     - `student_name = 'TestStudent'`
     - `class_name = '4 Integrity'`
     - `zone = 'gc'`
     - `topic = 'Grammar Cloze'`
     - `score = <your test answer count>`
     - `total = 10`
     - `stars = <calculated>`

✅ **Done:** Games save scores correctly.

---

## ✅ PHASE 4: Pilot with Real Students

### Step 4: Distribute games-hub.html Link

**Option A: Direct URL (Recommended)**
```
https://thealansensei-cps.github.io/wordquest/games-hub.html
```
- Students bookmark or click link
- Auto-logs in to their name/class (sessionStorage persists)
- Can play games in sequence

**Option B: Embedded in LMS**
- If using Student Learning Space (SLS) or Google Classroom
- Embed games-hub.html as **External Tool** or **Link** (with LTI if available)

**Option C: Shortcode**
- Create QR code → `https://bit.ly/wordquest-cps`
- Print as poster in classroom

### Step 5: Monitor Scores

**Teacher Dashboard:**
- [ ] Log in to `https://thealansensei-cps.github.io/wordquest/teacher.html`
- [ ] PIN: `262626` (set in teacher.html)
- [ ] View **Leaderboards** by zone (gc, syn, rs, sp)
- [ ] See class-wide scores

**Supabase Live Dashboard:**
- [ ] Log in to `https://supabase.co` → Project
- [ ] **Data Studio** or **Table Editor** → `legacy_scores`
- [ ] Filter by `class_name` or `zone`
- [ ] Export CSV for records

✅ **Done:** Pilot is live.

---

## 📋 Troubleshooting

| Issue | Solution |
|-------|----------|
| Game page blank | Check browser console (F12 → Console). Verify `supabase-games-client.js` loaded. |
| Login button doesn't work | `sessionStorage` disabled? Check browser privacy settings. Try incognito mode. |
| Scores don't save | Check Supabase project URL/key in `supabase-games-client.js`. Verify RLS policies created. Test with Supabase SQL query. |
| Images/CSS not loading | Check GitHub Pages URL. Verify files uploaded to correct `/wordquest/` folder. Hard refresh (Ctrl+Shift+R). |
| Hero bar shows "Not logged in" | Clear sessionStorage: F12 → Application → Session Storage → Delete all. Re-login. |

---

## 📊 Expected Outcomes

**After Pilot (48 hours):**
- [ ] 50+ scores in `legacy_scores` table
- [ ] Class leaders identified per game
- [ ] No crashes or 500 errors in browser console
- [ ] Teachers can export scores to CSV

**After Week 1:**
- [ ] 500+ total completions across 4 games
- [ ] Per-game mastery breakdown available
- [ ] Student feedback gathered (sticky notes, quick poll)
- [ ] Ready for rollout to all P4 classes

---

## 🎯 Success Criteria

- ✅ Students can log in via games-hub.html
- ✅ All 4 games load without errors
- ✅ Scores save to Supabase (verified via SQL)
- ✅ Teacher dashboard shows live leaderboards
- ✅ No student data lost (RLS policies working)
- ✅ Performance: games load <2s, redirect <1s

---

## 📞 Quick Reference

| Resource | URL / Location |
|----------|---|
| **Games Hub** | https://thealansensei-cps.github.io/wordquest/games-hub.html |
| **Teacher Dashboard** | https://thealansensei-cps.github.io/wordquest/teacher.html |
| **Supabase Project** | https://supabase.co → wordquest |
| **GitHub Repo** | https://github.com/thealansensei-cps/wordquest |
| **Database (live)** | https://zwdzvzvbotuuxxwtreqe.supabase.co → legacy_scores |

---

**Deployment Status:** Ready ✅  
**Checklist Completion:** Update after each phase  
**Pilot Start Date:** ___________  
**Teacher:** Alan  
**School:** Cantonment Primary School
