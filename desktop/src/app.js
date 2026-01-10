// M-essenger Desktop Application v3
// Fixed bugs, better sounds, voice messages, improved design

const CONFIG = {
    API_URL: 'https://m-essenger.onrender.com',
    WS_URL: 'wss://m-essenger.onrender.com',
    GIPHY_API_KEY: 'dc6zaTOxFJmzC'
};

// ==================== EARLY PERMISSION REQUEST FOR iOS ====================
// Request camera/microphone permissions IMMEDIATELY on mobile
// This must happen as early as possible to trigger iOS permission dialog
(async function requestEarlyPermissions() {
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobileDevice) return;

    console.log('[M-essenger] Requesting media permissions early...');

    try {
        // Request camera + microphone
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
        stream.getTracks().forEach(track => track.stop());
        console.log('[M-essenger] Camera & microphone permissions granted');
    } catch (e) {
        console.warn('[M-essenger] Camera permission failed, trying audio only:', e.name);
        try {
            // Fallback: request just microphone
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStream.getTracks().forEach(track => track.stop());
            console.log('[M-essenger] Audio permission granted');
        } catch (audioErr) {
            console.warn('[M-essenger] Audio permission denied:', audioErr.name);
        }
    }
})();


// Username validation regex - only Latin letters, numbers, and underscore
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

// ==================== TOAST & MODAL SYSTEM ====================
// SVG icons for toast notifications
const ICONS = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    question: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    channel: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 18-5v12L3 14z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    group: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
};

function showToast(message, type = 'info', title = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const titles = { success: 'Успешно', error: 'Ошибка', warning: 'Внимание', info: 'Информация' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${ICONS[type] || ICONS.info}</div>
        <div class="toast-content">
            <div class="toast-title">${title || titles[type]}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showModal(options = {}) {
    const { icon = ICONS.question, title = 'Подтверждение', message = '', buttons = [] } = options;

    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    overlay.innerHTML = `
        <div class="custom-modal">
            <div class="custom-modal-icon">${icon}</div>
            <div class="custom-modal-title">${title}</div>
            <div class="custom-modal-message">${message}</div>
            <div class="custom-modal-buttons"></div>
        </div>
    `;

    const buttonsContainer = overlay.querySelector('.custom-modal-buttons');
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `custom-modal-btn ${btn.primary ? 'primary' : 'secondary'}`;
        button.textContent = btn.text;
        button.onclick = () => {
            overlay.remove();
            btn.onClick?.();
        };
        buttonsContainer.appendChild(button);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
    return overlay;
}

// Global wrapper to replace all alerts
window.showToast = showToast;
window.showModal = showModal;

// ==================== LOADING OVERLAY ====================
function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
}

// Detect mobile platform and add class to body
let isMobile = false;
function detectPlatform() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(userAgent)) {
        document.body.classList.add('platform-android');
    }
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        document.body.classList.add('platform-ios');
    }
    if (window.matchMedia('(max-width: 768px)').matches || /android|iphone|ipad|ipod/i.test(userAgent)) {
        document.body.classList.add('is-mobile');
        isMobile = true;
    }
}

// Auto-request media permissions on mobile
async function requestMediaPermissions() {
    if (!isMobile) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(track => track.stop());
        console.log('Media permissions granted');
    } catch (err) {
        console.log('Media permissions request:', err.message);
    }
}

// Make functions globally available
window.showLoading = showLoading;
window.hideLoading = hideLoading;

// ==================== AUDIO SYSTEM ====================
class AudioManager {
    constructor() {
        this.audioCtx = null;
        this.enabled = { messages: true, calls: true };
    }

    getContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioCtx;
    }

    // Beautiful message sound - two-tone chime
    playMessageSound() {
        if (!this.enabled.messages) return;
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // First tone
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.frequency.value = 880; // A5
        osc1.type = 'sine';
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Second tone (higher)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1320; // E6
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.setValueAtTime(0.15, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.25);
    }

    // Outgoing call sound - rhythmic beeps
    playCallSound() {
        if (!this.enabled.calls) return;
        const ctx = this.getContext();
        const now = ctx.currentTime;

        for (let i = 0; i < 2; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 440;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, now + i * 0.25);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.25 + 0.15);
            osc.start(now + i * 0.25);
            osc.stop(now + i * 0.25 + 0.15);
        }
    }

    // Incoming call - pleasant ringtone
    startRingtone() {
        if (!this.enabled.calls) return;
        this.ringInterval = setInterval(() => {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            // Pleasant two-note pattern
            [523.25, 659.25, 783.99].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.15, now + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.2);
            });
        }, 1500);
    }

    stopRingtone() {
        if (this.ringInterval) {
            clearInterval(this.ringInterval);
            this.ringInterval = null;
        }
    }

    // Record start/stop sound
    playRecordSound(start = true) {
        const ctx = this.getContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = start ? 600 : 400;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
}

const audioManager = new AudioManager();

// ==================== VOICE RECORDER ====================
// Get supported MIME type for audio recording (iOS uses mp4)
function getSupportedMimeType() {
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return ''; // Let browser choose default
}

class VoiceRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.chunks = [];
        this.isRecording = false;
        this.startTime = null;
        this.mimeType = '';
    }

    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mimeType = getSupportedMimeType();
            const options = this.mimeType ? { mimeType: this.mimeType } : {};
            this.mediaRecorder = new MediaRecorder(stream, options);
            this.chunks = [];
            this.startTime = Date.now();

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.chunks.push(e.data);
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            audioManager.playRecordSound(true);
            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            showToast('Не удалось получить доступ к микрофону', 'error');
            return false;
        }
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || !this.isRecording) {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'audio/webm' });
                const duration = Math.round((Date.now() - this.startTime) / 1000);
                this.isRecording = false;
                this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
                audioManager.playRecordSound(false);
                resolve({ blob, duration });
            };

            this.mediaRecorder.stop();
        });
    }

    cancel() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
            this.isRecording = false;
            this.chunks = [];
        }
    }
}

const voiceRecorder = new VoiceRecorder();

// ==================== STATE ====================
const state = {
    user: null,
    conversations: [],
    currentConversation: null,
    currentChannel: null,
    currentGroup: null,
    messages: [],
    ws: null,
    peerConnection: null,
    localStream: null,
    isInCall: false,
    isMuted: false,
    isVideoEnabled: true,
    typingTimeout: null,
    incomingCallData: null,
    settings: {
        soundMessages: true,
        soundCalls: true,
        microphoneId: '',
        speakerId: '',
        cameraId: ''
    }
};

