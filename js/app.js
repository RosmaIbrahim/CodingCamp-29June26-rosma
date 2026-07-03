/**
 * To-Do List Dashboard — Main Application Script
 * Single JS file: js/app.js
 *
 * Modules:
 *   1. StorageManager      — localStorage abstraction + preference helpers
 *   2. ThemeManager        — light/dark mode toggle
 *   3. GreetingWidget      — live clock, date, greeting, custom name
 *   4. FocusTimer          — Pomodoro countdown with custom duration
 *   5. TodoManager         — CRUD + duplicate prevention + sort
 *   6. QuickLinksManager   — bookmarked URL management
 */

'use strict';

// ============================================================
// StorageManager
// ============================================================
const StorageManager = {
  isAvailable: false,

  init() {
    const TEST_KEY = '__todo_storage_test__';
    try {
      localStorage.setItem(TEST_KEY, '1');
      const val = localStorage.getItem(TEST_KEY);
      localStorage.removeItem(TEST_KEY);
      this.isAvailable = val === '1';
    } catch (_e) {
      this.isAvailable = false;
    }
  },

  // --- Tasks ---
  loadTasks() {
    const KEY = 'todo-list-dashboard-tasks';
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) { localStorage.removeItem(KEY); return []; }
      return parsed;
    } catch (_e) { localStorage.removeItem(KEY); return []; }
  },

  saveTasks(tasks) {
    if (!this.isAvailable) return { ok: true };
    try {
      localStorage.setItem('todo-list-dashboard-tasks', JSON.stringify(tasks));
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  // --- Links ---
  loadLinks() {
    const KEY = 'todo-list-dashboard-links';
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) { localStorage.removeItem(KEY); return []; }
      return parsed;
    } catch (_e) { localStorage.removeItem(KEY); return []; }
  },

  saveLinks(links) {
    if (!this.isAvailable) return { ok: true };
    try {
      localStorage.setItem('todo-list-dashboard-links', JSON.stringify(links));
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  // --- Preferences (simple string key/value) ---
  loadPref(key, defaultValue) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : defaultValue;
    } catch (_e) { return defaultValue; }
  },

  savePref(key, value) {
    if (!this.isAvailable) return { ok: true };
    try {
      localStorage.setItem(key, String(value));
      return { ok: true };
    } catch (e) {
      console.error('StorageManager.savePref error:', e);
      return { ok: false, error: e.message };
    }
  },

  removePref(key) {
    try { localStorage.removeItem(key); } catch (_e) {}
  },
};

