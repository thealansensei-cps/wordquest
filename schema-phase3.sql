CREATE TABLE public.composition_exercises (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  num_paragraphs INT DEFAULT 3,
  word_target INT DEFAULT 300,
  paragraph_1_criteria TEXT NOT NULL,
  paragraph_2_criteria TEXT NOT NULL,
  paragraph_3_criteria TEXT,
  paragraph_4_criteria TEXT,
  helping_words TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.composition_submissions (
  id BIGSERIAL PRIMARY KEY,
  exercise_id BIGINT REFERENCES public.composition_exercises(id),
  student_name TEXT NOT NULL,
  class_name TEXT,
  paragraph_1_text TEXT,
  paragraph_1_score INT,
  paragraph_1_feedback JSONB,
  paragraph_1_revisions INT DEFAULT 0,
  paragraph_2_text TEXT,
  paragraph_2_score INT,
  paragraph_2_feedback JSONB,
  paragraph_2_revisions INT DEFAULT 0,
  paragraph_3_text TEXT,
  paragraph_3_score INT,
  paragraph_3_feedback JSONB,
  paragraph_3_revisions INT DEFAULT 0,
  paragraph_4_text TEXT,
  paragraph_4_score INT,
  paragraph_4_feedback JSONB,
  paragraph_4_revisions INT DEFAULT 0,
  holistic_score INT,
  status TEXT DEFAULT 'in_progress',
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.achievements (
  id BIGSERIAL PRIMARY KEY,
  student_name TEXT NOT NULL,
  class_name TEXT,
  achievement_type TEXT,
  achievement_name TEXT,
  description TEXT,
  earned_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.composition_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composition_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "composition_exercises_select" ON public.composition_exercises FOR SELECT USING (true);
CREATE POLICY "composition_exercises_insert" ON public.composition_exercises FOR INSERT USING (true) WITH CHECK (true);
CREATE POLICY "composition_exercises_update" ON public.composition_exercises FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "composition_exercises_delete" ON public.composition_exercises FOR DELETE USING (true);

CREATE POLICY "composition_submissions_select" ON public.composition_submissions FOR SELECT USING (true);
CREATE POLICY "composition_submissions_insert" ON public.composition_submissions FOR INSERT USING (true) WITH CHECK (true);
CREATE POLICY "composition_submissions_update" ON public.composition_submissions FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "achievements_select" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "achievements_insert" ON public.achievements FOR INSERT USING (true) WITH CHECK (true);

CREATE VIEW public.composition_leaderboard AS
SELECT 
  student_name,
  class_name,
  COUNT(*) as exercises_completed,
  ROUND(AVG(holistic_score)) as avg_score,
  MAX(holistic_score) as best_score,
  MAX(submitted_at) as last_submitted
FROM public.composition_submissions
WHERE status = 'completed'
GROUP BY student_name, class_name
ORDER BY avg_score DESC;

CREATE POLICY "composition_leaderboard_select" ON public.composition_leaderboard FOR SELECT USING (true);
