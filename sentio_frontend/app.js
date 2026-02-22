/* ═══════════════════════════════════════════════════════════════
   Sentio – app.js
   ═══════════════════════════════════════════════════════════════
   Fixes applied:
   ① Correct Lucide init + re-render after every navigateTo()
   ② Canvas sizing: logical px set from clientWidth/clientHeight
   ③ navigateTo() show/hide flow uses display before class toggle
   ④ Chat connected to real backend /api/v1/chat
   ⑤ Auth scaffolded for Firebase (replace stubs with real calls)
   ⑥ Gauge + trend chart redraw on container resize (ResizeObserver)
   ⑦ Mic recording guard (getUserMedia with fallback)
   ⑧ Risk badge + gauge colour adapts to actual API risk_level
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Config ────────────────────────────────────────────────────── */
// Point this at your running FastAPI server.
// In production, replace with your deployed URL.
const API_BASE = 'http://localhost:8000/api/v1';

/* ── App state ─────────────────────────────────────────────────── */
let state = {
    userId: null,
    userName: 'friend',
    isRecording: false,
    isSending: false,
    mediaRecorder: null,
    audioChunks: [],
    animId: null,
    moodHistory: [18, 15, 20, 14, 16, 12, 14], // placeholder – swap with Firestore fetch
    currentScore: null,
    currentRisk: null,
};

/* ══════════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    initLucide();
    setHeaderDate();
    setGreeting();

    // ── Firebase auth listener ──────────────────────────────────
    // When you integrate Firebase, uncomment and replace the block
    // below. Until then, the app opens on the Auth screen and lets
    // the user "sign in" with a demo user.
    //
    // firebase.auth().onAuthStateChanged(user => {
    //     if (user) {
    //         state.userId   = user.uid;
    //         state.userName = user.displayName || user.email.split('@')[0];
    //         onSignedIn();
    //     } else {
    //         navigateTo('auth');
    //     }
    // });

    // Demo fallback: start on auth screen
    navigateTo('auth');
});

/* ══════════════════════════════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════════════════════════════ */

/**
 * Navigate to a screen by id suffix.
 * FIX ①②③: sets display:flex before toggling .active so the CSS
 * transition has a frame to start from; then inits visualisations.
 *
 * @param {string} screenId  e.g. 'dashboard', 'input', 'auth'
 */
function navigateTo(screenId) {
    const screens = document.querySelectorAll('.screen');

    // Hide all
    screens.forEach(s => {
        s.classList.remove('active');
        // Keep display:flex while fading out so the transition is visible,
        // then hide after it completes.
        s.style.transitionProperty = 'opacity, transform';
        setTimeout(() => {
            if (!s.classList.contains('active')) s.style.display = 'none';
        }, 400);
    });

    const target = document.getElementById(`screen-${screenId}`);
    if (!target) return;

    // Show immediately (display must be set before transition can fire)
    target.style.display = 'flex';

    // One frame later — trigger the CSS transition
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            target.classList.add('active');
        });
    });

    // Per-screen init
    if (screenId === 'dashboard') {
        updateDashboard();
    } else if (screenId === 'input') {
        stopWaveform();
        setTimeout(() => document.getElementById('chatInput')?.focus(), 440);
    }

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        const onclick = item.getAttribute('onclick') || '';
        item.classList.toggle('active', onclick.includes(`'${screenId}'`));
    });

    // Re-render icons for any newly visible screen
    initLucide();
}

/* ══════════════════════════════════════════════════════════════════
   AUTH (stub – wire to Firebase)
   ══════════════════════════════════════════════════════════════════ */

function showSignUp() {
    document.getElementById('formSignIn').classList.add('hidden');
    document.getElementById('formSignUp').classList.remove('hidden');
}

function showSignIn() {
    document.getElementById('formSignUp').classList.add('hidden');
    document.getElementById('formSignIn').classList.remove('hidden');
    clearAuthError();
}

