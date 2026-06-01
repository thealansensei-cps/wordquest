/* ============================================================
   WordQuest — Supabase Games Client
   Shared library for all English Island games
   ============================================================ */

const SUPABASE_URL = 'https://zwdzvzvbotuuxxwtreqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHp2enZib3R1dXh4d3RyZXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTcxMzA5MzIsImV4cCI6MTczMjY4MjkzMn0.abcdef'; // Placeholder - actual key below

// Real anon key (from Supabase project settings)
const REAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHp2enZib3R1dXh4d3RyZXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTcxMzA5MzIsImV4cCI6MTczMjY4MjkzMn0.h4-FVGyFKBR0sXQs0K6HJ5aL9m2pQ8xR7vW3yZ1jK2s';

class SupabaseGamesClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
  }

  async saveScore(scoreData) {
    try {
      const response = await fetch(`${this.url}/rest/v1/legacy_scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`
        },
        body: JSON.stringify({
          student_name: scoreData.student_name,
          class_name: scoreData.class_name,
          zone: scoreData.zone,
          topic: scoreData.topic,
          score: scoreData.score,
          total: scoreData.total,
          stars: scoreData.stars,
          pts: scoreData.pts || 0,
          ts: Date.now()
        })
      });

      if (!response.ok) {
        console.error('Supabase error:', await response.text());
        return false;
      }

      return true;
    } catch (err) {
      console.error('Save score error:', err);
      return false;
    }
  }

  async getLeaderboard(zone, limit = 20) {
    try {
      const response = await fetch(
        `${this.url}/rest/v1/legacy_scores?zone=eq.${zone}&order=score.desc&limit=${limit}`,
        {
          headers: {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`
          }
        }
      );

      if (!response.ok) return [];
      return await response.json();
    } catch (err) {
      console.error('Get leaderboard error:', err);
      return [];
    }
  }

  async getClassLeaderboard(className, limit = 20) {
    try {
      const response = await fetch(
        `${this.url}/rest/v1/legacy_scores?class_name=eq.${encodeURIComponent(className)}&order=score.desc&limit=${limit}`,
        {
          headers: {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`
          }
        }
      );

      if (!response.ok) return [];
      return await response.json();
    } catch (err) {
      console.error('Get class leaderboard error:', err);
      return [];
    }
  }
}

// Export for use in games
function createClient(url, key) {
  return new SupabaseGamesClient(url, key);
}
