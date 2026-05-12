/* ═══════════════════════════════════════════════════════════════
   Sentio – app.js  v7
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const API_BASE = 'https://sentio-backend-311t.onrender.com/api/v1';

let state = {
    userId: null, userName: 'friend', userEmail: null, idToken: null,
    isRecording: false, isSending: false, mediaRecorder: null, audioChunks: [],
    animId: null, moodHistory: [], currentScore: null, currentRisk: null,
    currentSessionId: null, sidebarOpen: false, activityTimer: null,
    lastCrisisContacts: null, currentPromptIndex: 0,
    // Onboarding
    onboardingQuestions: [], onboardingAnswers: [], onboardingIndex: 0,
    // To-Do
    todoTab: 'daily', todoCalMonth: new Date(), todoSelectedDay: null,
    todoNotifEnabled: false, todoNotifTime: '20:00', notifTimer: null,
    // Medical Records
    currentMedSection: 'Prescriptions', pendingImageData: null,
    journalPrompts: [
        'How are you feeling right now, in this moment?',
        'What is one thing that has been weighing on your mind?',
        'What is one small thing you are grateful for today?',
        'What do you need most right now?',
        'What would you tell a close friend going through what you are going through?',
        'Describe your energy today in three words.',
        'What made you smile recently, even briefly?',
        'What is one thing you want to let go of today?',
    ],
};

/* ══════════════════════════════════════════════════════════════════
   ACTIVITY DATA
═══════════════════════════════════════════════════════════════════ */
const ACTIVITIES = {
    'box-breathing': { title:'Box Breathing', subtitle:'A 4-4-4-4 breathing pattern to calm your nervous system', icon:'🌬️', type:'breathing', steps:[{label:'Inhale',duration:4,color:'#5D7A56',instruction:'Breathe in slowly through your nose'},{label:'Hold',duration:4,color:'#F0943A',instruction:'Hold your breath gently'},{label:'Exhale',duration:4,color:'#3E5438',instruction:'Breathe out slowly through your mouth'},{label:'Hold',duration:4,color:'#9DB594',instruction:'Rest before the next breath'}], cycles:5 },
    'daily-journal': { title:'Daily Journal', subtitle:'Free writing to process your thoughts and emotions', icon:'📓', type:'journal', prompts:['How are you feeling right now?','What is weighing on your mind?','What are you grateful for today?','What do you need most right now?','What would you tell a close friend going through this?'] },
    'sleep-hygiene': { title:'Sleep Hygiene', subtitle:'A nightly routine for deeper, more restful sleep', icon:'🌙', type:'checklist', items:[{time:'2 hours before',action:'Dim your lights or switch to warm lighting',icon:'💡'},{time:'1 hour before',action:'Put your phone face-down or in another room',icon:'📵'},{time:'45 min before',action:'Do something calming — read, stretch, or journal',icon:'📖'},{time:'30 min before',action:'Avoid food and caffeine',icon:'🚫'},{time:'15 min before',action:"Write down tomorrow's worries to clear your mind",icon:'✍️'},{time:'Bedtime',action:'Keep your room cool, dark, and quiet',icon:'🌑'}] },
    'mindful-walk': { title:'Mindful Walk', subtitle:'Ground yourself through movement and awareness', icon:'🚶', type:'guided', steps:[{duration:60,instruction:'Start walking slowly. Focus only on the sensation of your feet touching the ground.'},{duration:120,instruction:'Notice 5 things you can see around you. Really look at them.'},{duration:120,instruction:"Notice 4 things you can hear. Don't judge them, just listen."},{duration:120,instruction:'Notice 3 things you can physically feel — breeze, warmth, the weight of your body.'},{duration:120,instruction:"Take 3 deep breaths. With each exhale, let go of whatever you're carrying."},{duration:60,instruction:'Slow your pace. Let your mind be completely empty for these last 60 seconds.'}] },
    'body-scan': { title:'Body Scan', subtitle:'Gently reconnect with your physical self', icon:'🧘', type:'guided', steps:[{duration:30,instruction:'Sit or lie down comfortably. Close your eyes. Take 3 slow breaths.'},{duration:60,instruction:'Bring your attention to your feet. Notice any tension, warmth, or tingling.'},{duration:60,instruction:'Move your attention slowly up to your legs and hips. Breathe into any tightness.'},{duration:60,instruction:'Notice your stomach and chest. Feel them rise and fall with each breath.'},{duration:60,instruction:'Bring awareness to your shoulders and neck. Soften them.'},{duration:60,instruction:'Finally, relax your jaw, eyes, and forehead. Let your face be completely soft.'},{duration:30,instruction:"Take a final deep breath. When you're ready, slowly open your eyes."}] },
    'gentle-stretch': { title:'Gentle Stretch', subtitle:'Release physical tension held in your body', icon:'🤸', type:'guided', steps:[{duration:60,instruction:'Neck rolls: Slowly drop your chin to your chest, roll right, back, left. 3 full circles each way.'},{duration:60,instruction:'Shoulder shrugs: Lift both shoulders to your ears, hold 3 seconds, release. Repeat 5 times.'},{duration:60,instruction:'Chest opener: Clasp hands behind your back, squeeze shoulder blades, hold 10 seconds. Repeat 3 times.'},{duration:60,instruction:'Seated forward fold: Sit tall, hinge forward from your hips, let your arms hang. Hold 30 seconds.'},{duration:60,instruction:'Hip flexor stretch: Step one foot forward into a lunge, hold 30 seconds. Switch sides.'},{duration:60,instruction:"Child's pose: Kneel, reach arms forward, rest forehead on the floor. Breathe deeply for 1 minute."}] },
};

/* ══════════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    initLucide(); setHeaderDate(); setGreeting(); navigateTo('loading');
    applyStoredDarkMode();
    initTodoNotifications();
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            state.userId    = user.uid;
            state.userName  = user.displayName || user.email.split('@')[0];
            state.userEmail = user.email;
            state.idToken   = await user.getIdToken();
            onSignedIn();
        } else { navigateTo('auth'); }
    });
});

/* ══════════════════════════════════════════════════════════════════
   DARK MODE
═══════════════════════════════════════════════════════════════════ */
function applyStoredDarkMode() {
    const dark = localStorage.getItem('sentio_dark') === 'true';
    document.body.classList.toggle('dark', dark);
    updateDarkModeIcon();
}
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('sentio_dark', isDark);
    updateDarkModeIcon();
}
function updateDarkModeIcon() {
    const btn = document.getElementById('darkModeBtn');
    if (!btn) return;
    const isDark = document.body.classList.contains('dark');
    btn.innerHTML = isDark ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
    initLucide();
}

/* ══════════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════════ */
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); setTimeout(() => { if (!s.classList.contains('active')) s.style.display = 'none'; }, 400); });
    const target = document.getElementById(`screen-${screenId}`); if (!target) return;
    target.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => target.classList.add('active')));
    if (screenId === 'dashboard') updateDashboard();
    else if (screenId === 'input') { stopWaveform(); setTimeout(() => document.getElementById('chatInput')?.focus(), 440); }
    else if (screenId === 'journal') loadJournalEntries();
    else if (screenId === 'todo') { loadTodos(); renderMonthTitle(); }
    else if (screenId === 'medical') loadMedicalRecords();
    document.querySelectorAll('.nav-item').forEach(item => { const oc = item.getAttribute('onclick') || ''; item.classList.toggle('active', oc.includes(`'${screenId}'`)); });
    initLucide();
}

/* ══════════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════════ */
function showSignUp() { document.getElementById('formSignIn').classList.add('hidden'); document.getElementById('formSignUp').classList.remove('hidden'); clearAuthError(); }
function showSignIn()  { document.getElementById('formSignUp').classList.add('hidden'); document.getElementById('formSignIn').classList.remove('hidden'); clearAuthError(); }
function clearAuthError() { ['authError','signUpError'].forEach(id => { const el = document.getElementById(id); if (el) { el.textContent=''; el.classList.add('hidden'); } }); }
function showAuthError(id, msg) { const el = document.getElementById(id); if (!el) return; el.textContent = msg; el.classList.remove('hidden'); }

async function handleSignIn() {
    clearAuthError();
    const email = document.getElementById('signInEmail').value.trim(), password = document.getElementById('signInPassword').value;
    if (!email || !password) { showAuthError('authError','Please enter your email and password.'); return; }
    try { setAuthLoading(true); await firebase.auth().signInWithEmailAndPassword(email, password); }
    catch (err) { showAuthError('authError', friendlyAuthError(err.code)); }
    finally { setAuthLoading(false); }
}
async function handleSignUp() {
    clearAuthError();
    const name = document.getElementById('signUpName').value.trim(), email = document.getElementById('signUpEmail').value.trim(), password = document.getElementById('signUpPassword').value;
    if (!name||!email||!password) { showAuthError('signUpError','Please fill in all fields.'); return; }
    if (password.length < 6) { showAuthError('signUpError','Password must be at least 6 characters.'); return; }
    try { setAuthLoading(true); const cred = await firebase.auth().createUserWithEmailAndPassword(email, password); await cred.user.updateProfile({ displayName: name }); }
    catch (err) { showAuthError('signUpError', friendlyAuthError(err.code)); }
    finally { setAuthLoading(false); }
}
async function handleGoogleSignIn() {
    clearAuthError();
    try { setAuthLoading(true); const googleUser = await CapacitorGoogleAuth.GoogleAuth.signIn();
const credential = firebase.auth.GoogleAuthProvider.credential(googleUser.authentication.idToken);
await firebase.auth().signInWithCredential(credential); }
    catch (err) { showAuthError('authError', friendlyAuthError(err.code)); showAuthError('signUpError', friendlyAuthError(err.code)); }
    finally { setAuthLoading(false); }
}
async function handleSignOut() {
    closeSidebar(); await firebase.auth().signOut();
    Object.assign(state, { userId:null, userName:'friend', userEmail:null, idToken:null, currentScore:null, currentRisk:null, moodHistory:[], currentSessionId:null });
    navigateTo('auth');
}
async function onSignedIn() {
    setGreeting();
    const btn = document.getElementById('avatarBtn');
    if (btn) { btn.textContent = (state.userName||'U').charAt(0).toUpperCase(); btn.title = `Signed in as ${state.userEmail}\nClick to sign out`; }
    await checkOnboarding();
    loadMoodHistory();
    try {
        const res = await fetch(`${API_BASE}/sessions?user_id=${encodeURIComponent(state.userId)}`);
        if (res.ok) { const data = await res.json(); const active = (data.sessions||[]).find(s => (s.message_count||0) > 0); if (active) state.currentSessionId = active.session_id; else await createNewSession(); }
        else await createNewSession();
    } catch { await createNewSession(); }
}
function setAuthLoading(loading) { document.querySelectorAll('.btn-primary,.btn-google').forEach(btn => btn.disabled = loading); }
function friendlyAuthError(code) { return ({'auth/user-not-found':'No account found with that email.','auth/wrong-password':'Incorrect password.','auth/email-already-in-use':'That email is already registered.','auth/invalid-email':'Please enter a valid email address.','auth/too-many-requests':'Too many attempts. Please wait.','auth/weak-password':'Password should be at least 6 characters.','auth/popup-closed-by-user':'Google sign-in was cancelled.','auth/invalid-credential':'Incorrect email or password.'})[code] || 'Authentication failed. Please try again.'; }

/* ══════════════════════════════════════════════════════════════════
   ONBOARDING — dynamic questions from Firestore config
═══════════════════════════════════════════════════════════════════ */
const DEFAULT_ONBOARDING_QUESTIONS = [
    { id: 'name', type: 'text', question: "What should I call you?", sub: "We'll use this to personalise your experience.", placeholder: "Your preferred name…" },
    { id: 'concern', type: 'options', question: "What brings you to Sentio?", sub: "Choose what resonates most right now.", options: [{ emoji:'😰', label:'Anxiety & Stress' },{ emoji:'😔', label:'Feeling Low or Depressed' },{ emoji:'😴', label:'Sleep & Fatigue' },{ emoji:'😶', label:'Loneliness' },{ emoji:'🌱', label:'Just Exploring' }] },
    { id: 'goal', type: 'options', question: "What are you hoping for?", sub: "This helps Sentio support you better.", options: [{ emoji:'💬', label:'Someone to talk to' },{ emoji:'📊', label:'Track my mood' },{ emoji:'🧘', label:'Guided exercises' },{ emoji:'✨', label:'All of the above' }] },
];