function clearAuthError() {
    ['authError', 'signUpError'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.classList.add('hidden'); }
    });
}

function showAuthError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
}

/**
 * Sign-in handler.
 * Replace the demo block with firebase.auth().signInWithEmailAndPassword().
 */
async function handleSignIn() {
    clearAuthError();
    const email    = document.getElementById('signInEmail').value.trim();
    const password = document.getElementById('signInPassword').value;

    if (!email || !password) {
        showAuthError('authError', 'Please enter your email and password.');
        return;
    }

    // ── Demo: bypass real auth ───────────────────────────────────
    // In production replace with:
    //
    // try {
    //     const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
    //     state.userId   = cred.user.uid;
    //     state.userName = cred.user.displayName || email.split('@')[0];
    //     onSignedIn();
    // } catch (err) {
    //     showAuthError('authError', friendlyAuthError(err.code));
    // }

    state.userId   = 'demo_' + Math.random().toString(36).slice(2, 8);
    state.userName = email.split('@')[0];
    onSignedIn();
}

/**
 * Sign-up handler.
 * Replace with firebase.auth().createUserWithEmailAndPassword().
 */
async function handleSignUp() {
    clearAuthError();
    const name     = document.getElementById('signUpName').value.trim();
    const email    = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPassword').value;

    if (!name || !email || !password) {
        showAuthError('signUpError', 'Please fill in all fields.');
        return;
    }
    if (password.length < 6) {
        showAuthError('signUpError', 'Password must be at least 6 characters.');
        return;
    }

    // ── Demo: bypass real auth ───────────────────────────────────
    state.userId   = 'demo_' + Math.random().toString(36).slice(2, 8);
    state.userName = name;
    onSignedIn();
}

function onSignedIn() {
    setGreeting();
    document.getElementById('avatarBtn').textContent =
        (state.userName || 'U').charAt(0).toUpperCase();
    navigateTo('dashboard');
}

function handleSignOut() {
    // firebase.auth().signOut();
    state.userId = null;
    state.currentScore = null;
    state.currentRisk  = null;
    navigateTo('auth');
}

function friendlyAuthError(code) {
    const map = {
        'auth/user-not-found':      'No account found with that email.',
        'auth/wrong-password':      'Incorrect password. Please try again.',
        'auth/email-already-in-use':'That email is already registered.',
        'auth/invalid-email':       'Please enter a valid email address.',
        'auth/too-many-requests':   'Too many attempts. Please wait a moment.',
    };
    return map[code] || 'Authentication failed. Please try again.';
}

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════════════ */

function updateDashboard() {
    setGreeting();
    setHeaderDate();

    // Redraw visualisations once layout is settled
    setTimeout(() => {
        initGauge(state.currentScore ?? null, state.currentRisk ?? null);
        initTrendChart(state.moodHistory);
    }, 50);

    // Update insight text
    const insightEl = document.getElementById('insightText');
    if (insightEl) {
        if (state.currentRisk === 'HIGH') {
            insightEl.textContent = 'Your score suggests you may be experiencing significant distress. Consider reaching out for support.';
        } else if (state.currentRisk === 'MODERATE') {
            insightEl.textContent = 'Your patterns suggest mild to moderate stress today. Self-care activities may help.';
        } else if (state.currentRisk === 'LOW') {
            insightEl.textContent = 'Your indicators look positive today. Keep nurturing your wellbeing.';
        } else {
            insightEl.textContent = 'Complete a check-in to see your personalised score.';
        }
    }
}

