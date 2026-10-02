/* ============================================
   TMB Objectes Perduts - App Logic
   Firebase Realtime Database per sincronització
   ============================================ */

// Firebase config - base de dades pública per al prototip
const firebaseConfig = {
    apiKey: "AIzaSyDummyKeyForPrototype",
    authDomain: "tmb-objectes-perduts.firebaseapp.com",
    databaseURL: "https://tmb-objectes-perduts-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tmb-objectes-perduts",
    storageBucket: "tmb-objectes-perduts.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000"
};

// ============================================
// STATE
// ============================================
let db = null;
let isOnline = false;
const MAX_RECENT_ITEMS = 20;

// Local storage fallback
const STORAGE_KEYS = {
    trobats: 'tmb_trobats',
    perduts: 'tmb_perduts',
    matches: 'tmb_matches'
};

// Category emoji map
const CATEGORY_EMOJIS = {
    mobil: '📱',
    cartera: '👛',
    claus: '🔑',
    roba: '🧥',
    bossa: '👜',
    auriculars: '🎧',
    paraigua: '☂️',
    joguina: '🧸',
    llibre: '📚',
    altres: '📦'
};

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    initNavigation();
    initForms();
    initMatchFilters();
    setDefaultDates();
});

function initFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        
        // Monitor connection
        const connRef = db.ref('.info/connected');
        connRef.on('value', (snap) => {
            updateConnectionStatus(snap.val() === true);
        });

        // Listen for data changes
        listenForData('trobats', renderTrobats);
        listenForData('perduts', renderPerduts);
        listenForData('matches', renderMatches);
        
    } catch (e) {
        console.warn('Firebase init failed, using local storage:', e);
        updateConnectionStatus(false);
        loadFromLocalStorage();
    }
}

function updateConnectionStatus(online) {
    isOnline = online;
    const statusEl = document.getElementById('connectionStatus');
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');
    
    if (online) {
        dot.className = 'status-dot online';
        text.textContent = 'En línia';
    } else {
        dot.className = 'status-dot offline';
        text.textContent = 'Fora de línia';
        // Load from local storage as fallback
        loadFromLocalStorage();
    }
}

function listenForData(collection, renderFn) {
    if (!db) return;
    
    const ref = db.ref(collection);
    ref.orderByChild('timestamp').limitToLast(MAX_RECENT_ITEMS).on('value', (snapshot) => {
        const items = [];
        snapshot.forEach((child) => {
            items.push({ id: child.key, ...child.val() });
        });
        items.reverse(); // Most recent first
        
        // Save to local storage
        localStorage.setItem(STORAGE_KEYS[collection], JSON.stringify(items));
        
        renderFn(items);
    }, (error) => {
        console.warn(`Error listening to ${collection}:`, error);
        loadCollectionFromStorage(collection, renderFn);
    });
}

function loadFromLocalStorage() {
    loadCollectionFromStorage('trobats', renderTrobats);
    loadCollectionFromStorage('perduts', renderPerduts);
    loadCollectionFromStorage('matches', renderMatches);
}

function loadCollectionFromStorage(collection, renderFn) {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEYS[collection]) || '[]');
        renderFn(data);
    } catch (e) {
        renderFn([]);
    }
}

// ============================================
// NAVIGATION
// ============================================
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.dataset.tab;
            
            // Update nav
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Update panels
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// ============================================
// FORMS
// ============================================
function initForms() {
    document.getElementById('formTrobat').addEventListener('submit', (e) => {
        e.preventDefault();
        handleFormSubmit('trobat');
    });
    
    document.getElementById('formPerdut').addEventListener('submit', (e) => {
        e.preventDefault();
        handleFormSubmit('perdut');
    });
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('trobat-data').value = today;
    document.getElementById('perdut-data').value = today;
}

function handleFormSubmit(type) {
    const prefix = type;
    const form = document.getElementById(`form${capitalize(type)}`);
    
    // Get values
    const que = document.getElementById(`${prefix}-que`).value.trim();
    const linia = document.getElementById(`${prefix}-linia`).value;
    const estacio = document.getElementById(`${prefix}-estacio`).value.trim();
    const data = document.getElementById(`${prefix}-data`).value;
    const hora = document.getElementById(`${prefix}-hora`).value;
    const categoria = document.getElementById(`${prefix}-categoria`).value;
    const descripcio = document.getElementById(`${prefix}-descripcio`).value.trim();
    const contacte = document.getElementById(`${prefix}-contacte`).value.trim();
    const nom = document.getElementById(`${prefix}-nom`).value.trim();
    
    // Validate
    let valid = true;
    clearErrors(form);
    
    if (!que) { markError(`${prefix}-que`); valid = false; }
    if (!data) { markError(`${prefix}-data`); valid = false; }
    if (!categoria) { markError(`${prefix}-categoria`); valid = false; }
    if (!contacte) { markError(`${prefix}-contacte`); valid = false; }
    
    if (!valid) {
        showToast('⚠️ Omple tots els camps obligatoris', 'error');
        return;
    }
    
    // Build item
    const item = {
        que,
        linia: linia || null,
        estacio: estacio || null,
        data,
        hora: hora || null,
        categoria,
        descripcio: descripcio || null,
        contacte,
        nom: nom || 'Anònim',
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        tipus: type
    };
    
    // Save
    saveItem(type === 'trobat' ? 'trobats' : 'perduts', item);
    
    // Reset form
    form.reset();
    setDefaultDates();
    
    // Feedback
    const msg = type === 'trobat' 
        ? '✅ Objecte trobat registrat correctament!' 
        : '✅ Objecte perdut registrat correctament!';
    showToast(msg, 'success');
}

