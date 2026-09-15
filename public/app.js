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
const regDateInput = document.getElementById('regDateInput');
const regTimeInput = document.getElementById('regTimeInput');
const stationNameInput = document.getElementById('stationNameInput');

const submitBtn = document.getElementById('submitBtn');
const submitSpinner = document.getElementById('submitSpinner');
const quickCheckBtn = document.getElementById('quickCheckBtn');
const clearBtn = document.getElementById('clearBtn');

// Records Table Elements
const todayCountBadge = document.getElementById('todayCountBadge');
const tableSearchInput = document.getElementById('tableSearchInput');
const refreshTableBtn = document.getElementById('refreshTableBtn');
const printTableBtn = document.getElementById('printTableBtn');
const recordsTableBody = document.getElementById('recordsTableBody');

// ===================================================================
// INITIALIZATION
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    checkSavedSession();
    setupEventListeners();
});

// Realtime Clock & Date
function initClock() {
    function update() {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

        if (liveTimeClock) liveTimeClock.textContent = timeStr;
        if (liveDateClock) liveDateClock.textContent = dateStr;

        // Also update form time if user hasn't typed a custom time
        if (regTimeInput && !regTimeInput.dataset.manual) {
            regTimeInput.value = timeStr;
        }
        if (regDateInput && !regDateInput.dataset.manual) {
            regDateInput.value = dateStr;
        }
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

    navUsername.textContent = user.username || 'کارمەند';
    navUserRole.textContent = user.permission ? `دەسەڵات: ${user.permission}` : 'سەرپەرشتیار';
    navStationTitle.textContent = user.station || 'بەنزینخانەی سەرەکی';
    stationNameInput.value = user.station || 'بەنزینخانەی سەرەکی';

    loadTodayRecords();
    resetFormToNormal();
    setTimeout(() => carNumberInput.focus(), 250);
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

    // 2. Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        sounds.init();

        const username = loginUser.value.trim();
        const password = loginPass.value.trim();
        const station = loginStation.value.trim();

        if (!username || !password) return;

        loginAlert.classList.add('hidden');
        loginBtn.disabled = true;
        loginBtn.querySelector('.spinner').classList.remove('hidden');

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
                loginAlertText.textContent = data.message || 'هەڵە لە چوونەژوورەوە';
                loginPass.focus();
            }
        } catch (err) {
            loginAlert.classList.remove('hidden');
            loginAlertText.textContent = 'نەتوانرا پەیوەندی بە سێرڤەرەوە بکرێت: ' + err.message;
        } finally {
            loginBtn.disabled = false;
            loginBtn.querySelector('.spinner').classList.add('hidden');
        }
    });

    // 3. Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('feul_user');
        currentUser = null;
        showLogin();
    });

    // 4. Strict Alphanumeric Car Plate Input (تەنها ژمارە و پیتی ئینگلیزی)
    carNumberInput.addEventListener('input', (e) => {
        const originalVal = carNumberInput.value;
        // Filter out non-alphanumeric (keep A-Z, 0-9, spaces)
        const cleanVal = originalVal.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase();

        if (originalVal !== cleanVal) {
            carNoHelper.classList.remove('hidden');
            setTimeout(() => carNoHelper.classList.add('hidden'), 2500);
        } else {
            carNoHelper.classList.add('hidden');
        }

        carNumberInput.value = cleanVal;
        platePreviewNumber.textContent = cleanVal || '12345 A';

        // Clear warning state if user starts typing a new car number
        if (registrationCard.classList.contains('state-blocked')) {
            clearTimeout(clearTimer);
            resetFormToNormal();
        }
    });

    // 5. Combobox Province preview update
    parizgaInput.addEventListener('input', () => {
        platePreviewProvince.textContent = parizgaInput.value.trim() || 'هەولێر';
    });

    // 6. Combobox Section preview update
    bashInput.addEventListener('input', () => {
        platePreviewCategory.textContent = bashInput.value.trim() || 'تایبەت';
    });

    // Mark manual time/date if edited
    regTimeInput.addEventListener('input', () => { regTimeInput.dataset.manual = 'true'; });
    regDateInput.addEventListener('input', () => { regDateInput.dataset.manual = 'true'; });

    // 7. Form Submit (Check & Register Car)
    fuelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleRegisterCar();
    });

    // 8. Quick Check Button (Without Saving)
    quickCheckBtn.addEventListener('click', async () => {
        await handleQuickCheck();
    });

    // 9. Clear Button (Esc)
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

    const car_no = carNumberInput.value.trim().toUpperCase();
    const parizga = parizgaInput.value.trim();
    const bash = bashInput.value.trim();
    const reg_date = regDateInput.value;
    const reg_time = regTimeInput.value;
    const station_name = stationNameInput.value.trim() || (currentUser && currentUser.station) || 'بەنزینخانە';
    const created_by = currentUser ? currentUser.username : 'سەرپەرشتیار';

    if (!car_no) {
        carNumberInput.focus();
        return;
    }

    // Set Loading State
    submitBtn.disabled = true;
    submitSpinner.classList.remove('hidden');

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
        submitSpinner.classList.add('hidden');
    }
}

