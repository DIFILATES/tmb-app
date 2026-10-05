/* ============================================
   TMB Objectes Perduts - Supabase Edition
   Dades compartides en temps real, sense backend propi.
   ============================================ */

// ── Config Supabase ──────────────────────────
const SUPABASE_URL  = 'https://bpjtsafvcsyvyawcwagk.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwanRzYWZ2Y3N5dnlhd2N3YWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDE4NzYsImV4cCI6MjEwNjUxNzg3Nn0.90jCz90edhGdi2RG2ZcGtTEIS4BFUlDMbUm2jEz7GvY';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Emoji map ────────────────────────────────
const CAT_EMOJI = {
    mobil:'📱', cartera:'👛', claus:'🔑', roba:'🧥', bossa:'👜',
    auriculars:'🎧', paraigua:'☂️', joguina:'🧸', llibre:'📚', altres:'📦'
};

// ── State ────────────────────────────────────
let allTrobats = [];
let allPerduts = [];
let allMatches = [];

// ── Init ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initForms();
    initMatchFilters();
    setDefaultDates();
    loadAll();
    subscribeRealtime();
});

// ============================================
// DATA – LOAD
// ============================================
async function loadAll() {
    badge('Carregant...', 'loading');
    try {
        const [tRes, pRes, mRes] = await Promise.all([
            sb.from('objectes').select('*').eq('tipus','trobat').order('created_at',{ascending:false}),
            sb.from('objectes').select('*').eq('tipus','perdut').order('created_at',{ascending:false}),
            sb.from('matches').select('*').order('created_at',{ascending:false})
        ]);
        if (tRes.error) throw tRes.error;
        if (pRes.error) throw pRes.error;
        if (mRes.error) throw mRes.error;

        allTrobats = tRes.data;
        allPerduts = pRes.data;
        allMatches = mRes.data;

        renderTrobats();
        renderPerduts();
        renderMatches();
        badge('En línia', 'ok');
    } catch (err) {
        console.error(err);
        badge('Error de connexió', 'err');
        el('llistaTrobats').innerHTML = emptyHTML('⚠️','No s\'han pogut carregar les dades');
        el('llistaPerduts').innerHTML = emptyHTML('⚠️','No s\'han pogut carregar les dades');
        el('llistaMatches').innerHTML = emptyHTML('⚠️','No s\'han pogut carregar les dades');
    }
}

// ============================================
// DATA – REALTIME
// ============================================
function subscribeRealtime() {
    sb.channel('public-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'objectes'}, () => loadAll())
      .on('postgres_changes', {event:'*', schema:'public', table:'matches'},  () => loadAll())
      .subscribe();
}

// ============================================
// DATA – INSERT
// ============================================
async function insertObjecte(tipus, formData) {
    const row = {
        tipus,
        que:          formData.que,
        categoria:    formData.categoria,
        linia:        formData.linia || null,
        estacio:      formData.estacio || null,
        data_objecte: formData.data || null,
        hora:         formData.hora || null,
        descripcio:   formData.descripcio || null,
        contacte:     formData.contacte,
        nom:          formData.nom || 'Anònim',
        status:       tipus === 'trobat' ? 'disponible' : 'actiu'
    };
    const { data, error } = await sb.from('objectes').insert([row]).select();
    if (error) throw error;
    return data[0];
}

// ============================================
// NAVIGATION
// ============================================
function initNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            el(btn.dataset.tab).classList.add('active');
            window.scrollTo({top:0, behavior:'smooth'});
        });
    });
}

// ============================================
// FORMS
// ============================================
function initForms() {
    el('formTrobat').addEventListener('submit', e => { e.preventDefault(); submitForm('trobat'); });
    el('formPerdut').addEventListener('submit', e => { e.preventDefault(); submitForm('perdut'); });
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    el('trobat-data').value = today;
    el('perdut-data').value = today;
}