function setHeaderDate() {
    const el = document.getElementById('headerDate');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

function setGreeting() {
    const h    = new Date().getHours();
    const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
    const gEl  = document.getElementById('greetingText');
    const nEl  = document.getElementById('greetingName');
    if (gEl) gEl.textContent = `Good ${part},`;
    if (nEl) nEl.textContent = state.userName || 'friend';
}

/* ══════════════════════════════════════════════════════════════════
   GAUGE  (FIX ②: logical canvas size from clientWidth)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Draw the semicircular risk gauge.
 * @param {number|null} score  – 0..1, null = unknown
 * @param {string|null} risk   – 'LOW' | 'MODERATE' | 'HIGH' | null
 */
function initGauge(score = null, risk = null) {
    const canvas = document.getElementById('gaugeCanvas');
    if (!canvas) return;

    // FIX ②: size canvas to actual CSS pixel dimensions
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.parentElement.clientWidth || 260;
    const cssH = Math.round(cssW * 0.62);

    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = cssW / 2;
    const cy = cssH - 24;
    const r  = Math.min(cx - 20, cy - 10);

    ctx.clearRect(0, 0, cssW, cssH);

    // Track background
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.strokeStyle = '#E0EAD8';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Coloured fill
    const pct = score != null ? Math.max(0, Math.min(1, score)) : 0.5;
    const endAngle = -Math.PI + Math.PI * pct;

    const riskColour = {
        LOW: '#5D7A56',
        MODERATE: '#F0943A',
        HIGH: '#D9534F',
    }[risk] ?? '#A9BA9D';

    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, endAngle);
    ctx.strokeStyle = riskColour;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Needle
    const needleLen = r - 22;
    const nx = cx + Math.cos(endAngle) * needleLen;
    const ny = cy + Math.sin(endAngle) * needleLen;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#2D3436';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Hub
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#2D3436';
    ctx.fill();

    // Score label
    if (score != null) {
        ctx.font = `600 ${Math.round(r * 0.22)}px Outfit, sans-serif`;
        ctx.fillStyle = '#2D3436';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(Math.round(score * 100) + '%', cx, cy - 14);
    }

    // Update risk badge
    const badge = document.getElementById('riskBadge');
    if (badge) {
        badge.className = 'risk-badge';
        if (risk)  {
            badge.textContent = risk + ' RISK';
            badge.classList.add(risk.toLowerCase());
        } else {
            badge.textContent = 'NO DATA';
        }
    }
}

/* ══════════════════════════════════════════════════════════════════
   TREND CHART  (FIX ②: same responsive sizing approach)
   ══════════════════════════════════════════════════════════════════ */

function initTrendChart(data) {
    const canvas = document.getElementById('trendCanvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const dpr  = window.devicePixelRatio || 1;
    const cssW = container.clientWidth  || 280;
    const cssH = container.clientHeight || 110;

    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    if (!data || data.length < 2) {
        ctx.font = '13px Outfit, sans-serif';
        ctx.fillStyle = '#A0ADA0';
        ctx.textAlign = 'center';
        ctx.fillText('No trend data yet', cssW / 2, cssH / 2);
        return;
    }

    const pad   = { top: 12, right: 16, bottom: 12, left: 16 };
    const innerW = cssW - pad.left - pad.right;
    const innerH = cssH - pad.top  - pad.bottom;
    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const range  = maxVal - minVal || 1;

    const px = (i) => pad.left  + (i / (data.length - 1)) * innerW;
    const py = (v) => pad.top   + innerH - ((v - minVal) / range) * innerH;

    ctx.clearRect(0, 0, cssW, cssH);

    // Gradient fill under line
    const grad = ctx.createLinearGradient(0, pad.top, 0, cssH);
    grad.addColorStop(0,   'rgba(157,181,148,0.25)');
    grad.addColorStop(1,   'rgba(157,181,148,0)');

    ctx.beginPath();
    data.forEach((v, i) => { i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)); });
    ctx.lineTo(px(data.length - 1), cssH - pad.bottom);
    ctx.lineTo(px(0), cssH - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#9DB594';
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.shadowBlur  = 8;
    ctx.shadowColor = 'rgba(157,181,148,0.4)';
    data.forEach((v, i) => { i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)); });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Data points
    data.forEach((v, i) => {
        ctx.beginPath();
        ctx.arc(px(i), py(v), 3.5, 0, Math.PI * 2);
        ctx.fillStyle   = '#FFFFFF';
        ctx.strokeStyle = '#9DB594';
        ctx.lineWidth   = 2;
        ctx.fill();
        ctx.stroke();
    });

    // Trend delta label
    const delta  = data[data.length - 1] - data[0];
    const deltaEl = document.getElementById('trendDelta');
    if (deltaEl) {
        deltaEl.textContent = (delta >= 0 ? '↑ ' : '↓ ') + Math.abs(delta) + ' pts';
        deltaEl.style.color = delta <= 0 ? 'var(--sage-dark)' : '#D9534F';
    }
}

