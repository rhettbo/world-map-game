// /script.js
// World Map Game — stable, single-audio quiz flow
// - Start Quiz button toggles to red "Exit Quiz" while active
// - Prevents stacked event listeners
// - Ensures only one prompt audio plays at a time
// - Clears pending next-question timers before scheduling new ones
// - Guards all optional DOM lookups

'use strict';

// ====== Config ======
const ids = [
  'africa', 'antarctica', 'arctic', 'asia', 'atlantic',
  'australia', 'europe', 'indian', 'north_america',
  'pacific', 'south_america', 'southern'
];

// Display names for question prompt
const NAME_MAP = {
  arctic: 'Arctic Ocean',
  atlantic: 'Atlantic Ocean',
  indian: 'Indian Ocean',
  pacific: 'Pacific Ocean',
  southern: 'Southern Ocean',
  north_america: 'North America',
  south_america: 'South America',
  antarctica: 'Antarctica',
  africa: 'Africa',
  asia: 'Asia',
  europe: 'Europe',
  australia: 'Australia',
};

// Colors
const NEUTRAL_FILL = '#d6d6d6';
const CORRECT_FILL = '#66ff66';
const GUESS_COLORS = ['#ffcccc', '#ff9999', '#ff6666', '#ff3333', '#ff0000'];

// ====== State ======
let quizActive = false;
let currentTarget = null;
let guessCount = 0;

let totalQuestions = 0;
let correctAnswers = 0;

let promptAudio = null;   // the "find_*" audio currently playing
let nextQTimer = null;    // pending setTimeout handle

// ====== DOM ======
const quizButton  = document.getElementById('quiz-button');
const questionUI  = document.getElementById('question-ui');
const questionBox = document.getElementById('current-question');
const repeatBtn   = document.getElementById('repeat-audio');
const resetBtn    = document.getElementById('reset-quiz');

const modal       = document.getElementById('quiz-modal');
const homeBtn     = document.getElementById('home-btn');
const practiceBtn = document.getElementById('practice-btn');
const resultTitle = document.getElementById('quiz-result-title');
const scoreText   = document.getElementById('quiz-score-text');

// Feedback sounds
const correctSound   = safeAudio('audio/correct.wav');
const wrongSound     = safeAudio('audio/try_again.wav');
const greatJobSound  = safeAudio('audio/great_job.wav');

// ====== Utilities ======
function displayName(id) {
  if (!id) return '';
  return NAME_MAP[id] ?? id.replace(/_/g, ' ').replace(/\b[a-z]/g, m => m.toUpperCase());
}

function safeAudio(src) {
  try {
    return new Audio(src);
  } catch {
    return { play() {}, pause() {}, currentTime: 0 };
  }
}

function getRegionEl(idOrEl) {
  return typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
}

function forEachRegionShape(idOrEl, cb) {
  const el = getRegionEl(idOrEl);
  if (!el) return;
  cb(el);
  el.querySelectorAll('path, polygon, polyline, rect, circle, ellipse, line, use').forEach(cb);
}

function setRegionFill(idOrEl, color) {
  forEachRegionShape(idOrEl, node => { node.style.fill = color; });
}

function clearRegionFill(idOrEl) {
  forEachRegionShape(idOrEl, node => { node.style.fill = ''; });
}

function stopPromptAudio() {
  if (!promptAudio) return;
  try { promptAudio.pause(); } catch {}
  try { promptAudio.currentTime = 0; } catch {}
  promptAudio = null;
}

function clearNextQTimer() {
  if (nextQTimer) {
    clearTimeout(nextQTimer);
    nextQTimer = null;
  }
}

function scheduleNextQuestion(delayMs = 800) {
  clearNextQTimer();
  nextQTimer = setTimeout(nextQuestion, delayMs);
}

// Reset neutral fill on all non-answered regions; keep answered green
function resetAllColors() {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('correct', 'incorrect', 'asked');
    if (!el.classList.contains('answered')) setRegionFill(el, NEUTRAL_FILL);
  });
}

// Update the Start/Exit Quiz button UI & semantics
function updateQuizButtonUI() {
  if (!quizButton) return;
  if (quizActive) {
    quizButton.textContent = 'Exit Quiz';
    quizButton.setAttribute('aria-label', 'Exit quiz mode');
    // red with white text
    quizButton.style.backgroundColor = '#c53030';
    quizButton.style.color = '#ffffff';
    quizButton.style.border = 'none';
  } else {
    quizButton.textContent = 'Start Quiz Mode';
    quizButton.setAttribute('aria-label', 'Start quiz mode');
    // revert to default styles (let CSS take over)
    quizButton.style.backgroundColor = '';
    quizButton.style.color = '';
    quizButton.style.border = '';
  }
}

// ====== Mode: Regular (non-quiz) — click to play region audio ======
ids.forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  const clickAudio = safeAudio(`audio/${id}.wav`);
  el.addEventListener('click', () => {
    if (quizActive) return; // no regular audio during quiz
    try { clickAudio.currentTime = 0; } catch {}
    clickAudio.play();
  });
});