// ==================== DOM ELEMENTS ====================
const $ = (id) => document.getElementById(id);
const elements = {
    loginScreen: $('login-screen'),
    appScreen: $('app-screen'),
    loginForm: $('login-form'),
    emailInput: $('email'),
    passwordInput: $('password'),
    usernameInput: $('username'),
    usernameField: $('username-field'),
    toggleModeBtn: $('toggle-mode'),
    authBtnText: $('auth-btn-text'),
    errorContainer: $('error-container'),
    currentUserAvatar: $('current-user-avatar'),
    currentUserName: $('current-user-name'),
    searchInput: $('search-input'),
    searchResults: $('search-results'),
    chatList: $('chat-list'),
    emptyState: $('empty-state'),
    chatWindow: $('chat-window'),
    chatAvatar: $('chat-avatar'),
    chatUsername: $('chat-username'),
    chatStatus: $('chat-status'),
    messagesContainer: $('messages-container'),
    typingIndicator: $('typing-indicator'),
    messageInput: $('message-input'),
    sendBtn: $('send-btn'),
    gifBtn: $('gif-btn'),
    voiceBtn: $('voice-btn'),
    gifPicker: $('gif-picker'),
    gifSearch: $('gif-search'),
    gifGrid: $('gif-grid'),
    voiceCallBtn: $('voice-call-btn'),
    videoCallBtn: $('video-call-btn'),
    callOverlay: $('call-overlay'),
    callVideoContainer: $('call-video-container'),
    callConnecting: $('call-connecting'),
    callAvatar: $('call-avatar'),
    callName: $('call-name'),
    callStatus: $('call-status'),
    localVideo: $('local-video'),
    remoteVideo: $('remote-video'),
    muteBtn: $('mute-btn'),
    videoToggleBtn: $('video-toggle-btn'),
    endCallBtn: $('end-call-btn'),
    incomingCall: $('incoming-call'),
    incomingAvatar: $('incoming-avatar'),
    incomingName: $('incoming-name'),
    incomingType: $('incoming-type'),
    acceptCallBtn: $('accept-call-btn'),
    rejectCallBtn: $('reject-call-btn'),
    profileModal: $('profile-modal'),
    settingsModal: $('settings-modal'),
    profileAvatarLarge: $('profile-avatar-large'),
    profileUsername: $('profile-username'),
    profileDisplayName: $('profile-display-name'),
    profileBio: $('profile-bio'),
    microphoneSelect: $('microphone-select'),
    speakerSelect: $('speaker-select'),
    cameraSelect: $('camera-select'),
    voiceRecordingUI: $('voice-recording-ui'),
    voiceRecordingTime: $('voice-recording-time'),
    voiceCancelBtn: $('voice-cancel-btn'),
    voiceSendBtn: $('voice-send-btn')
};

let isLoginMode = true;
let voiceRecordingTimer = null;

// ==================== INITIALIZATION ====================
async function init() {
    // Detect platform for mobile-specific styling
    detectPlatform();

    // Auto-request media permissions on mobile
    if (isMobile) {
        requestMediaPermissions();
    }

    // Check for saved session (auto-login)
    const savedUser = localStorage.getItem('m_essenger_user');
    if (savedUser) {
        try {
            showLoading();
            state.user = JSON.parse(savedUser);
            // Verify user still exists on server
            const response = await fetch(`${CONFIG.API_URL}/api/users/${state.user.id}`);
            if (response.ok) {
                showApp();
            } else {
                localStorage.removeItem('m_essenger_user');
                hideLoading();
            }
        } catch (e) {
            localStorage.removeItem('m_essenger_user');
            hideLoading();
        }
    }

    setupEventListeners();
    requestNotificationPermission();
}

// Request permission for desktop notifications
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// Show desktop notification
function showDesktopNotification(title, body, icon = null) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: body,
            icon: icon || 'icon.png',
            badge: 'icon.png',
            tag: 'messenger-notification',
            requireInteraction: true
        });
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        // Auto-close after 10 seconds
        setTimeout(() => notification.close(), 10000);
    }
}

// Handle pending calls received on reconnect
function handlePendingCalls(calls) {
    if (!calls || calls.length === 0) return;

    calls.forEach(call => {
        const callType = call.call_type === 'video' ? 'Видеозвонок' : 'Голосовой звонок';
        const callerName = call.caller_name || call.caller_username || 'Неизвестный';

        // Show toast notification
        showToast(`${callType} от @${callerName}`, 'warning', 'Пропущенный звонок');

        // Show desktop notification
        showDesktopNotification(
            'Пропущенный звонок',
            `${callerName} звонил(а) вам (${callType})`,
            null
        );
    });

    // Play notification sound
    audioManager.playMessageSound();
}

function isValidUsername(username) {
    return USERNAME_REGEX.test(username) && username.length >= 1;
}

function checkUsernameValid() {
    if (state.user && state.user.username && !isValidUsername(state.user.username)) {
        showUsernameRequiredModal();
    }
}

function showUsernameRequiredModal() {
    const modal = document.getElementById('username-required-modal');
    if (modal) modal.classList.remove('hidden');
}

async function saveRequiredUsername() {
    const input = document.getElementById('new-username-required');
    const errorEl = document.getElementById('new-username-error');
    const newUsername = input.value.trim().replace('@', '');

    if (!newUsername) {
        errorEl.textContent = 'Username не может быть пустым';
        errorEl.classList.remove('hidden');
        return;
    }

    if (!isValidUsername(newUsername)) {
        errorEl.textContent = 'Username может содержать только латинские буквы, цифры и _';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}/api/users/${state.user.id}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: newUsername })
        });

        const data = await response.json();
        if (data.success) {
            state.user = { ...state.user, ...data.user };
            updateUserDisplay();
            document.getElementById('username-required-modal').classList.add('hidden');
        } else {
            errorEl.textContent = data.error || 'Ошибка сохранения';
            errorEl.classList.remove('hidden');
        }
    } catch (error) {
        errorEl.textContent = 'Ошибка соединения';
        errorEl.classList.remove('hidden');
    }
}

function setupEventListeners() {
    elements.loginForm?.addEventListener('submit', handleAuth);
    elements.toggleModeBtn?.addEventListener('click', toggleAuthMode);
    elements.searchInput?.addEventListener('input', debounce(handleSearch, 300));

    document.addEventListener('click', (e) => {
        if (elements.searchResults && !elements.searchResults.contains(e.target) && e.target !== elements.searchInput) {
            elements.searchResults.classList.add('hidden');
        }
        if (elements.gifPicker && !elements.gifPicker.contains(e.target) && e.target !== elements.gifBtn) {
            elements.gifPicker.classList.add('hidden');
        }
    });

    elements.messageInput?.addEventListener('input', handleMessageInput);
    elements.messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    elements.sendBtn?.addEventListener('click', () => sendMessage());
    elements.gifBtn?.addEventListener('click', toggleGifPicker);
    elements.gifSearch?.addEventListener('input', debounce(searchGifs, 300));

    // Voice recording
    elements.voiceBtn?.addEventListener('mousedown', startVoiceRecording);
    elements.voiceBtn?.addEventListener('touchstart', startVoiceRecording);
    elements.voiceCancelBtn?.addEventListener('click', cancelVoiceRecording);
    elements.voiceSendBtn?.addEventListener('click', sendVoiceMessage);

    // Calls
    elements.voiceCallBtn?.addEventListener('click', () => startCall(false));
    elements.videoCallBtn?.addEventListener('click', () => startCall(true));
    elements.muteBtn?.addEventListener('click', toggleMute);
    elements.videoToggleBtn?.addEventListener('click', toggleVideo);
    elements.endCallBtn?.addEventListener('click', endCall);
    elements.acceptCallBtn?.addEventListener('click', acceptCall);
    elements.rejectCallBtn?.addEventListener('click', rejectCall);

    // Modals
    elements.profileModal?.addEventListener('click', (e) => {
        if (e.target === elements.profileModal) closeProfileModal();
    });
    elements.settingsModal?.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettingsModal();
    });
}