// ============================================================
// ThemeManager
// ============================================================
const ThemeManager = {
  _current: 'light',
  _toggleBtn: null,

  /** Apply a theme to the root element and update button icon. */
  _apply(theme) {
    this._current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (this._toggleBtn) {
      this._toggleBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
      this._toggleBtn.setAttribute('aria-label',
        theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap');
    }
  },

  init() {
    this._toggleBtn = document.getElementById('theme-toggle');

    // Load saved theme; validate; fall back to 'light'
    const saved = StorageManager.loadPref('dashboard-theme', 'light');
    const theme = (saved === 'dark' || saved === 'light') ? saved : 'light';
    this._apply(theme);

    if (this._toggleBtn) {
      this._toggleBtn.addEventListener('click', () => {
        const next = this._current === 'light' ? 'dark' : 'light';
        this._apply(next);
        StorageManager.savePref('dashboard-theme', next);
      });
    }
  },
};

// ============================================================
// GreetingWidget  (clock + date + greeting + custom name)
// ============================================================
const GREETING_PERIODS = [
  { from:  0, to: 11, text: 'Selamat Pagi'  },
  { from: 12, to: 14, text: 'Selamat Siang' },
  { from: 15, to: 17, text: 'Selamat Sore'  },
  { from: 18, to: 23, text: 'Selamat Malam' },
];

const GreetingWidget = {
  _clockEl:      null,
  _dateEl:       null,
  _greetingEl:   null,
  _nameDisplay:  null,
  _nameEditBtn:  null,
  _nameInputRow: null,
  _nameInput:    null,
  _nameSaveBtn:  null,
  _nameCancelBtn:null,
  _nameErrorEl:  null,
  _userName: '',

  _pad(n) { return String(n).padStart(2, '0'); },

  _formatDate(date) {
    const DAYS   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];
    return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  },

  _getGreetingText(hour) {
    for (const p of GREETING_PERIODS) {
      if (hour >= p.from && hour <= p.to) return p.text;
    }
    return 'Halo';
  },

  _updateClock() {
    const now = new Date();
    if (this._clockEl) this._clockEl.textContent = `${this._pad(now.getHours())}:${this._pad(now.getMinutes())}`;
    if (this._dateEl)  this._dateEl.textContent  = this._formatDate(now);
  },

  _updateGreeting() {
    if (!this._greetingEl) return;
    const base = this._getGreetingText(new Date().getHours());
    this._greetingEl.textContent = this._userName
      ? `${base}, ${this._userName}!`
      : base;
  },

  _showNameError(msg) {
    if (this._nameErrorEl) this._nameErrorEl.textContent = msg || '';
  },

  _openNameEditor() {
    if (this._nameInput) this._nameInput.value = this._userName;
    this._nameInputRow?.classList.remove('hidden');
    this._nameEditBtn?.classList.add('hidden');
    this._showNameError('');
    this._nameInput?.focus();
  },

  _closeNameEditor() {
    this._nameInputRow?.classList.add('hidden');
    this._nameEditBtn?.classList.remove('hidden');
    this._showNameError('');
  },

  _saveName() {
    const raw = this._nameInput ? this._nameInput.value : '';
    const trimmed = raw.trim();

    if (trimmed.length > 50) {
      this._showNameError('Nama maksimal 50 karakter.');
      return;
    }

    if (trimmed === '') {
      // Clear name
      this._userName = '';
      StorageManager.removePref('dashboard-user-name');
    } else {
      this._userName = trimmed;
      StorageManager.savePref('dashboard-user-name', trimmed);
    }

    // Update display
    if (this._nameDisplay) {
      this._nameDisplay.textContent = this._userName ? `👤 ${this._userName}` : '';
    }
    this._updateGreeting();
    this._closeNameEditor();
  },

  init() {
    this._clockEl       = document.getElementById('clock-display');
    this._dateEl        = document.getElementById('date-display');
    this._greetingEl    = document.getElementById('greeting-text');
    this._nameDisplay   = document.getElementById('name-display');
    this._nameEditBtn   = document.getElementById('name-edit-btn');
    this._nameInputRow  = document.getElementById('name-input-row');
    this._nameInput     = document.getElementById('name-input');
    this._nameSaveBtn   = document.getElementById('name-save-btn');
    this._nameCancelBtn = document.getElementById('name-cancel-btn');
    this._nameErrorEl   = document.getElementById('name-error');

    // Load saved name
    const saved = StorageManager.loadPref('dashboard-user-name', '');
    this._userName = saved.trim();
    if (this._nameDisplay) {
      this._nameDisplay.textContent = this._userName ? `👤 ${this._userName}` : '';
    }

    // Events
    this._nameEditBtn?.addEventListener('click', () => this._openNameEditor());
    this._nameSaveBtn?.addEventListener('click', () => this._saveName());
    this._nameCancelBtn?.addEventListener('click', () => this._closeNameEditor());
    this._nameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._saveName(); }
      if (e.key === 'Escape') this._closeNameEditor();
    });
    this._nameInput?.addEventListener('input', () => this._showNameError(''));

    this._updateClock();
    this._updateGreeting();

    setInterval(() => this._updateClock(),    1000);
    setInterval(() => this._updateGreeting(), 60000);
  },
};