async function checkOnboarding() {
    try {
        const db = firebase.firestore();
        const prefDoc = await db.collection('chats').doc(state.userId).collection('profile').doc('preferences').get();
        const prefs = prefDoc.exists ? prefDoc.data() : {};
        if (prefs.onboarding_complete || prefs.onboarding_skipped) { navigateTo('dashboard'); return; }
        await loadOnboardingQuestions();
        startOnboarding();
    } catch (err) { console.error('[Sentio] Onboarding check error:', err); navigateTo('dashboard'); }
}

async function loadOnboardingQuestions() {
    try {
        const db = firebase.firestore();
        const configDoc = await db.collection('config').doc('onboarding').get();
        if (configDoc.exists && configDoc.data().questions?.length) {
            state.onboardingQuestions = configDoc.data().questions;
        } else {
            // Seed default questions into Firestore on first load
            state.onboardingQuestions = DEFAULT_ONBOARDING_QUESTIONS;
            await db.collection('config').doc('onboarding').set({ questions: DEFAULT_ONBOARDING_QUESTIONS }, { merge: true });
        }
    } catch (_) { state.onboardingQuestions = DEFAULT_ONBOARDING_QUESTIONS; }
}

function startOnboarding() {
    state.onboardingIndex = 0;
    state.onboardingAnswers = new Array(state.onboardingQuestions.length).fill(null);
    renderOnboardingProgress();
    renderOnboardingQuestion();
    navigateTo('onboarding');
}

function renderOnboardingProgress() {
    const prog = document.getElementById('onboardingProgress'); if (!prog) return;
    prog.innerHTML = '';
    state.onboardingQuestions.forEach((_, i) => {
        const dot = document.createElement('div'); dot.className = 'onboarding-dot';
        if (i < state.onboardingIndex) dot.classList.add('done');
        else if (i === state.onboardingIndex) dot.classList.add('active');
        prog.appendChild(dot);
    });
}

function renderOnboardingQuestion() {
    const wrap = document.getElementById('onboardingQuestionWrap'); if (!wrap) return;
    const q = state.onboardingQuestions[state.onboardingIndex];
    const nextBtn = document.getElementById('onboardingNextBtn');
    const isLast = state.onboardingIndex === state.onboardingQuestions.length - 1;
    nextBtn.textContent = isLast ? 'Get Started →' : 'Continue →';
    nextBtn.disabled = !state.onboardingAnswers[state.onboardingIndex];
    wrap.innerHTML = '';
    const h3 = document.createElement('h3'); h3.textContent = q.question; wrap.appendChild(h3);
    if (q.sub) { const sub = document.createElement('p'); sub.className = 'q-sub'; sub.textContent = q.sub; wrap.appendChild(sub); }

    if (q.type === 'text') {
        const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'onboarding-text-input'; inp.placeholder = q.placeholder || '';
        inp.value = state.onboardingAnswers[state.onboardingIndex] || '';
        inp.addEventListener('input', e => { state.onboardingAnswers[state.onboardingIndex] = e.target.value.trim(); nextBtn.disabled = !e.target.value.trim(); });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !nextBtn.disabled) onboardingNext(); });
        wrap.appendChild(inp); setTimeout(() => inp.focus(), 100);
    } else if (q.type === 'options') {
        const optsWrap = document.createElement('div'); optsWrap.className = 'onboarding-options';
        (q.options || []).forEach(opt => {
            const btn = document.createElement('button'); btn.className = 'onboarding-option';
            if (state.onboardingAnswers[state.onboardingIndex] === opt.label) btn.classList.add('selected');
            btn.innerHTML = `<span class="opt-emoji">${opt.emoji || ''}</span>${escapeHtml(opt.label)}`;
            btn.addEventListener('click', () => {
                optsWrap.querySelectorAll('.onboarding-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                state.onboardingAnswers[state.onboardingIndex] = opt.label;
                nextBtn.disabled = false;
            });
            optsWrap.appendChild(btn);
        });
        wrap.appendChild(optsWrap);
    }
}

async function onboardingNext() {
    const answer = state.onboardingAnswers[state.onboardingIndex];
    if (!answer) return;
    if (state.onboardingIndex < state.onboardingQuestions.length - 1) {
        state.onboardingIndex++;
        renderOnboardingProgress();
        renderOnboardingQuestion();
    } else {
        await completeOnboarding();
    }
}