function saveItem(collection, item) {
    if (db && isOnline) {
        db.ref(collection).push(item).catch(err => {
            console.warn('Firebase save failed:', err);
            saveToLocalOnly(collection, item);
        });
    } else {
        saveToLocalOnly(collection, item);
    }
}

function saveToLocalOnly(collection, item) {
    try {
        const items = JSON.parse(localStorage.getItem(STORAGE_KEYS[collection]) || '[]');
        item.id = 'local_' + Date.now();
        items.unshift(item);
        if (items.length > MAX_RECENT_ITEMS) items.pop();
        localStorage.setItem(STORAGE_KEYS[collection], JSON.stringify(items));
        
        // Re-render
        if (collection === 'trobats') renderTrobats(items);
        else if (collection === 'perduts') renderPerduts(items);
    } catch (e) {
        console.error('Local save failed:', e);
    }
}

// ============================================
// RENDER
// ============================================
function renderTrobats(items) {
    const container = document.getElementById('llistaTrobats');
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>📦</span>
                <p>No hi ha objectes trobats registrats</p>
            </div>`;
        return;
    }
    
    container.innerHTML = items.map(item => renderItemCard(item, 'trobat')).join('');
}

function renderPerduts(items) {
    const container = document.getElementById('llistaPerduts');
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>🔎</span>
                <p>No hi ha objectes perduts registrats</p>
            </div>`;
        return;
    }
    
    container.innerHTML = items.map(item => renderItemCard(item, 'perdut')).join('');
}

function renderItemCard(item, type) {
    const emoji = CATEGORY_EMOJIS[item.categoria] || '📦';
    const timeAgo = getTimeAgo(item.timestamp);
    const liniaTag = item.linia ? `<span>🚇 ${item.linia}</span>` : '';
    const estacioTag = item.estacio ? `<span>📍 ${item.estacio}</span>` : '';
    
    return `
        <div class="item-card ${type}-card">
            <div class="item-emoji">${emoji}</div>
            <div class="item-info">
                <div class="item-title">${escapeHtml(item.que)}</div>
                <div class="item-meta">
                    ${liniaTag}
                    ${estacioTag}
                    <span>📅 ${formatDate(item.data)}</span>
                </div>
            </div>
            <div class="item-time">${timeAgo}</div>
        </div>`;
}

function renderMatches(items) {
    const container = document.getElementById('llistaMatches');
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>🤝</span>
                <p>El sistema de match automàtic s'activarà properament.</p>
                <p class="hint">Quan es detectin coincidències entre objectes trobats i perduts, apareixeran aquí.</p>
            </div>`;
        return;
    }
    
    container.innerHTML = items.map(match => renderMatchCard(match)).join('');
    
    // Update badge
    const pendents = items.filter(m => m.status === 'pendent').length;
    const badge = document.getElementById('matchBadge');
    if (pendents > 0) {
        badge.style.display = 'flex';
        badge.textContent = pendents;
    } else {
        badge.style.display = 'none';
    }
}

function renderMatchCard(match) {
    return `
        <div class="match-card" data-status="${match.status || 'pendent'}">
            <div class="match-header">
                <span style="font-size:13px;font-weight:600;">Match #${match.id?.slice(-4) || '----'}</span>
                <span class="match-status ${match.status || 'pendent'}">${getStatusLabel(match.status)}</span>
            </div>
            <div class="match-pair">
                <div class="match-side trobat-side">
                    <div class="side-label">📦 Trobat</div>
                    <div class="side-title">${escapeHtml(match.trobat?.que || '—')}</div>
                    <div style="font-size:11px;color:#666;">${match.trobat?.data || ''}</div>
                </div>
                <div class="match-arrow">⇄</div>
                <div class="match-side perdut-side">
                    <div class="side-label">🔎 Perdut</div>
                    <div class="side-title">${escapeHtml(match.perdut?.que || '—')}</div>
                    <div style="font-size:11px;color:#666;">${match.perdut?.data || ''}</div>
                </div>
            </div>
        </div>`;
}

// ============================================
// MATCH FILTERS
// ============================================
function initMatchFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            const cards = document.querySelectorAll('.match-card');
            
            cards.forEach(card => {
                if (filter === 'tots') {
                    card.style.display = '';
                } else {
                    card.style.display = card.dataset.status === filter ? '' : 'none';
                }
            });
        });
    });
}

// ============================================
// UTILS
// ============================================
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function markError(id) {
    document.getElementById(id).classList.add('error');
}

function clearErrors(form) {
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function getTimeAgo(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return 'Ara';
    if (mins < 60) return `${mins}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return formatDate(new Date(timestamp).toISOString().split('T')[0]);
}

function getStatusLabel(status) {
    switch (status) {
        case 'pendent': return '⏳ Pendent';
        case 'confirmat': return '✅ Confirmat';
        case 'tancat': return '🔒 Tancat';
        default: return '⏳ Pendent';
    }
}

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.className = `toast ${type}`;
    toast.querySelector('.toast-msg').textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