// Quick check without registering
async function handleQuickCheck() {
    sounds.init();
    clearTimeout(clearTimer);

    const car_no = carNumberInput.value.trim().toUpperCase();
    const parizga = parizgaInput.value.trim();
    const bash = bashInput.value.trim();
    const reg_date = regDateInput.value;

    if (!car_no) {
        carNumberInput.focus();
        return;
    }

    quickCheckBtn.disabled = true;

    try {
        const response = await fetch('/api/check-car', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ car_no, parizga, bash, reg_date })
        });

        const data = await response.json();

        if (data.allowed) {
            triggerAllowedCheckNotice(data.message);
        } else {
            triggerBlockedState(data);
        }
    } catch (err) {
        alert('هەڵە لە پشکنین: ' + err.message);
    } finally {
        quickCheckBtn.disabled = false;
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
 * 4. Automatic form clearing ready for next car ("تۆمارهكه بهتال ببێتهوه بۆ تۆماری نوێ ئهكتیڤ ببیتهوه").
 */
function triggerBlockedState(data) {
    // 1. Play Warning Sound (Buzzer)
    sounds.playWarning();

    // 2. Transform Registration Card into RED BLOCKED STATE
    registrationCard.className = 'glass-panel registration-card state-blocked';
    stateBadgeIcon.className = 'fa-solid fa-ban';
    quickStatusChip.className = 'quick-status-chip';
    quickStatusText.textContent = 'ڕێگەنەدراو (پێشتر بەنزینی بردووە!)';

    // 3. Build Action Banner
    actionBanner.className = 'action-banner blocked';
    actionBanner.classList.remove('hidden');
    bannerIcon.className = 'fa-solid fa-triangle-exclamation';
    bannerTitle.textContent = 'ئاگاداری مەترسی: ئەم ئۆتۆمبێلە پێشتر بەنزینی وەرگرتووە!';
    bannerMessage.textContent = data.message || 'لە ماوەی ٧ ڕۆژی ڕابردوودا ئەم ئۆتۆمبێلە بەنزینی وەرگرتووە و ناتوانێت دووبارە وەربگرێت.';

    // Meta details pills
    const rec = data.record || {};
    bannerMeta.innerHTML = `
        <span class="meta-pill"><i class="fa-solid fa-calendar"></i> بەرواری وەرگرتن: ${rec.reg_date_str || rec.reg_date || 'نادیار'}</span>
        <span class="meta-pill"><i class="fa-solid fa-clock"></i> کاتژمێر: ${rec.reg_time || 'نادیار'}</span>
        <span class="meta-pill"><i class="fa-solid fa-gas-pump"></i> وێستگە: ${rec.station_name || 'نادیار'}</span>
        <span class="meta-pill" style="background: rgba(239, 68, 68, 0.4);"><i class="fa-solid fa-hourglass-half"></i> ماوەی ڕێگەپێدان: ${data.daysRemaining || 'چەند'} ڕۆژی تر (لە ${data.nextAllowedDate || ''})</span>
    `;

    // 4. Automatic clearing ("و تۆمارهكه بهتال ببێتهوه بۆ تۆماری نوێ ئهكتیڤ ببیتهوه")
    // Keep warning visible for 3.5 seconds, but clear input immediately and keep focus on car number
    clearInputs(false); // clears car_no input so operator can type immediately
    carNumberInput.focus();

    clearTimer = setTimeout(() => {
        resetFormToNormal();
    }, 4500);
}

/**
 * TRIGGER SUCCESS STATE (سه‌وزبوونی سه‌ركه‌وتوو)
 */
function triggerSuccessState(message, record) {
    sounds.playSuccess();

    registrationCard.className = 'glass-panel registration-card state-success';
    stateBadgeIcon.className = 'fa-solid fa-circle-check';
    quickStatusText.textContent = 'بە سەرکەوتوویی تۆمار کرا';

    actionBanner.className = 'action-banner success';
    actionBanner.classList.remove('hidden');
    bannerIcon.className = 'fa-solid fa-circle-check';
    bannerTitle.textContent = 'سەرکەوتوو بوو: ئۆتۆمبێل بە سەرکەوتوویی تۆمار کرا!';
    bannerMessage.textContent = message;

    bannerMeta.innerHTML = `
        <span class="meta-pill"><i class="fa-solid fa-hashtag"></i> ژمارەی ئۆتۆمبێل: ${record.car_no}</span>
        <span class="meta-pill"><i class="fa-solid fa-location-dot"></i> پارێزگا: ${record.parizga}</span>
        <span class="meta-pill"><i class="fa-solid fa-layer-group"></i> بەش: ${record.bash}</span>
        <span class="meta-pill"><i class="fa-solid fa-clock"></i> کاتی تۆمار: ${record.reg_time}</span>
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

function triggerAllowedCheckNotice(message) {
    sounds.playSuccess();
    registrationCard.className = 'glass-panel registration-card state-success';
    stateBadgeIcon.className = 'fa-solid fa-shield-check';
    quickStatusText.textContent = 'ئامادەیە بۆ وەرگرتن';

    actionBanner.className = 'action-banner success';
    actionBanner.classList.remove('hidden');
    bannerIcon.className = 'fa-solid fa-check';
    bannerTitle.textContent = 'ئەنجامی پشکنین: ڕێگەپێدراوە';
    bannerMessage.textContent = message;
    bannerMeta.innerHTML = `<span class="meta-pill">ئەم ئۆتۆمبێلە لە ٧ ڕۆژی ڕابردوودا بەنزینی وەرنەگرتووە و دەتوانرێت تۆمار بکرێت.</span>`;

    clearTimer = setTimeout(() => {
        resetFormToNormal();
    }, 3000);
}

// Reset form appearance to neutral cyan
function resetFormToNormal() {
    registrationCard.className = 'glass-panel registration-card state-normal';
    stateBadgeIcon.className = 'fa-solid fa-shield-check';
    quickStatusText.textContent = 'ئامادەیە بۆ تۆماری نوێ';
    actionBanner.classList.add('hidden');
    bannerMeta.innerHTML = '';
}

// Clear input fields
function clearInputs(clearAll = false) {
    carNumberInput.value = '';
    platePreviewNumber.textContent = '12345 A';

    if (clearAll) {
        parizgaInput.value = 'هەولێر';
        platePreviewProvince.textContent = 'هەولێر';
        bashInput.value = 'تایبەت';
        platePreviewCategory.textContent = 'تایبەت';
        delete regTimeInput.dataset.manual;
        delete regDateInput.dataset.manual;
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
            todayCountBadge.textContent = `کۆی گشتی: ${total} ئۆتۆمبێل`;
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
                        <p>هیچ تۆمارێک بۆ ئەمڕۆ نەدۆزرایەوە</p>
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