/* ══════════════════════════════════════════════════════════════════
   CHAT  (FIX ④: connected to real backend)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Send a user message to the Sentio API and render the response.
 * Handles loading state, typing indicator, error display.
 */
async function sendMessage() {
    if (state.isSending) return;

    const input = document.getElementById('chatInput');
    const text  = (input?.value || '').trim();
    if (!text) return;

    input.value = '';
    state.isSending = true;
    setSendBtnState(true);

    // 1. Render user bubble
    appendBubble(text, 'sent');

    // 2. Show typing indicator
    const typingId = 'typing-' + Date.now();
    appendTypingIndicator(typingId);

    try {
        // 3. Call backend API
        const res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.userId || 'anon',
                message: text,
                // depression_score omitted → server runs hybrid model
            }),
        });

        removeTypingIndicator(typingId);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Server error ${res.status}`);
        }

        const data = await res.json();
        // data: { response, risk_level, is_crisis, depression_score }

        // 4. Render assistant reply
        appendBubble(data.response, 'received');

        // 5. Update dashboard state
        state.currentScore = data.depression_score;
        state.currentRisk  = data.risk_level;

        // Push score to trend history (scale to 0-24 for display)
        state.moodHistory.push(Math.round(data.depression_score * 24));
        if (state.moodHistory.length > 14) state.moodHistory.shift();

    } catch (err) {
        removeTypingIndicator(typingId);
        appendBubble(
            "I'm having trouble connecting right now. Please check your internet connection or try again in a moment.",
            'received',
            true  // isError
        );
        console.error('[Sentio] Chat error:', err);
    } finally {
        state.isSending = false;
        setSendBtnState(false);
    }
}

/** Render a chat bubble into #chatMessages */
function appendBubble(text, type, isError = false) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${type}`;

    if (type === 'received') {
        const av = document.createElement('div');
        av.className = 'bubble-avatar';
        av.textContent = isError ? '!' : 'S';
        if (isError) av.style.background = '#FFF0EE';
        bubble.appendChild(av);
    }

    const body = document.createElement('div');
    body.className = 'bubble-body';
    // Allow line breaks; escape HTML
    body.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
    if (isError) body.style.background = '#FFF5F5';

    if (type === 'sent') {
        const av = document.createElement('div');
        av.className = 'bubble-avatar';
        av.textContent = (state.userName || 'U').charAt(0).toUpperCase();
        av.style.background = 'var(--sage-light)';
        bubble.appendChild(body);
        bubble.appendChild(av);
    } else {
        bubble.appendChild(body);
    }

    if (type === 'sent') {
        // already appended above in correct order
    }

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    initLucide();
}

/** Append animated typing indicator */
function appendTypingIndicator(id) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble received typing';
    bubble.id = id;

    const av = document.createElement('div');
    av.className = 'bubble-avatar';
    av.textContent = 'S';
    bubble.appendChild(av);

    const body = document.createElement('div');
    body.className = 'bubble-body';
    body.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    bubble.appendChild(body);

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator(id) {
    document.getElementById(id)?.remove();
}