async function submitForm(tipus) {
    const p = tipus;
    const form = el(`form${cap(tipus)}`);

    // Collect
    const formData = {
        que:        val(`${p}-que`),
        linia:      val(`${p}-linia`),
        estacio:    val(`${p}-estacio`),
        data:       val(`${p}-data`),
        hora:       val(`${p}-hora`),
        categoria:  val(`${p}-categoria`),
        descripcio: val(`${p}-descripcio`),
        contacte:   val(`${p}-contacte`),
        nom:        val(`${p}-nom`)
    };

    // Validate
    clearErrors(form);
    let ok = true;
    if (!formData.que)       { markErr(`${p}-que`); ok = false; }
    if (!formData.data)      { markErr(`${p}-data`); ok = false; }
    if (!formData.categoria) { markErr(`${p}-categoria`); ok = false; }
    if (!formData.contacte)  { markErr(`${p}-contacte`); ok = false; }
    if (!ok) { toast('⚠️ Omple els camps obligatoris','error'); return; }

    // Submit button loading
    const btn = form.querySelector('.btn-submit');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto;"></div>';

    try {
        await insertObjecte(tipus, formData);
        form.reset();
        setDefaultDates();
        toast(tipus === 'trobat'
            ? '✅ Objecte trobat registrat correctament!'
            : '✅ Objecte perdut registrat correctament!', 'success');
        await loadAll();
    } catch (err) {
        console.error(err);
        toast('❌ Error al desar. Torna-ho a provar.','error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
}

// ============================================
// RENDER – TROBATS / PERDUTS
// ============================================
function renderTrobats() {
    const c = el('llistaTrobats');
    if (!allTrobats.length) { c.innerHTML = emptyHTML('📦','No hi ha objectes trobats'); return; }
    c.innerHTML = allTrobats.map(i => itemCard(i,'trobat')).join('');
}

function renderPerduts() {
    const c = el('llistaPerduts');
    if (!allPerduts.length) { c.innerHTML = emptyHTML('🔎','No hi ha objectes perduts'); return; }
    c.innerHTML = allPerduts.map(i => itemCard(i,'perdut')).join('');
}

function itemCard(item, tipus) {
    const emoji = CAT_EMOJI[item.categoria] || '📦';
    const lTag  = item.linia ? `<span class="linia-tag linia-${item.linia}">${esc(item.linia)}</span>` : '';
    const eTag  = item.estacio ? `<span>📍 ${esc(item.estacio)}</span>` : '';
    const sClass = item.status === 'disponible' ? 'status-disponible'
                 : item.status === 'actiu'      ? 'status-actiu'
                 : 'status-retornat';

    return `
    <div class="item-card ${tipus}-card">
        <div class="item-emoji">${emoji}</div>
        <div class="item-info">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div class="item-title">${esc(item.que)}</div>
                <span style="font-size:10px;color:#aaa;margin-left:6px;flex-shrink:0">#${item.id}</span>
            </div>
            ${item.descripcio ? `<div class="item-desc">${esc(item.descripcio)}</div>` : ''}
            <div class="item-meta">${lTag}${eTag}<span>📅 ${fmtDate(item.data_objecte)}</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
                <span class="item-status ${sClass}">${item.status.toUpperCase()}</span>
                <span style="font-size:10px;color:#999">${esc(item.nom)}</span>
            </div>
        </div>
    </div>`;
}

// ============================================
// RENDER – MATCHES
// ============================================
function renderMatches() {
    const c = el('llistaMatches');
    if (!allMatches.length) {
        c.innerHTML = emptyHTML('🤝','No hi ha matches encara');
        el('matchBadge').style.display = 'none';
        return;
    }

    c.innerHTML = allMatches.map(m => {
        const t = allTrobats.find(x => x.id === m.trobat_id) || {que:'—'};
        const p = allPerduts.find(x => x.id === m.perdut_id) || {que:'—'};
        const sLabel = m.status==='pendent'?'⏳ Pendent':m.status==='confirmat'?'✅ Confirmat':'🔒 Tancat';

        return `
        <div class="match-card" data-status="${m.status}">
            <div class="match-header">
                <span class="match-id">Match #${m.id}</span>
                <span class="match-status ${m.status}">${sLabel}</span>
            </div>
            <div class="match-pair">
                <div class="match-side trobat-side">
                    <div class="side-label">📦 Trobat #${m.trobat_id}</div>
                    <div class="side-title">${esc(t.que)}</div>
                    <div class="side-detail">${fmtDate(t.data_objecte)} ${t.linia?'· '+t.linia:''}</div>
                </div>
                <div class="match-arrow">⇄</div>
                <div class="match-side perdut-side">
                    <div class="side-label">🔎 Perdut #${m.perdut_id}</div>
                    <div class="side-title">${esc(p.que)}</div>
                    <div class="side-detail">${fmtDate(p.data_objecte)} ${p.linia?'· '+p.linia:''}</div>
                </div>
            </div>
            ${m.notes?`<div class="match-notes"><strong>Notes:</strong> ${esc(m.notes)}</div>`:''}
        </div>`;
    }).join('');

    const pendents = allMatches.filter(m => m.status === 'pendent').length;
    const badge = el('matchBadge');
    badge.style.display = pendents > 0 ? 'flex' : 'none';
    badge.textContent = pendents;
}

// ============================================
// MATCH FILTERS
// ============================================
function initMatchFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const f = btn.dataset.filter;
            document.querySelectorAll('.match-card').forEach(c => {
                c.style.display = (f === 'tots' || c.dataset.status === f) ? '' : 'none';
            });
        });
    });
}

// ============================================
// UTILS
// ============================================
function el(id)   { return document.getElementById(id); }
function val(id)  { return el(id).value.trim(); }
function cap(s)   { return s[0].toUpperCase()+s.slice(1); }
function markErr(id) { el(id).classList.add('error'); }
function clearErrors(form) { form.querySelectorAll('.error').forEach(e => e.classList.remove('error')); }

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function fmtDate(d) {
    if (!d) return '';
    const [y,m,day] = d.split('-');
    return `${day}/${m}/${y}`;
}

function badge(text, state) {
    const b = el('dataBadge');
    b.querySelector('.badge-text').textContent = text;
    const dot = b.querySelector('.badge-dot');
    dot.className = 'badge-dot';
    if (state === 'ok')  dot.classList.add('ok');
    if (state === 'err') dot.classList.add('err');
}

function emptyHTML(icon, msg) {
    return `<div class="empty-state"><span>${icon}</span><p>${msg}</p></div>`;
}

function toast(msg, type) {
    const t = el('toast');
    t.className = `toast ${type||''}`;
    t.querySelector('.toast-msg').textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}