// ==================== AUTH ====================
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    elements.usernameField.classList.toggle('hidden', isLoginMode);
    elements.authBtnText.textContent = isLoginMode ? 'Войти' : 'Зарегистрироваться';
    elements.toggleModeBtn.textContent = isLoginMode
        ? 'Нет аккаунта? Зарегистрироваться'
        : 'Уже есть аккаунт? Войти';
    elements.errorContainer.classList.add('hidden');
}

async function handleAuth(e) {
    e.preventDefault();

    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;
    const username = elements.usernameInput.value.trim().replace('@', '');

    try {
        const endpoint = isLoginMode ? '/api/login' : '/api/register';
        const body = isLoginMode ? { email, password } : { email, password, username };

        const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Ошибка');

        state.user = data.user;
        // Save user to localStorage for auto-login
        localStorage.setItem('m_essenger_user', JSON.stringify(data.user));
        showApp();
    } catch (error) {
        showError(error.message);
    }
}

function showError(message) {
    elements.errorContainer.textContent = message;
    elements.errorContainer.classList.remove('hidden');
}

function logout() {
    // Clear localStorage
    localStorage.removeItem('m_essenger_user');

    // Complete state reset
    state.user = null;
    state.conversations = [];
    state.currentConversation = null;
    state.currentChannel = null;
    state.currentGroup = null;
    state.messages = [];
    state.ws?.close();
    state.ws = null;
    state.peerConnection = null;
    state.localStream = null;
    state.isInCall = false;
    state.isMuted = false;
    state.isVideoEnabled = true;
    state.incomingCallData = null;

    // Reset UI
    elements.loginScreen.classList.remove('hidden');
    elements.appScreen.classList.add('hidden');
    elements.emailInput.value = '';
    elements.passwordInput.value = '';
    elements.usernameInput.value = '';
    elements.chatList.innerHTML = '';
    elements.messagesContainer.innerHTML = '';

    // Close chat on mobile
    if (isMobile) closeChat();
}

// ==================== PROFILE ====================
function openProfileModal() {
    if (!state.user) return;
    elements.profileAvatarLarge.textContent = (state.user.display_name || state.user.username || 'U').charAt(0).toUpperCase();
    elements.profileUsername.value = state.user.username || '';
    elements.profileDisplayName.value = state.user.display_name || '';
    elements.profileBio.value = state.user.bio || '';
    elements.profileModal.classList.remove('hidden');
}

function closeProfileModal() {
    elements.profileModal.classList.add('hidden');
}

