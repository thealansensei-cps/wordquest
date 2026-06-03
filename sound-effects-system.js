/**
 * WordQuest Sound Effects System
 * Provides audio feedback for game events
 * Uses Web Audio API + HTML5 Audio
 * 
 * Usage:
 * - Include this file in game HTML
 * - Call soundFx.play('correct') when student answers correctly
 * - Call soundFx.toggle() to let users mute
 */

const SoundEffects = {
  enabled: localStorage.getItem('wordquest_sound_enabled') !== 'false',
  
  // Audio context for Web Audio API synthesis
  audioContext: null,
  
  init() {
    // Initialize audio context on first user interaction
    if (!this.audioContext) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
  },

  // Sound effects library
  sounds: {
    correct: {
      type: 'synth',
      notes: [523, 659, 784], // C5, E5, G5
      duration: 0.2,
      volume: 0.3
    },
    incorrect: {
      type: 'synth',
      notes: [261], // C4
      duration: 0.3,
      volume: 0.2
    },
    success: {
      type: 'synth',
      notes: [523, 659, 784, 1047], // C5, E5, G5, C6
      duration: 0.15,
      volume: 0.3
    },
    levelUp: {
      type: 'synth',
      notes: [523, 523, 784, 784, 1047],
      duration: 0.1,
      volume: 0.3
    },
    click: {
      type: 'synth',
      notes: [440],
      duration: 0.05,
      volume: 0.1
    },
    achievement: {
      type: 'synth',
      notes: [659, 784, 880, 988],
      duration: 0.12,
      volume: 0.3
    },
    streak: {
      type: 'synth',
      notes: [784, 784, 988, 1047, 988],
      duration: 0.1,
      volume: 0.3
    },
    gameOver: {
      type: 'synth',
      notes: [523, 523, 440, 392],
      duration: 0.15,
      volume: 0.25
    },
    hint: {
      type: 'synth',
      notes: [440, 494, 523],
      duration: 0.1,
      volume: 0.2
    },
    timer: {
      type: 'synth',
      notes: [880],
      duration: 0.05,
      volume: 0.15
    }
  },

  /**
   * Play a sound effect
   * @param {string} soundName - Name of the sound to play
   */
  play(soundName) {
    if (!this.enabled) return;
    
    this.init();
    
    const sound = this.sounds[soundName];
    if (!sound) {
      console.warn(`Sound "${soundName}" not found`);
      return;
    }

    if (sound.type === 'synth') {
      this.playSynth(sound);
    }
  },

  /**
   * Play synthesized sound using Web Audio API
   * @param {object} sound - Sound configuration
   */
  playSynth(sound) {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.setValueAtTime(sound.volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + sound.duration * sound.notes.length);

    sound.notes.forEach((frequency, index) => {
      const startTime = now + (index * sound.duration);
      const endTime = startTime + sound.duration;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);
      osc.connect(gainNode);
      osc.start(startTime);
      osc.stop(endTime);
    });
  },

  /**
   * Toggle sound on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('wordquest_sound_enabled', this.enabled);
    return this.enabled;
  },

  /**
   * Check if sound is enabled
   */
  isEnabled() {
    return this.enabled;
  }
};

// HTML for sound toggle button (add to game pages)
const soundButtonHTML = `
<button id="soundToggleBtn" class="sound-toggle-btn" onclick="toggleSound()" title="Toggle sound effects">
  <span id="soundIcon">🔊</span>
</button>

<style>
.sound-toggle-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--accent, #7C3AED);
  color: #fff;
  border: none;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  transition: all 0.2s;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sound-toggle-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0,0,0,0.3);
}

.sound-toggle-btn:active {
  transform: scale(0.95);
}

.sound-toggle-btn.muted {
  background: #999;
}

@media screen and (max-width: 768px) {
  .sound-toggle-btn {
    bottom: 16px;
    right: 16px;
    width: 44px;
    height: 44px;
    font-size: 18px;
  }
}
</style>

<script>
function toggleSound() {
  const btn = document.getElementById('soundToggleBtn');
  const icon = document.getElementById('soundIcon');
  const enabled = SoundEffects.toggle();
  
  if (enabled) {
    icon.textContent = '🔊';
    btn.classList.remove('muted');
    SoundEffects.play('click');
  } else {
    icon.textContent = '🔇';
    btn.classList.add('muted');
  }
}

// Initialize button state on load
window.addEventListener('load', () => {
  if (!SoundEffects.isEnabled()) {
    document.getElementById('soundToggleBtn')?.classList.add('muted');
    document.getElementById('soundIcon').textContent = '🔇';
  }
});
</script>
`;

// Integration examples for game files
const integrationExamples = {
  correctAnswer() {
    // In your game's answer check function
    if (isCorrect) {
      SoundEffects.play('correct');
      // ... rest of code
    }
  },

  incorrectAnswer() {
    // For wrong answers
    if (!isCorrect) {
      SoundEffects.play('incorrect');
      // ... rest of code
    }
  },

  buttonClick() {
    // Play click sound on button interactions
    SoundEffects.play('click');
  },

  achievementUnlock() {
    // When student unlocks an achievement
    SoundEffects.play('achievement');
    // ... rest of code
  },

  streakMilestone() {
    // When student hits a streak milestone
    SoundEffects.play('streak');
    // ... rest of code
  },

  gameComplete() {
    // When game is completed
    SoundEffects.play('success');
    // ... rest of code
  },

  timerWarning() {
    // When time is running out (10 seconds left)
    SoundEffects.play('timer');
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SoundEffects, soundButtonHTML, integrationExamples };
}
