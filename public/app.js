/**
 * FEUL STATION PRO - CLIENT LOGIC
 * Handles Authentication, License Plate Validation, 7-Day Restriction Engine,
 * Audio Synthesis, Dynamic Red/Green UI States, and Live Record Management.
 */

// Web Audio API Synthesizer for alerts (no external audio files needed!)
class SoundEffects {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Two-tone warning buzzer for blocked duplicate car (Red Alert)
    playWarning() {
        try {
            this.init();
            const now = this.ctx.currentTime;

            // Tone 1: Low harsh buzz
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(180, now);
            osc1.frequency.setValueAtTime(140, now + 0.15);
            gain1.gain.setValueAtTime(0.35, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(this.ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            // Tone 2: Follow-up alert buzz
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(220, now + 0.2);
            osc2.frequency.setValueAtTime(160, now + 0.35);
            gain2.gain.setValueAtTime(0.35, now + 0.2);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);
            osc2.start(now + 0.2);
            osc2.stop(now + 0.6);
        } catch (e) {
            console.warn('Audio play warning failed:', e);
        }
    }

    // Pleasant upbeat chime for successful registration (Green State)
    playSuccess() {
        try {
            this.init();
            const now = this.ctx.currentTime;

            // Notes: E5 (659.25Hz) -> G#5 (830.61Hz) -> B5 (987.77Hz)
            const notes = [659.25, 830.61, 987.77];
            notes.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.1);
                gain.gain.setValueAtTime(0.2, now + idx * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + idx * 0.1);
                osc.stop(now + idx * 0.1 + 0.35);
            });
        } catch (e) {
            console.warn('Audio play success failed:', e);
        }
    }
}

const sounds = new SoundEffects();

// State & DOM Elements
let currentUser = null;
let todayRecords = [];
let clearTimer = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainDashboard = document.getElementById('mainDashboard');
const loginForm = document.getElementById('loginForm');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');
const loginStation = document.getElementById('loginStation');
const togglePassBtn = document.getElementById('togglePassBtn');
const togglePassIcon = document.getElementById('togglePassIcon');
const loginAlert = document.getElementById('loginAlert');
const loginAlertText = document.getElementById('loginAlertText');
const loginBtn = document.getElementById('loginBtn');

// Nav Elements
const navStationTitle = document.getElementById('navStationTitle');
const navUsername = document.getElementById('navUsername');
const navUserRole = document.getElementById('navUserRole');
const logoutBtn = document.getElementById('logoutBtn');
const liveTimeClock = document.getElementById('liveTimeClock');
const liveDateClock = document.getElementById('liveDateClock');

// Registration Elements
const registrationCard = document.getElementById('registrationCard');
const stateBadge = document.getElementById('stateBadge');
const stateBadgeIcon = document.getElementById('stateBadgeIcon');
const quickStatusChip = document.getElementById('quickStatusChip');
const quickStatusText = document.getElementById('quickStatusText');

const platePreviewNumber = document.getElementById('platePreviewNumber');
const platePreviewProvince = document.getElementById('platePreviewProvince');
const platePreviewCategory = document.getElementById('platePreviewCategory');

const actionBanner = document.getElementById('actionBanner');
const bannerIcon = document.getElementById('bannerIcon');
const bannerTitle = document.getElementById('bannerTitle');
const bannerMessage = document.getElementById('bannerMessage');
const bannerMeta = document.getElementById('bannerMeta');

const fuelForm = document.getElementById('fuelForm');
const carNumberInput = document.getElementById('carNumberInput');
const carNoHelper = document.getElementById('carNoHelper');
const parizgaInput = document.getElementById('parizgaInput');
const bashInput = document.getElementById('bashInput');

const submitBtn = document.getElementById('submitBtn');
const submitSpinner = document.getElementById('submitSpinner');
const clearBtn = document.getElementById('clearBtn');

// Card Header Info Elements
const cardTopStation = document.getElementById('cardTopStation');
const cardTopUser = document.getElementById('cardTopUser');
const cardTopDate = document.getElementById('cardTopDate');
const cardTopTime = document.getElementById('cardTopTime');