async function saveProfile() {
    const usernameInput = elements.profileUsername.value.trim().replace('@', '');
    const errorEl = document.getElementById('username-error');

    // Validate username
    if (usernameInput && !isValidUsername(usernameInput)) {
        errorEl.textContent = 'Username может содержать только латинские буквы (a-z), цифры (0-9) и _ ';
        errorEl.classList.remove('hidden');
        return;
    }
    errorEl.classList.add('hidden');

    try {
        const updates = {
            username: usernameInput,
            display_name: elements.profileDisplayName.value.trim(),
            bio: elements.profileBio.value.trim()
        };

        const response = await fetch(`${CONFIG.API_URL}/api/users/${state.user.id}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        const data = await response.json();
        if (data.success) {
            state.user = { ...state.user, ...data.user };
            updateUserDisplay();
            closeProfileModal();
        } else {
            errorEl.textContent = data.error || 'Ошибка сохранения';
            errorEl.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Save profile error:', error);
    }
}

// Account Deletion
function deleteAccount() {
    closeProfileModal();
    document.getElementById('delete-account-modal').classList.remove('hidden');
    document.getElementById('delete-confirm-input').value = '';
}

function closeDeleteAccountModal() {
    document.getElementById('delete-account-modal').classList.add('hidden');
}

async function confirmDeleteAccount() {
    const input = document.getElementById('delete-confirm-input');
    if (input.value !== 'УДАЛИТЬ') {
        input.style.borderColor = 'var(--danger)';
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}/api/users/${state.user.id}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (data.success) {
            logout();
            alert('Ваш аккаунт был успешно удалён');
        } else {
            alert('Ошибка удаления аккаунта');
        }
    } catch (error) {
        console.error('Delete account error:', error);
        alert('Ошибка соединения');
    }

    closeDeleteAccountModal();
}

function updateUserDisplay() {
    const name = state.user.display_name || state.user.username;
    elements.currentUserAvatar.textContent = name.charAt(0).toUpperCase();
    elements.currentUserName.textContent = name;
}

// ==================== SETTINGS ====================
function openSettingsModal() {
    // Hide device settings on mobile
    if (isMobile) {
        const micSection = elements.microphoneSelect?.closest('.modal-section');
        const spkSection = elements.speakerSelect?.closest('.modal-section');
        const camSection = elements.cameraSelect?.closest('.modal-section');
        if (micSection) micSection.style.display = 'none';
        if (spkSection) spkSection.style.display = 'none';
        if (camSection) camSection.style.display = 'none';
    } else {
        loadMediaDevices();
    }
    updateSettingsUI();
    elements.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
    elements.settingsModal.classList.add('hidden');
}

function updateSettingsUI() {
    const msgToggle = $('sound-messages-toggle');
    const callToggle = $('sound-calls-toggle');
    if (msgToggle) msgToggle.classList.toggle('active', state.settings.soundMessages);
    if (callToggle) callToggle.classList.toggle('active', state.settings.soundCalls);
}

function toggleSetting(setting) {
    if (setting === 'soundMessages') {
        state.settings.soundMessages = !state.settings.soundMessages;
        audioManager.enabled.messages = state.settings.soundMessages;
    } else if (setting === 'soundCalls') {
        state.settings.soundCalls = !state.settings.soundCalls;
        audioManager.enabled.calls = state.settings.soundCalls;
    }
    updateSettingsUI();
    // Settings are session-only, not persisted to localStorage
}

async function loadMediaDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => { });
        const devices = await navigator.mediaDevices.enumerateDevices();

        const mics = devices.filter(d => d.kind === 'audioinput');
        const spks = devices.filter(d => d.kind === 'audiooutput');
        const cams = devices.filter(d => d.kind === 'videoinput');

        elements.microphoneSelect.innerHTML = mics.map((d, i) =>
            `<option value="${d.deviceId}">${d.label || 'Микрофон ' + (i + 1)}</option>`
        ).join('') || '<option>Нет устройств</option>';

        elements.speakerSelect.innerHTML = spks.map((d, i) =>
            `<option value="${d.deviceId}">${d.label || 'Динамик ' + (i + 1)}</option>`
        ).join('') || '<option>Нет устройств</option>';

        elements.cameraSelect.innerHTML = cams.map((d, i) =>
            `<option value="${d.deviceId}">${d.label || 'Камера ' + (i + 1)}</option>`
        ).join('') || '<option>Нет устройств</option>';

    } catch (error) {
        console.error('Load devices error:', error);
    }
}

function saveSettings() {
    state.settings.microphoneId = elements.microphoneSelect.value;
    state.settings.speakerId = elements.speakerSelect.value;
    state.settings.cameraId = elements.cameraSelect.value;
    // Settings are session-only, not persisted to localStorage
    closeSettingsModal();
}

// ==================== APP ====================
// Request camera/microphone permissions early on mobile
async function requestMediaPermissions() {
    // Only request on mobile devices
    if (!isMobile) return;

    try {
        console.log('Requesting media permissions...');
        // Request both camera and microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
        // Immediately stop the stream - we just needed to trigger the permission prompt
        stream.getTracks().forEach(track => track.stop());
        console.log('Media permissions granted');
    } catch (error) {
        console.warn('Media permission request:', error.name);
        // If video fails, try audio only
        if (error.name === 'NotFoundError' || error.name === 'NotAllowedError') {
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioStream.getTracks().forEach(track => track.stop());
                console.log('Audio permission granted');
            } catch (audioError) {
                console.warn('Audio permission denied:', audioError.name);
            }
        }
    }
}

function showApp() {
    elements.loginScreen.classList.add('hidden');
    elements.appScreen.classList.remove('hidden');
    updateUserDisplay();
    connectWebSocket();
    loadConversations();
    loadTrendingGifs();

    // Request media permissions early on mobile for calls
    requestMediaPermissions();
}


// ==================== WEBSOCKET ====================
function connectWebSocket() {
    state.ws = new WebSocket(CONFIG.WS_URL);

    state.ws.onopen = () => {
        state.ws.send(JSON.stringify({ type: 'auth', userId: state.user.id }));
    };

    state.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    state.ws.onclose = () => {
        setTimeout(connectWebSocket, 3000);
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'new_message':
            handleNewMessage(data.message);
            break;
        case 'typing':
            handleTypingIndicator(data);
            break;
        case 'user_status':
            updateUserStatus(data.userId, data.status);
            break;
        case 'call_offer':
            handleIncomingCall(data);
            break;
        case 'call_answer':
            handleCallAnswer(data);
            break;
        case 'ice_candidate':
            handleIceCandidate(data);
            break;
        case 'call_ended':
        case 'call_rejected':
            handleCallError('Звонок отклонен', true);
            break;
        case 'call_error':
            handleCallError(data.error);
            break;
        case 'call_pending':
            // User was offline, they'll get notification when online
            showToast(data.message, 'info', 'Звонок');
            handleCallError('Пользователь офлайн', true);
            break;
        case 'pending_calls':
            // Received missed calls from when we were offline
            handlePendingCalls(data.calls);
            break;
    }
}

// ==================== CONVERSATIONS ====================
async function loadConversations() {
    try {
        showLoading();
        const response = await fetch(`${CONFIG.API_URL}/api/conversations/${state.user.id}`);
        state.conversations = await response.json();
        renderConversations();
    } catch (error) {
        console.error('Load conversations error:', error);
    } finally {
        hideLoading();
    }
}

function renderConversations() {
    elements.chatList.innerHTML = state.conversations.map((conv, i) => {
        let preview = 'Нет сообщений';
        if (conv.last_message) {
            if (conv.last_message.startsWith('data:audio')) {
                preview = '🎤 Голосовое сообщение';
            } else if (conv.last_message.startsWith('http') && conv.last_message.includes('giphy')) {
                preview = '🎬 GIF';
            } else {
                preview = conv.last_message.substring(0, 30) + (conv.last_message.length > 30 ? '...' : '');
            }
        }

        return `
    <div class="chat-item ${state.currentConversation?.id === conv.id ? 'active' : ''}"
         style="animation-delay: ${i * 30}ms"
         onclick="selectConversation('${conv.id}')">
      <div class="avatar">${(conv.other_username || 'U').charAt(0).toUpperCase()}</div>
      <div class="chat-content">
        <div class="chat-header">
          <span class="chat-name">@${conv.other_username}</span>
          <span class="chat-time">${formatTime(conv.last_message_time)}</span>
        </div>
        <div class="chat-preview">${preview}</div>
      </div>
      <div class="status-dot ${conv.other_status === 'online' ? 'online' : ''}"></div>
    </div>
  `;
    }).join('');
}

async function selectConversation(conversationId) {
    const conv = state.conversations.find(c => c.id === conversationId);
    if (!conv) return;

    state.currentConversation = conv;
    state.currentChannel = null;
    state.currentGroup = null;

    elements.emptyState.classList.add('hidden');
    elements.chatWindow.classList.remove('hidden');
    elements.chatAvatar.textContent = (conv.other_username || 'U').charAt(0).toUpperCase();
    elements.chatAvatar.style.background = ''; // Reset background
    elements.chatUsername.textContent = '@' + conv.other_username;
    elements.chatStatus.textContent = conv.other_status === 'online' ? 'В сети' : 'Не в сети';

    // Show call buttons for private chats
    document.querySelectorAll('.chat-header-actions .action-btn').forEach(btn => btn.style.display = '');

    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[onclick="selectConversation('${conversationId}')"]`)?.classList.add('active');

    await loadMessages(conversationId);

    // Open chat view on mobile with smooth animation
    if (isMobile) openChat();
}

async function loadMessages(conversationId) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/messages/${conversationId}`);
        state.messages = await response.json();
        renderMessages();
    } catch (error) {
        console.error('Load messages error:', error);
    }
}

function renderMessages() {
    elements.messagesContainer.innerHTML = state.messages.map(msg => {
        // FIX: Check both sender_id and senderId for compatibility
        const senderId = msg.sender_id || msg.senderId;
        const isSent = senderId === state.user.id;
        const isGif = msg.type === 'gif';
        const isVoice = msg.type === 'voice';
        const time = formatMessageTime(msg.created_at || msg.createdAt);
        const msgId = msg.id || Math.random().toString(36).substr(2, 9);

        let content;
        if (isGif) {
            content = `<div class="message-gif"><img src="${msg.content}" alt="GIF" loading="lazy"></div>`;
        } else if (isVoice) {
            // Generate random waveform heights
            const bars = [];
            for (let i = 0; i < 30; i++) {
                const height = Math.floor(Math.random() * 20) + 8;
                bars.push(`<div class="voice-bar" style="height: ${height}px;"></div>`);
            }
            const duration = msg.duration || '0:00';
            content = `<div class="message-voice" data-voice-id="${msgId}">
        <button class="voice-play-btn" onclick="playVoiceMessage(this, '${msg.content}', '${msgId}')">▶</button>
        <div class="voice-waveform-container">
            <div class="voice-waveform">${bars.join('')}</div>
            <div class="voice-progress-container" onclick="seekVoice(event, '${msgId}')">
                <div class="voice-progress" id="voice-progress-${msgId}"></div>
            </div>
            <div class="voice-time-info">
                <span class="voice-current-time" id="voice-time-${msgId}">0:00</span>
                <span class="voice-duration">${duration}</span>
            </div>
        </div>
      </div>`;
        } else {
            content = `<div class="message-bubble">${escapeHtml(msg.content)}</div>`;
        }

        return `
      <div class="message ${isSent ? 'sent' : 'received'}">
        ${content}
        <span class="message-time">${time}</span>
      </div>
    `;
    }).join('');

    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function handleNewMessage(message) {
    // Normalize the message format
    const normalizedMessage = {
        ...message,
        sender_id: message.sender_id || message.senderId,
        created_at: message.created_at || message.createdAt || new Date().toISOString()
    };

    if (state.currentConversation && (message.conversationId === state.currentConversation.id || message.conversation_id === state.currentConversation.id)) {
        state.messages.push(normalizedMessage);
        renderMessages();
    }

    // Play sound only for received messages
    const senderId = message.sender_id || message.senderId;
    if (senderId !== state.user.id) {
        audioManager.playMessageSound();
    }

    loadConversations();
}

// ==================== SEARCH ====================
async function handleSearch() {
    const query = elements.searchInput.value.trim().replace('@', '');
    if (!query) {
        elements.searchResults.classList.add('hidden');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}/api/users/search?q=${encodeURIComponent(query)}&userId=${state.user.id}`);
        const users = await response.json();

        elements.searchResults.innerHTML = users.length > 0
            ? users.map(u => `
          <div class="search-result-item" onclick="startConversationWith('${u.id}', '${u.username}')">
            <div class="avatar small">${(u.username || 'U').charAt(0).toUpperCase()}</div>
            <div class="user-info">
              <div class="user-name">@${u.username}</div>
              <div class="user-status">${u.status === 'online' ? 'В сети' : 'Не в сети'}</div>
            </div>
          </div>
        `).join('')
            : '<div class="search-result-item"><span class="text-muted">Не найдено</span></div>';
        elements.searchResults.classList.remove('hidden');
    } catch (error) {
        console.error('Search error:', error);
    }
}

