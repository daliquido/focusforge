/* ============================================================
   FOCUSFORGE — script.js
   All logic for the Pomodoro timer, task list, and progress.
   Written for beginners — every section is clearly commented.
   ============================================================ */


/* ============================================================
   SECTION 1: CONSTANTS & STATE
   These are the values and data our app keeps track of.
   ============================================================ */

// How many sessions count as a "full day" for the progress bar
const DAILY_GOAL = 8;

// Keys we use to save data in localStorage (browser storage)
const STORAGE_KEYS = {
  tasks:        'focusforge_tasks',
  sessions:     'focusforge_sessions',
  sessionDate:  'focusforge_session_date',
  streak:       'focusforge_streak',
  lastActive:   'focusforge_last_active',
};

// App state — one place that holds everything
const state = {
  // --- Timer state ---
  isRunning:       false,      // is the timer ticking right now?
  isWorkMode:      true,       // true = work session, false = break
  secondsLeft:     25 * 60,    // seconds remaining (default 25 min)
  intervalId:      null,       // holds the setInterval reference

  // --- Progress state ---
  sessionsToday:   0,
  streak:          0,
  lastActiveDate:  null,       // ISO date string of last session day

  // --- Task state ---
  tasks: [],                   // array of task objects { id, text, completed }
};


/* ============================================================
   SECTION 2: DOM REFERENCES
   Grab all the HTML elements we'll need to read or update.
   ============================================================ */

// Timer elements
const timerDisplay    = document.getElementById('timerDisplay');
const modeLabel       = document.getElementById('modeLabel');
const startPauseBtn   = document.getElementById('startPauseBtn');
const resetBtn        = document.getElementById('resetBtn');
const workMinutesInput  = document.getElementById('workMinutes');
const breakMinutesInput = document.getElementById('breakMinutes');

// Progress elements
const sessionsCompleted  = document.getElementById('sessionsCompleted');
const progressBarFill    = document.getElementById('progressBarFill');
const sessionDots        = document.getElementById('sessionDots');
const streakDisplay      = document.getElementById('streakDisplay');
const lastActiveDisplay  = document.getElementById('lastActiveDisplay');
const streakCount        = document.getElementById('streakCount');   // header badge

// Task elements
const taskInput    = document.getElementById('taskInput');
const addTaskBtn   = document.getElementById('addTaskBtn');
const taskList     = document.getElementById('taskList');
const taskSummary  = document.getElementById('taskSummary');
const emptyState   = document.getElementById('emptyState');


/* ============================================================
   SECTION 3: TIMER LOGIC
   ============================================================ */

/**
 * Returns the total seconds for the current mode (work or break).
 * Reads from the input fields so the user can customise durations.
 */
function getTotalSeconds() {
  if (state.isWorkMode) {
    const mins = parseInt(workMinutesInput.value, 10) || 25;
    return mins * 60;
  } else {
    const mins = parseInt(breakMinutesInput.value, 10) || 5;
    return mins * 60;
  }
}

/**
 * Formats a number of seconds into MM:SS string, e.g. 90 → "01:30"
 */
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  // padStart ensures two digits, e.g. 5 → "05"
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Updates the timer display text and the browser tab title.
 */
function renderTimer() {
  timerDisplay.textContent = formatTime(state.secondsLeft);
  document.title = `${formatTime(state.secondsLeft)} — FocusForge`;
}

/**
 * Updates the mode label pill ("Work Session" / "Break Time").
 */
function renderModeLabel() {
  if (state.isWorkMode) {
    modeLabel.textContent = 'Work Session';
    modeLabel.classList.remove('break');
  } else {
    modeLabel.textContent = '☕ Break Time';
    modeLabel.classList.add('break');
  }
}

/**
 * Called every second by setInterval.
 * Counts down; when it hits 0, it switches modes.
 */
function tick() {
  if (state.secondsLeft <= 0) {
    // Time is up — handle session completion
    handleSessionEnd();
    return;
  }
  state.secondsLeft--;
  renderTimer();
}

/**
 * Called when a session (work or break) finishes.
 */
function handleSessionEnd() {
  // Stop the interval
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.isRunning  = false;

  // Play a gentle audio beep to notify the user
  playBeep();

  if (state.isWorkMode) {
    // A work session just finished — record it
    state.sessionsToday++;
    saveProgress();
    renderProgress();
    updateStreak();

    // Switch to break mode
    state.isWorkMode = false;
  } else {
    // A break just finished — switch back to work mode
    state.isWorkMode = true;
  }

  // Reset the timer for the new mode
  state.secondsLeft = getTotalSeconds();

  // Update UI
  renderModeLabel();
  renderTimer();
  startPauseBtn.textContent = 'Start';
  timerDisplay.classList.remove('running');
}