// Records Table Elements
const todayCountBadge = document.getElementById('todayCountBadge');
const tableSearchInput = document.getElementById('tableSearchInput');
const refreshTableBtn = document.getElementById('refreshTableBtn');
const printTableBtn = document.getElementById('printTableBtn');
const recordsTableBody = document.getElementById('recordsTableBody');

// ===================================================================
// ARABIC (JORDAN) C4KURD & ENGLISH DIGIT AUTO-CONVERTERS
// ===================================================================

// Normalizes Arabic characters to Kurdish Sorani Unicode (e.g. ك -> ک, ي -> ی, ة -> ە)
function normalizeToKurdishSorani(str) {
    if (!str) return '';
    const ARABIC_TO_KURDISH_MAP = {
        'ك': 'ک',
        'ي': 'ی',
        'ى': 'ی',
        'ة': 'ە',
        'ؤ': 'ۆ',
        'أ': 'ئا',
        'إ': 'ئـ',
        'آ': 'ئا',
        'ء': 'ئـ'
    };
    return String(str)
        .split('')
        .map(char => ARABIC_TO_KURDISH_MAP[char] || char)
        .join('');
}

// Convert any Kurdish/Arabic digits or letters in car number to English (0-9, A-Z)
function normalizeToEnglishCarPlate(val) {
    if (!val) return '';
    const ARABIC_KURD_TO_ENG = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
        'ق': 'Q', 'و': 'W', 'ۆ': 'W', 'ە': 'E', 'ێ': 'E',
        'ر': 'R', 'ڕ': 'R', 'ت': 'T', 'ط': 'T', 'ی': 'Y',
        'ي': 'Y', 'ى': 'Y', 'پ': 'P', 'ا': 'A', 'ئا': 'A', 'أ': 'A',
        'إ': 'A', 'آ': 'A', 'س': 'S', 'ش': 'S', 'ص': 'S',
        'د': 'D', 'ض': 'D', 'ذ': 'D', 'ف': 'F', 'گ': 'G',
        'غ': 'G', 'ه': 'H', 'ح': 'H', 'ژ': 'J', 'ج': 'J',
        'ک': 'K', 'ك': 'K', 'ل': 'L', 'ڵ': 'L', 'ز': 'Z',
        'ظ': 'Z', 'خ': 'X', 'چ': 'C', 'ڤ': 'V', 'ب': 'B',
        'ن': 'N', 'م': 'M', 'ء': 'A', 'ة': 'E'
    };
    return String(val)
        .split('')
        .map(char => ARABIC_KURD_TO_ENG[char] || char)
        .join('')
        .toUpperCase();
}

// Helper to insert text at cursor position and trigger input event
function insertTextAtCursor(input, text) {
    const start = input.selectionStart !== null ? input.selectionStart : input.value.length;
    const end = input.selectionEnd !== null ? input.selectionEnd : input.value.length;
    const val = input.value;
    input.value = val.substring(0, start) + text + val.substring(end);
    const newPos = start + text.length;
    input.setSelectionRange(newPos, newPos);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Enables seamless Arabic (Jordan) C4Kurd typing without layout conflict
function enableC4KurdTyping(inputElem) {
    if (!inputElem) return;

    // Normalizes input to Kurdish Sorani characters on the fly (ك -> ک, ي -> ی, ة -> ە)
    inputElem.addEventListener('input', () => {
        const val = inputElem.value;
        const converted = normalizeToKurdishSorani(val);
        if (val !== converted) {
            const pos = inputElem.selectionStart;
            inputElem.value = converted;
            if (pos !== null) inputElem.setSelectionRange(pos, pos);
        }
    });
}

// Auto-converts any keyboard layout (Arabic Jordan C4Kurd / English) to English digits/letters
function enableEnglishCarNumberTyping(inputElem) {
    if (!inputElem) return;

    inputElem.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Escape', 'Home', 'End'].includes(e.key)) {
            return;
        }

        let char = null;
        if (e.code.startsWith('Digit')) {
            char = e.code.replace('Digit', '');
        } else if (e.code.startsWith('Numpad') && !isNaN(e.code.replace('Numpad', ''))) {
            char = e.code.replace('Numpad', '');
        } else if (e.code.startsWith('Key')) {
            char = e.code.replace('Key', '').toUpperCase();
        } else if (e.code === 'Space') {
            char = ' ';
        }

        if (char !== null) {
            e.preventDefault();
            insertTextAtCursor(inputElem, char);
        }
    });

    inputElem.addEventListener('input', () => {
        const raw = inputElem.value;
        const normalized = normalizeToEnglishCarPlate(raw);
        if (raw !== normalized) {
            const pos = inputElem.selectionStart;
            inputElem.value = normalized;
            if (pos !== null) inputElem.setSelectionRange(pos, pos);
        }
    });
}