async function startConversationWith(userId, username) {
    elements.searchResults.classList.add('hidden');
    elements.searchInput.value = '';

    try {
        const response = await fetch(`${CONFIG.API_URL}/api/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId1: state.user.id, userId2: userId })
        });
        const data = await response.json();
        await loadConversations();
        selectConversation(data.conversationId);
    } catch (error) {
        console.error('Create conversation error:', error);
    }
}

// ==================== MESSAGES ====================
function handleMessageInput() {
    const hasText = elements.messageInput.value.trim().length > 0;
    elements.sendBtn.disabled = !hasText;
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 120) + 'px';

    if (state.currentConversation && state.ws?.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({
            type: 'typing',
            conversationId: state.currentConversation.id,
            userId: state.user.id,
            isTyping: true
        }));

        clearTimeout(state.typingTimeout);
        state.typingTimeout = setTimeout(() => {
            state.ws?.send(JSON.stringify({
                type: 'typing',
                conversationId: state.currentConversation.id,
                userId: state.user.id,
                isTyping: false
            }));
        }, 2000);
    }
}

function sendMessage(content = null, type = 'text') {
    const messageContent = content || elements.messageInput.value.trim();
    if (!messageContent) return;

    // Check what context we're in
    if (state.currentChannel) {
        // Send to channel via HTTP (only admins can post)
        sendChannelMessage(messageContent, type);
    } else if (state.currentGroup) {
        // Send to group via WebSocket
        sendGroupMessage(messageContent, type);
    } else if (state.currentConversation && state.ws) {
        // Private message via WebSocket
        state.ws.send(JSON.stringify({
            type: 'message',
            conversationId: state.currentConversation.id,
            senderId: state.user.id,
            content: messageContent,
            messageType: type
        }));
    } else {
        return;
    }

    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    elements.sendBtn.disabled = true;
}

async function sendChannelMessage(content, type = 'text') {
    if (!state.currentChannel) return;
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/channels/${state.currentChannel.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: state.user.id,
                content: content,
                type: type
            })
        });
        const data = await response.json();
        if (data.success) {
            // Reload messages
            await loadChannelMessages(state.currentChannel.id);
        } else {
            alert(data.error || 'Только администраторы могут писать в канале');
        }
    } catch (error) {
        console.error('Send channel message error:', error);
    }
}

async function sendGroupMessage(content, type = 'text') {
    if (!state.currentGroup) return;
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/groups/${state.currentGroup.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: state.user.id,
                content: content,
                type: type
            })
        });
        const data = await response.json();
        if (data.success) {
            await loadGroupMessages(state.currentGroup.id);
        }
    } catch (error) {
        console.error('Send group message error:', error);
    }
}

function handleTypingIndicator(data) {
    if (state.currentConversation && data.conversationId === state.currentConversation.id) {
        elements.typingIndicator.classList.toggle('hidden', !data.isTyping);
    }
}

function updateUserStatus(userId, status) {
    const conv = state.conversations.find(c => c.other_user_id === userId);
    if (conv) {
        conv.other_status = status;
        renderConversations();
        if (state.currentConversation?.id === conv.id) {
            elements.chatStatus.textContent = status === 'online' ? 'В сети' : 'Не в сети';
        }
    }
}

// ==================== VOICE MESSAGES ====================
async function startVoiceRecording() {
    if (voiceRecorder.isRecording) return;

    const started = await voiceRecorder.start();
    if (!started) {
        alert('Не удалось получить доступ к микрофону');
        return;
    }

    elements.voiceRecordingUI.classList.remove('hidden');
    let seconds = 0;
    voiceRecordingTimer = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        elements.voiceRecordingTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function cancelVoiceRecording() {
    voiceRecorder.cancel();
    clearInterval(voiceRecordingTimer);
    elements.voiceRecordingUI.classList.add('hidden');
    elements.voiceRecordingTime.textContent = '0:00';
}

async function sendVoiceMessage() {
    clearInterval(voiceRecordingTimer);
    const result = await voiceRecorder.stop();

    if (result && result.blob) {
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result;
            sendMessage(base64, 'voice');
        };
        reader.readAsDataURL(result.blob);
    }

    elements.voiceRecordingUI.classList.add('hidden');
    elements.voiceRecordingTime.textContent = '0:00';
}

// Voice playback with progress tracking
const activeVoiceAudios = {};

function playVoiceMessage(btn, src, msgId) {
    // Stop any currently playing audio
    Object.keys(activeVoiceAudios).forEach(id => {
        if (id !== msgId && activeVoiceAudios[id]) {
            activeVoiceAudios[id].pause();
            activeVoiceAudios[id].currentTime = 0;
            const oldBtn = document.querySelector(`[data-voice-id="${id}"] .voice-play-btn`);
            if (oldBtn) {
                oldBtn.textContent = '▶';
                oldBtn.classList.remove('playing');
            }
            const oldProgress = document.getElementById(`voice-progress-${id}`);
            if (oldProgress) oldProgress.style.width = '0%';
        }
    });

    // If we already have this audio, toggle play/pause
    if (activeVoiceAudios[msgId]) {
        const audio = activeVoiceAudios[msgId];
        if (audio.paused) {
            audio.play();
            btn.textContent = '⏸';
            btn.classList.add('playing');
        } else {
            audio.pause();
            btn.textContent = '▶';
            btn.classList.remove('playing');
        }
        return;
    }

    // Create new audio
    const audio = new Audio(src);
    activeVoiceAudios[msgId] = audio;

    const progressEl = document.getElementById(`voice-progress-${msgId}`);
    const timeEl = document.getElementById(`voice-time-${msgId}`);
    const waveformEl = btn.parentElement.querySelector('.voice-waveform');

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const percent = (audio.currentTime / audio.duration) * 100;
            if (progressEl) progressEl.style.width = percent + '%';
            if (timeEl) timeEl.textContent = formatDuration(audio.currentTime);

            // Update waveform bars
            if (waveformEl) {
                const bars = waveformEl.querySelectorAll('.voice-bar');
                const activeCount = Math.floor((percent / 100) * bars.length);
                bars.forEach((bar, i) => {
                    bar.classList.toggle('active', i < activeCount);
                });
            }
        }
    });

    audio.addEventListener('ended', () => {
        btn.textContent = '▶';
        btn.classList.remove('playing');
        if (progressEl) progressEl.style.width = '0%';
        if (timeEl) timeEl.textContent = '0:00';
        if (waveformEl) {
            waveformEl.querySelectorAll('.voice-bar').forEach(bar => bar.classList.remove('active'));
        }
        delete activeVoiceAudios[msgId];
    });

    audio.play();
    btn.textContent = '⏸';
    btn.classList.add('playing');
}

function seekVoice(event, msgId) {
    const audio = activeVoiceAudios[msgId];
    if (!audio) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function playVoice(btn, src) {
    const audio = new Audio(src);
    audio.play();
    btn.textContent = '⏸';
    audio.onended = () => btn.textContent = '▶';
}

// ==================== GIF ====================
function toggleGifPicker() {
    elements.gifPicker.classList.toggle('hidden');
    if (!elements.gifPicker.classList.contains('hidden')) {
        elements.gifSearch.focus();
    }
}

async function loadTrendingGifs() {
    try {
        const response = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${CONFIG.GIPHY_API_KEY}&limit=20&rating=g`);
        const data = await response.json();
        renderGifs(data.data);
    } catch (error) {
        console.error('Load GIFs error:', error);
    }
}