/**
 * Starts the countdown timer using setInterval.
 */
function startTimer() {
  // Don't start a second interval if one is already running
  if (state.intervalId) return;

  state.isRunning = true;
  state.intervalId = setInterval(tick, 1000);

  startPauseBtn.textContent = 'Pause';
  timerDisplay.classList.add('running');   // starts the CSS pulse animation
}

/**
 * Pauses the countdown.
 */
function pauseTimer() {
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.isRunning = false;

  startPauseBtn.textContent = 'Start';
  timerDisplay.classList.remove('running');
}

/**
 * Resets the timer back to the current mode's full duration.
 */
function resetTimer() {
  pauseTimer();
  state.secondsLeft = getTotalSeconds();
  renderTimer();
}

/**
 * Produces a short beep using the Web Audio API (no external files needed).
 */
function playBeep() {
  try {
    // AudioContext is the browser's built-in sound engine
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.value = 880;        // 880 Hz = musical A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // If the browser blocks audio (unlikely), silently ignore
    console.warn('Audio not available:', e);
  }
}

/* ── Timer event listeners ── */

// Start / Pause button toggles between starting and pausing
startPauseBtn.addEventListener('click', () => {
  if (state.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

// Reset button
resetBtn.addEventListener('click', resetTimer);

// When the user changes a minute input, reset the timer so it reflects the new duration
workMinutesInput.addEventListener('change', () => {
  if (!state.isRunning && state.isWorkMode) {
    resetTimer();
  }
});

breakMinutesInput.addEventListener('change', () => {
  if (!state.isRunning && !state.isWorkMode) {
    resetTimer();
  }
});


/* ============================================================
   SECTION 4: PROGRESS & STREAK LOGIC
   ============================================================ */

/**
 * Checks if today is a new day compared to the saved date.
 * Returns today's date as a string like "2025-04-01".
 */
function getTodayString() {
  return new Date().toISOString().slice(0, 10);   // "YYYY-MM-DD"
}

/**
 * Updates the streak counter.
 * Streak increases if the user has completed a session today.
 * It resets if they missed a day.
 */
function updateStreak() {
  const today     = getTodayString();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (state.lastActiveDate === today) {
    // Already recorded today — no change to streak number
  } else if (state.lastActiveDate === yesterday || state.lastActiveDate === null) {
    // Consecutive day (or first ever session) — increment streak
    state.streak++;
    state.lastActiveDate = today;
  } else {
    // Missed at least one day — reset streak
    state.streak = 1;
    state.lastActiveDate = today;
  }

  saveProgress();
  renderProgress();
}

/**
 * Renders the progress card (dots, bar, counts, streak).
 */
function renderProgress() {
  // Update big number
  sessionsCompleted.textContent = state.sessionsToday;

  // Progress bar: cap at 100%
  const pct = Math.min((state.sessionsToday / DAILY_GOAL) * 100, 100);
  progressBarFill.style.width = `${pct}%`;

  // Render 8 session dots
  sessionDots.innerHTML = '';
  for (let i = 0; i < DAILY_GOAL; i++) {
    const dot = document.createElement('div');
    dot.className = 'session-dot' + (i < state.sessionsToday ? ' done' : '');
    sessionDots.appendChild(dot);
  }

  // Streak displays
  streakDisplay.textContent = state.streak;
  streakCount.textContent   = state.streak;   // header badge

  // Last active date (human-friendly)
  if (state.lastActiveDate) {
    const d = new Date(state.lastActiveDate + 'T12:00:00');  // noon avoids timezone issues
    lastActiveDisplay.textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } else {
    lastActiveDisplay.textContent = '—';
  }
}


/* ============================================================
   SECTION 5: TASK LIST LOGIC
   ============================================================ */

/**
 * Creates a unique ID for each task using the current timestamp.
 */
function generateId() {
  return Date.now().toString();
}

/**
 * Adds a new task to the state and re-renders the list.
 */
function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;    // don't add empty tasks

  // Build a task object
  const task = {
    id:        generateId(),
    text:      text,
    completed: false,
  };

  state.tasks.push(task);
  taskInput.value = '';    // clear the input

  saveTasks();
  renderTasks();
}

/**
 * Toggles a task's completed state.
 * @param {string} id - The task's unique ID
 */
function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
  }
}