// ====== Quiz Flow ======
function startQuizFresh() {
  quizActive = true;
  currentTarget = null;
  guessCount = 0;
  totalQuestions = 0;
  correctAnswers = 0;

  clearNextQTimer();
  stopPromptAudio();
  updateQuizButtonUI();

  if (questionUI) questionUI.style.display = 'inline-block';

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('answered', 'correct', 'incorrect', 'asked');
    setRegionFill(el, NEUTRAL_FILL);
  });

  nextQuestion();
}

function resetQuiz() {
  // Same as startFresh, but safe if called mid-quiz
  startQuizFresh();
}

function endQuizToHome() {
  quizActive = false;
  currentTarget = null;

  clearNextQTimer();
  stopPromptAudio();
  updateQuizButtonUI();

  if (questionUI) questionUI.style.display = 'none';

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('answered', 'correct', 'incorrect', 'asked');
    clearRegionFill(el); // restore original SVG colors
  });

  totalQuestions = 0;
  correctAnswers = 0;

  // Close results modal if it's open
  if (modal) modal.style.display = 'none';
}

function showQuizResults() {
  quizActive = false;
  currentTarget = null;

  clearNextQTimer();
  stopPromptAudio();
  updateQuizButtonUI();

  const score = Math.round((correctAnswers / ids.length) * 100);
  if (resultTitle) {
    resultTitle.textContent = (score === 100) ? 'Great Job!' : 'Quiz Complete!';
  }
  if (scoreText) {
    scoreText.textContent = `You got ${correctAnswers} out of ${ids.length} correct. (${score}%)`;
  }
  if (modal) modal.style.display = 'block';

  if (score === 100) greatJobSound.play();
}

function nextQuestion() {
  clearNextQTimer(); // prevent overlaps
  stopPromptAudio(); // stop previous prompt before starting a new one
  resetAllColors();

  const unanswered = ids.filter(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('answered');
  });

  if (unanswered.length === 0) {
    showQuizResults();
    return;
  }

  currentTarget = unanswered[Math.floor(Math.random() * unanswered.length)];
  guessCount = 0;

  // Play new prompt
  const promptFile = `audio/find_${currentTarget}.wav`;
  promptAudio = safeAudio(promptFile);
  promptAudio.play();

  if (questionBox) questionBox.textContent = `Find ${displayName(currentTarget)}`;
}

// Click handling during quiz
ids.forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener('click', () => {
    if (!quizActive || !currentTarget) return;

    // ignore clicks on already answered regions
    if (el.classList.contains('answered')) return;

    const isCorrect = (id === currentTarget);

    if (isCorrect) {
      el.classList.add('answered');
      setRegionFill(el, CORRECT_FILL);

      if (guessCount === 0) correctAnswers++;
      totalQuestions++;

      correctSound.play();
      scheduleNextQuestion(800);
    } else {
      setRegionFill(el, GUESS_COLORS[Math.min(guessCount, GUESS_COLORS.length - 1)]);
      guessCount++;
      wrongSound.play();

      if (guessCount >= 5) {
        const targetEl = document.getElementById(currentTarget);
        if (targetEl) {
          targetEl.classList.add('answered');
          setRegionFill(targetEl, CORRECT_FILL);
        }
        totalQuestions++;
        scheduleNextQuestion(800);
      }
    }
  });
});

// ====== Controls ======

// Start Quiz  ⇄  Exit Quiz (single listener, toggles by state)
if (quizButton && !quizButton.dataset.bound) {
  quizButton.dataset.bound = '1';
  updateQuizButtonUI(); // set initial look
  quizButton.addEventListener('click', () => {
    if (quizActive) {
      endQuizToHome();
    } else {
      startQuizFresh();
    }
  });
}

// Repeat current prompt
if (repeatBtn && !repeatBtn.dataset.bound) {
  repeatBtn.dataset.bound = '1';
  repeatBtn.addEventListener('click', () => {
    if (!promptAudio) return;
    try { promptAudio.currentTime = 0; } catch {}
    promptAudio.play();
  });
}

// Reset quiz (keep practicing from scratch)
if (resetBtn && !resetBtn.dataset.bound) {
  resetBtn.dataset.bound = '1';
  resetBtn.addEventListener('click', resetQuiz);
}

// Modal: Home
if (homeBtn && !homeBtn.dataset.bound) {
  homeBtn.dataset.bound = '1';
  homeBtn.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
    endQuizToHome();
  });
}

// Modal: Keep practicing
if (practiceBtn && !practiceBtn.dataset.bound) {
  practiceBtn.dataset.bound = '1';
  practiceBtn.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
    // critical: prevent stacked audios/timers when resuming
    clearNextQTimer();
    stopPromptAudio();
    startQuizFresh();
  });
}