// ===================================================================
// INITIALIZATION & CONNECTION HEALTH MONITOR
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    checkServerHealth();
    setInterval(checkServerHealth, 10000); // Check server connection every 10s
    loadPlacesList();
    checkSavedSession();
    setupEventListeners();
});

// Live Server Connection & Internet Health Check
async function checkServerHealth() {
    const pill = document.getElementById('dbStatusPill');
    const text = document.getElementById('dbStatusText');
    if (!pill || !text) return;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch('/api/health', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data.status === 'ok') {
                pill.className = 'db-status-pill online';
                text.textContent = 'سیستەم پەیوەستە بە سێرڤەرەوە';
                return;
            }
        }
        pill.className = 'db-status-pill offline';
        text.textContent = 'کێشە هەیە لە ئینتەرنێت یان سێرڤەر';
    } catch (e) {
        pill.className = 'db-status-pill offline';
        text.textContent = 'کێشە هەیە لە ئینتەرنێت یان سێرڤەر';
    }
}

// Load distinct places from server to datalist
async function loadPlacesList() {
    try {
        const res = await fetch('/api/places');
        const data = await res.json();
        const dl = document.getElementById('stationList');
        if (dl) {
            const list = (data.success && data.places && data.places.length > 0) ? data.places : ['سان', 'سەرکۆ'];
            if (!list.includes('سان')) list.unshift('سان');
            if (!list.includes('سەرکۆ')) list.splice(1, 0, 'سەرکۆ');
            dl.innerHTML = list.map(p => `<option value="${escapeHtml(p)}">`).join('');
        }
    } catch (e) {
        console.error('Error loading places:', e);
        const dl = document.getElementById('stationList');
        if (dl) dl.innerHTML = '<option value="سان"><option value="سەرکۆ">';
    }
}

// Helper to normalize Kurdish/Arabic digits (٠-٩ and ۰-۹) to standard digits (0-9)
function normalizeKurdishDigits(val) {
    if (!val) return '';
    const map = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    return String(val).replace(/[٠-٩۰-۹]/g, d => map[d] || d);
}