// ============================================================
// FocusTimer  (custom duration, persisted)
// ============================================================
const FocusTimer = {
  _totalSeconds: 1500,
  _remaining:    1500,
  _intervalId:   null,
  _isRunning:    false,

  _displayEl:        null,
  _startBtn:         null,
  _stopBtn:          null,
  _resetBtn:         null,
  _durationEditBtn:  null,
  _durationInputRow: null,
  _durationInput:    null,
  _durationSaveBtn:  null,
  _durationCancelBtn:null,
  _durationErrorEl:  null,

  _pad(n) { return String(n).padStart(2, '0'); },

  _render() {
    const mins = Math.floor(this._remaining / 60);
    const secs = this._remaining % 60;
    if (this._displayEl) {
      this._displayEl.textContent = `${this._pad(mins)}:${this._pad(secs)}`;
      this._displayEl.classList.toggle('timer-complete', this._remaining === 0);
    }
  },

  _tick() {
    if (this._remaining > 0) this._remaining -= 1;
    this._render();
    if (this._remaining === 0) this.stop();
  },

  start() {
    if (this._isRunning) return;
    this._isRunning = true;
    if (this._startBtn) this._startBtn.disabled = true;
    this._intervalId = setInterval(() => this._tick(), 1000);
  },

  stop() {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._isRunning  = false;
    if (this._startBtn) this._startBtn.disabled = false;
  },

  reset() {
    this.stop();
    this._remaining = this._totalSeconds;
    this._render();
  },

  _showDurationError(msg) {
    if (this._durationErrorEl) this._durationErrorEl.textContent = msg || '';
  },

  _openDurationEditor() {
    const currentMins = Math.round(this._totalSeconds / 60);
    if (this._durationInput) this._durationInput.value = currentMins;
    this._durationInputRow?.classList.remove('hidden');
    this._durationEditBtn?.classList.add('hidden');
    this._showDurationError('');
    this._durationInput?.focus();
  },

  _closeDurationEditor() {
    this._durationInputRow?.classList.add('hidden');
    this._durationEditBtn?.classList.remove('hidden');
    this._showDurationError('');
  },

  _saveDuration() {
    const raw = this._durationInput ? this._durationInput.value : '';
    const mins = parseInt(raw, 10);

    if (!Number.isInteger(mins) || mins < 1 || mins > 60) {
      this._showDurationError('Masukkan angka antara 1–60 menit.');
      return;
    }

    this._totalSeconds = mins * 60;
    StorageManager.savePref('dashboard-pomodoro-duration', mins);
    this.reset();           // stop any running/paused timer, update display
    this._closeDurationEditor();
  },

  init() {
    this._displayEl         = document.getElementById('timer-display');
    this._startBtn          = document.getElementById('timer-start');
    this._stopBtn           = document.getElementById('timer-stop');
    this._resetBtn          = document.getElementById('timer-reset');
    this._durationEditBtn   = document.getElementById('duration-edit-btn');
    this._durationInputRow  = document.getElementById('duration-input-row');
    this._durationInput     = document.getElementById('duration-input');
    this._durationSaveBtn   = document.getElementById('duration-save-btn');
    this._durationCancelBtn = document.getElementById('duration-cancel-btn');
    this._durationErrorEl   = document.getElementById('duration-error');

    // Load saved duration
    const savedStr  = StorageManager.loadPref('dashboard-pomodoro-duration', '25');
    const savedMins = parseInt(savedStr, 10);
    if (Number.isInteger(savedMins) && savedMins >= 1 && savedMins <= 60) {
      this._totalSeconds = savedMins * 60;
    }
    this._remaining = this._totalSeconds;

    // Timer controls
    this._startBtn?.addEventListener('click', () => this.start());
    this._stopBtn?.addEventListener('click',  () => this.stop());
    this._resetBtn?.addEventListener('click', () => this.reset());

    // Duration editor
    this._durationEditBtn?.addEventListener('click', () => this._openDurationEditor());
    this._durationSaveBtn?.addEventListener('click', () => this._saveDuration());
    this._durationCancelBtn?.addEventListener('click', () => this._closeDurationEditor());
    this._durationInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._saveDuration(); }
      if (e.key === 'Escape') this._closeDurationEditor();
    });
    this._durationInput?.addEventListener('input', () => this._showDurationError(''));

    this._render();
  },
};

// ============================================================
// TodoManager  (CRUD + duplicate prevention + sort)
// ============================================================
const VALID_SORT_ORDERS = ['oldest-first', 'newest-first', 'alpha-az', 'incomplete-first'];

