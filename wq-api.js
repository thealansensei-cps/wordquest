/* ============================================================
   WordQuest — Supabase Client API  (wq-api.js)
   Thin wrapper over @supabase/supabase-js used by BOTH the teacher
   dashboard and the student app.

   Load order in HTML:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script>const WQ_SUPABASE_URL='...'; const WQ_SUPABASE_ANON='...';</script>
     <script src="wq-api.js"></script>

   All functions return {data, error}. Callers check error first.
   ============================================================ */
(function (global) {
  "use strict";

  let sb = null;
  function client() {
    if (!sb) {
      if (!global.supabase || !global.WQ_SUPABASE_URL) {
        throw new Error("Supabase not configured. Set WQ_SUPABASE_URL and WQ_SUPABASE_ANON.");
      }
      sb = global.supabase.createClient(global.WQ_SUPABASE_URL, global.WQ_SUPABASE_ANON);
    }
    return sb;
  }

  const API = {

    /* ---------------- AUTH (teachers only) ---------------- */
    async signIn(email, password) {
      return await client().auth.signInWithPassword({ email, password });
    },
    async signInWithGoogle() {
      return await client().auth.signInWithOAuth({ provider: "google" });
    },
    async signOut() { return await client().auth.signOut(); },
    async currentUser() {
      const { data } = await client().auth.getUser();
      return data ? data.user : null;
    },

    /* Ensure a teachers row exists for the signed-in auth user */
    async ensureTeacher(name) {
      const user = await this.currentUser();
      if (!user) return { error: "Not signed in" };
      const { data: existing } = await client()
        .from("teachers").select("*").eq("auth_uid", user.id).maybeSingle();
      if (existing) return { data: existing };
      return await client().from("teachers")
        .insert({ auth_uid: user.id, name: name || user.email })
        .select().single();
    },

    /* ---------------- CLASSES (houses) ---------------- */
    async createClass(teacherId, name, color, emoji) {
      return await client().from("classes")
        .insert({ teacher_id: teacherId, name, house_color: color, crest_emoji: emoji })
        .select().single();
    },
    async listMyClasses(teacherId) {
      return await client().from("classes")
        .select("*").eq("teacher_id", teacherId).order("created_at");
    },
    async listAllClasses() {           // public read, for house cup display
      return await client().from("classes").select("*").order("name");
    },

    /* ---------------- ROSTER ---------------- */
    async addRosterBulk(classId, names) {
      // names: array of strings (one student per line)
      const rows = names.filter(Boolean).map((n, i) => ({
        class_id: classId,
        display_name: n.trim(),
        index_no: i + 1,
        pick_token: makeToken()
      }));
      return await client().from("roster").insert(rows).select();
    },
    async listRoster(classId) {
      return await client().from("roster")
        .select("*").eq("class_id", classId).order("index_no");
    },

    /* ---------------- ASSIGNMENTS ---------------- */
    async createAssignment(teacherId, title, category, opts) {
      opts = opts || {};
      const code = makeJoinCode();
      return await client().from("assignments")
        .insert({
          teacher_id: teacherId, title, category, join_code: code,
          roster_only: !!opts.rosterOnly, pass_mark: opts.passMark || 60
        })
        .select().single();
    },
    async listMyAssignments(teacherId) {
      return await client().from("assignments")
        .select("*").eq("teacher_id", teacherId).order("created_at", { ascending: false });
    },
    async setAssignmentOpen(assignmentId, open) {
      return await client().from("assignments")
        .update({ is_open: open }).eq("id", assignmentId).select().single();
    },
    /* Student-side: look up an open assignment by code */
    async findAssignmentByCode(code) {
      return await client().from("assignments")
        .select("id,title,category,roster_only,pass_mark,is_open")
        .eq("join_code", code.toUpperCase()).eq("is_open", true).maybeSingle();
    },

    /* ---------------- QUESTIONS ---------------- */
    async addQuestions(assignmentId, items) {
      // items: [{qtype, skill, lo, payload, approved}]
      const rows = items.map((q, i) => ({
        assignment_id: assignmentId,
        ord: i,
        qtype: q.qtype,
        skill: q.skill || null,
        lo: q.lo || null,
        payload: q.payload,
        approved: q.approved !== false
      }));
      return await client().from("questions").insert(rows).select();
    },
    async listQuestions(assignmentId, approvedOnly) {
      let q = client().from("questions")
        .select("*").eq("assignment_id", assignmentId).order("ord");
      if (approvedOnly) q = q.eq("approved", true);
      return await q;
    },
    async updateQuestion(id, patch) {
      return await client().from("questions")
        .update(patch).eq("id", id).select().single();
    },
    async deleteQuestion(id) {
      return await client().from("questions").delete().eq("id", id);
    },

    /* ---------------- SESSIONS / PLAY ---------------- */
    async startSession(assignmentId, classId, rosterId, guestName) {
      return await client().from("sessions")
        .insert({
          assignment_id: assignmentId, class_id: classId,
          roster_id: rosterId || null, guest_name: guestName || null
        })
        .select().single();
    },
    async recordResponse(sessionId, questionId, answerText, isCorrect, msTaken) {
      return await client().from("responses")
        .insert({ session_id: sessionId, question_id: questionId,
                  answer_text: answerText, is_correct: isCorrect, ms_taken: msTaken });
    },
    async finishSession(sessionId, scorePct, points, correct, total) {
      return await client().from("sessions")
        .update({ score_pct: scorePct, points, correct, total,
                  finished: true, finished_at: new Date().toISOString() })
        .eq("id", sessionId).select().single();
    },

    /* ---------------- LEADERBOARDS ---------------- */
    async houseCup() {                 // overall class ranking (avg + bonus pts)
      return await client().from("v_house_cup").select("*");
    },
    async classByCategory(category) {  // per-category class ranking
      let q = client().from("v_class_category").select("*");
      if (category) q = q.eq("category", category);
      return await q.order("avg_pct", { ascending: false });
    },
    async topStudents(category) {      // top 5 per class per category
      let q = client().from("v_top_students").select("*");
      if (category) q = q.eq("category", category);
      return await q.order("best_pct", { ascending: false });
    },

    /* Live session leaderboard (during play): current scores for an assignment */
    async liveScores(assignmentId) {
      return await client().from("sessions")
        .select("id,guest_name,roster_id,class_id,score_pct,points,correct,total,finished")
        .eq("assignment_id", assignmentId)
        .order("points", { ascending: false });
    },

    /* Realtime subscription helper for live leaderboard */
    subscribeLive(assignmentId, onChange) {
      const ch = client()
        .channel("live-" + assignmentId)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "sessions",
            filter: "assignment_id=eq." + assignmentId },
          onChange)
        .subscribe();
      return () => client().removeChannel(ch);  // returns unsubscribe fn
    },

    /* expose raw client if needed */
    raw: client
  };

  /* ---- local code generators (mirror SQL fns for offline/demo) ---- */
  function makeJoinCode() {
    const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = ""; for (let i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }
  function makeToken() {
    const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = ""; for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }

  global.WQ_API = API;
})(typeof window !== "undefined" ? window : globalThis);
