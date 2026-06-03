-- Student Authentication Table (Phase 2)
CREATE TABLE public.student_auth (
  id SERIAL PRIMARY KEY,
  student_name TEXT NOT NULL UNIQUE,
  class_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.student_auth ENABLE ROW LEVEL SECURITY;

-- Allow anyone to check if student exists (for login)
CREATE POLICY "student_auth_select_public" ON public.student_auth FOR SELECT USING (true);

-- Allow inserts for new students (first login)
CREATE POLICY "student_auth_insert_public" ON public.student_auth FOR INSERT WITH CHECK (true);

-- Allow updates for password reset (by teachers)
CREATE POLICY "student_auth_update_public" ON public.student_auth FOR UPDATE USING (true) WITH CHECK (true);

-- Public Leaderboard View (aggregated scores)
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

-- Per-Game Leaderboard
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

-- Per-Class Leaderboard
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

-- Allow public read access to leaderboards
CREATE POLICY "leaderboard_students_select" ON public.leaderboard_students FOR SELECT USING (true);
CREATE POLICY "leaderboard_by_game_select" ON public.leaderboard_by_game FOR SELECT USING (true);
CREATE POLICY "leaderboard_by_class_select" ON public.leaderboard_by_class FOR SELECT USING (true);