const TodoManager = {
  _tasks:     [],
  _sortOrder: 'oldest-first',

  _inputEl:  null,
  _errorEl:  null,
  _listEl:   null,
  _formEl:   null,
  _sortEl:   null,

  _generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString() + Math.random().toString(36).slice(2);
  },

  _showError(msg) {
    if (this._errorEl) this._errorEl.textContent = msg || '';
  },

  /** Basic length/empty validation. Returns { valid, error }. */
  _validate(text) {
    if (text.trim() === '')  return { valid: false, error: 'Teks tugas tidak boleh kosong.' };
    if (text.length > 200)   return { valid: false, error: 'Teks tugas tidak boleh melebihi 200 karakter.' };
    return { valid: true };
  },

  /**
   * Duplicate check: case-insensitive, trimmed.
   * excludeId: skip the task being edited (self-comparison allowed).
   */
  _isDuplicate(text, excludeId = null) {
    const normalized = text.trim().toLowerCase();
    return this._tasks.some(t => t.id !== excludeId && t.text.toLowerCase() === normalized);
  },

  _loadFromStorage() {
    this._tasks = StorageManager.loadTasks();
  },

  _saveToStorage() {
    return StorageManager.saveTasks(this._tasks).ok === true;
  },

  /** Return a sorted copy of _tasks without mutating the original array. */
  _getSorted() {
    const copy = this._tasks.slice();
    switch (this._sortOrder) {
      case 'newest-first':
        return copy.sort((a, b) => b.createdAt - a.createdAt);
      case 'alpha-az':
        return copy.sort((a, b) => a.text.localeCompare(b.text, 'id'));
      case 'incomplete-first':
        return copy.sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return a.createdAt - b.createdAt;   // secondary: oldest first
        });
      case 'oldest-first':
      default:
        return copy.sort((a, b) => a.createdAt - b.createdAt);
    }
  },

  addTask(text) {
    const v = this._validate(text);
    if (!v.valid) { this._showError(v.error); return; }

    if (this._isDuplicate(text)) {
      this._showError(`Tugas "${text.trim()}" sudah ada dalam daftar.`);
      return;
    }

    const snapshot = this._tasks.slice();
    this._tasks.push({ id: this._generateId(), text: text.trim(), completed: false, createdAt: Date.now() });

    if (!this._saveToStorage()) {
      this._tasks = snapshot;
      this._showError('Gagal menyimpan tugas. Silakan coba lagi.');
      return;
    }

    this._showError('');
    if (this._inputEl) this._inputEl.value = '';
    this._renderList();
  },

  editTask(id, newText) {
    const v = this._validate(newText);
    if (!v.valid) { this._showError(v.error); return; }

    if (this._isDuplicate(newText, id)) {
      this._showError(`Tugas "${newText.trim()}" sudah ada dalam daftar.`);
      return;
    }

    const task = this._tasks.find(t => t.id === id);
    if (!task) return;
    const original = task.text;
    task.text = newText.trim();

    if (!this._saveToStorage()) {
      task.text = original;
      this._showError('Gagal menyimpan perubahan. Silakan coba lagi.');
      return;
    }

    this._showError('');
    this._renderList();
  },

  toggleTask(id) {
    const task = this._tasks.find(t => t.id === id);
    if (!task) return;
    const orig = task.completed;
    task.completed = !task.completed;

    if (!this._saveToStorage()) {
      task.completed = orig;
      this._showError('Gagal menyimpan perubahan. Silakan coba lagi.');
      return;
    }
    this._showError('');
    this._renderList();
  },

  deleteTask(id) {
    const snapshot = this._tasks.slice();
    this._tasks = this._tasks.filter(t => t.id !== id);

    if (!this._saveToStorage()) {
      this._tasks = snapshot;
      this._showError('Gagal menghapus tugas. Silakan coba lagi.');
      return;
    }
    this._showError('');
    this._renderList();
  },

  _renderItem(task) {
    const li = document.createElement('li');
    if (task.completed) li.classList.add('completed');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('data-id', task.id);
    checkbox.setAttribute('data-action', 'toggle');
    checkbox.setAttribute('aria-label', `Tandai "${task.text}" sebagai selesai`);

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task.text;
    span.setAttribute('data-id', task.id);

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('data-id', task.id);
    editBtn.setAttribute('data-action', 'edit');

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Hapus';
    deleteBtn.setAttribute('data-id', task.id);
    deleteBtn.setAttribute('data-action', 'delete');

    li.append(checkbox, span, editBtn, deleteBtn);
    return li;
  },

  _renderList() {
    if (!this._listEl) return;
    this._listEl.innerHTML = '';
    this._getSorted().forEach(task => this._listEl.appendChild(this._renderItem(task)));
  },

  _enterEditMode(id) {
    if (!this._listEl) return;
    const span = this._listEl.querySelector(`span.task-text[data-id="${id}"]`);
    if (!span) return;
    const li   = span.closest('li');
    const task = this._tasks.find(t => t.id === id);
    if (!task || !li) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.value = task.text;
    input.maxLength = 200;
    input.setAttribute('data-id', id);
    li.replaceChild(input, span);

    const editBtn = li.querySelector(`button[data-action="edit"][data-id="${id}"]`);
    if (editBtn) {
      const saveBtn   = document.createElement('button');
      saveBtn.textContent = 'Simpan';
      saveBtn.setAttribute('data-id', id);
      saveBtn.setAttribute('data-action', 'save-edit');

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Batal';
      cancelBtn.setAttribute('data-id', id);
      cancelBtn.setAttribute('data-action', 'cancel-edit');

      li.replaceChild(saveBtn, editBtn);
      saveBtn.insertAdjacentElement('afterend', cancelBtn);
    }
    input.focus();
    input.select();
  },

  _exitEditMode(id, save) {
    if (!this._listEl) return;
    const input = this._listEl.querySelector(`.task-edit-input[data-id="${id}"]`);
    if (!input) return;
    const li = input.closest('li');
    if (!li) return;

    if (save) {
      this.editTask(id, input.value);
      // If editTask failed (validation/duplicate/save), input still exists — stay in edit mode
      if (this._listEl.querySelector(`.task-edit-input[data-id="${id}"]`)) return;
    } else {
      const task = this._tasks.find(t => t.id === id);
      if (!task) return;

      const span = document.createElement('span');
      span.className = 'task-text';
      span.textContent = task.text;
      span.setAttribute('data-id', id);
      li.replaceChild(span, input);

      const saveBtn   = li.querySelector(`button[data-action="save-edit"][data-id="${id}"]`);
      const cancelBtn = li.querySelector(`button[data-action="cancel-edit"][data-id="${id}"]`);
      const editBtn   = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('data-id', id);
      editBtn.setAttribute('data-action', 'edit');
      if (saveBtn)   li.replaceChild(editBtn, saveBtn);
      if (cancelBtn) cancelBtn.remove();
    }
  },

  init() {
    this._inputEl = document.getElementById('todo-input');
    this._errorEl = document.getElementById('todo-error');
    this._listEl  = document.getElementById('todo-list');
    this._formEl  = document.getElementById('todo-form');
    this._sortEl  = document.getElementById('task-sort');

    // Load sort preference
    const savedSort = StorageManager.loadPref('dashboard-task-sort', 'oldest-first');
    this._sortOrder = VALID_SORT_ORDERS.includes(savedSort) ? savedSort : 'oldest-first';
    if (this._sortEl) this._sortEl.value = this._sortOrder;

    // Sort change
    this._sortEl?.addEventListener('change', () => {
      const val = this._sortEl.value;
      this._sortOrder = VALID_SORT_ORDERS.includes(val) ? val : 'oldest-first';
      StorageManager.savePref('dashboard-task-sort', this._sortOrder);
      this._renderList();
    });

    // Task list delegated click
    this._listEl?.addEventListener('click', (e) => {
      const action = e.target.getAttribute('data-action');
      const id     = e.target.getAttribute('data-id');
      if (!action || !id) return;
      switch (action) {
        case 'toggle':      this.toggleTask(id);          break;
        case 'edit':        this._enterEditMode(id);       break;
        case 'save-edit':   this._exitEditMode(id, true);  break;
        case 'cancel-edit': this._exitEditMode(id, false); break;
        case 'delete':      this.deleteTask(id);           break;
      }
    });

    // Add-task form
    this._formEl?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addTask(this._inputEl ? this._inputEl.value : '');
    });

    // Clear error on input
    this._inputEl?.addEventListener('input', () => this._showError(''));

    this._loadFromStorage();
    this._renderList();
  },
};