async function searchGifs() {
    const query = elements.gifSearch.value.trim();
    if (!query) return loadTrendingGifs();

    try {
        const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${CONFIG.GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`);
        const data = await response.json();
        renderGifs(data.data);
    } catch (error) {
        console.error('Search GIFs error:', error);
    }
}

function renderGifs(gifs) {
    elements.gifGrid.innerHTML = gifs.map(gif => `
    <div class="gif-item" onclick="sendGif('${gif.images.fixed_height.url}')">
      <img src="${gif.images.fixed_height_small.url}" alt="${gif.title}" loading="lazy">
    </div>
  `).join('');
}

function sendGif(url) {
    sendMessage(url, 'gif');
    elements.gifPicker.classList.add('hidden');
    elements.gifSearch.value = '';
}

// ==================== CALLS ====================
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        // Free TURN servers from OpenRelay (for NAT traversal)
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ],
    iceCandidatePoolSize: 10
};

async function startCall(isVideo) {
    if (!state.currentConversation || state.isInCall) return;

    // Check WebSocket connection first
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
        showToast('Нет подключения к серверу', 'error', 'Ошибка');
        return;
    }

    // Allow calling offline users - check done on server/peer level, not client
    // if (state.currentConversation.other_status !== 'online') ... removed restriction

    try {
        // Request media access with specific error handling
        try {
            state.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: isVideo
            });
        } catch (mediaError) {
            console.error('Media access error:', mediaError);
            if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
                showToast(isVideo ? 'Доступ к камере и микрофону запрещён' : 'Доступ к микрофону запрещён', 'error', 'Нет доступа');
            } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
                showToast(isVideo ? 'Камера или микрофон не найдены' : 'Микрофон не найден', 'error', 'Устройство не найдено');
            } else {
                showToast('Не удалось получить доступ к устройствам', 'error', 'Ошибка');
            }
            return;
        }

        state.isInCall = true;
        state.isVideoEnabled = isVideo;

        audioManager.playCallSound();
        showCallUI(state.currentConversation.other_username, isVideo);
        createPeerConnection();

        state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
        elements.localVideo.srcObject = state.localStream;

        const offer = await state.peerConnection.createOffer();
        await state.peerConnection.setLocalDescription(offer);

        state.ws.send(JSON.stringify({
            type: 'call_offer',
            offer,
            targetUserId: state.currentConversation.other_user_id,
            callerId: state.user.id,
            callerName: state.user.username,
            conversationId: state.currentConversation.id,
            isVideo
        }));

        elements.callStatus.textContent = 'Звоним...';

        // Timeout for no answer (60 seconds - increased for stability)
        setTimeout(() => {
            if (state.isInCall && elements.callStatus.textContent === 'Звоним...') {
                showToast('Абонент не отвечает', 'warning');
                handleCallError('Нет ответа', true);
            }
        }, 60000);

    } catch (error) {
        console.error('Start call error:', error);
        // Clean up if partially started
        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            state.localStream = null;
        }
        state.isInCall = false;
        showToast('Не удалось начать звонок', 'error', 'Ошибка звонка');
        endCall();
    }
}

function createPeerConnection() {
    state.peerConnection = new RTCPeerConnection(rtcConfig);

    state.peerConnection.onicecandidate = (e) => {
        if (e.candidate && state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({
                type: 'ice_candidate',
                candidate: e.candidate,
                targetUserId: state.currentConversation?.other_user_id || state.incomingCallData?.callerId,
                fromUserId: state.user.id
            }));
        }
    };

    // Monitor ICE connection state for better error handling
    state.peerConnection.oniceconnectionstatechange = () => {
        const iceState = state.peerConnection.iceConnectionState;
        console.log('ICE connection state:', iceState);

        switch (iceState) {
            case 'connected':
            case 'completed':
                // Connection established successfully
                elements.callStatus.textContent = 'Подключено';
                audioManager.stopRingtone();
                break;
            case 'disconnected':
                elements.callStatus.textContent = 'Переподключение...';
                break;
            case 'failed':
                console.error('ICE connection failed');
                showToast('Не удалось установить соединение', 'error', 'Ошибка связи');
                endCall();
                break;
            case 'closed':
                // Connection closed, cleanup handled in endCall
                break;
        }
    };

    // Handle ICE candidate errors (for debugging)
    state.peerConnection.onicecandidateerror = (event) => {
        console.warn('ICE candidate error:', event.errorCode, event.errorText);
    };

    state.peerConnection.ontrack = (e) => {
        if (state.isVideoEnabled) {
            elements.remoteVideo.srcObject = e.streams[0];
            elements.callVideoContainer.classList.remove('hidden');
            elements.callConnecting.classList.add('hidden');
            elements.callOverlay.classList.remove('connecting');
        } else {
            // Voice call connected - show waves animation and timer
            elements.callStatus.textContent = 'Подключено';
            const voiceWaves = document.getElementById('voice-waves');
            const callTimer = document.getElementById('call-timer');
            if (voiceWaves) voiceWaves.classList.remove('hidden');
            if (callTimer) {
                callTimer.classList.remove('hidden');
                startCallTimer();
            }
        }
        audioManager.stopRingtone();
    };
}


let callTimerInterval = null;
let callStartTime = null;

function startCallTimer() {
    callStartTime = Date.now();
    const callTimerEl = document.getElementById('call-timer');

    callTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        if (callTimerEl) {
            callTimerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callStartTime = null;
}

function handleIncomingCall(data) {
    state.incomingCallData = data;
    audioManager.startRingtone();

    elements.incomingAvatar.textContent = (data.callerName || 'U').charAt(0).toUpperCase();
    elements.incomingName.textContent = '@' + data.callerName;
    elements.incomingType.textContent = data.isVideo ? 'Видеозвонок' : 'Голосовой звонок';
    elements.incomingCall.classList.remove('hidden');
}

async function acceptCall() {
    if (!state.incomingCallData) return;
    audioManager.stopRingtone();
    elements.incomingCall.classList.add('hidden');

    try {
        state.localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: state.incomingCallData.isVideo
        });
        state.isInCall = true;

        showCallUI(state.incomingCallData.callerName, state.incomingCallData.isVideo);
        createPeerConnection();

        state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
        elements.localVideo.srcObject = state.localStream;

        await state.peerConnection.setRemoteDescription(new RTCSessionDescription(state.incomingCallData.offer));
        const answer = await state.peerConnection.createAnswer();
        await state.peerConnection.setLocalDescription(answer);

        state.ws.send(JSON.stringify({
            type: 'call_answer',
            answer,
            callerId: state.incomingCallData.callerId,
            answererId: state.user.id
        }));
    } catch (error) {
        console.error('Accept call error:', error);
        rejectCall();
    }
}

function rejectCall() {
    audioManager.stopRingtone();
    if (state.incomingCallData) {
        state.ws.send(JSON.stringify({
            type: 'call_reject',
            callerId: state.incomingCallData.callerId,
            rejecterId: state.user.id
        }));
    }
    elements.incomingCall.classList.add('hidden');
    state.incomingCallData = null;
}

async function handleCallAnswer(data) {
    if (state.peerConnection) {
        await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
}

async function handleIceCandidate(data) {
    if (state.peerConnection && data.candidate) {
        await state.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => { });
    }
}

function showCallUI(name, isVideo) {
    elements.callOverlay.classList.remove('hidden', 'voice-call', 'video-call', 'connecting');
    elements.callOverlay.classList.add(isVideo ? 'video-call' : 'voice-call', 'connecting');
    elements.callAvatar.textContent = (name || 'U').charAt(0).toUpperCase();
    elements.callName.textContent = '@' + name;
    elements.callStatus.textContent = 'Вызов...';

    // Reset timer and waves
    const callTimer = document.getElementById('call-timer');
    const voiceWaves = document.getElementById('voice-waves');
    if (callTimer) {
        callTimer.classList.add('hidden');
        callTimer.textContent = '0:00';
    }
    if (voiceWaves) voiceWaves.classList.add('hidden');

    if (isVideo) {
        elements.callVideoContainer.classList.remove('hidden');
        elements.callConnecting.classList.remove('hidden');
        elements.videoToggleBtn.classList.remove('hidden');
    } else {
        elements.callVideoContainer.classList.add('hidden');
        elements.callConnecting.classList.remove('hidden');
        elements.videoToggleBtn.classList.add('hidden');
    }
}

function toggleMute() {
    state.isMuted = !state.isMuted;
    state.localStream?.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
    elements.muteBtn.classList.toggle('active', state.isMuted);
    elements.muteBtn.textContent = state.isMuted ? '🔇' : '🎤';
}

function toggleVideo() {
    state.isVideoEnabled = !state.isVideoEnabled;
    state.localStream?.getVideoTracks().forEach(t => t.enabled = state.isVideoEnabled);
    elements.videoToggleBtn.classList.toggle('active', !state.isVideoEnabled);
}

function endCall() {
    audioManager.stopRingtone();
    stopCallTimer();
    state.localStream?.getTracks().forEach(t => t.stop());
    state.peerConnection?.close();

    if (state.ws && state.currentConversation) {
        state.ws.send(JSON.stringify({
            type: 'call_end',
            targetUserId: state.currentConversation.other_user_id,
            fromUserId: state.user.id
        }));
    }

    elements.callOverlay.classList.add('hidden');
    elements.callOverlay.classList.remove('voice-call', 'video-call', 'connecting');
    elements.incomingCall.classList.add('hidden');

    // Reset voice waves and timer
    const voiceWaves = document.getElementById('voice-waves');
    const callTimer = document.getElementById('call-timer');
    if (voiceWaves) voiceWaves.classList.add('hidden');
    if (callTimer) {
        callTimer.classList.add('hidden');
        callTimer.textContent = '0:00';
    }

    state.localStream = null;
    state.peerConnection = null;
    state.isInCall = false;
    state.isMuted = false;
    state.isVideoEnabled = true;
    state.incomingCallData = null;

    elements.muteBtn.classList.remove('active');
    elements.muteBtn.textContent = '🎤';
    elements.videoToggleBtn.classList.remove('active');
}



function handleCallError(message, isEnd = false) {
    if (isEnd) {
        // Show error quickly then close
        const statusEl = elements.callStatus;
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = '#ef4444'; // Red color
        }
        setTimeout(() => endCall(), 2000);
    } else {
        // Show error state in call UI
        elements.callOverlay.classList.remove('hidden', 'voice-call', 'video-call');
        elements.callOverlay.classList.add('voice-call'); // Default to voice style for error

        elements.callAvatar.textContent = '!';
        elements.callAvatar.style.background = 'var(--danger)';
        elements.callName.textContent = 'Ошибка';
        elements.callStatus.textContent = message;
        elements.callStatus.style.color = '#ef4444';

        // Show only end call button
        elements.callControls.innerHTML = `<button class="call-btn end-call" onclick="endCall()">Закрыть</button>`;
    }
}

// ==================== UTILITIES ====================
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function formatTime(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';

        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Вчера';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('ru-RU', { weekday: 'short' });
        }
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    } catch {
        return '';
    }
}

function formatMessageTime(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Manual permission request function for settings button
async function requestCameraAndMic() {
    try {
        showToast('Запрашиваем разрешения...', 'info', 'Разрешения');

        // Request camera + microphone
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
        stream.getTracks().forEach(track => track.stop());
        showToast('Камера и микрофон разрешены!', 'success', 'Готово');
    } catch (e) {
        console.warn('Camera permission failed:', e.name);

        // Try audio only
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStream.getTracks().forEach(track => track.stop());
            showToast('Микрофон разрешён!', 'success', 'Готово');
        } catch (audioErr) {
            console.error('Audio permission denied:', audioErr.name);
            if (audioErr.name === 'NotAllowedError') {
                showToast('Разрешение отклонено. Откройте настройки iOS > M-essenger и включите камеру/микрофон', 'error', 'Ошибка');
            } else if (audioErr.name === 'NotFoundError') {
                showToast('Микрофон не найден на устройстве', 'error', 'Ошибка');
            } else {
                showToast('Не удалось получить доступ к устройствам', 'error', 'Ошибка');
            }
        }
    }
}

// Global exports
window.selectConversation = selectConversation;
window.startConversationWith = startConversationWith;
window.sendGif = sendGif;
window.logout = logout;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.saveProfile = saveProfile;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.toggleSetting = toggleSetting;
window.saveSettings = saveSettings;
window.playVoice = playVoice;
window.playVoiceMessage = playVoiceMessage;
window.seekVoice = seekVoice;
window.deleteAccount = deleteAccount;
window.closeDeleteAccountModal = closeDeleteAccountModal;
window.confirmDeleteAccount = confirmDeleteAccount;
window.saveRequiredUsername = saveRequiredUsername;
window.requestCameraAndMic = requestCameraAndMic;


// ==================== MOBILE NAVIGATION ====================
// Open chat view with smooth slide animation
function openChat() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.classList.add('active');
    }
}

// Close chat view and return to chat list
function closeChat() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.classList.remove('active');
    }
    // Clear current selection
    state.currentConversation = null;
    state.currentChannel = null;
    state.currentGroup = null;
}

window.openChat = openChat;
window.closeChat = closeChat;

// ==================== CHANNELS & GROUPS ====================
let currentTab = 'chats';

function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');

    // Show/hide lists
    document.getElementById('chat-list')?.classList.toggle('hidden', tab !== 'chats');
    document.getElementById('channel-list')?.classList.toggle('hidden', tab !== 'channels');
    document.getElementById('group-list')?.classList.toggle('hidden', tab !== 'groups');

    // Load data
    if (tab === 'channels') loadChannels();
    else if (tab === 'groups') loadGroups();
}

async function loadChannels() {
    if (!state.user) return;
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/channels/user/${state.user.id}`);
        const channels = await response.json();
        renderChannels(channels);
    } catch (error) {
        console.error('Load channels error:', error);
    }
}