// Realtime Clock & Date
function initClock() {
    function update() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${h}:${min}:${s}`;

        if (liveTimeClock) liveTimeClock.textContent = timeStr;
        if (liveDateClock) liveDateClock.textContent = dateStr;

        const cardTopDate = document.getElementById('cardTopDate');
        const cardTopTime = document.getElementById('cardTopTime');
        if (cardTopDate) cardTopDate.textContent = dateStr;
        if (cardTopTime) cardTopTime.textContent = timeStr;
    }
    update();
    setInterval(update, 1000);
}

// Check if user is already logged in
function checkSavedSession() {
    const saved = localStorage.getItem('feul_user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            applyUserSession(currentUser);
        } catch (e) {
            localStorage.removeItem('feul_user');
            showLogin();
        }
    } else {
        showLogin();
    }
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    loginScreen.classList.add('active');
    mainDashboard.classList.add('hidden');
    setTimeout(() => loginUser && loginUser.focus(), 200);
}

function applyUserSession(user) {
    currentUser = user;
    loginScreen.classList.add('hidden');
    loginScreen.classList.remove('active');
    mainDashboard.classList.remove('hidden');

    const placeName = user.station || user.place || 'سان';
    navUsername.textContent = user.username || 'کارمەند';
    navUserRole.textContent = user.permission ? `بەکارهێنەر` : 'بەکارهێنەر';
    navStationTitle.textContent = placeName;
    
    const cardTopStation = document.getElementById('cardTopStation');
    const cardTopUser = document.getElementById('cardTopUser');
    if (cardTopStation) cardTopStation.textContent = placeName;
    if (cardTopUser) cardTopUser.textContent = user.username || 'کارمەند';

    loadTodayRecords();
    resetFormToNormal();
    clearInputs(true);
    setTimeout(() => carNumberInput && carNumberInput.focus(), 250);
}

// ===================================================================
// EVENT LISTENERS & PLATE VALIDATION
// ===================================================================
function setupEventListeners() {
    // 1. Password Visibility Toggle
    togglePassBtn.addEventListener('click', () => {
        const isPass = loginPass.type === 'password';
        loginPass.type = isPass ? 'text' : 'password';
        togglePassIcon.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });

    // 2. Login Form Submit & Button Click
    async function doLogin(e) {
        if (e) e.preventDefault();
        sounds.init();

        const username = loginUser.value.trim();
        const password = loginPass.value.trim();
        const station = (loginStation.value && loginStation.value.trim()) ? loginStation.value.trim() : 'بەنزینخانەی سەرەکی';

        if (!username) {
            loginAlert.classList.remove('hidden');
            loginAlertText.textContent = 'تکایە ناوی بەکارهێنەر بنووسە.';
            loginUser.focus();
            return;
        }

        if (!password) {
            loginAlert.classList.remove('hidden');
            loginAlertText.textContent = 'تکایە وشەی نهێنی بنووسە.';
            loginPass.focus();
            return;
        }

        loginAlert.classList.add('hidden');
        loginBtn.disabled = true;
        const spinner = loginBtn.querySelector('.spinner');
        if (spinner) spinner.classList.remove('hidden');

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, station })
            });

            const data = await res.json();

            if (data.success) {
                localStorage.setItem('feul_user', JSON.stringify(data.user));
                applyUserSession(data.user);
            } else {
                loginAlert.classList.remove('hidden');
                loginAlertText.textContent = data.message || 'هەڵە لە چوونەژوورەوە: ناوی بەکارهێنەر یان وشەی نهێنی نادروستە';
                loginPass.focus();
            }
        } catch (err) {
            loginAlert.classList.remove('hidden');
            loginAlertText.textContent = 'نەتوانرا پەیوەندی بە سێرڤەرەوە بکرێت: ' + err.message;
        } finally {
            loginBtn.disabled = false;
            const spinner = loginBtn.querySelector('.spinner');
            if (spinner) spinner.classList.add('hidden');
        }
    }

    loginForm.addEventListener('submit', doLogin);
    loginBtn.addEventListener('click', (e) => {
        doLogin(e);
    });

    // 3. Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('feul_user');
        currentUser = null;
        showLogin();
    });

    // Helper to safely open datalist picker on supported browsers
    function openPickerSafely(inp) {
        if (!inp) return;
        try {
            if (typeof inp.showPicker === 'function') {
                inp.showPicker();
            }
        } catch (e) {}
    }

    // Attach C4Kurd and English converters
    enableEnglishCarNumberTyping(carNumberInput);
    enableC4KurdTyping(parizgaInput);
    enableC4KurdTyping(bashInput);
    enableC4KurdTyping(tableSearchInput);
    enableC4KurdTyping(loginStation);

    // 4. Car Plate Input: updates license plate display
    carNumberInput.addEventListener('input', () => {
        const raw = carNumberInput.value;
        const normalized = normalizeToEnglishCarPlate(raw);
        platePreviewNumber.textContent = normalized.trim() || '12345';

        // Clear warning state if user starts typing a new car number
        if (registrationCard.classList.contains('state-blocked')) {
            clearTimeout(clearTimer);
            resetFormToNormal();
        }
    });

    // Enter / Tab on Car Number -> Jump to Province (Parizga)
    carNumberInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const val = normalizeKurdishDigits(carNumberInput.value).trim();
            if (val) {
                parizgaInput.focus();
                openPickerSafely(parizgaInput);
            }
        }
    });

    // 5. Combobox Province: both typing & selecting supported
    parizgaInput.addEventListener('input', () => {
        platePreviewProvince.textContent = parizgaInput.value.trim() || '-';
    });

    // When Province is picked from list -> Jump to Section (Bash)
    parizgaInput.addEventListener('change', () => {
        platePreviewProvince.textContent = parizgaInput.value.trim() || '-';
        if (parizgaInput.value.trim()) {
            bashInput.focus();
            openPickerSafely(bashInput);
        }
    });

    // Enter / Tab on Province -> Jump to Section (Bash)
    parizgaInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (parizgaInput.value.trim()) {
                bashInput.focus();
                openPickerSafely(bashInput);
            } else {
                openPickerSafely(parizgaInput);
            }
        }
    });

    // 6. Combobox Section (Bash): both typing & selecting supported
    bashInput.addEventListener('input', () => {
        platePreviewCategory.textContent = bashInput.value.trim() || '-';
    });

    bashInput.addEventListener('change', () => {
        platePreviewCategory.textContent = bashInput.value.trim() || '-';
    });

    // Enter / Tab on Section -> Trigger Check & Register!
    bashInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            handleRegisterCar();
        }
    });

    // Click on combobox inputs to open suggestions
    [parizgaInput, bashInput].forEach(inp => {
        if (!inp) return;
        inp.addEventListener('click', () => {
            openPickerSafely(inp);
        });
    });

    // Make dropdown chevron icons clickable to open suggestion list
    document.querySelectorAll('.combobox-wrapper').forEach(wrapper => {
        const inp = wrapper.querySelector('input');
        const arrow = wrapper.querySelector('.combo-arrow');
        if (arrow && inp) {
            arrow.style.cursor = 'pointer';
            arrow.style.pointerEvents = 'auto';
            arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                inp.focus();
                openPickerSafely(inp);
            });
        }
    });

    // 7. Form Submit (Check & Register Car)
    fuelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleRegisterCar();
    });

    // 8. Clear Button (Esc)
    clearBtn.addEventListener('click', () => {
        resetFormToNormal();
        clearInputs(true);
        carNumberInput.focus();
    });

    // Global Keydown shortcuts: Esc to clear
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !loginScreen.classList.contains('active')) {
            resetFormToNormal();
            clearInputs(true);
            carNumberInput.focus();
        }
    });

    // 10. Table Search Filter
    tableSearchInput.addEventListener('input', (e) => {
        filterRecordsTable(e.target.value.trim().toLowerCase());
    });

    // 11. Refresh Table
    refreshTableBtn.addEventListener('click', () => {
        loadTodayRecords();
    });

    // 12. Print Table Report
    printTableBtn.addEventListener('click', () => {
        window.print();
    });
}

// ===================================================================
// REGISTRATION & 7-DAY DUPLICATE CHECK CORE LOGIC
// ===================================================================

async function handleRegisterCar() {
    sounds.init();
    clearTimeout(clearTimer);

    const car_no = normalizeKurdishDigits(carNumberInput.value).trim().toUpperCase();
    const parizga = parizgaInput.value.trim();
    const bash = bashInput.value.trim();
    
    // Live Date & Time automatically generated
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const reg_date = `${y}-${m}-${d}`;

    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const reg_time = `${h}:${min}:${s}`;

    const station_name = (currentUser && (currentUser.station || currentUser.place)) || 'سان';
    const created_by = currentUser ? currentUser.username : 'سەرپەرشتیار';

    if (!car_no) {
        carNumberInput.focus();
        return;
    }
    if (!parizga) {
        parizgaInput.focus();
        openPickerSafely(parizgaInput);
        return;
    }
    if (!bash) {
        bashInput.focus();
        openPickerSafely(bashInput);
        return;
    }

    // Set Loading State
    submitBtn.disabled = true;
    if (submitSpinner) submitSpinner.classList.remove('hidden');

    try {
        const response = await fetch('/api/register-car', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                car_no,
                parizga,
                bash,
                reg_date,
                reg_time,
                station_name,
                created_by
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // SUCCESS STATE (GREEN)
            triggerSuccessState(data.message, data.record);
        } else {
            // BLOCKED STATE (RED) - Duplicate in past 7 days!
            triggerBlockedState(data);
        }
    } catch (err) {
        console.error('Registration error:', err);
        alert('هەڵە لە تۆمارکردن: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        if (submitSpinner) submitSpinner.classList.add('hidden');
    }
}

// -------------------------------------------------------------
// UI STATES: BLOCKED (RED) & SUCCESS (GREEN)
// -------------------------------------------------------------

/**
 * TRIGGER BLOCKED STATE (فۆڕمه‌كه‌ سوور ده‌كات)
 * Rule: Car took fuel within the last 7 days.
 * UI Actions:
 * 1. Form card glows RED with alert animation.
 * 2. Sound buzzer triggers.
 * 3. Detailed warning banner appears with previous date, time, station, and remaining days.
 */
function triggerBlockedState(data) {
    // 1. Play Warning Sound (Buzzer)
    sounds.playWarning();

    // 2. Transform Registration Card into RED BLOCKED STATE
    registrationCard.className = 'glass-panel registration-card state-blocked';
    stateBadgeIcon.className = 'fa-solid fa-ban';
    quickStatusChip.className = 'quick-status-chip';
    quickStatusText.textContent = 'ڕێگەپێنەدراو - پێشتر بەنزینی بردووە';

    // 3. Build Action Banner
    actionBanner.className = 'action-banner blocked';
    actionBanner.classList.remove('hidden');
    bannerIcon.className = 'fa-solid fa-triangle-exclamation';
    bannerTitle.textContent = 'ئاگاداری: ئەم ئۆتۆمبێلە پێشتر بەنزینی وەرگرتووە!';
    bannerMessage.textContent = data.message || 'لە ماوەی ٧ ڕۆژدا ئەم ئۆتۆمبێلە بەنزینی وەرگرتووە و ناتوانێت دووبارە وەربگرێت.';

    // Meta details pills
    const rec = data.record || {};
    bannerMeta.innerHTML = `
        <span class="meta-pill"><i class="fa-solid fa-calendar"></i> بەروار: ${rec.reg_date_str || rec.reg_date || '-'}</span>
        <span class="meta-pill"><i class="fa-solid fa-clock"></i> کات: ${rec.reg_time || '-'}</span>
        <span class="meta-pill"><i class="fa-solid fa-gas-pump"></i> بەنزینخانە: ${rec.station_name || '-'}</span>
        <span class="meta-pill" style="background: rgba(239, 68, 68, 0.4);"><i class="fa-solid fa-hourglass-half"></i> ${data.daysRemaining || '٧'} ڕۆژ ماوە (${data.nextAllowedDate || ''})</span>
    `;

    // Highlight and focus car number so operator can easily see or re-type
    carNumberInput.select();
    carNumberInput.focus();

    clearTimer = setTimeout(() => {
        resetFormToNormal();
    }, 5000);
}

/**
 * TRIGGER SUCCESS STATE (سه‌وزبوونی سه‌ركه‌وتوو)
 */
function triggerSuccessState(message, record) {
    sounds.playSuccess();

    registrationCard.className = 'glass-panel registration-card state-success';
    stateBadgeIcon.className = 'fa-solid fa-circle-check';
    quickStatusText.textContent = 'سەرکەوتوو - تۆمار کرا';

    actionBanner.className = 'action-banner success';
    actionBanner.classList.remove('hidden');
    bannerIcon.className = 'fa-solid fa-circle-check';
    bannerTitle.textContent = 'سەرکەوتوو: ئۆتۆمبێل تۆمار کرا!';
    bannerMessage.textContent = message;

    bannerMeta.innerHTML = `
        <span class="meta-pill"><i class="fa-solid fa-hashtag"></i> ژمارە: ${record.car_no}</span>
        <span class="meta-pill"><i class="fa-solid fa-location-dot"></i> پارێزگا: ${record.parizga}</span>
        <span class="meta-pill"><i class="fa-solid fa-layer-group"></i> بەش: ${record.bash}</span>
        <span class="meta-pill"><i class="fa-solid fa-clock"></i> کات: ${record.reg_time}</span>
    `;

    // Add to table
    loadTodayRecords();

    // Auto-clear inputs and reset to normal ready for next car
    clearInputs(false);
    carNumberInput.focus();

    clearTimer = setTimeout(() => {
        resetFormToNormal();
    }, 3500);
}

// Reset form appearance to neutral cyan
function resetFormToNormal() {
    registrationCard.className = 'glass-panel registration-card state-normal';
    stateBadgeIcon.className = 'fa-solid fa-shield-check';
    quickStatusText.textContent = 'ئامادەیە بۆ تۆمار';
    actionBanner.classList.add('hidden');
    bannerMeta.innerHTML = '';
    lastCheckedSig = '';
}

// Clear input fields
function clearInputs(clearAll = false) {
    carNumberInput.value = '';
    platePreviewNumber.textContent = '12345';
    lastCheckedSig = '';

    if (clearAll) {
        parizgaInput.value = '';
        platePreviewProvince.textContent = '-';
        bashInput.value = '';
        platePreviewCategory.textContent = '-';
    }
}

// ===================================================================
// TODAY'S RECORDS TABLE MANAGEMENT
// ===================================================================
async function loadTodayRecords() {
    try {
        const station = (currentUser && currentUser.station) ? currentUser.station : '';
        const todayStr = new Date().toISOString().split('T')[0];

        const res = await fetch(`/api/today-records?date=${todayStr}&station=${encodeURIComponent(station)}`);
        const data = await res.json();

        if (data.success) {
            todayRecords = data.records || [];
            renderRecordsTable(todayRecords);
            const total = (data.stats && data.stats.total_today) ? data.stats.total_today : todayRecords.length;
            todayCountBadge.textContent = `کۆی گشتی: ${total}`;
        }
    } catch (err) {
        console.error('Error loading today records:', err);
    }
}

function renderRecordsTable(records) {
    if (!recordsTableBody) return;

    if (records.length === 0) {
        recordsTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="9">
                    <div class="empty-state">
                        <i class="fa-solid fa-inbox"></i>
                        <p>هیچ تۆمارێک نەدۆزرایەوە</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    recordsTableBody.innerHTML = records.map((r, index) => `
        <tr>
            <td style="color: var(--text-dim); font-family: var(--font-mono);">${index + 1}</td>
            <td><span class="plate-badge-sm">${escapeHtml(r.car_no)}</span></td>
            <td><strong>${escapeHtml(r.parizga)}</strong></td>
            <td>${escapeHtml(r.bash)}</td>
            <td style="font-family: var(--font-mono);">${escapeHtml(r.reg_date_str || r.reg_date)}</td>
            <td style="font-family: var(--font-mono);">${escapeHtml(r.reg_time)}</td>
            <td>${escapeHtml(r.station_name)}</td>
            <td>${escapeHtml(r.created_by || 'سیستەم')}</td>
            <td><span class="status-tag-ok"><i class="fa-solid fa-check"></i> تۆمارکراو</span></td>
        </tr>
    `).join('');
}

function filterRecordsTable(query) {
    if (!query) {
        renderRecordsTable(todayRecords);
        return;
    }

    const filtered = todayRecords.filter(r => 
        (r.car_no && r.car_no.toLowerCase().includes(query)) ||
        (r.parizga && r.parizga.toLowerCase().includes(query)) ||
        (r.bash && r.bash.toLowerCase().includes(query)) ||
        (r.station_name && r.station_name.toLowerCase().includes(query))
    );

    renderRecordsTable(filtered);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
