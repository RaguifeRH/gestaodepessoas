// ============================================================================
// Componentes de interface compartilhados
// ============================================================================

export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

// Escapa texto vindo do banco antes de pôr no HTML.
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const iniciais = n => { const p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
export const capitalizar = n => String(n || '').toLowerCase().replace(/(^|\s|-|\()([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, m => m.toLowerCase());

// Datas: guardamos aaaa-mm-dd; mostramos dd/mm/aaaa.
export const fmtData = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
export const fmtDataHora = iso => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
export const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const somarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
export const fmtNum = n => (n ?? 0).toLocaleString('pt-BR');
export const fmtPct = (n, casas = 1) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%';
export const fmtReais = n => n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Os quatro estados do sistema (vocabulário fixo).
const ESTADOS = { pend: ['Pendente', 'ti-clock'], hoje: ['Hoje', 'ti-calendar-event'], atr: ['Atrasado', 'ti-alert-triangle'], ok: ['Concluído', 'ti-check'] };
export const st = (k, rotulo) => { const e = ESTADOS[k]; return `<span class="st ${k}"><i class="ti ${e[1]}"></i>${esc(rotulo || e[0])}</span>`; };
export const pill = (t, c) => `<span class="pill ${c || ''}">${esc(t)}</span>`;

export function tit(ic, titulo, sub, acoes) {
  return `<div class="titulo-pg"><div class="tt"><span class="tic"><i class="ti ${ic}"></i></span><div><h1 class="d">${esc(titulo)}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>${acoes ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${acoes}</div>` : ''}</div>`;
}
export const kpis = l => `<div class="kpis">${l.map(k => `<div class="card kpi"><small>${esc(k[0])}</small><b>${k[1]}</b><span class="var ${k[3] || 'neutro'}">${k[2] || ''}</span></div>`).join('')}</div>`;
export const card = (t, corpo, extra, cls) => `<section class="card ${cls || ''}"><div class="card-h"><h3 class="d">${esc(t)}</h3>${extra || ''}</div><div class="card-b">${corpo}</div></section>`;
export const pes = (n, s) => `<div class="pes"><span class="av">${esc(iniciais(n))}</span><div><b>${esc(n)}</b>${s ? `<small>${esc(s)}</small>` : ''}</div></div>`;
export const vazio = (ic, t, p, acao) => `<section class="card vazio"><span class="ic"><i class="ti ${ic}"></i></span><h2 class="d">${esc(t)}</h2><p>${p}</p>${acao || ''}</section>`;
export const carregando = () => `<div class="card" style="padding:20px">${[1, 2, 3, 4, 5].map(() => '<div class="esq-l" style="height:18px;margin:12px 0"></div>').join('')}</div>`;
export const hbar = (l, max) => l.map(x => `<div class="barra-h"><span>${esc(x[0])}</span><span class="bh"><i style="width:${max ? Math.max(1, x[1] / max * 100) : 0}%"></i></span><b>${x[2] ?? fmtNum(x[1])}</b></div>`).join('');

// Gráfico de barras em SVG, com linha de meta opcional.
export function barras(rot, series, opc = {}) {
  const W = 640, H = opc.alt || 220, pl = 34, pb = 26, n = rot.length, bw = (W - pl) / n, k = series.length, w = bw * .62 / k;
  const bruto = opc.max || Math.max(1, ...series.flatMap(s => s.v), opc.meta || 0) * 1.1;
  const passo = (() => { const p = Math.pow(10, Math.floor(Math.log10(bruto / 4))), r = bruto / 4 / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p; })();
  const max = passo * 4; // eixo com números redondos, para as linhas de grade baterem com os valores
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(opc.rotulo || 'Gráfico')}">`;
  for (let i = 0; i <= 4; i++) { const v = max / 4 * i, y = H - pb - (v / max) * (H - pb - 10); s += `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="#e3e9e3"/><text x="${pl - 6}" y="${y + 4}" font-size="10.5" fill="#86978b" text-anchor="end">${String(+v.toFixed(2)).replace('.', ',')}</text>`; }
  rot.forEach((m, i) => { series.forEach((se, j) => { const h = (se.v[i] / max) * (H - pb - 10), x = pl + i * bw + bw * .19 + j * (w + 2); s += `<rect x="${x}" y="${H - pb - h}" width="${w}" height="${h}" rx="3" fill="${se.c}"><title>${esc(m)} · ${esc(se.n)}: ${se.v[i]}</title></rect>`; if (opc.valores) s += `<text x="${x + w / 2}" y="${H - pb - h - 6}" font-size="12" font-weight="600" fill="#1d2b22" text-anchor="middle">${esc(opc.valores(se.v[i]))}</text>`; }); s += `<text x="${pl + i * bw + bw / 2}" y="${H - 8}" font-size="11" fill="#55635a" text-anchor="middle">${esc(m)}</text>`; });
  if (opc.meta) { const y = H - pb - (opc.meta / max) * (H - pb - 10); s += `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="#b3372f" stroke-width="2" stroke-dasharray="6 5"/><text x="${W - 4}" y="${y - 6}" font-size="11" font-weight="600" fill="#b3372f" text-anchor="end">${esc(opc.metaTxt || 'Meta')}</text>`; }
  return s + '</svg>';
}
export const legenda = series => `<div class="leg">${series.map(s => `<span><i style="background:${s.c}"></i>${esc(s.n)}</span>`).join('')}</div>`;

// Aviso rápido.
export function toast(m, tipo) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = m; t.style.background = tipo === 'erro' ? 'var(--verm)' : ''; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 3200);
}

// Janela modal. corpo: HTML; botoes: [{id, texto, cls}]. Resolve com o id do botão (ou null).
export function modal({ titulo, corpo, botoes = [], larga, aoAbrir, antesDeFechar }) {
  return new Promise(ok => {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal${larga ? ' larga' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="modal-h"><h3 class="d">${esc(titulo)}</h3><button class="ico-btn x" data-b="__x" aria-label="Fechar"><i class="ti ti-x"></i></button></div><div class="modal-c">${corpo}</div>${botoes.length ? `<div class="modal-r">${botoes.map(b => `<button class="btn ${b.cls || ''}" data-b="${b.id}">${b.texto}</button>`).join('')}</div>` : ''}</div>`;
    const fechar = async id => { if (antesDeFechar && id && id !== '__x' && id !== 'cancelar') { const pode = await antesDeFechar(id, bg); if (pode === false) return; } bg.remove(); document.removeEventListener('keydown', tecla); ok(id === '__x' ? null : id); };
    const tecla = e => { if (e.key === 'Escape') fechar(null); };
    bg.addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (b) fechar(b.dataset.b); else if (e.target === bg) fechar(null); });
    document.addEventListener('keydown', tecla);
    document.body.appendChild(bg);
    const f = bg.querySelector('input,select,textarea'); if (f) f.focus();
    aoAbrir && aoAbrir(bg);
  });
}
export const confirmar = (titulo, texto, sim = 'Confirmar') => modal({ titulo, corpo: `<p style="margin:0">${texto}</p>`, botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'sim', texto: sim, cls: 'prim' }] }).then(r => r === 'sim');

// Mensagens de erro do Firebase em português.
export function erroAmigavel(e) {
  const c = (e && e.code) || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'E-mail ou senha incorretos.';
  if (c.includes('too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (c.includes('email-already-in-use')) return 'Este e-mail já tem conta. Use "Esqueci minha senha" ou peça ao administrador.';
  if (c.includes('weak-password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (c.includes('invalid-email')) return 'E-mail em formato inválido.';
  if (c.includes('network') || c.includes('unavailable')) return 'Sem conexão com o servidor. Verifique a internet.';
  if (c.includes('permission-denied') || c.includes('unauthorized')) return 'Você não tem permissão para isso. Peça ao administrador.';
  return (e && e.message) || 'Algo deu errado. Tente de novo.';
}