function renderChannels(channels) {
    const list = document.getElementById('channel-list');
    if (!list) return;

    if (channels.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding: 40px; text-align: center;"><p style="color: var(--text-muted);">Нет каналов</p></div>';
        return;
    }

    list.innerHTML = channels.map(ch => `
        <div class="channel-item" onclick="selectChannel('${ch.id}')">
            <div class="channel-icon">${ICONS.channel}</div>
            <div class="item-content">
                <div class="item-name">${ch.name}</div>
                <div class="member-count">${ch.member_count || 1} участников</div>
            </div>
        </div>
    `).join('');
}

async function loadGroups() {
    if (!state.user) return;
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/groups/user/${state.user.id}`);
        const groups = await response.json();
        renderGroups(groups);
    } catch (error) {
        console.error('Load groups error:', error);
    }
}

function renderGroups(groups) {
    const list = document.getElementById('group-list');
    if (!list) return;

    if (groups.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding: 40px; text-align: center;"><p style="color: var(--text-muted);">Нет групп</p></div>';
        return;
    }

    list.innerHTML = groups.map(g => `
        <div class="group-item" onclick="selectGroup('${g.id}')">
            <div class="group-icon">${ICONS.group}</div>
            <div class="item-content">
                <div class="item-name">${g.name}</div>
                <div class="member-count">${g.member_count || 1} участников</div>
            </div>
        </div>
    `).join('');
}

async function selectChannel(channelId) {
    try {
        // Fetch channel details
        const response = await fetch(`${CONFIG.API_URL}/api/channels/${channelId}`);
        const channel = await response.json();
        if (!channel || channel.error) {
            console.error('Channel not found');
            return;
        }

        // Store current channel
        state.currentChannel = channel;
        state.currentConversation = null; // Clear private chat
        state.currentGroup = null;

        // Update UI
        elements.emptyState.classList.add('hidden');
        elements.chatWindow.classList.remove('hidden');
        elements.chatAvatar.innerHTML = ICONS.channel;
        elements.chatAvatar.style.background = 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
        elements.chatUsername.textContent = channel.name;
        elements.chatStatus.textContent = `${channel.member_count || 1} участников`;

        // Hide call buttons for channels
        document.querySelectorAll('.call-btn').forEach(btn => btn.style.display = 'none');

        // Load channel messages
        await loadChannelMessages(channelId);

        // Update active state
        document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`[onclick="selectChannel('${channelId}')"]`)?.classList.add('active');

        // Open chat on mobile
        if (isMobile) openChat();
    } catch (error) {
        console.error('Select channel error:', error);
    }
}

async function loadChannelMessages(channelId) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/channels/${channelId}/messages`);
        state.messages = await response.json();
        renderMessages();
    } catch (error) {
        console.error('Load channel messages error:', error);
    }
}

