// AI Hint System - Add to games (grammar-cloze, synthesis, etc.)
// This is a helper module that integrates into existing games

const AIHintSystem = {
  GROQ_API_KEY: 'gsk_xxxxxxxxxxxx', // To be configured by teacher
  
  hints: {
    'grammar-cloze': [
      'Read the sentence aloud. Does it sound right?',
      'Check if the word needs to be singular or plural',
      'Look at the tense: past, present, or future?',
      'What part of speech is missing? Noun, verb, adjective?',
      'Try each option and see which fits best'
    ],
    'synthesis': [
      'What type of connector is needed? (reason, time, addition, contrast)',
      'Look at the relationship between the two sentences',
      'Is it cause-and-effect? Then use "because" or "so"',
      'Is it adding information? Then use "and", "also", "in addition"',
      'Say both sentences in your head and hear which sounds better'
    ],
    'reported-speech': [
      'Did the original speaker use "I" or "he/she"?',
      'Change "I" to the person\'s name or "he/she"',
      'Adjust the tense if needed (present → past)',
      'Remove words like "please" and make it indirect',
      'Read both versions: direct and reported. Which is correct?'
    ],
    'spelling': [
      'Break the word into smaller parts',
      'Sound it out: letter by letter',
      'Look for common spelling patterns',
      'Remember: i before e except after c',
      'Write it different ways and see which "looks" right'
    ],
    'vocabulary': [
      'Look for context clues in the sentence',
      'Does the missing word need to be positive or negative?',
      'What part of speech is it? Adjective, verb, noun?',
      'Think of synonyms (words with similar meaning)',
      'Eliminate options that don\'t make sense'
    ]
  },

  async getContextualHint(gameType, question, studentAnswer = null) {
    // Generic hints based on game type
    const baseHints = this.hints[gameType] || this.hints['grammar-cloze'];
    
    // If Groq is configured, get AI-powered hint
    if (this.GROQ_API_KEY && this.GROQ_API_KEY !== 'gsk_xxxxxxxxxxxx') {
      try {
        return await this.getGroqHint(gameType, question, studentAnswer);
      } catch (err) {
        console.error('Groq hint error:', err);
        return this.getRandomHint(baseHints);
      }
    }
    
    // Fallback to random generic hint
    return this.getRandomHint(baseHints);
  },

  async getGroqHint(gameType, question, studentAnswer) {
    const prompt = `You are a helpful English tutor giving a hint (not the answer) to a P4 student.

Game: ${gameType}
Question: ${question}
Student's attempt: ${studentAnswer || 'Not yet answered'}

Give ONE brief, encouraging hint that:
1. Does NOT reveal the answer
2. Guides them to think through it
3. Uses simple language
4. Is 1-2 sentences max

Example good hints:
- "Look at the verbs in both sentences - what tense are they?"
- "If you remove the words 'very' and 'really', what's left?"
- "Say the sentence out loud with each option. Which sounds most natural?"

Your hint:`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [{role: 'user', content: prompt}],
          max_tokens: 100,
          temperature: 0.7
        })
      });

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (err) {
      console.error('Groq API error:', err);
      return null;
    }
  },

  getRandomHint(hints) {
    return hints[Math.floor(Math.random() * hints.length)];
  },

  // HTML template for hint button
  renderHintButton(gameType) {
    return `
      <button id="hintBtn" class="hint-button" onclick="showHint('${gameType}')">
        💡 Need a Hint?
      </button>
      <div id="hintBox" style="display:none;background:rgba(212,165,116,.15);padding:12px;border-radius:8px;margin-top:12px;border-left:3px solid #D4A574">
        <strong style="font-size:12px;color:#6B6B6B">Hint:</strong>
        <p id="hintText" style="margin-top:8px;font-size:13px;color:#E8EAF6"></p>
        <button onclick="closeHint()" style="margin-top:8px;padding:6px 12px;background:#D4A574;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer">Got it, hiding hint</button>
      </div>
    `;
  },

  renderHintCSS() {
    return `
      .hint-button {
        margin-top: 16px;
        padding: 10px 16px;
        background: rgba(212, 165, 116, 0.15);
        border: 1px solid rgba(212, 165, 116, 0.3);
        color: #D4A574;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .hint-button:hover {
        background: rgba(212, 165, 116, 0.25);
      }
      .hint-button.used {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
};

// Integration functions
async function showHint(gameType) {
  const hintBtn = document.getElementById('hintBtn');
  hintBtn.disabled = true;
  hintBtn.classList.add('used');
  hintBtn.textContent = '💡 Loading hint...';

  const question = document.getElementById('questionText')?.textContent || 'Unknown question';
  const hint = await AIHintSystem.getContextualHint(gameType, question);

  document.getElementById('hintText').textContent = hint;
  document.getElementById('hintBox').style.display = 'block';
  hintBtn.textContent = '💡 Hint Used';
}

function closeHint() {
  document.getElementById('hintBox').style.display = 'none';
}

// Export for use in game files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIHintSystem;
}