/**
 * Removes a task from the list.
 * @param {string} id - The task's unique ID
 */
function deleteTask(id) {
  // filter() returns a new array without the matching task
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
}

/**
 * Builds and renders the entire task list from state.tasks.
 * We clear the <ul> and rebuild it each time — simple and reliable.
 */
function renderTasks() {
  taskList.innerHTML = '';    // clear existing items

  // Show or hide the empty-state message
  if (state.tasks.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
  }

  // Build each task row as a <li> element
  state.tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');

    // Checkbox to toggle completion
    const checkbox = document.createElement('input');
    checkbox.type      = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked   = task.completed;
    checkbox.addEventListener('change', () => toggleTask(task.id));

    // Task text label
    const span = document.createElement('span');
    span.className   = 'task-text';
    span.textContent = task.text;

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className   = 'btn-delete';
    deleteBtn.textContent = '✕';
    deleteBtn.title       = 'Delete task';
    deleteBtn.addEventListener('click', () => deleteTask(task.id));

    // Assemble the row
    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(deleteBtn);
    taskList.appendChild(li);
  });

  // Update the summary line ("3 / 5 done")
  const total     = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  taskSummary.textContent = `${completed} / ${total} done`;
}

/* ── Task event listeners ── */

// "Add" button click
addTaskBtn.addEventListener('click', addTask);

// Allow pressing Enter in the text input to add a task
taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTask();
});


/* ============================================================
   SECTION 6: LOCAL STORAGE (saving & loading data)
   localStorage lets us persist data between page loads.
   JSON.stringify converts objects → strings for storage.
   JSON.parse converts strings → objects when loading.
   ============================================================ */

/** Saves the task array to localStorage. */
function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
}

/** Saves session count, streak, and dates to localStorage. */
function saveProgress() {
  localStorage.setItem(STORAGE_KEYS.sessions,    JSON.stringify(state.sessionsToday));
  localStorage.setItem(STORAGE_KEYS.sessionDate,  getTodayString());
  localStorage.setItem(STORAGE_KEYS.streak,       JSON.stringify(state.streak));
  localStorage.setItem(STORAGE_KEYS.lastActive,   state.lastActiveDate || '');
}

/**
 * Loads all saved data from localStorage when the page loads.
 * If nothing is saved yet, default values from state are used.
 */
function loadFromStorage() {
  // ── Load tasks ──
  const savedTasks = localStorage.getItem(STORAGE_KEYS.tasks);
  if (savedTasks) {
    state.tasks = JSON.parse(savedTasks);
  }

  // ── Load progress ──
  // Check if the saved session date is today; if not, reset the count
  const savedDate = localStorage.getItem(STORAGE_KEYS.sessionDate);
  const today     = getTodayString();

  if (savedDate === today) {
    // Same day — restore the session count
    const savedSessions = localStorage.getItem(STORAGE_KEYS.sessions);
    if (savedSessions !== null) {
      state.sessionsToday = JSON.parse(savedSessions);
    }
  } else {
    // New day — reset session count (but keep streak)
    state.sessionsToday = 0;
  }

  // ── Load streak ──
  const savedStreak = localStorage.getItem(STORAGE_KEYS.streak);
  if (savedStreak !== null) {
    state.streak = JSON.parse(savedStreak);
  }

  const savedLastActive = localStorage.getItem(STORAGE_KEYS.lastActive);
  if (savedLastActive) {
    state.lastActiveDate = savedLastActive;
  }

  // Check if the streak should be reset (missed days)
  checkStreakReset();
}

/**
 * If the user hasn't been active since before yesterday, reset the streak.
 */
function checkStreakReset() {
  if (!state.lastActiveDate) return;

  const today     = getTodayString();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (state.lastActiveDate !== today && state.lastActiveDate !== yesterday) {
    // They missed at least one day — streak is gone
    state.streak = 0;
    saveProgress();
  }
}


/* ============================================================
   SECTION 7: INITIALISATION
   This runs once when the page first loads.
   ============================================================ */

function init() {
  // Load any previously saved data
  loadFromStorage();

  // Set the timer display to default work duration
  state.secondsLeft = getTotalSeconds();

  // Render everything
  renderTimer();
  renderModeLabel();
  renderProgress();
  renderTasks();
}

// Kick everything off!
init();