async function selectGroup(groupId) {
    try {
        // Fetch group details
        const response = await fetch(`${CONFIG.API_URL}/api/groups/${groupId}`);
        const group = await response.json();
        if (!group || group.error) {
            console.error('Group not found');
            return;
        }

        // Store current group
        state.currentGroup = group;
        state.currentConversation = null;
        state.currentChannel = null;

        // Update UI
        elements.emptyState.classList.add('hidden');
        elements.chatWindow.classList.remove('hidden');
        elements.chatAvatar.innerHTML = ICONS.group;
        elements.chatAvatar.style.background = 'linear-gradient(135deg, #10b981, #3b82f6)';
        elements.chatUsername.textContent = group.name;
        elements.chatStatus.textContent = `${group.member_count || 1} участников`;

        // Show call buttons for groups (group calls)
        document.querySelectorAll('.call-btn').forEach(btn => btn.style.display = '');

        // Load group messages
        await loadGroupMessages(groupId);

        // Update active state
        document.querySelectorAll('.group-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`[onclick="selectGroup('${groupId}')"]`)?.classList.add('active');
    } catch (error) {
        console.error('Select group error:', error);
    }
}

async function loadGroupMessages(groupId) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/groups/${groupId}/messages`);
        state.messages = await response.json();
        renderMessages();
    } catch (error) {
        console.error('Load group messages error:', error);
    }
}

function openCreateModal() {
    document.getElementById('create-modal')?.classList.remove('hidden');
    document.getElementById('create-name').value = '';
    document.getElementById('create-description').value = '';
}

function closeCreateModal() {
    document.getElementById('create-modal')?.classList.add('hidden');
}

async function createChannelOrGroup() {
    const type = document.getElementById('create-type').value;
    const name = document.getElementById('create-name').value.trim();
    const description = document.getElementById('create-description').value.trim();

    if (!name) {
        showToast('Введите название', 'warning');
        return;
    }

    // Validate user is logged in
    if (!state.user || !state.user.id) {
        showToast('Пожалуйста, перезайдите в аккаунт', 'error');
        return;
    }

    try {
        const endpoint = type === 'channel' ? '/api/channels' : '/api/groups';
        const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, ownerId: state.user.id })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            closeCreateModal();
            showToast(`${type === 'channel' ? 'Канал' : 'Группа'} создан(а)!`, 'success');
            switchTab(type === 'channel' ? 'channels' : 'groups');
        } else {
            showToast(data.error || 'Ошибка создания', 'error');
        }
    } catch (error) {
        console.error('Create error:', error);
        showToast(error.message || 'Ошибка соединения', 'error');
    }
}

window.switchTab = switchTab;
window.selectChannel = selectChannel;
window.selectGroup = selectGroup;
window.openCreateModal = openCreateModal;
window.closeCreateModal = closeCreateModal;
window.createChannelOrGroup = createChannelOrGroup;

init();