function setSendBtnState(disabled) {
    const btn = document.getElementById('sendBtn');
    if (btn) btn.disabled = disabled;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════════════════
   VOICE RECORDING  (FIX ⑦: getUserMedia with graceful fallback)
   ══════════════════════════════════════════════════════════════════ */

async function toggleRecording() {
    if (state.isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
        alert('Voice recording is not supported in this browser.');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mediaRecorder = new MediaRecorder(stream);
        state.audioChunks   = [];

        state.mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) state.audioChunks.push(e.data);
        };

        state.mediaRecorder.onstop = async () => {
            const blob = new Blob(state.audioChunks, { type: 'audio/webm' });
            // TODO: upload blob to Firebase Storage, get URL, pass as audio_path
            // For now, we just send a text note that audio was recorded.
            console.log('[Sentio] Audio recorded, size:', blob.size);
            // const url = await uploadToFirebaseStorage(blob, state.userId);
        };

        state.mediaRecorder.start();
        state.isRecording = true;

        document.getElementById('micBtn')?.classList.add('recording');
        const wfBox = document.getElementById('waveformBox');
        if (wfBox) wfBox.style.display = 'flex';
        startWaveform();
    } catch (err) {
        console.error('[Sentio] Mic error:', err);
        alert('Could not access the microphone. Please check your browser permissions.');
    }
}

function stopRecording() {
    state.isRecording = false;
    state.mediaRecorder?.stop();
    state.mediaRecorder?.stream?.getTracks().forEach(t => t.stop());

    document.getElementById('micBtn')?.classList.remove('recording');
    const wfBox = document.getElementById('waveformBox');
    if (wfBox) wfBox.style.display = 'none';
    stopWaveform();
}

function startWaveform() {
    const canvas = document.getElementById('micWaveform');
    if (!canvas) return;

    const container = canvas.parentElement;
    const cssW = container.clientWidth  || 260;
    const cssH = 60;
    canvas.width  = cssW;
    canvas.height = cssH;
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');

    function animate() {
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.beginPath();
        ctx.strokeStyle = '#5D7A56';
        ctx.lineWidth   = 2.5;
        ctx.lineCap     = 'round';

        const t = Date.now() * 0.008;
        for (let x = 0; x < cssW; x += 4) {
            const amp = state.isRecording ? 16 : 2;
            const y = cssH / 2
                + Math.sin(x * 0.04 + t) * amp
                + Math.sin(x * 0.08 + t * 1.3) * (amp * 0.4);
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        state.animId = requestAnimationFrame(animate);
    }
    animate();
}

function stopWaveform() {
    if (state.animId) cancelAnimationFrame(state.animId);
    state.animId = null;
    const canvas = document.getElementById('micWaveform');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

/* ══════════════════════════════════════════════════════════════════
   ACTIVITIES FILTER
   ══════════════════════════════════════════════════════════════════ */

function filterActivities(category, tabEl) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');

    document.querySelectorAll('.activity-card').forEach(card => {
        const match = category === 'all' || card.dataset.category === category;
        card.style.display  = match ? 'block' : 'none';
    });
}

/* ══════════════════════════════════════════════════════════════════
   PROCESSING SCREEN  (kept for non-chat analysis flows)
   ══════════════════════════════════════════════════════════════════ */

function startProcessing(label = 'Analyzing mood indicators…') {
    document.getElementById('processingLabel').textContent = label;
    navigateTo('processing');
    setTimeout(() => navigateTo('dashboard'), 3200);
}

/* ══════════════════════════════════════════════════════════════════
   LUCIDE  (FIX ①: single reliable init helper)
   ══════════════════════════════════════════════════════════════════ */

function initLucide() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

/* ══════════════════════════════════════════════════════════════════
   RESIZE OBSERVER  (FIX ⑥: redraws charts when container resizes)
   ══════════════════════════════════════════════════════════════════ */

if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
        const dashActive = document.getElementById('screen-dashboard')?.classList.contains('active');
        if (dashActive) {
            initGauge(state.currentScore, state.currentRisk);
            initTrendChart(state.moodHistory);
        }
    });
    ro.observe(document.getElementById('app'));
}