async function completeOnboarding() {
    try {
        const db = firebase.firestore();
        const answers = {};
        state.onboardingQuestions.forEach((q, i) => { answers[q.id] = state.onboardingAnswers[i]; });
        // Update display name if name provided
        if (answers.name) { state.userName = answers.name; const user = firebase.auth().currentUser; if (user) await user.updateProfile({ displayName: answers.name }); }
        await db.collection('chats').doc(state.userId).collection('profile').doc('preferences').set({ onboarding_complete: true, onboarding_answers: answers, completed_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (err) { console.error('[Sentio] Onboarding save error:', err); }
    navigateTo('dashboard');
}

async function skipOnboarding() {
    try { await firebase.firestore().collection('chats').doc(state.userId).collection('profile').doc('preferences').set({ onboarding_skipped: true }, { merge: true }); }
    catch (_) {}
    navigateTo('dashboard');
}

/* ══════════════════════════════════════════════════════════════════
   CRISIS MODAL
═══════════════════════════════════════════════════════════════════ */
function showCrisisModal(contacts) {
    if (!contacts || !contacts.lines) return; state.lastCrisisContacts = contacts;
    const hotlinesEl = document.getElementById('crisisHotlines'); hotlinesEl.innerHTML = '';
    contacts.lines.forEach(line => { if (!line.name) return; const card = document.createElement('div'); card.className = 'crisis-hotline-card'; card.innerHTML = `<div class="crisis-hotline-info"><span class="crisis-hotline-name">${escapeHtml(line.name)}</span>${line.note?`<span class="crisis-hotline-note">${escapeHtml(line.note)}</span>`:''}</div>${line.number?`<a class="crisis-hotline-number" href="tel:${line.number.replace(/\s/g,'')}">${escapeHtml(line.number)}</a>`:''}`; hotlinesEl.appendChild(card); });
    if (contacts.international_link) { const a = document.createElement('a'); a.href=contacts.international_link; a.target='_blank'; a.className='crisis-intl-link'; a.textContent='🌍 Find more international resources'; hotlinesEl.appendChild(a); }
    document.getElementById('crisisOverlay').classList.add('visible'); document.getElementById('crisisModal').classList.add('visible');
}
function closeCrisisModal() { document.getElementById('crisisOverlay').classList.remove('visible'); document.getElementById('crisisModal').classList.remove('visible'); const b=document.getElementById('crisisBanner'); if(b) b.classList.remove('hidden'); }
function showCrisisModalAgain() { if (state.lastCrisisContacts) showCrisisModal(state.lastCrisisContacts); }
function hideCrisisBanner() { document.getElementById('crisisBanner')?.classList.add('hidden'); }

/* ══════════════════════════════════════════════════════════════════
   ACTIVITY MODALS (unchanged from v6)
═══════════════════════════════════════════════════════════════════ */
function openActivity(activityId) { const activity=ACTIVITIES[activityId]; if(!activity)return; document.getElementById('activityModalIcon').textContent=activity.icon; document.getElementById('activityModalTitle').textContent=activity.title; document.getElementById('activityModalSubtitle').textContent=activity.subtitle; const body=document.getElementById('activityModalBody'); body.innerHTML=''; if(activity.type==='breathing')renderBreathingActivity(body,activity); else if(activity.type==='journal')renderJournalActivity(body,activity); else if(activity.type==='checklist')renderChecklistActivity(body,activity); else if(activity.type==='guided')renderGuidedActivity(body,activity,activityId); document.getElementById('activityOverlay').classList.add('visible'); document.getElementById('activityModal').classList.add('visible'); initLucide(); }
function closeActivityModal() { if(state.activityTimer){clearInterval(state.activityTimer);clearTimeout(state.activityTimer);state.activityTimer=null;} document.getElementById('activityOverlay').classList.remove('visible'); document.getElementById('activityModal').classList.remove('visible'); }
function renderBreathingActivity(body,activity){body.innerHTML=`<div class="breathing-circle-wrap"><div class="breathing-circle" id="breathCircle"><span id="breathLabel">Ready</span><span id="breathCount"></span></div></div><p id="breathInstruction" class="activity-instruction">Press Start to begin your breathing exercise</p><div class="activity-progress"><span id="breathCycleCount">0 / ${activity.cycles} cycles</span></div><button class="activity-action-btn" id="breathStartBtn" onclick="startBreathing()">Start</button>`;}
function startBreathing(){const activity=ACTIVITIES['box-breathing'];const btn=document.getElementById('breathStartBtn');btn.style.display='none';let cycleNum=0,stepIndex=0,secondsLeft=0;const runStep=()=>{if(cycleNum>=activity.cycles){document.getElementById('breathLabel').textContent='✓';document.getElementById('breathCount').textContent='';document.getElementById('breathInstruction').textContent='Well done. Take a moment to notice how you feel.';document.getElementById('breathCircle').style.background='#5D7A56';document.getElementById('breathCycleCount').textContent=`${activity.cycles} / ${activity.cycles} cycles complete`;btn.style.display='block';btn.textContent='Close';btn.onclick=closeActivityModal;return;}const step=activity.steps[stepIndex];secondsLeft=step.duration;document.getElementById('breathLabel').textContent=step.label;document.getElementById('breathCount').textContent=secondsLeft;document.getElementById('breathInstruction').textContent=step.instruction;document.getElementById('breathCircle').style.background=step.color;document.getElementById('breathCircle').style.transform=step.label==='Inhale'?'scale(1.3)':step.label==='Exhale'?'scale(0.85)':'scale(1)';if(state.activityTimer)clearInterval(state.activityTimer);state.activityTimer=setInterval(()=>{secondsLeft--;document.getElementById('breathCount').textContent=secondsLeft;if(secondsLeft<=0){clearInterval(state.activityTimer);stepIndex++;if(stepIndex>=activity.steps.length){stepIndex=0;cycleNum++;document.getElementById('breathCycleCount').textContent=`${cycleNum} / ${activity.cycles} cycles`;}runStep();}},1000);};runStep();}
function renderJournalActivity(body,activity){const prompt=activity.prompts[Math.floor(Math.random()*activity.prompts.length)];body.innerHTML=`<div class="journal-prompt"><span class="journal-prompt-label">Today's prompt</span><p id="journalPromptText">${prompt}</p><button class="journal-new-prompt" onclick="refreshJournalPrompt()">New prompt ↺</button></div><textarea id="journalText" class="journal-textarea" placeholder="Write freely…" rows="8"></textarea><div class="journal-actions"><span id="journalWordCount" class="journal-word-count">0 words</span><button class="activity-action-btn small" onclick="closeActivityModal()">Done ✓</button></div>`;document.getElementById('journalText').addEventListener('input',(e)=>{const words=e.target.value.trim().split(/\s+/).filter(w=>w).length;document.getElementById('journalWordCount').textContent=`${words} word${words!==1?'s':''}`; });}
function refreshJournalPrompt(){const p=ACTIVITIES['daily-journal'].prompts;document.getElementById('journalPromptText').textContent=p[Math.floor(Math.random()*p.length)];}
function renderChecklistActivity(body,activity){body.innerHTML=`<div class="checklist-wrap">${activity.items.map((item,i)=>`<label class="checklist-item" for="check-${i}"><input type="checkbox" id="check-${i}" onchange="updateChecklist()"><div class="checklist-content"><span class="checklist-icon">${item.icon}</span><div><span class="checklist-time">${item.time}</span><span class="checklist-action">${item.action}</span></div></div></label>`).join('')}</div><div class="checklist-progress"><div class="checklist-bar-track"><div class="checklist-bar-fill" id="checklistBar" style="width:0%"></div></div><span id="checklistProgressText">0 / ${activity.items.length} done</span></div>`;}
function updateChecklist(){const checks=document.querySelectorAll('.checklist-item input[type=checkbox]');const done=[...checks].filter(c=>c.checked).length;document.getElementById('checklistBar').style.width=Math.round((done/checks.length)*100)+'%';document.getElementById('checklistProgressText').textContent=`${done} / ${checks.length} done`;}
function renderGuidedActivity(body,activity,activityId){body.innerHTML=`<div class="guided-step-display"><div class="guided-step-num" id="guidedStepNum">Step 1 of ${activity.steps.length}</div><p class="guided-step-text" id="guidedStepText">${activity.steps[0].instruction}</p><div class="guided-timer-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#e0e8da" stroke-width="8"/><circle cx="50" cy="50" r="44" fill="none" stroke="#5D7A56" stroke-width="8" stroke-dasharray="276" stroke-dashoffset="276" stroke-linecap="round" id="guidedTimerArc" transform="rotate(-90 50 50)"/></svg><span id="guidedTimerText">—</span></div></div><button class="activity-action-btn" id="guidedStartBtn" onclick="startGuidedActivity('${activityId}')">Begin</button>`;}
function startGuidedActivity(activityId){const activity=ACTIVITIES[activityId];document.getElementById('guidedStartBtn').style.display='none';let stepIdx=0;const runStep=()=>{if(stepIdx>=activity.steps.length){document.getElementById('guidedStepText').textContent="You're done. Take a moment to settle.";document.getElementById('guidedStepNum').textContent='Complete ✓';document.getElementById('guidedTimerText').textContent='✓';const btn=document.getElementById('guidedStartBtn');btn.style.display='block';btn.textContent='Close';btn.onclick=closeActivityModal;return;}const step=activity.steps[stepIdx];const totalSecs=step.duration;let secsLeft=totalSecs;document.getElementById('guidedStepNum').textContent=`Step ${stepIdx+1} of ${activity.steps.length}`;document.getElementById('guidedStepText').textContent=step.instruction;document.getElementById('guidedTimerText').textContent=secsLeft;if(state.activityTimer)clearInterval(state.activityTimer);state.activityTimer=setInterval(()=>{secsLeft--;document.getElementById('guidedTimerText').textContent=secsLeft;document.getElementById('guidedTimerArc').style.strokeDashoffset=276-(276*(totalSecs-secsLeft)/totalSecs);if(secsLeft<=0){clearInterval(state.activityTimer);stepIdx++;runStep();}},1000);};runStep();}

/* ══════════════════════════════════════════════════════════════════
   JOURNAL SCREEN
═══════════════════════════════════════════════════════════════════ */
const JOURNAL_PROMPTS = ['How are you feeling right now, in this moment?','What is one thing that has been weighing on your mind?','What is one small thing you are grateful for today?','What do you need most right now?','What would you tell a close friend going through what you are going through?','Describe your energy today in three words.','What made you smile recently, even briefly?','What is one thing you want to let go of today?'];
function showNewJournalEntry(){const panel=document.getElementById('journalWritePanel');panel.classList.remove('hidden');document.getElementById('journalWriteDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});refreshScreenPrompt();document.getElementById('journalWriteArea').value='';document.getElementById('journalWriteArea').focus();document.getElementById('journalWriteArea').addEventListener('input',updateJournalWordCount);}
function hideNewJournalEntry(){document.getElementById('journalWritePanel').classList.add('hidden');}
function updateJournalWordCount(){const text=document.getElementById('journalWriteArea').value;const words=text.trim().split(/\s+/).filter(w=>w).length;document.getElementById('journalWriteWordCount').textContent=`${words} word${words!==1?'s':''}`;}
function refreshScreenPrompt(){state.currentPromptIndex=Math.floor(Math.random()*JOURNAL_PROMPTS.length);document.getElementById('journalPromptDisplay').textContent=JOURNAL_PROMPTS[state.currentPromptIndex];}
async function saveJournalEntry(){const text=document.getElementById('journalWriteArea').value.trim();if(!text)return;const db=firebase.firestore();const now=new Date();const key=now.toISOString().split('T')[0];try{await db.collection('chats').doc(state.userId).collection('journal').add({text,prompt:JOURNAL_PROMPTS[state.currentPromptIndex]||'',date:key,timestamp:firebase.firestore.FieldValue.serverTimestamp(),wordCount:text.trim().split(/\s+/).filter(w=>w).length});hideNewJournalEntry();loadJournalEntries();}catch(err){console.error('[Sentio] Failed to save journal entry:',err);}}
async function loadJournalEntries(){const listEl=document.getElementById('journalEntriesList');if(!listEl)return;listEl.innerHTML='<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">Loading…</div>';try{const db=firebase.firestore();const snapshot=await db.collection('chats').doc(state.userId).collection('journal').orderBy('timestamp','desc').limit(50).get();if(snapshot.empty){listEl.innerHTML=`<div class="journal-empty-state"><div class="journal-empty-icon">📓</div><p>Your journal is empty.</p><p class="journal-empty-sub">Tap + to write your first entry.</p></div>`;return;}listEl.innerHTML='';snapshot.forEach(doc=>{const data=doc.data();const card=document.createElement('div');card.className='journal-entry-card';const date=data.date||'';const preview=data.text.length>120?data.text.slice(0,120)+'…':data.text;card.innerHTML=`<div class="journal-entry-header"><span class="journal-entry-date">${formatJournalDate(date)}</span><div class="journal-entry-actions"><span class="journal-entry-words">${data.wordCount||0} words</span><button class="journal-entry-delete" onclick="deleteJournalEntry('${doc.id}',event)"><i data-lucide="trash-2"></i></button></div></div>${data.prompt?`<p class="journal-entry-prompt">${escapeHtml(data.prompt)}</p>`:''}<p class="journal-entry-preview">${escapeHtml(preview)}</p><button class="journal-entry-expand" onclick="expandJournalEntry('${doc.id}',this,${JSON.stringify(data.text).replace(/'/g,'&#39;')})">Read more</button>`;listEl.appendChild(card);});initLucide();}catch(err){listEl.innerHTML='<div style="text-align:center;padding:24px;color:#c0392b;font-size:13px;">Failed to load entries.</div>';console.error('[Sentio] Journal load error:',err);}}
function formatJournalDate(dateStr){if(!dateStr)return'';const d=new Date(dateStr+'T00:00:00');const today=new Date().toISOString().split('T')[0];const yesterday=new Date(Date.now()-86400000).toISOString().split('T')[0];if(dateStr===today)return'Today';if(dateStr===yesterday)return'Yesterday';return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});}
function expandJournalEntry(docId,btn,fullText){btn.previousElementSibling.textContent=fullText;btn.style.display='none';}
async function deleteJournalEntry(docId,event){event.stopPropagation();if(!confirm('Delete this journal entry?'))return;try{await firebase.firestore().collection('chats').doc(state.userId).collection('journal').doc(docId).delete();loadJournalEntries();}catch(err){console.error('[Sentio] Journal delete error:',err);}}

/* ══════════════════════════════════════════════════════════
   MEDICAL RECORDS
═══════════════════════════════════════════════════════════════════ */
function switchMedSection(section, tabEl) {
    state.currentMedSection = section;
    document.querySelectorAll('.med-section-tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    document.getElementById('cameraModalSection').textContent = `Section: ${section}`;
    loadMedicalRecords();
}

async function loadMedicalRecords() {
    const listEl = document.getElementById('medRecordsList'); if (!listEl) return;
    listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">Loading…</div>';
    try {
        // Simple query with no compound index needed — filter section client-side
        const snap = await firebase.firestore().collection('chats').doc(state.userId).collection('medical_records')
            .orderBy('timestamp', 'desc').limit(100).get();
        const docs = [];
        snap.forEach(doc => { if (doc.data().section === state.currentMedSection) docs.push(doc); });
        if (docs.length === 0) {
            listEl.innerHTML = `<div class="med-empty"><div class="med-empty-icon">🗂️</div><p>No records in ${state.currentMedSection}.</p><p class="med-empty-sub">Tap + to add a record.</p></div>`;
            return;
        }
        listEl.innerHTML = '';
        docs.forEach(doc => {
            const data = doc.data();
            const card = document.createElement('div'); card.className = 'med-record-card';
            const dateStr = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : 'Unknown date';
            card.innerHTML = `
                ${data.imageData ? `<img class="med-record-img" src="${data.imageData}" alt="${escapeHtml(data.section)}" loading="lazy">` : ''}
                <div class="med-record-body">
                    <div class="med-record-meta">
                        <span class="med-record-section">${escapeHtml(data.section)}</span>
                        <span class="med-record-date">${dateStr}</span>
                    </div>
                    ${data.note ? `<p class="med-record-note">${escapeHtml(data.note)}</p>` : ''}
                    <div class="med-record-actions">
                        <button class="med-record-del" onclick="deleteMedRecord('${doc.id}', event)">🗑 Delete</button>
                    </div>
                </div>`;
            listEl.appendChild(card);
        });
    } catch (err) {
        listEl.innerHTML = '<div style="text-align:center;padding:24px;color:#c0392b;font-size:13px;">Failed to load records.</div>';
        console.error('[Sentio] Medical records load error:', err);
    }
}

function openCameraModal() {
    state.pendingImageData = null;
    document.getElementById('cameraPreview').classList.add('hidden');
    document.getElementById('cameraNote').value = '';
    document.getElementById('cameraSaveBtn').disabled = true;
    document.getElementById('cameraModalSection').textContent = `Section: ${state.currentMedSection}`;
    document.getElementById('cameraOverlay').classList.add('visible');
    initLucide();
}

function closeCameraModal() {
    document.getElementById('cameraOverlay').classList.remove('visible');
    state.pendingImageData = null;
    // Reset file inputs
    document.getElementById('cameraInput').value = '';
    document.getElementById('galleryInput').value = '';
}

function handleImageCapture(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        // Compress image to stay under Firestore 1MB limit
        compressImage(e.target.result, 800, 0.75, (compressed) => {
            state.pendingImageData = compressed;
            const preview = document.getElementById('cameraPreview');
            preview.src = compressed; preview.classList.remove('hidden');
            document.getElementById('cameraSaveBtn').disabled = false;
        });
    };
    reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxWidth, quality, callback) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.getElementById('imageCompressCanvas');
        let w = img.width; let h = img.height;
        if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
}

async function saveMedicalRecord() {
    if (!state.pendingImageData) return;
    const btn = document.getElementById('cameraSaveBtn'); btn.disabled = true; btn.textContent = 'Saving…';
    const note = document.getElementById('cameraNote').value.trim();
    try {
        await firebase.firestore().collection('chats').doc(state.userId).collection('medical_records').add({
            section: state.currentMedSection,
            imageData: state.pendingImageData,
            note: note || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
        closeCameraModal();
        loadMedicalRecords();
    } catch (err) {
        console.error('[Sentio] Save medical record error:', err);
        alert('Could not save record. Image may be too large — try again with a smaller image.');
        btn.disabled = false; btn.textContent = 'Save Record';
    }
}

async function deleteMedRecord(docId, event) {
    event.stopPropagation(); if (!confirm('Delete this record?')) return;
    try { await firebase.firestore().collection('chats').doc(state.userId).collection('medical_records').doc(docId).delete(); loadMedicalRecords(); }
    catch (err) { console.error('[Sentio] Delete medical record error:', err); }
}

/* ══════════════════════════════════════════════════════════════════
   SESSION MANAGEMENT
═══════════════════════════════════════════════════════════════════ */
function generateSessionId(){return 'session_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);}
async function createNewSession(title='New Conversation'){const sessionId=generateSessionId();state.currentSessionId=sessionId;try{const res=await fetch(`${API_BASE}/sessions?user_id=${encodeURIComponent(state.userId)}`);if(res.ok){const data=await res.json();const empty=(data.sessions||[]).filter(s=>(s.message_count||0)===0);for(const s of empty)await fetch(`${API_BASE}/sessions/${s.session_id}?user_id=${encodeURIComponent(state.userId)}`,{method:'DELETE'});}}catch(_){}try{await fetch(`${API_BASE}/sessions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:state.userId,session_id:sessionId,title})});}catch(err){console.error('[Sentio] Failed to create session:',err);}return sessionId;}
async function startNewChat(){closeSidebar();await createNewSession();const container=document.getElementById('chatMessages');if(container){container.innerHTML='';const welcome=document.createElement('div');welcome.className='chat-bubble received';welcome.innerHTML=`<div class="bubble-avatar">S</div><div class="bubble-body">Hi there 👋 Starting fresh. How are you feeling right now?</div>`;container.appendChild(welcome);}navigateTo('input');}
async function loadSession(sessionId){closeSidebar();state.currentSessionId=sessionId;const container=document.getElementById('chatMessages');if(!container)return;container.innerHTML='';const welcome=document.createElement('div');welcome.className='chat-bubble received';welcome.innerHTML=`<div class="bubble-avatar">S</div><div class="bubble-body">Here's your past conversation. Feel free to continue! 💚</div>`;container.appendChild(welcome);try{const res=await fetch(`${API_BASE}/sessions/${sessionId}/messages?user_id=${encodeURIComponent(state.userId)}`);if(!res.ok)throw new Error(`Status ${res.status}`);const data=await res.json();if(data.messages?.length){data.messages.forEach(msg=>{const riskLevel=(msg.role==='assistant')?(msg.risk_level||null):null;appendBubble(msg.content,msg.role==='user'?'sent':'received',false,riskLevel);});}}catch(err){console.error('[Sentio] Failed to load session:',err);}navigateTo('input');}
async function deleteSession(sessionId){if(!confirm('Delete this conversation?'))return;try{const res=await fetch(`${API_BASE}/sessions/${sessionId}?user_id=${encodeURIComponent(state.userId)}`,{method:'DELETE'});if(!res.ok)throw new Error(`Status ${res.status}`);if(state.currentSessionId===sessionId){await createNewSession();const c=document.getElementById('chatMessages');if(c)c.innerHTML='';}loadSidebarSessions();}catch(err){console.error('[Sentio] Failed to delete session:',err);}}

/* ══════════════════════════════════════════════════════════════════
   RENAME SESSION
═══════════════════════════════════════════════════════════════════ */
function startRenameSession(sessionId,previewEl){const currentTitle=previewEl.textContent;const input=document.createElement('input');input.type='text';input.value=currentTitle;input.className='session-rename-input';input.maxLength=60;previewEl.replaceWith(input);input.focus();input.select();let saved=false;const finish=async()=>{if(saved)return;saved=true;const newTitle=input.value.trim()||currentTitle;const np=document.createElement('div');np.className='session-preview';np.textContent=newTitle.length>45?newTitle.slice(0,45)+'…':newTitle;np.addEventListener('dblclick',(e)=>{e.stopPropagation();startRenameSession(sessionId,np);});input.replaceWith(np);if(newTitle!==currentTitle){try{await fetch(`${API_BASE}/sessions/${sessionId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:state.userId,title:newTitle})});}catch(err){console.error('[Sentio] Rename failed:',err);}}};input.addEventListener('blur',finish);input.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();input.blur();}if(e.key==='Escape'){input.value=currentTitle;input.blur();}});input.addEventListener('click',(e)=>e.stopPropagation());}

/* ══════════════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════════════ */
function toggleSidebar(){state.sidebarOpen?closeSidebar():openSidebar();}
function openSidebar(){state.sidebarOpen=true;document.getElementById('chatSidebar')?.classList.add('open');document.getElementById('sidebarOverlay')?.classList.add('visible');loadSidebarSessions();}
function closeSidebar(){state.sidebarOpen=false;document.getElementById('chatSidebar')?.classList.remove('open');document.getElementById('sidebarOverlay')?.classList.remove('visible');}
function renderSkeletonSessions(){const list=document.getElementById('sessionList');if(!list)return;list.innerHTML='';for(let i=0;i<5;i++){const sk=document.createElement('div');sk.className='session-skeleton';sk.innerHTML=`<div class="skeleton-line wide"></div><div class="skeleton-line narrow"></div>`;list.appendChild(sk);}}
async function loadSidebarSessions(){const list=document.getElementById('sessionList');if(!list)return;renderSkeletonSessions();try{const res=await fetch(`${API_BASE}/sessions?user_id=${encodeURIComponent(state.userId)}`);if(!res.ok)throw new Error(`Status ${res.status}`);const data=await res.json();const sessions=data.sessions||[];if(sessions.length===0){list.innerHTML='<div class="session-empty">No past conversations yet.</div>';return;}const now=new Date(),today=now.toDateString(),yest=new Date(now);yest.setDate(yest.getDate()-1);const yestStr=yest.toDateString();const groups={'Today':[],'Yesterday':[],'Last 7 Days':[],'Older':[]};sessions.forEach(s=>{const d=s.last_updated?new Date(s.last_updated):null;if(!d||isNaN(d)){groups['Older'].push(s);return;}const diff=Math.floor((now-d)/86400000);if(d.toDateString()===today)groups['Today'].push(s);else if(d.toDateString()===yestStr)groups['Yesterday'].push(s);else if(diff<=7)groups['Last 7 Days'].push(s);else groups['Older'].push(s);});list.innerHTML='';Object.entries(groups).forEach(([label,items])=>{if(!items.length)return;const h=document.createElement('div');h.className='session-group-label';h.textContent=label;list.appendChild(h);items.forEach(session=>{const item=document.createElement('div');item.className='session-item';if(session.session_id===state.currentSessionId)item.classList.add('active');const title=session.title||'Conversation',preview=title.length>45?title.slice(0,45)+'…':title,count=Math.floor((session.message_count||0)/2);const previewEl=document.createElement('div');previewEl.className='session-preview';previewEl.textContent=preview;previewEl.addEventListener('dblclick',(e)=>{e.stopPropagation();startRenameSession(session.session_id,previewEl);});const metaEl=document.createElement('div');metaEl.className='session-meta';const countEl=document.createElement('span');countEl.className='session-count';countEl.textContent=`${count} message${count!==1?'s':''}`;const deleteBtn=document.createElement('button');deleteBtn.className='session-delete';deleteBtn.innerHTML='<i data-lucide="trash-2"></i>';deleteBtn.addEventListener('click',(e)=>{e.stopPropagation();deleteSession(session.session_id);});metaEl.appendChild(countEl);metaEl.appendChild(deleteBtn);item.appendChild(previewEl);item.appendChild(metaEl);item.addEventListener('click',(e)=>{if(e.target.classList.contains('session-preview')||e.target.classList.contains('session-rename-input'))return;loadSession(session.session_id);});list.appendChild(item);});});initLucide();}catch(err){list.innerHTML='<div class="session-empty">Failed to load history.</div>';console.error('[Sentio] Sidebar error:',err);}}

/* ══════════════════════════════════════════════════════════════════
   SMART AUTO-TITLE
═══════════════════════════════════════════════════════════════════ */
async function generateSmartTitle(userMessage){try{const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:20,messages:[{role:'user',content:`Generate a very short 3-5 word title for a mental health chat that starts with: "${userMessage.slice(0,120)}". Reply ONLY with the title, no punctuation, no quotes.`}]})});if(!res.ok)throw new Error('title failed');const data=await res.json(),title=data.content?.[0]?.text?.trim();return title&&title.length>0&&title.length<60?title:userMessage.slice(0,50);}catch(_){return userMessage.slice(0,50);}}

/* ══════════════════════════════════════════════════════════════════
   MOOD HISTORY
═══════════════════════════════════════════════════════════════════ */
async function saveDailyScore(score){try{const db=firebase.firestore(),key=new Date().toISOString().split('T')[0];const ref=db.collection('chats').doc(state.userId).collection('daily_scores').doc(key);const doc=await ref.get();if(doc.exists){const ex=doc.data().score||score;await ref.set({score:(ex+score)/2,date:key},{merge:true});}else await ref.set({score,date:key});}catch(err){console.error('[Sentio] Failed to save daily score:',err);}}
async function loadMoodHistory(){try{const db=firebase.firestore();const profileDoc=await db.collection('chats').doc(state.userId).collection('profile').doc('latest').get();if(profileDoc.exists){const p=profileDoc.data();state.currentScore=p.depression_score;state.currentRisk=p.risk_level;}const today=new Date(),history=[];for(let i=6;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);const key=d.toISOString().split('T')[0];const doc=await db.collection('chats').doc(state.userId).collection('daily_scores').doc(key).get();history.push(doc.exists?Math.round((doc.data().score||0)*24):null);}const filled=history.filter(v=>v!==null);state.moodHistory=filled.length>=1?filled:(state.currentScore!==null?[Math.round(state.currentScore*24)]:[]);if(document.getElementById('screen-dashboard')?.classList.contains('active'))updateDashboard();}catch(err){console.error('[Sentio] Failed to load mood history:',err);}}

/* ══════════════════════════════════════════════════════════════════
   CRISIS LOG
═══════════════════════════════════════════════════════════════════ */
async function loadCrisisCount(){const card=document.getElementById('crisisLogCard');const countEl=document.getElementById('crisisLogCount');const labelEl=document.getElementById('crisisLogLabel');if(!card||!countEl||!labelEl)return;try{const db=firebase.firestore();const cutoff=new Date(Date.now()-7*24*60*60*1000);const snap=await db.collection('chats').doc(state.userId).collection('crisis_log').where('timestamp','>=',cutoff).get();const count=snap.size;if(count===0){card.classList.add('hidden');}else{card.classList.remove('hidden');countEl.textContent=count;labelEl.textContent=count===1?'crisis detected this week':'crises detected this week';}}catch(err){if(card)card.classList.add('hidden');console.error('[Sentio] Failed to load crisis count:',err);}}

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════════ */
function updateDashboard(){setGreeting();setHeaderDate();setTimeout(()=>{initGauge(state.currentScore??null,state.currentRisk??null);initTrendChart(state.moodHistory);},50);const insightEl=document.getElementById('insightText');if(insightEl){if(state.currentRisk==='HIGH')insightEl.textContent='Your score suggests you may be experiencing significant distress. Consider reaching out for support.';else if(state.currentRisk==='MODERATE')insightEl.textContent='Your patterns suggest mild to moderate stress today. Self-care activities may help.';else if(state.currentRisk==='LOW')insightEl.textContent='Your indicators look positive today. Keep nurturing your wellbeing.';else insightEl.textContent='Complete a check-in to see your personalised score.';}loadCrisisCount();}
function setHeaderDate(){const el=document.getElementById('headerDate');if(!el)return;el.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});}
function setGreeting(){const h=new Date().getHours(),part=h<12?'morning':h<17?'afternoon':'evening';const gEl=document.getElementById('greetingText'),nEl=document.getElementById('greetingName');if(gEl)gEl.textContent=`Good ${part},`;if(nEl)nEl.textContent=state.userName||'friend';}

/* ══════════════════════════════════════════════════════════════════
   GAUGE
═══════════════════════════════════════════════════════════════════ */
function initGauge(score=null,risk=null){const canvas=document.getElementById('gaugeCanvas');if(!canvas)return;const dpr=window.devicePixelRatio||1,cssW=canvas.parentElement.clientWidth||260,cssH=Math.round(cssW*0.62);canvas.width=cssW*dpr;canvas.height=cssH*dpr;canvas.style.width=cssW+'px';canvas.style.height=cssH+'px';const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const cx=cssW/2,cy=cssH-24,r=Math.min(cx-20,cy-10);ctx.clearRect(0,0,cssW,cssH);ctx.beginPath();ctx.arc(cx,cy,r,Math.PI,0);ctx.strokeStyle='#E0EAD8';ctx.lineWidth=18;ctx.lineCap='round';ctx.stroke();const pct=score!=null?Math.max(0,Math.min(1,score)):0.5,endAngle=-Math.PI+Math.PI*pct,riskColour={LOW:'#5D7A56',MODERATE:'#F0943A',HIGH:'#D9534F'}[risk]??'#A9BA9D';ctx.beginPath();ctx.arc(cx,cy,r,Math.PI,endAngle);ctx.strokeStyle=riskColour;ctx.lineWidth=18;ctx.lineCap='round';ctx.stroke();const nl=r-22,nx=cx+Math.cos(endAngle)*nl,ny=cy+Math.sin(endAngle)*nl;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(nx,ny);ctx.strokeStyle='#2D3436';ctx.lineWidth=3;ctx.lineCap='round';ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,7,0,Math.PI*2);ctx.fillStyle='#2D3436';ctx.fill();if(score!=null){ctx.font=`600 ${Math.round(r*0.22)}px Outfit, sans-serif`;ctx.fillStyle='#2D3436';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(Math.round(score*100)+'%',cx,cy-14);}const badge=document.getElementById('riskBadge');if(badge){badge.className='risk-badge';if(risk){badge.textContent=risk+' RISK';badge.classList.add(risk.toLowerCase());}else badge.textContent='NO DATA';}}

/* ══════════════════════════════════════════════════════════════════
   TREND CHART
═══════════════════════════════════════════════════════════════════ */
function initTrendChart(data){const canvas=document.getElementById('trendCanvas');if(!canvas)return;const container=canvas.parentElement,dpr=window.devicePixelRatio||1,cssW=container.clientWidth||280,cssH=container.clientHeight||110;canvas.width=cssW*dpr;canvas.height=cssH*dpr;canvas.style.width=cssW+'px';canvas.style.height=cssH+'px';const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);if(!data||data.length<2){ctx.font='13px Outfit, sans-serif';ctx.fillStyle='#A0ADA0';ctx.textAlign='center';ctx.fillText('Chat more to see your trend',cssW/2,cssH/2);return;}const pad={top:12,right:16,bottom:12,left:16},innerW=cssW-pad.left-pad.right,innerH=cssH-pad.top-pad.bottom,maxVal=Math.max(...data),minVal=Math.min(...data),range=maxVal-minVal||1,px=(i)=>pad.left+(i/(data.length-1))*innerW,py=(v)=>pad.top+innerH-((v-minVal)/range)*innerH;ctx.clearRect(0,0,cssW,cssH);const grad=ctx.createLinearGradient(0,pad.top,0,cssH);grad.addColorStop(0,'rgba(157,181,148,0.25)');grad.addColorStop(1,'rgba(157,181,148,0)');ctx.beginPath();data.forEach((v,i)=>{i===0?ctx.moveTo(px(i),py(v)):ctx.lineTo(px(i),py(v));});ctx.lineTo(px(data.length-1),cssH-pad.bottom);ctx.lineTo(px(0),cssH-pad.bottom);ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.beginPath();ctx.strokeStyle='#9DB594';ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowBlur=8;ctx.shadowColor='rgba(157,181,148,0.4)';data.forEach((v,i)=>{i===0?ctx.moveTo(px(i),py(v)):ctx.lineTo(px(i),py(v));});ctx.stroke();ctx.shadowBlur=0;data.forEach((v,i)=>{ctx.beginPath();ctx.arc(px(i),py(v),3.5,0,Math.PI*2);ctx.fillStyle='#FFFFFF';ctx.strokeStyle='#9DB594';ctx.lineWidth=2;ctx.fill();ctx.stroke();});const delta=data[data.length-1]-data[0],deltaEl=document.getElementById('trendDelta');if(deltaEl){deltaEl.textContent=(delta>=0?'↑ ':'↓ ')+Math.abs(delta)+' pts';deltaEl.style.color=delta<=0?'var(--sage-dark)':'#D9534F';}}

/* ══════════════════════════════════════════════════════════════════
   CHAT
═══════════════════════════════════════════════════════════════════ */
async function sendMessage(){if(state.isSending)return;const input=document.getElementById('chatInput'),text=(input?.value||'').trim();if(!text)return;input.value='';state.isSending=true;setSendBtnState(true);appendBubble(text,'sent');const typingId='typing-'+Date.now();appendTypingIndicator(typingId);if(state.currentSessionId){try{const db=firebase.firestore(),ref=db.collection('chats').doc(state.userId).collection('sessions').doc(state.currentSessionId);const doc=await ref.get();if(doc.exists&&(doc.data().title==='New Conversation'||doc.data().message_count===0)){generateSmartTitle(text).then(async(t)=>{await fetch(`${API_BASE}/sessions/${state.currentSessionId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:state.userId,title:t})});}).catch(()=>{});}}catch(_){}}try{const user=firebase.auth().currentUser;if(user)state.idToken=await user.getIdToken();const res=await fetch(`${API_BASE}/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:state.userId||'anon',message:text,session_id:state.currentSessionId,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})});await new Promise(resolve=>setTimeout(resolve,300+Math.random()*200));removeTypingIndicator(typingId);if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.detail||`Server error ${res.status}`);}const data=await res.json();if(data.is_crisis&&data.crisis_contacts)showCrisisModal(data.crisis_contacts);appendBubbleAnimated(data.response,'received',data.risk_level||null);state.currentScore=data.depression_score;state.currentRisk=data.risk_level;saveDailyScore(data.depression_score);state.moodHistory.push(Math.round(data.depression_score*24));if(state.moodHistory.length>7)state.moodHistory.shift();}catch(err){removeTypingIndicator(typingId);appendBubble("I'm having trouble connecting right now. Please check your connection or try again.",'received',true);console.error('[Sentio] Chat error:',err);}finally{state.isSending=false;setSendBtnState(false);}}

function createSentimentDots(riskLevel){if(!riskLevel)return null;const wrap=document.createElement('div');wrap.className='sentiment-dots';wrap.setAttribute('aria-label',`Risk level: ${riskLevel}`);const colourClass={LOW:'dot-low',MODERATE:'dot-moderate',HIGH:'dot-high'}[riskLevel]||'';for(let i=0;i<3;i++){const dot=document.createElement('span');dot.className=`sentiment-dot ${colourClass}`;wrap.appendChild(dot);}return wrap;}
function appendBubble(text,type,isError=false,riskLevel=null){const container=document.getElementById('chatMessages');if(!container)return;const bubble=document.createElement('div');bubble.className=`chat-bubble ${type}`;if(type==='received'){const av=document.createElement('div');av.className='bubble-avatar';av.textContent=isError?'!':'S';if(isError)av.style.background='#FFF0EE';bubble.appendChild(av);}const body=document.createElement('div');body.className='bubble-body';body.innerHTML=escapeHtml(text).replace(/\n/g,'<br>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');if(isError)body.style.background='#FFF5F5';if(type==='sent'){const av=document.createElement('div');av.className='bubble-avatar';av.textContent=(state.userName||'U').charAt(0).toUpperCase();av.style.background='var(--sage-light)';bubble.appendChild(body);bubble.appendChild(av);}else{bubble.appendChild(body);if(riskLevel){const dots=createSentimentDots(riskLevel);if(dots)bubble.appendChild(dots);}}container.appendChild(bubble);container.scrollTop=container.scrollHeight;initLucide();}
function appendBubbleAnimated(text,type,riskLevel=null){const container=document.getElementById('chatMessages');if(!container)return;const bubble=document.createElement('div');bubble.className=`chat-bubble ${type}`;bubble.style.opacity='0';bubble.style.transition='opacity 0.3s ease';const av=document.createElement('div');av.className='bubble-avatar';av.textContent='S';bubble.appendChild(av);const body=document.createElement('div');body.className='bubble-body';body.textContent='';bubble.appendChild(body);let dotsEl=null;if(riskLevel){dotsEl=createSentimentDots(riskLevel);dotsEl.style.opacity='0';dotsEl.style.transition='opacity 0.4s ease';bubble.appendChild(dotsEl);}container.appendChild(bubble);container.scrollTop=container.scrollHeight;requestAnimationFrame(()=>{bubble.style.opacity='1';});const words=text.split(' ');let i=0;const interval=setInterval(()=>{if(i<words.length){body.textContent+=(i===0?'':' ')+words[i];container.scrollTop=container.scrollHeight;i++;}else{clearInterval(interval);body.innerHTML=escapeHtml(text).replace(/\n/g,'<br>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');if(dotsEl)requestAnimationFrame(()=>{dotsEl.style.opacity='1';});initLucide();}},38);}
function appendTypingIndicator(id){const container=document.getElementById('chatMessages');if(!container)return;const bubble=document.createElement('div');bubble.className='chat-bubble received typing';bubble.id=id;const av=document.createElement('div');av.className='bubble-avatar';av.textContent='S';bubble.appendChild(av);const body=document.createElement('div');body.className='bubble-body';body.innerHTML='<div class="dot"></div><div class="dot"></div><div class="dot"></div>';bubble.appendChild(body);container.appendChild(bubble);container.scrollTop=container.scrollHeight;}
function removeTypingIndicator(id){document.getElementById(id)?.remove();}
function setSendBtnState(disabled){const btn=document.getElementById('sendBtn');if(btn)btn.disabled=disabled;}
function escapeHtml(str){return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function filterActivities(category,tabEl){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));tabEl.classList.add('active');document.querySelectorAll('.activity-card').forEach(card=>{card.style.display=(category==='all'||card.dataset.category===category)?'block':'none';});}

/* ══════════════════════════════════════════════════════════════════
   VOICE RECORDING (unchanged)
═══════════════════════════════════════════════════════════════════ */
async function toggleRecording(){if(state.isRecording)stopRecording();else await startRecording();}
async function startRecording(){if(!navigator.mediaDevices?.getUserMedia){alert('Voice recording not supported.');return;}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});state.mediaRecorder=new MediaRecorder(stream);state.audioChunks=[];state.mediaRecorder.ondataavailable=e=>{if(e.data.size>0)state.audioChunks.push(e.data);};state.mediaRecorder.onstop=async()=>{const blob=new Blob(state.audioChunks,{type:'audio/webm'});console.log('[Sentio] Audio recorded, size:',blob.size);};state.mediaRecorder.start();state.isRecording=true;document.getElementById('micBtn')?.classList.add('recording');const wfBox=document.getElementById('waveformBox');if(wfBox)wfBox.style.display='flex';startWaveform();}catch(err){console.error('[Sentio] Mic error:',err);alert('Could not access the microphone.');}}
function stopRecording(){state.isRecording=false;state.mediaRecorder?.stop();state.mediaRecorder?.stream?.getTracks().forEach(t=>t.stop());document.getElementById('micBtn')?.classList.remove('recording');const wfBox=document.getElementById('waveformBox');if(wfBox)wfBox.style.display='none';stopWaveform();}
function startWaveform(){const canvas=document.getElementById('micWaveform');if(!canvas)return;const container=canvas.parentElement,cssW=container.clientWidth||260,cssH=60;canvas.width=cssW;canvas.height=cssH;canvas.style.width=cssW+'px';canvas.style.height=cssH+'px';const ctx=canvas.getContext('2d');function animate(){ctx.clearRect(0,0,cssW,cssH);ctx.beginPath();ctx.strokeStyle='#5D7A56';ctx.lineWidth=2.5;ctx.lineCap='round';const t=Date.now()*0.008;for(let x=0;x<cssW;x+=4){const amp=state.isRecording?16:2,y=cssH/2+Math.sin(x*0.04+t)*amp+Math.sin(x*0.08+t*1.3)*(amp*0.4);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();state.animId=requestAnimationFrame(animate);}animate();}
function stopWaveform(){if(state.animId)cancelAnimationFrame(state.animId);state.animId=null;const canvas=document.getElementById('micWaveform');if(canvas)canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
function startProcessing(label='Analyzing mood indicators…'){document.getElementById('processingLabel').textContent=label;navigateTo('processing');setTimeout(()=>navigateTo('dashboard'),3200);}

/* ══════════════════════════════════════════════════════════════════
   PDF HELPERS
═══════════════════════════════════════════════════════════════════ */
const PDF_C={sageDark:[93,122,86],sageDeeper:[62,84,56],sageMedium:[157,181,148],sageLight:[220,233,216],orange:[240,148,58],red:[217,83,79],text:[34,44,33],muted:[160,173,160],white:[255,255,255],bg:[247,250,247]};
function _pdfHeader(doc,title,subtitle){const W=doc.internal.pageSize.getWidth();doc.setFillColor(...PDF_C.sageDeeper);doc.rect(0,0,W,28,'F');doc.setFontSize(16);doc.setFont('helvetica','bold');doc.setTextColor(...PDF_C.white);doc.text('Sentio',14,18);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.sageMedium);doc.text(title,14,24);if(subtitle)doc.text(subtitle,W-14,24,{align:'right'});}
function _pdfSection(doc,label,y){const W=doc.internal.pageSize.getWidth();doc.setFillColor(...PDF_C.sageLight);doc.rect(14,y,W-28,7,'F');doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(...PDF_C.sageDark);doc.text(label.toUpperCase(),17,y+5);return y+11;}
function _riskColor(risk){return{LOW:PDF_C.sageDark,MODERATE:PDF_C.orange,HIGH:PDF_C.red}[risk]||PDF_C.muted;}
function _pdfWrappedText(doc,text,x,y,maxW,lh=5){const lines=doc.splitTextToSize(text,maxW);doc.text(lines,x,y);return y+lines.length*lh;}
function _countKeywords(messages){const KW=['anxious','anxiety','stress','stressed','depressed','depression','sad','lonely','hopeless','hopeful','happy','overwhelmed','tired','exhausted','sleep','panic','fear','worried','worry','angry','anger','grief','loss','empty','numb','better','worse','cry','crying','help','support'];const all=messages.join(' ').toLowerCase();const freq={};KW.forEach(kw=>{const m=all.match(new RegExp(`\\b${kw}\\w*\\b`,'g'));if(m?.length)freq[kw]=m.length;});return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8);}
function _activityRecs(avgPct){const s=avgPct||0;if(s>66)return['Daily box breathing (5 min) — activates your parasympathetic nervous system','Body scan meditation — helps reconnect with physical sensations','Consider speaking with a mental health professional','Reach out to a trusted person today'];if(s>33)return['Box breathing exercises — reduces cortisol and calms anxiety','Gentle stretching or mindful walk — movement supports mood','Journaling — writing helps process difficult emotions','Maintain a consistent sleep routine'];return['Continue your current self-care practices','Mindful walk — maintain your connection with the present','Journal regularly to track your emotional patterns','Keep your to-do list manageable — small wins matter'];}

/* ── PDF 1 — Chat Export ───────────────────────────────────────── */
async function exportChatPDF(){if(!state.currentSessionId){alert('No active chat session to export.');return;}if(typeof window.jspdf==='undefined'){alert('PDF library not loaded yet. Please try again in a moment.');return;}const btn=document.getElementById('exportChatBtn');if(btn){btn.disabled=true;btn.textContent='Exporting…';}try{const[msgRes,sessRes]=await Promise.all([fetch(`${API_BASE}/sessions/${state.currentSessionId}/messages?user_id=${encodeURIComponent(state.userId)}`),fetch(`${API_BASE}/sessions?user_id=${encodeURIComponent(state.userId)}`)]);const msgData=msgRes.ok?await msgRes.json():{messages:[]};const sessData=sessRes.ok?await sessRes.json():{sessions:[]};const messages=msgData.messages||[];const session=(sessData.sessions||[]).find(s=>s.session_id===state.currentSessionId);const title=session?.title||'Conversation';const dateStr=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});const W=doc.internal.pageSize.getWidth();const H=doc.internal.pageSize.getHeight();const M=14;const CW=W-M*2;_pdfHeader(doc,'Chat Export',dateStr);let y=38;doc.setFontSize(14);doc.setFont('helvetica','bold');doc.setTextColor(...PDF_C.text);doc.text(title,M,y);y+=5;doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.muted);doc.text(`${messages.length} messages  ·  Exported ${dateStr}`,M,y);y+=8;doc.setDrawColor(...PDF_C.sageLight);doc.line(M,y,W-M,y);y+=6;if(messages.length===0){doc.setFontSize(11);doc.setTextColor(...PDF_C.muted);doc.text('No messages in this conversation.',M,y);}else{messages.forEach((msg,idx)=>{const isUser=msg.role==='user';const sender=isUser?(state.userName||'You'):'Sentio';if(y>H-30){doc.addPage();_pdfHeader(doc,'Chat Export (continued)',dateStr);y=36;}doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(...(isUser?PDF_C.sageDark:PDF_C.sageDeeper));doc.text(sender.toUpperCase(),M,y);if(!isUser&&msg.risk_level){const rx=M+doc.getTextWidth(sender.toUpperCase())+3;doc.setFontSize(6.5);doc.setTextColor(..._riskColor(msg.risk_level));doc.text(`● ${msg.risk_level}`,rx,y);}if(msg.timestamp){const ts=new Date(msg.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.muted);doc.text(ts,W-M,y,{align:'right'});}y+=4;const lines=doc.splitTextToSize(msg.content||'',CW-4);const boxH=lines.length*5+4;doc.setFillColor(isUser?220:248,isUser?233:250,isUser?216:247);doc.roundedRect(M,y-1,CW,boxH,2,2,'F');doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.text);doc.text(lines,M+3,y+3);y+=boxH+5;if(idx<messages.length-1){doc.setDrawColor(...PDF_C.bg);doc.line(M,y-2,W-M,y-2);}});}const tp=doc.internal.getNumberOfPages();for(let p=1;p<=tp;p++){doc.setPage(p);doc.setFontSize(7);doc.setTextColor(...PDF_C.muted);doc.text(`Sentio — private & confidential  ·  Page ${p} of ${tp}`,W/2,H-8,{align:'center'});}doc.save(`Sentio_Chat_${title.replace(/[^a-z0-9]/gi,'_').slice(0,40)}_${new Date().toISOString().split('T')[0]}.pdf`);}catch(err){console.error('[Sentio] Chat PDF error:',err);alert('Could not export chat. Please try again.');}finally{if(btn){btn.disabled=false;btn.innerHTML='<i data-lucide="download"></i>';initLucide();}}}

/* ── PDF 2 — Weekly Report ─────────────────────────────────────── */
async function exportWeeklyReportPDF(){if(typeof window.jspdf==='undefined'){alert('PDF library not loaded yet.');return;}const btn=document.getElementById('weeklyReportBtn');if(btn){btn.disabled=true;btn.textContent='Generating…';}try{const db=firebase.firestore();const now=new Date();const days=Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-(6-i));return d.toISOString().split('T')[0];});const scoreRows=await Promise.all(days.map(async key=>{const doc=await db.collection('chats').doc(state.userId).collection('daily_scores').doc(key).get();return{date:key,score:doc.exists?doc.data().score:null};}));const sessSnap=await db.collection('chats').doc(state.userId).collection('sessions').orderBy('last_updated','desc').limit(20).get();const userMessages=[];await Promise.all(sessSnap.docs.map(async sDoc=>{const lu=sDoc.data().last_updated;if(!lu)return;const sd=lu.toDate?lu.toDate():new Date(lu);if((now-sd)>7*24*60*60*1000)return;try{const r=await fetch(`${API_BASE}/sessions/${sDoc.id}/messages?user_id=${encodeURIComponent(state.userId)}`);if(!r.ok)return;const md=await r.json();(md.messages||[]).filter(m=>m.role==='user').forEach(m=>userMessages.push(m.content||''));}catch(_){}}));const keywords=_countKeywords(userMessages);const valid=scoreRows.filter(r=>r.score!==null).map(r=>r.score);const avg=valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null;const avgPct=avg!==null?Math.round(avg*100):null;const peak=valid.length?Math.round(Math.max(...valid)*100):null;const riskLbl=state.currentRisk||(avgPct>66?'HIGH':avgPct>33?'MODERATE':'LOW');const weekStart=new Date(now);weekStart.setDate(weekStart.getDate()-6);const weekLbl=`${weekStart.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${now.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=14,CW=W-M*2;_pdfHeader(doc,'Weekly Mood Report',weekLbl);let y=36;const bw=(CW-8)/3;[{label:'Avg Risk Score',val:avgPct!==null?`${avgPct}%`:'—',col:PDF_C.sageDeeper},{label:'Peak Score',val:peak!==null?`${peak}%`:'—',col:PDF_C.sageDeeper},{label:'Risk Level',val:riskLbl,col:_riskColor(riskLbl)}].forEach((s,i)=>{const bx=M+i*(bw+4);doc.setFillColor(...PDF_C.sageLight);doc.roundedRect(bx,y,bw,18,3,3,'F');doc.setFontSize(16);doc.setFont('helvetica','bold');doc.setTextColor(...s.col);doc.text(s.val,bx+bw/2,y+11,{align:'center'});doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.muted);doc.text(s.label,bx+bw/2,y+16,{align:'center'});});y+=24;y=_pdfSection(doc,'Daily Score Breakdown',y);doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(...PDF_C.muted);doc.text('DATE',M,y);doc.text('DAY',M+38,y);doc.text('SCORE',M+68,y);doc.text('BAR',M+90,y);y+=5;scoreRows.forEach(row=>{const dayName=new Date(row.date+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'});const sv=row.score!==null?Math.round(row.score*100):null;doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.text);doc.text(row.date,M,y);doc.text(dayName,M+38,y);if(sv!==null){const rc=_riskColor(sv>66?'HIGH':sv>33?'MODERATE':'LOW');doc.setFont('helvetica','bold');doc.setTextColor(...rc);doc.text(`${sv}%`,M+68,y);const bMaxW=CW-(M+90-M)-4;const bW=Math.max(2,(sv/100)*bMaxW);doc.setFillColor(...PDF_C.sageLight);doc.rect(M+90,y-3.5,bMaxW,4,'F');doc.setFillColor(...rc);doc.rect(M+90,y-3.5,bW,4,'F');}else{doc.setTextColor(...PDF_C.muted);doc.text('No data',M+68,y);}y+=7;});y+=4;if(keywords.length>0){y=_pdfSection(doc,'Top Keywords in Your Messages',y);const kw2=CW/2;keywords.forEach(([kw,cnt],i)=>{const col=i%2===0?M:M+kw2+4;if(i%2===0&&i>0)y+=6;doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.text);doc.text(`"${kw}"`,col,y);doc.setFont('helvetica','bold');doc.setTextColor(...PDF_C.sageDark);doc.text(`× ${cnt}`,col+kw2-10,y,{align:'right'});});y+=10;}if(y>H-60){doc.addPage();_pdfHeader(doc,'Weekly Report (continued)',weekLbl);y=36;}y=_pdfSection(doc,'Recommended Activities for Next Week',y);_activityRecs(avgPct).forEach(rec=>{doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.text);doc.text('•',M,y);y=_pdfWrappedText(doc,rec,M+5,y,CW-5);y+=3;});const tp=doc.internal.getNumberOfPages();for(let p=1;p<=tp;p++){doc.setPage(p);doc.setFontSize(7);doc.setTextColor(...PDF_C.muted);doc.text(`Sentio Weekly Report  ·  ${weekLbl}  ·  Page ${p} of ${tp}`,W/2,H-8,{align:'center'});}doc.save(`Sentio_Weekly_Report_${days[0]}_to_${days[6]}.pdf`);}catch(err){console.error('[Sentio] Weekly PDF error:',err);alert('Could not generate weekly report.');}finally{if(btn){btn.disabled=false;btn.textContent='7-Day Report';}}}

/* ── PDF 3 — Monthly Report ────────────────────────────────────── */
async function exportMonthlyReportPDF(){if(typeof window.jspdf==='undefined'){alert('PDF library not loaded yet.');return;}const btn=document.getElementById('monthlyReportBtn');if(btn){btn.disabled=true;btn.textContent='Generating…';}try{const db=firebase.firestore(),now=new Date();const days=Array.from({length:30},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-(29-i));return d.toISOString().split('T')[0];});const cutoff30=new Date(now.getTime()-30*24*60*60*1000);const[scoreResults,todosSnap,journalSnap,crisisSnap]=await Promise.all([Promise.all(days.map(async key=>{const doc=await db.collection('chats').doc(state.userId).collection('daily_scores').doc(key).get();return{date:key,score:doc.exists?doc.data().score:null};})),db.collection('chats').doc(state.userId).collection('todos').get(),db.collection('chats').doc(state.userId).collection('journal').where('date','>=',days[0]).where('date','<=',days[29]).get(),db.collection('chats').doc(state.userId).collection('crisis_log').where('timestamp','>=',cutoff30).get()]);const valid=scoreResults.filter(r=>r.score!==null);const avg=valid.length?valid.reduce((a,b)=>a+b.score,0)/valid.length:null;const avgPct=avg!==null?Math.round(avg*100):null;const peak=valid.length?Math.round(Math.max(...valid.map(r=>r.score))*100):null;const low=valid.length?Math.round(Math.min(...valid.map(r=>r.score))*100):null;const todos=todosSnap.docs.map(d=>d.data());const tTotal=todos.length;const tDone=todos.filter(t=>t.done).length;const tRate=tTotal>0?Math.round((tDone/tTotal)*100):0;const jCount=journalSnap.size;const cCount=crisisSnap.size;const riskLbl=state.currentRisk||(avgPct>66?'HIGH':avgPct>33?'MODERATE':'LOW');const monthStart=new Date(now);monthStart.setDate(monthStart.getDate()-29);const mLbl=`${monthStart.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${now.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=14,CW=W-M*2;_pdfHeader(doc,'Monthly Wellness Report',mLbl);let y=36;const sw=(CW-6)/4;[{label:'Avg Risk Score',val:avgPct!==null?`${avgPct}%`:'—',col:PDF_C.sageDeeper},{label:'Active Days',val:`${valid.length}/30`,col:PDF_C.sageDark},{label:'Journal Entries',val:`${jCount}`,col:PDF_C.sageDark},{label:'Crisis Events',val:`${cCount}`,col:cCount>0?PDF_C.orange:PDF_C.sageDark}].forEach((s,i)=>{const bx=M+i*(sw+2);doc.setFillColor(...PDF_C.sageLight);doc.roundedRect(bx,y,sw,18,3,3,'F');doc.setFontSize(15);doc.setFont('helvetica','bold');doc.setTextColor(...s.col);doc.text(s.val,bx+sw/2,y+11,{align:'center'});doc.setFontSize(6.5);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.muted);doc.text(s.label,bx+sw/2,y+16,{align:'center'});});y+=24;y=_pdfSection(doc,'Score Summary',y);[{l:'Average depression risk score',v:avgPct!==null?`${avgPct}%`:'No data'},{l:'Peak score (highest risk day)',v:peak!==null?`${peak}%`:'No data'},{l:'Lowest score (best day)',v:low!==null?`${low}%`:'No data'},{l:'Overall risk level',v:riskLbl},{l:'Days with check-ins',v:`${valid.length} of 30 days`}].forEach(item=>{doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.text);doc.text(item.l,M,y);doc.setFont('helvetica','bold');doc.setTextColor(...PDF_C.sageDark);doc.text(item.v,W-M,y,{align:'right'});y+=6;});y+=4;y=_pdfSection(doc,'30-Day Score Trend',y);const sH=20,sW=CW;doc.setFillColor(...PDF_C.sageLight);doc.rect(M,y,sW,sH,'F');const hasData=scoreResults.some(r=>r.score!==null);if(hasData){const filled=scoreResults.map(r=>r.score!==null?r.score:0);const maxV=Math.max(...filled)||1;const validOnly=filled.filter((_,i)=>scoreResults[i].score!==null);const minV=Math.min(...validOnly)||0;const rng=maxV-minV||1;doc.setDrawColor(...PDF_C.sageDark);doc.setLineWidth(0.7);let first=true;scoreResults.forEach((r,i)=>{if(r.score===null){first=true;return;}const px=M+(i/(scoreResults.length-1))*sW;const py=y+sH-((r.score-minV)/rng)*sH*0.85-1;if(first){doc.moveTo(px,py);first=false;}else doc.lineTo(px,py);});doc.stroke();}else{doc.setFontSize(9);doc.setTextColor(...PDF_C.muted);doc.text('Not enough data.',M+CW/2,y+sH/2,{align:'center'});}y+=sH+8;y=_pdfSection(doc,'Task Completion',y);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.text);doc.text(`${tDone} of ${tTotal} tasks completed  (${tRate}%)`,M,y);y+=5;doc.setFillColor(...PDF_C.sageLight);doc.rect(M,y,CW,5,'F');if(tRate>0){doc.setFillColor(...PDF_C.sageDark);doc.rect(M,y,(tRate/100)*CW,5,'F');}y+=11;y=_pdfSection(doc,'Journal Activity',y);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.text);doc.text(jCount===0?'No journal entries this month.':`${jCount} journal ${jCount===1?'entry':'entries'} written.`,M,y);y+=9;y=_pdfSection(doc,'Crisis Events',y);doc.setFontSize(9);if(cCount===0){doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.sageDark);doc.text('No crisis events detected this month.',M,y);}else{doc.setFont('helvetica','bold');doc.setTextColor(...PDF_C.orange);doc.text(`${cCount} crisis ${cCount===1?'event':'events'} detected.`,M,y);y+=5;doc.setFontSize(8.5);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.text);doc.text('If you are struggling, please reach out to a trusted person or mental health service.',M,y);}y+=9;if(y>H-50){doc.addPage();_pdfHeader(doc,'Monthly Report (continued)',mLbl);y=36;}y=_pdfSection(doc,'Recommendations for Next Month',y);_activityRecs(avgPct).forEach(rec=>{doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(...PDF_C.text);doc.text('•',M,y);y=_pdfWrappedText(doc,rec,M+5,y,CW-5);y+=3;});const tp=doc.internal.getNumberOfPages();for(let p=1;p<=tp;p++){doc.setPage(p);doc.setFontSize(7);doc.setTextColor(...PDF_C.muted);doc.text(`Sentio Monthly Report  ·  ${mLbl}  ·  Page ${p} of ${tp}`,W/2,H-8,{align:'center'});}doc.save(`Sentio_Monthly_Report_${days[0]}_to_${days[29]}.pdf`);}catch(err){console.error('[Sentio] Monthly PDF error:',err);alert('Could not generate monthly report.');}finally{if(btn){btn.disabled=false;btn.textContent='Monthly Report';}}}

/* ══════════════════════════════════════════════════════════════════
   LUCIDE + RESIZE
═══════════════════════════════════════════════════════════════════ */
function initLucide(){if(window.lucide)lucide.createIcons();}
if(window.ResizeObserver){const ro=new ResizeObserver(()=>{if(document.getElementById('screen-dashboard')?.classList.contains('active')){initGauge(state.currentScore,state.currentRisk);initTrendChart(state.moodHistory);}});ro.observe(document.getElementById('app'));}/* ══════════════════════════════════════════════════════════════════
   TO-DO — TABS
═══════════════════════════════════════════════════════════════════ */
function switchTodoTab(tab) {
    state.todoTab = tab;
    document.getElementById('todoTabDaily').classList.toggle('active', tab === 'daily');
    document.getElementById('todoTabMonthly').classList.toggle('active', tab === 'monthly');
    const dv = document.getElementById('todoDailyView');
    const mv = document.getElementById('todoMonthlyView');
    dv.style.display = tab === 'daily' ? 'flex' : 'none';
    mv.style.display = tab === 'monthly' ? 'flex' : 'none';
    if (tab === 'monthly') { renderMonthTitle(); loadHabits(); }
}

/* ══════════════════════════════════════════════════════════════════
   TO-DO — DAILY (each task has optional alarm)
═══════════════════════════════════════════════════════════════════ */
async function addTodo() {
    const input = document.getElementById('todoInput');
    const text = input.value.trim(); if (!text) return; input.value = '';
    const today = new Date().toISOString().split('T')[0];
    try {
        await firebase.firestore().collection('chats').doc(state.userId).collection('todos')
            .add({ text, done: false, createdAt: firebase.firestore.FieldValue.serverTimestamp(), date: today, alarmTime: null });
        loadTodos();
    } catch (err) { console.error('[Sentio] Todo add error:', err); }
}

async function toggleTodo(docId, currentDone) {
    try { await firebase.firestore().collection('chats').doc(state.userId).collection('todos').doc(docId).update({ done: !currentDone }); loadTodos(); }
    catch (err) { console.error('[Sentio] Todo toggle error:', err); }
}

async function deleteTodo(docId, event) {
    event.stopPropagation();
    try { await firebase.firestore().collection('chats').doc(state.userId).collection('todos').doc(docId).delete(); loadTodos(); }
    catch (err) { console.error('[Sentio] Todo delete error:', err); }
}

async function clearDoneTodos() {
    try {
        const snap = await firebase.firestore().collection('chats').doc(state.userId).collection('todos').where('done','==',true).get();
        const batch = firebase.firestore().batch(); snap.forEach(doc => batch.delete(doc.ref)); await batch.commit(); loadTodos();
    } catch (err) { console.error('[Sentio] Clear done error:', err); }
}

async function setTodoAlarm(docId, time) {
    try {
        await firebase.firestore().collection('chats').doc(state.userId).collection('todos').doc(docId).update({ alarmTime: time || null });
        if (time && Notification.permission === 'default') await Notification.requestPermission();
        loadTodos();
    } catch (err) { console.error('[Sentio] Todo alarm error:', err); }
}

async function loadTodos() {
    const listEl = document.getElementById('todoList'); if (!listEl) return;
    try {
        const snap = await firebase.firestore().collection('chats').doc(state.userId).collection('todos').orderBy('createdAt', 'asc').get();
        let todos = []; snap.forEach(doc => todos.push({ id: doc.id, ...doc.data() }));
        // Show only today's + undated todos in daily view
        const today = new Date().toISOString().split('T')[0];
        todos = todos.filter(t => !t.date || t.date === today);

        const total = todos.length; const done = todos.filter(t => t.done).length;
        const statsText = document.getElementById('todoStatsText');
        const clearBtn = document.getElementById('todoClearBtn');
        if (statsText) statsText.textContent = total === 0 ? '0 tasks' : `${total - done} remaining · ${done} done`;
        if (clearBtn) clearBtn.style.display = done > 0 ? 'block' : 'none';

        if (todos.length === 0) {
            listEl.innerHTML = `<div class="todo-empty-state"><div class="todo-empty-icon">✅</div><p>No tasks for today.</p><p class="todo-empty-sub">Add something you'd like to get done.</p></div>`;
            return;
        }
        listEl.innerHTML = '';
        [...todos.filter(t => !t.done), ...todos.filter(t => t.done)].forEach(todo => {
            const item = document.createElement('div'); item.className = `todo-item${todo.done ? ' done' : ''}`;
            const alarmVal = todo.alarmTime || '';
            const alarmSet = !!alarmVal;
            item.innerHTML = `
                <button class="todo-check" onclick="toggleTodo('${todo.id}',${todo.done})">
                    ${todo.done ? '<i data-lucide="check-circle-2"></i>' : '<i data-lucide="circle"></i>'}
                </button>
                <div class="todo-content">
                    <span class="todo-text">${escapeHtml(todo.text)}</span>
                    <div class="todo-alarm-row">
                        <i data-lucide="bell" class="todo-alarm-icon ${alarmSet ? 'alarm-active' : ''}"></i>
                        <input type="time" class="todo-alarm-time" value="${alarmVal}"
                               onchange="setTodoAlarm('${todo.id}', this.value)"
                               title="Set reminder time">
                        ${alarmSet ? `<span class="todo-alarm-label">${alarmVal}</span>` : '<span class="todo-alarm-label muted">No alarm</span>'}
                    </div>
                </div>
                <button class="todo-delete" onclick="deleteTodo('${todo.id}',event)"><i data-lucide="x"></i></button>`;
            listEl.appendChild(item);
        });
        initLucide();
    } catch (err) { console.error('[Sentio] Todo load error:', err); }
}

/* ══════════════════════════════════════════════════════════════════
   MONTHLY HABITS — recurring habits with per-day check-in + alarm
═══════════════════════════════════════════════════════════════════ */
function renderMonthTitle() {
    const el = document.getElementById('todoMonthTitle'); if (!el) return;
    el.textContent = state.todoCalMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function changeMonth(delta) {
    const d = new Date(state.todoCalMonth); d.setMonth(d.getMonth() + delta);
    state.todoCalMonth = d; renderMonthTitle(); loadHabits();
}

async function addHabit() {
    const input = document.getElementById('habitInput');
    const text = input.value.trim(); if (!text) return; input.value = '';
    try {
        await firebase.firestore().collection('chats').doc(state.userId).collection('monthly_habits')
            .add({ text, alarmTime: null, createdAt: firebase.firestore.FieldValue.serverTimestamp(), active: true });
        loadHabits();
    } catch (err) { console.error('[Sentio] Habit add error:', err); }
}

async function deleteHabit(habitId, event) {
    event.stopPropagation();
    if (!confirm('Delete this habit and all its logs?')) return;
    try {
        // Delete habit + all its logs
        const batch = firebase.firestore().batch();
        batch.delete(firebase.firestore().collection('chats').doc(state.userId).collection('monthly_habits').doc(habitId));
        const logs = await firebase.firestore().collection('chats').doc(state.userId).collection('habit_logs')
            .where('habitId', '==', habitId).get();
        logs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        loadHabits();
    } catch (err) { console.error('[Sentio] Habit delete error:', err); }
}

async function setHabitAlarm(habitId, time) {
    try {
        await firebase.firestore().collection('chats').doc(state.userId).collection('monthly_habits').doc(habitId).update({ alarmTime: time || null });
        if (time && Notification.permission === 'default') await Notification.requestPermission();
        loadHabits();
    } catch (err) { console.error('[Sentio] Habit alarm error:', err); }
}

async function toggleHabitLog(habitId, dateStr, currentDone) {
    // dateStr = 'YYYY-MM-DD'
    const logId = `${habitId}_${dateStr}`;
    try {
        const ref = firebase.firestore().collection('chats').doc(state.userId).collection('habit_logs').doc(logId);
        if (currentDone) {
            await ref.delete();
        } else {
            await ref.set({ habitId, date: dateStr, done: true, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        }
        loadHabits();
    } catch (err) { console.error('[Sentio] Habit log error:', err); }
}

async function loadHabits() {
    const listEl = document.getElementById('habitList'); if (!listEl) return;
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">Loading…</div>';
    try {
        const now = state.todoCalMonth;
        const year = now.getFullYear(); const month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthStart = `${year}-${String(month+1).padStart(2,'0')}-01`;
        const monthEnd   = `${year}-${String(month+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;
        const today = new Date().toISOString().split('T')[0];
        const isCurrentMonth = today >= monthStart && today <= monthEnd;
        const todayStr = isCurrentMonth ? today : monthEnd;

        // Fetch habits
        const habitsSnap = await firebase.firestore().collection('chats').doc(state.userId)
            .collection('monthly_habits').orderBy('createdAt', 'asc').get();
        if (habitsSnap.empty) {
            listEl.innerHTML = `<div class="todo-empty-state"><div class="todo-empty-icon">🌟</div><p>No habits yet.</p><p class="todo-empty-sub">Add a habit to track this month.</p></div>`;
            return;
        }

        // Fetch all logs for this month (simple query — no compound index)
        const logsSnap = await firebase.firestore().collection('chats').doc(state.userId)
            .collection('habit_logs').get();
        const logs = new Set();
        const logCounts = {}; // habitId -> count for this month
        logsSnap.forEach(doc => {
            const d = doc.data();
            if (d.date >= monthStart && d.date <= monthEnd && d.done) {
                logs.add(`${d.habitId}_${d.date}`);
                logCounts[d.habitId] = (logCounts[d.habitId] || 0) + 1;
            }
        });

        listEl.innerHTML = '';
        habitsSnap.forEach(doc => {
            const habit = { id: doc.id, ...doc.data() };
            const doneToday = logs.has(`${habit.id}_${todayStr}`);
            const count = logCounts[habit.id] || 0;
            const alarmVal = habit.alarmTime || '';
            const alarmSet = !!alarmVal;

            const card = document.createElement('div');
            card.className = `habit-card${doneToday ? ' done-today' : ''}`;
            card.innerHTML = `
                <div class="habit-top">
                    <button class="habit-check" onclick="toggleHabitLog('${habit.id}','${todayStr}',${doneToday})" title="${doneToday ? 'Mark undone' : 'Mark done for today'}">
                        ${doneToday ? '<i data-lucide="check-circle-2"></i>' : '<i data-lucide="circle"></i>'}
                    </button>
                    <div class="habit-info">
                        <span class="habit-text">${escapeHtml(habit.text)}</span>
                        <span class="habit-streak">${count} / ${daysInMonth} days this month</span>
                    </div>
                    <button class="todo-delete" onclick="deleteHabit('${habit.id}',event)"><i data-lucide="x"></i></button>
                </div>
                <div class="habit-alarm-row">
                    <i data-lucide="bell" class="todo-alarm-icon ${alarmSet ? 'alarm-active' : ''}"></i>
                    <span class="habit-alarm-label">${alarmSet ? 'Alarm: ' + alarmVal : 'No alarm set'}</span>
                    <input type="time" class="todo-alarm-time" value="${alarmVal}"
                           onchange="setHabitAlarm('${habit.id}', this.value)"
                           title="Set daily alarm for this habit">
                </div>
                <div class="habit-progress-bar">
                    <div class="habit-progress-fill" style="width:${Math.round((count/daysInMonth)*100)}%"></div>
                </div>`;
            listEl.appendChild(card);
        });
        initLucide();
    } catch (err) {
        listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#c0392b;font-size:13px;">Failed to load habits.</div>';
        console.error('[Sentio] Load habits error:', err);
    }
}

/* ══════════════════════════════════════════════════════════════════
   ALARM CHECKER — runs every minute for both daily todos & habits
═══════════════════════════════════════════════════════════════════ */
function initTodoNotifications() {
    if (state.notifTimer) clearInterval(state.notifTimer);
    state.notifTimer = setInterval(checkAllAlarms, 60000);
}

async function checkAllAlarms() {
    if (!state.userId) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const todayKey = now.toISOString().split('T')[0];

    // Check daily todos
    try {
        const snap = await firebase.firestore().collection('chats').doc(state.userId).collection('todos')
            .where('alarmTime', '==', hhmm).where('done', '==', false).get();
        snap.forEach(doc => {
            const lastKey = `sentio_alarm_todo_${doc.id}_${todayKey}`;
            if (!localStorage.getItem(lastKey)) {
                localStorage.setItem(lastKey, '1');
                new Notification(`⏰ Sentio Reminder`, { body: doc.data().text, icon: '/favicon.ico' });
            }
        });
    } catch (_) {}

    // Check monthly habits
    try {
        const snap = await firebase.firestore().collection('chats').doc(state.userId).collection('monthly_habits')
            .where('alarmTime', '==', hhmm).get();
        snap.forEach(doc => {
            const lastKey = `sentio_alarm_habit_${doc.id}_${todayKey}`;
            if (!localStorage.getItem(lastKey)) {
                localStorage.setItem(lastKey, '1');
                new Notification(`🌿 Habit Reminder`, { body: doc.data().text, icon: '/favicon.ico' });
            }
        });
    } catch (_) {}
}

/* ══════════════════════════════════════════════════════════════════
   MONTHLY HABIT PDF REPORT
═══════════════════════════════════════════════════════════════════ */
async function exportTodoMonthlyPDF() {
    if (typeof window.jspdf === 'undefined') { alert('PDF library not loaded yet.'); return; }
    const now = state.todoCalMonth; const year = now.getFullYear(); const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthStart = `${year}-${String(month+1).padStart(2,'0')}-01`;
    const monthEnd   = `${year}-${String(month+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;
    const monthLbl = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    try {
        const [habitsSnap, logsSnap] = await Promise.all([
            firebase.firestore().collection('chats').doc(state.userId).collection('monthly_habits').orderBy('createdAt','asc').get(),
            firebase.firestore().collection('chats').doc(state.userId).collection('habit_logs').get(),
        ]);

        // Build log map: habitId -> Set of dates done
        const logMap = {};
        logsSnap.forEach(doc => {
            const d = doc.data();
            if (d.date >= monthStart && d.date <= monthEnd && d.done) {
                if (!logMap[d.habitId]) logMap[d.habitId] = new Set();
                logMap[d.habitId].add(d.date);
            }
        });

        const habits = []; habitsSnap.forEach(doc => habits.push({ id: doc.id, ...doc.data() }));

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14, CW = W - M * 2;

        _pdfHeader(doc, 'Monthly Habit Report', monthLbl);
        let y = 36;

        // Summary stats
        const totalHabits = habits.length;
        const totalPossible = totalHabits * daysInMonth;
        const totalDone = habits.reduce((sum, h) => sum + (logMap[h.id]?.size || 0), 0);
        const overallRate = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

        const bw = (CW - 8) / 3;
        [{ label: 'Habits Tracked', val: `${totalHabits}`, col: PDF_C.sageDeeper },
         { label: 'Total Check-ins', val: `${totalDone}`, col: PDF_C.sageDark },
         { label: 'Overall Rate', val: `${overallRate}%`, col: overallRate >= 70 ? PDF_C.sageDark : PDF_C.orange }
        ].forEach((s, i) => {
            const bx = M + i * (bw + 4);
            doc.setFillColor(...PDF_C.sageLight); doc.roundedRect(bx, y, bw, 18, 3, 3, 'F');
            doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...s.col); doc.text(s.val, bx + bw / 2, y + 11, { align: 'center' });
            doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...PDF_C.muted); doc.text(s.label, bx + bw / 2, y + 16, { align: 'center' });
        });
        y += 26;

        // Per-habit breakdown
        y = _pdfSection(doc, 'Habit Breakdown', y);

        habits.forEach(habit => {
            if (y > H - 40) { doc.addPage(); _pdfHeader(doc, 'Monthly Habit Report (continued)', monthLbl); y = 36; }
            const doneDates = logMap[habit.id] || new Set();
            const count = doneDates.size;
            const rate = Math.round((count / daysInMonth) * 100);
            const alarm = habit.alarmTime ? `Alarm: ${habit.alarmTime}` : 'No alarm';

            // Habit name + alarm
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_C.text);
            doc.text(habit.text, M, y);
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...PDF_C.muted);
            doc.text(alarm, W - M, y, { align: 'right' });
            y += 5;

            // Stats line
            doc.setFontSize(9); doc.setTextColor(...PDF_C.sageDark);
            doc.text(`${count} of ${daysInMonth} days completed  (${rate}%)`, M, y);
            y += 5;

            // Progress bar
            doc.setFillColor(...PDF_C.sageLight); doc.rect(M, y, CW, 4, 'F');
            if (rate > 0) { doc.setFillColor(...(rate >= 70 ? PDF_C.sageDark : PDF_C.orange)); doc.rect(M, y, (rate / 100) * CW, 4, 'F'); }
            y += 6;

            // Mini calendar dots — show which days were done
            const dotW = CW / daysInMonth;
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const x = M + (d - 1) * dotW + dotW / 2;
                doc.setFillColor(...(doneDates.has(dateStr) ? PDF_C.sageDark : PDF_C.sageLight));
                doc.circle(x, y + 1.5, 1.2, 'F');
            }
            y += 8;

            // Day numbers under dots (every 5th)
            doc.setFontSize(6); doc.setTextColor(...PDF_C.muted);
            for (let d = 1; d <= daysInMonth; d += 5) {
                const x = M + (d - 1) * dotW + dotW / 2;
                doc.text(String(d), x, y, { align: 'center' });
            }
            y += 8;
        });

        const tp = doc.internal.getNumberOfPages();
        for (let p = 1; p <= tp; p++) {
            doc.setPage(p); doc.setFontSize(7); doc.setTextColor(...PDF_C.muted);
            doc.text(`Sentio Habit Report  ·  ${monthLbl}  ·  Page ${p} of ${tp}`, W / 2, H - 8, { align: 'center' });
        }
        doc.save(`Sentio_Habits_${year}_${String(month+1).padStart(2,'0')}.pdf`);
    } catch (err) { console.error('[Sentio] Habit PDF error:', err); alert('Could not generate report.'); }
}