// ============================================================
// QuickLinksManager
// ============================================================
const QuickLinksManager = {
  _links: [],
  _labelInputEl: null,
  _urlInputEl:   null,
  _errorEl:      null,
  _listEl:       null,
  _formEl:       null,

  _generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString() + Math.random().toString(36).slice(2);
  },

  _showError(msg) {
    if (this._errorEl) this._errorEl.textContent = msg || '';
  },

  _normalizeUrl(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return 'https://' + url;
  },

  _validate(label, url) {
    const tl = label.trim(), tu = url.trim();
    if (tl === '' && tu === '') return { valid: false, error: 'Label atau URL harus diisi.' };
    if (tl !== '' && tu === '') return { valid: false, error: 'URL harus diisi.' };
    if (label.length > 100)     return { valid: false, error: 'Label maksimal 100 karakter.' };
    if (url.length > 2048)      return { valid: false, error: 'URL maksimal 2048 karakter.' };
    return { valid: true };
  },

  _loadFromStorage() { this._links = StorageManager.loadLinks(); },

  _saveToStorage() { return StorageManager.saveLinks(this._links).ok === true; },

  addLink(label, url) {
    const v = this._validate(label, url);
    if (!v.valid) { this._showError(v.error); return; }

    const snapshot = this._links.slice();
    this._links.push({
      id:    this._generateId(),
      label: label.trim(),
      url:   this._normalizeUrl(url.trim()),
    });

    if (!this._saveToStorage()) {
      this._links = snapshot;
      this._showError('Gagal menyimpan tautan. Silakan coba lagi.');
      return;
    }

    this._showError('');
    if (this._labelInputEl) this._labelInputEl.value = '';
    if (this._urlInputEl)   this._urlInputEl.value   = '';
    this._renderLinks();
  },

  deleteLink(id) {
    const snapshot = this._links.slice();
    this._links = this._links.filter(l => l.id !== id);

    if (!this._saveToStorage()) {
      this._links = snapshot;
      this._showError('Gagal menghapus tautan. Silakan coba lagi.');
      return;
    }
    this._showError('');
    this._renderLinks();
  },

  _renderItem(link) {
    const div = document.createElement('div');
    div.className = 'link-item';

    const displayText = link.label || link.url;
    const anchor = document.createElement('a');
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.className = 'link-button';
    anchor.textContent = displayText;
    anchor.setAttribute('data-id', link.id);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '✕';
    deleteBtn.setAttribute('data-id', link.id);
    deleteBtn.setAttribute('data-action', 'delete');
    deleteBtn.setAttribute('aria-label', `Hapus tautan "${displayText}"`);

    div.append(anchor, deleteBtn);
    return div;
  },

  _renderLinks() {
    if (!this._listEl) return;
    this._listEl.innerHTML = '';
    this._links.forEach(link => this._listEl.appendChild(this._renderItem(link)));
  },

  init() {
    this._labelInputEl = document.getElementById('link-label-input');
    this._urlInputEl   = document.getElementById('link-url-input');
    this._errorEl      = document.getElementById('links-error');
    this._listEl       = document.getElementById('links-list');
    this._formEl       = document.getElementById('links-form');

    this._listEl?.addEventListener('click', (e) => {
      const action = e.target.getAttribute('data-action');
      const id     = e.target.getAttribute('data-id');
      if (action === 'delete' && id) this.deleteLink(id);
    });

    this._formEl?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addLink(
        this._labelInputEl ? this._labelInputEl.value : '',
        this._urlInputEl   ? this._urlInputEl.value   : ''
      );
    });

    const clearErr = () => this._showError('');
    this._labelInputEl?.addEventListener('input', clearErr);
    this._urlInputEl?.addEventListener('input',   clearErr);

    this._loadFromStorage();
    this._renderLinks();
  },
};

// ============================================================
// crypto.randomUUID() polyfill (older Safari)
// ============================================================
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  crypto.randomUUID = function () {
    return Date.now().toString() + Math.random().toString(36).slice(2);
  };
}

// ============================================================
// App Initialization
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  StorageManager.init();
  ThemeManager.init();
  GreetingWidget.init();
  FocusTimer.init();
  TodoManager.init();
  QuickLinksManager.init();

  if (!StorageManager.isAvailable) {
    const banner = document.getElementById('storage-banner');
    if (banner) banner.removeAttribute('hidden');
  }
});

// ============================================================
// Exports (for Vitest / testing environments)
// ============================================================
export {
  StorageManager,
  ThemeManager,
  GreetingWidget,
  FocusTimer,
  TodoManager,
  QuickLinksManager,
};
