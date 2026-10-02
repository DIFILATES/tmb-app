/* ============================================
   TMB Objectes Perduts - App Logic (JSON/CLI Version)
   ============================================ */

const DB_URL = 'data/db.json';

// Category emoji map
const CATEGORY_EMOJIS = {
    mobil: '📱', cartera: '👛', claus: '🔑', roba: '🧥', bossa: '👜',
    auriculars: '🎧', paraigua: '☂️', joguina: '🧸', llibre: '📚', altres: '📦'
};

// State
let appData = { trobats: [], perduts: [], matches: [] };

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initForms();
    initMatchFilters();
    setDefaultDates();
    initModals();
    loadData();
});

// ============================================
// DATA LOADING
// ============================================
async function loadData() {
    updateBadge('Carregant...', false);
    try {
        // Add timestamp to prevent caching
        const response = await fetch(`${DB_URL}?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        appData = await response.json();
        
        renderTrobats(appData.trobats);
        renderPerduts(appData.perduts);
        renderMatches(appData.matches);
        
        const date = new Date(appData.meta.lastUpdated);
        updateBadge(`Actualitzat: ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`, true);
    } catch (error) {
        console.error('Error loading data:', error);
        updateBadge('Error de connexió', false, true);
        
        document.getElementById('llistaTrobats').innerHTML = '<div class="empty-state"><p>No s\'han pogut carregar les dades.</p></div>';
        document.getElementById('llistaPerduts').innerHTML = '<div class="empty-state"><p>No s\'han pogut carregar les dades.</p></div>';
        document.getElementById('llistaMatches').innerHTML = '<div class="empty-state"><p>No s\'han pogut carregar les dades.</p></div>';
    }
}

function updateBadge(text, isOk, isError = false) {
    const badge = document.getElementById('dataBadge');
    const dot = badge.querySelector('.badge-dot');
    badge.querySelector('.badge-text').textContent = text;
    
    dot.className = 'badge-dot';
    if (isOk) dot.classList.add('ok');
    if (isError) dot.classList.add('err');
}

// ============================================
// NAVIGATION
// ============================================
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.dataset.tab;
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// ============================================
// FORMS & MODAL
// ============================================
let currentCommand = '';

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

    // Generate gh workflow command
    currentCommand = `gh workflow run afegir-objecte.yml -f tipus="${type}" -f que="${que.replace(/"/g, '\\"')}" -f categoria="${categoria}" -f linia="${linia}" -f estacio="${estacio}" -f data_objecte="${data}" -f hora="${hora}" -f descripcio="${descripcio.replace(/"/g, '\\"')}" -f contacte="${contacte}" -f nom="${nom}"`;
    
    // Show Modal
    const preview = document.getElementById('sharePreview');
    preview.textContent = currentCommand;
    document.getElementById('shareModal').classList.add('show');
    
    // Reset
    form.reset();
    setDefaultDates();
}

function initModals() {
    const modal = document.getElementById('shareModal');
    
    document.getElementById('modalClose').addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    document.getElementById('btnCopy').addEventListener('click', () => {
        navigator.clipboard.writeText(currentCommand).then(() => {
            showToast('📋 Comanda copiada!', 'success');
        });
    });
    
    document.getElementById('btnWhatsapp').addEventListener('click', () => {
        const text = encodeURIComponent(`Hola! Per afegir l'objecte a la base de dades, executa aquesta comanda a la terminal:\n\n${currentCommand}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    });
    
    document.getElementById('btnEmail').addEventListener('click', () => {
        const body = encodeURIComponent(`Hola,\n\nPer afegir l'objecte a la base de dades de TMB, executa aquesta comanda a la terminal on tinguis configurat gh:\n\n${currentCommand}`);
        window.open(`mailto:?subject=Nou report objecte TMB&body=${body}`, '_blank');
    });
}

// ============================================
// RENDER
// ============================================
function renderTrobats(items) {
    const container = document.getElementById('llistaTrobats');
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="empty-state"><span>📦</span><p>No hi ha objectes trobats</p></div>`;
        return;
    }
    container.innerHTML = items.map(item => renderItemCard(item, 'trobat')).join('');
}

function renderPerduts(items) {
    const container = document.getElementById('llistaPerduts');
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="empty-state"><span>🔎</span><p>No hi ha objectes perduts</p></div>`;
        return;
    }
    container.innerHTML = items.map(item => renderItemCard(item, 'perdut')).join('');
}

function renderItemCard(item, type) {
    const emoji = CATEGORY_EMOJIS[item.categoria] || '📦';
    const liniaTag = item.linia ? `<span class="linia-tag linia-${item.linia}">${item.linia}</span>` : '';
    const estacioTag = item.estacio ? `<span>📍 ${escapeHtml(item.estacio)}</span>` : '';
    const statusClass = item.status === 'disponible' ? 'status-disponible' : item.status === 'actiu' ? 'status-actiu' : 'status-retornat';
    
    return `
        <div class="item-card ${type}-card">
            <div class="item-emoji">${emoji}</div>
            <div class="item-info">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div class="item-title">${escapeHtml(item.que)}</div>
                    <span style="font-size:10px; color:#999; margin-left:8px;">${item.id}</span>
                </div>
                ${item.descripcio ? `<div class="item-desc">${escapeHtml(item.descripcio)}</div>` : ''}
                <div class="item-meta">
                    ${liniaTag}
                    ${estacioTag}
                    <span>📅 ${formatDate(item.data)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                     <div class="item-status ${statusClass}">${item.status.toUpperCase()}</div>
                     <div style="font-size:10px; color:#888;">${escapeHtml(item.nom)}</div>
                </div>
            </div>
        </div>`;
}

function renderMatches(items) {
    const container = document.getElementById('llistaMatches');
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="empty-state"><span>🤝</span><p>No hi ha matches actualment</p></div>`;
        return;
    }
    
    container.innerHTML = items.map(match => {
        const trobat = appData.trobats.find(t => t.id === match.trobatId) || {que: 'Desconegut'};
        const perdut = appData.perduts.find(p => p.id === match.perdutId) || {que: 'Desconegut'};
        
        return `
        <div class="match-card" data-status="${match.status}">
            <div class="match-header">
                <span class="match-id">Match ${match.id}</span>
                <span class="match-status ${match.status}">${getStatusLabel(match.status)}</span>
            </div>
            <div class="match-pair">
                <div class="match-side trobat-side">
                    <div class="side-label">📦 Trobat (${match.trobatId})</div>
                    <div class="side-title">${escapeHtml(trobat.que)}</div>
                    <div class="side-detail">${trobat.data || ''} ${trobat.linia ? '- ' + trobat.linia : ''}</div>
                </div>
                <div class="match-arrow">⇄</div>
                <div class="match-side perdut-side">
                    <div class="side-label">🔎 Perdut (${match.perdutId})</div>
                    <div class="side-title">${escapeHtml(perdut.que)}</div>
                    <div class="side-detail">${perdut.data || ''} ${perdut.linia ? '- ' + perdut.linia : ''}</div>
                </div>
            </div>
            ${match.notes ? `<div class="match-notes"><strong>Notes:</strong> ${escapeHtml(match.notes)}</div>` : ''}
        </div>`;
    }).join('');
    
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
                if (filter === 'tots') card.style.display = '';
                else card.style.display = card.dataset.status === filter ? '' : 'none';
            });
        });
    });
}

// ============================================
// UTILS
// ============================================
function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
function markError(id) { document.getElementById(id).classList.add('error'); }
function clearErrors(form) { form.querySelectorAll('.error').forEach(el => el.classList.remove('error')); }
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
function getStatusLabel(status) {
    switch (status) {
        case 'pendent': return '⏳ Pendent';
        case 'confirmat': return '✅ Confirmat';
        case 'tancat': return '🔒 Tancat';
        default: return status;
    }
}
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.className = `toast ${type}`;
    toast.querySelector('.toast-msg').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
