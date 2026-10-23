// ============================================================================
// Gestão de Pessoas — Raguife · casca do sistema
// Login, primeiro acesso, menu por permissão, rotas, busca rápida e pendências.
// ============================================================================
import { D } from './dados.js?v=13';
import { MODULOS, MODULOS_ADMIN, ADMIN_INICIAL, DEMO } from './config.js?v=13';
import { $, $$, esc, iniciais, norm, toast, erroAmigavel, st, fmtData } from './ui.js?v=13';
import { pendenciasExperiencia, aniversariantes } from './pendencias.js?v=13';
import { carregar as carregarSelecao, pendenciasSelecao } from './selecao.js?v=13';

const ctx = {
  D, perfil: null, uid: null,
  _sel: null,
  pode(m) { const p = this.perfil; return !!p && p.ativo !== false && (p.perfil === 'admin' || m === 'guia' || (p.modulos || []).includes(m)); },
  admin() { return this.perfil && this.perfil.perfil === 'admin'; },
  nome() { return (this.perfil && this.perfil.nome) || ''; },
  _resumo: null,
  async resumo(forcar) { if (!this._resumo || forcar) { this._resumo = (await D.resumo()) || { itens: [] }; } return this._resumo; },
  _inicioExp: null,
  async inicioExp(forcar) { if (this._inicioExp === null || forcar) { const c = await D.lerConfig('experiencia').catch(() => null); this._inicioExp = (c && c.inicio) || new Date().toISOString().slice(0, 10); } return this._inicioExp; },
  _exp: null,
  async experiencias(forcar) { if (!this._exp || forcar) this._exp = await D.experiencias(); return this._exp; },
  atualizarMenu: () => montarMenu(),
};
window.__ctx = ctx; // ajuda a depurar pelo console

// ---------------------------------------------------------------------------
// Telas de entrada
// ---------------------------------------------------------------------------
function mostrar(qual) {
  $('#carregando').hidden = qual !== 'carregando';
  $('#login').hidden = qual !== 'login';
  $('#app').hidden = qual !== 'app';
}

async function telaLogin(msg) {
  mostrar('login');
  let configurado = true;
  try { configurado = await D.sistemaConfigurado(); } catch (e) { /* sem conexão: segue para o login */ }
  $('#lg-caixa').innerHTML = `
    <form id="f-login" style="display:grid;gap:16px">
      <img src="img/raguife-logo.png" alt="" style="height:40px;justify-self:start">
      <div><h2 class="d" style="font-size:30px;font-weight:850">Entrar</h2><p class="muted" style="margin:4px 0 0">Use o e-mail da empresa.</p></div>
      ${msg ? `<div class="${msg.ok ? 'ok-msg' : 'erro-msg'}">${esc(msg.t)}</div>` : ''}
      <div class="campo"><label for="lg-email">E-mail</label><input class="inp" id="lg-email" type="email" autocomplete="username" required></div>
      <div class="campo"><label for="lg-senha">Senha</label><input class="inp" id="lg-senha" type="password" autocomplete="current-password" required></div>
      <button type="button" class="esq" id="lg-esqueci" style="justify-self:end;font-size:13px;font-weight:600;color:var(--verde);background:none;border:0;cursor:pointer">Esqueci minha senha</button>
      <button class="btn prim" type="submit" style="justify-content:center;padding:12px">Entrar</button>
      ${!configurado ? `<button type="button" class="btn" id="lg-primeiro" style="justify-content:center">Primeiro acesso do administrador</button>` : ''}
      ${DEMO ? '<div class="lg-nota">Modo demonstração: qualquer e-mail e senha entram. Os dados são fictícios.</div>' : ''}
    </form>`;
  $('#f-login').onsubmit = async e => {
    e.preventDefault();
    const b = e.submitter || $('#f-login .btn.prim'); b.disabled = true; b.textContent = 'Entrando…';
    try { await D.entrar($('#lg-email').value.trim().toLowerCase(), $('#lg-senha').value); }
    catch (err) { telaLogin({ t: erroAmigavel(err) }); }
  };
  $('#lg-esqueci').onclick = async () => {
    const email = $('#lg-email').value.trim().toLowerCase();
    if (!email) return telaLogin({ t: 'Digite seu e-mail no campo acima e clique de novo em "Esqueci minha senha".' });
    try { await D.redefinirSenha(email); telaLogin({ ok: true, t: 'Se este e-mail tiver conta, um link para criar nova senha foi enviado. Confira também o spam.' }); }
    catch (err) { telaLogin({ t: erroAmigavel(err) }); }
  };
  const p = $('#lg-primeiro'); if (p) p.onclick = telaPrimeiroAcesso;
}

function telaPrimeiroAcesso(msg) {
  mostrar('login');
  $('#lg-caixa').innerHTML = `
    <form id="f-pa" style="display:grid;gap:16px">
      <div><h2 class="d" style="font-size:28px;font-weight:850">Primeiro acesso</h2><p class="muted" style="margin:4px 0 0">Cria a conta do administrador. Só funciona uma vez e só para ${esc(ADMIN_INICIAL)}.</p></div>
      ${msg ? `<div class="erro-msg">${esc(msg)}</div>` : ''}
      <div class="campo"><label for="pa-nome">Nome completo</label><input class="inp" id="pa-nome" required autocomplete="name"></div>
      <div class="campo"><label for="pa-email">E-mail</label><input class="inp" id="pa-email" type="email" value="${esc(ADMIN_INICIAL)}" readonly></div>
      <div class="campo"><label for="pa-senha">Crie uma senha</label><input class="inp" id="pa-senha" type="password" minlength="8" required autocomplete="new-password"><span class="ajuda">Mínimo de 8 caracteres.</span></div>
      <button class="btn prim" type="submit" style="justify-content:center;padding:12px">Criar administrador</button>
      <button type="button" class="btn ghost" id="pa-voltar" style="justify-content:center">Voltar</button>
    </form>`;
  $('#pa-voltar').onclick = () => telaLogin();
  $('#f-pa').onsubmit = async e => {
    e.preventDefault();
    const nome = $('#pa-nome').value.trim(), senha = $('#pa-senha').value;
    if (senha.length < 8) return telaPrimeiroAcesso('A senha precisa ter pelo menos 8 caracteres.');
    sessionStorage.setItem('gp-pa-nome', nome);
    try { await D.criarMinhaConta(ADMIN_INICIAL, senha); }
    catch (err) {
      if ((err.code || '').includes('email-already-in-use')) {
        try { await D.entrar(ADMIN_INICIAL, senha); return; } catch (e2) { return telaPrimeiroAcesso('Esta conta já existe e a senha não confere. Use "Esqueci minha senha" na tela de login.'); }
      }
      telaPrimeiroAcesso(erroAmigavel(err));
    }
  };
}

function telaSemAcesso(texto) {
  mostrar('login');
  $('#lg-caixa').innerHTML = `<div style="display:grid;gap:16px"><h2 class="d" style="font-size:26px;font-weight:850">Conta sem acesso</h2><p class="muted" style="margin:0">${texto}</p><button class="btn" id="sa-sair" style="justify-content:center">Sair</button></div>`;
  $('#sa-sair').onclick = () => D.sair();
}

// ---------------------------------------------------------------------------
// Login e perfil
// ---------------------------------------------------------------------------
D.aoMudarLogin(async u => {
  if (!u) { ctx.perfil = null; ctx._resumo = null; ctx._exp = null; ctx._sel = null; return telaLogin(); }
  if (u.anonimo) { D.sair(); return; } // sessão anônima do pedido de vaga/N2 neste navegador: não serve para o sistema
  mostrar('carregando');
  ctx.uid = u.uid;
  try {
    let perfil = await D.meuPerfil();
    if (!perfil && (u.email || '').toLowerCase() === ADMIN_INICIAL && !(await D.sistemaConfigurado())) {
      const nome = sessionStorage.getItem('gp-pa-nome') || 'Administrador';
      await D.configurarPrimeiroAdmin(nome);
      perfil = await D.meuPerfil();
      toast('Administrador criado. Bem-vindo!');
    }
    if (!perfil) return telaSemAcesso('Sua conta existe, mas ainda não foi liberada. Peça ao administrador do RH para cadastrar seus acessos.');
    if (perfil.ativo === false) return telaSemAcesso('Seu acesso foi desativado. Fale com o administrador do RH.');
    ctx.perfil = perfil;
    iniciarApp();
  } catch (err) { telaSemAcesso('Não foi possível carregar seu perfil. ' + esc(erroAmigavel(err))); }
});

// ---------------------------------------------------------------------------
// Casca
// ---------------------------------------------------------------------------
let iniciado = false;
function iniciarApp() {
  mostrar('app');
  const p = ctx.perfil;
  $('#eu-av').textContent = iniciais(p.nome); $('#eu-nome').textContent = p.nome; $('#eu-perfil').textContent = p.perfil === 'admin' ? 'Administrador' : 'Usuário';
  if (!iniciado) {
    iniciado = true;
    $('#sair').onclick = () => D.sair();
    $('#abrir-menu').onclick = () => document.body.classList.toggle('menu-aberto');
    $('#busca-topo').onclick = abrirBusca;
    $('#sino').onclick = abrirPendencias;
    window.addEventListener('hashchange', e => { const h = (e.oldURL.split('#')[1] || ''); if (h && !h.startsWith('/pessoa/') && !h.startsWith('/vaga/')) window.__gpAnterior = '#' + h; rotear(); });
    document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !$('#app').hidden) { e.preventDefault(); abrirBusca(); } });
    if (DEMO) { const f = document.createElement('div'); f.className = 'demo-faixa'; f.textContent = 'Modo demonstração · dados fictícios'; document.body.appendChild(f); }
  }
  rotear();
  atualizarContadores();
}

function rotasDisponiveis() {
  const r = [{ id: 'inicio', nome: 'Início', grupo: null, ic: 'ti-home' }];
  MODULOS.filter(m => m.grupo && ctx.pode(m.perm || m.id)).forEach(m => r.push(m));
  if (ctx.admin()) MODULOS_ADMIN.forEach(m => r.push(m));
  return r;
}

let FECHADOS = {}; try { FECHADOS = JSON.parse(localStorage.getItem('gp-menu') || '{}'); } catch (e) {}
let CONTADORES = {};
function montarMenu() {
  const atual = (location.hash.slice(2).split('/')[0]) || 'inicio';
  const ativo = ({ pessoa: 'pessoas', vaga: 'vagas' })[atual] || atual;
  const rotas = rotasDisponiveis(); const grupos = [];
  rotas.forEach(r => { let g = grupos.find(x => x.g === r.grupo); if (!g) grupos.push(g = { g: r.grupo, itens: [] }); g.itens.push(r); });
  let h = '<button class="atalho-k" id="ir-para"><i class="ti ti-search"></i>Ir para…<kbd>Ctrl K</kbd></button>';
  grupos.forEach(g => {
    const link = r => { const c = CONTADORES[r.id]; return `<a href="#/${r.id}" class="${r.id === ativo ? 'on' : ''}"${r.id === ativo ? ' aria-current="page"' : ''}><i class="ti ${r.ic}"></i>${esc(r.nome)}${c ? `<span class="cnt ${c.atr ? 'atr' : ''}" title="${c.n} pendência(s)">${c.n}</span>` : ''}</a>`; };
    if (!g.g) { h += g.itens.map(link).join(''); return; }
    const tem = g.itens.some(r => r.id === ativo), fechado = FECHADOS[g.g] && !tem;
    h += `<button class="grupo${fechado ? ' fechado' : ''}" data-g="${esc(g.g)}" aria-expanded="${!fechado}">${esc(g.g)}<i class="ti ti-chevron-down"></i></button><div class="gcorpo${fechado ? ' fechado' : ''}">${g.itens.map(link).join('')}</div>`;
  });
  $('#menu').innerHTML = h;
  $('#ir-para').onclick = abrirBusca;
  $$('#menu .grupo').forEach(b => b.onclick = () => { FECHADOS[b.dataset.g] = !FECHADOS[b.dataset.g]; try { localStorage.setItem('gp-menu', JSON.stringify(FECHADOS)); } catch (e) {} montarMenu(); });
}

async function atualizarContadores() {
  try {
    CONTADORES = {};
    if (ctx.pode('experiencia')) {
      const r = await ctx.resumo(), ex = await ctx.experiencias();
      const p = pendenciasExperiencia(r.itens, ex, await ctx.inicioExp());
      if (p.length) CONTADORES.experiencia = { n: p.length, atr: p.some(x => x.estado === 'atr') };
    }
    if (ctx.pode('selecao')) {
      pendenciasSelecao(await carregarSelecao(ctx)).filter(x => !x.naoConta).forEach(x => { const c = CONTADORES[x.id] = CONTADORES[x.id] || { n: 0, atr: false }; c.n += x.n; c.atr = c.atr || x.estado === 'atr'; });
    }
    montarMenu();
    const total = Object.values(CONTADORES).reduce((s, c) => s + c.n, 0);
    const sino = $('#sino'); sino.querySelector('.dot')?.remove(); if (total) sino.insertAdjacentHTML('beforeend', '<span class="dot"></span>');
  } catch (e) { montarMenu(); }
}
ctx.atualizarContadores = atualizarContadores;

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
const TELAS = { inicio: 'inicio', pessoas: 'pessoas', pessoa: 'pessoa', experiencia: 'experiencia', painel_rh: 'painel', importar: 'importar', usuarios: 'usuarios',
  solicitacoes: 'solicitacoes', vagas: 'vagas', vaga: 'vaga', curriculos: 'curriculos', agenda: 'agenda', migracao: 'migracao', admissao: 'admissao', rescisao: 'rescisao', movimentacoes: 'movimentacoes', salarios: 'salarios', equipe: 'equipe', guia: 'guia' };
const MAE = { pessoa: 'pessoas', vaga: 'vagas' }; // telas de detalhe herdam a permissão e o menu da lista
let rotaAtual = 0;
async function rotear() {
  if (!ctx.perfil) return;
  const partes = location.hash.slice(2).split('/'); const rota = partes[0] || 'inicio', param = decodeURIComponent(partes[1] || ''), param2 = decodeURIComponent(partes[2] || '');
  document.body.classList.remove('menu-aberto');
  montarMenu();
  const info = [...MODULOS, ...MODULOS_ADMIN, { id: 'inicio', nome: 'Início' }].find(r => r.id === (MAE[rota] || rota));
  $('#migalha').innerHTML = info ? (info.grupo ? esc(info.grupo) + ' / ' : '') + '<b>' + esc(rota === 'pessoa' ? 'Pasta da pessoa' : rota === 'vaga' ? 'Vaga' : info.nome) + '</b>' : '<b>Gestão de Pessoas</b>';
  const el = $('#conteudo'); const n = ++rotaAtual;
  const acc = { experiencia: 'verde', pessoas: 'verde', pessoa: 'verde', painel_rh: 'verde', importar: 'verde', usuarios: 'verde' }[rota] || 'verde';
  el.setAttribute('data-acc', acc);
  const permitido = rota === 'inicio' || ((rota === 'usuarios' || rota === 'migracao') ? ctx.admin() : info ? ctx.pode(info.perm || info.id) : false);
  if (!TELAS[rota]) { el.innerHTML = `<section class="card vazio"><span class="ic"><i class="ti ti-map-off"></i></span><h2 class="d">Página não encontrada</h2><p>O endereço pode ter mudado.</p><a class="btn" href="#/inicio"><i class="ti ti-arrow-left"></i>Voltar ao início</a></section>`; return; }
  if (!permitido) { el.innerHTML = `<section class="card vazio"><span class="ic" style="background:var(--verm-bg);color:var(--verm)"><i class="ti ti-lock"></i></span><h2 class="d">Você não tem acesso a esta tela</h2><p>Peça ao administrador do RH para liberar o módulo no seu usuário.</p><a class="btn" href="#/inicio"><i class="ti ti-arrow-left"></i>Voltar ao início</a></section>`; return; }
  el.innerHTML = '<div class="card" style="padding:20px">' + [1, 2, 3, 4].map(() => '<div class="esq-l" style="height:18px;margin:12px 0"></div>').join('') + '</div>';
  try {
    const mod = await import(`./modulos/${TELAS[rota]}.js?v=13`);
    if (n !== rotaAtual) return;
    await mod.render(el, ctx, param, param2);
    document.title = (info ? info.nome + ' — ' : '') + 'Gestão de Pessoas';
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    if (n !== rotaAtual) return;
    el.innerHTML = `<div class="faixa-erro"><i class="ti ti-wifi-off" style="font-size:22px"></i><div>Não foi possível carregar esta tela. <span>${esc(erroAmigavel(err))}</span></div><button class="btn sm" id="tentar">Tentar de novo</button></div>`;
    $('#tentar').onclick = rotear;
  }
}

// ---------------------------------------------------------------------------
// Busca rápida (Ctrl+K)
// ---------------------------------------------------------------------------
async function abrirBusca() {
  if ($('.cmdk-bg')) return;
  const bg = document.createElement('div'); bg.className = 'cmdk-bg';
  bg.innerHTML = '<div class="cmdk" role="dialog" aria-label="Busca rápida"><div class="cmdk-in"><i class="ti ti-search"></i><input id="cmdk-q" placeholder="Nome, matrícula, CPF ou módulo…" autocomplete="off"></div><div class="cmdk-lista" id="cmdk-l"></div><div class="cmdk-rod"><span>↑↓ escolher</span><span>Enter abrir</span><span>Esc fechar</span></div></div>';
  const fechar = () => bg.remove();
  bg.addEventListener('click', e => { if (e.target === bg) fechar(); });
  document.body.appendChild(bg);
  const q = $('#cmdk-q'); q.focus();
  const itens = ctx.pode('pessoas') ? (await ctx.resumo()).itens : [];
  const cands = ctx.pode('selecao') ? (await carregarSelecao(ctx).catch(() => ({ candidatos: [] }))).candidatos : [];
  let sel = 0, res = [];
  const listar = () => {
    const t = norm(q.value.trim()), dig = q.value.replace(/\D/g, '');
    const mods = rotasDisponiveis().filter(r => !t || norm(r.nome).includes(t)).map(r => ({ tipo: 'm', r }));
    let pes = [];
    if (t.length >= 2 || dig.length >= 3) pes = itens.filter(x => norm(x.n).includes(t) || (dig && (x.m === dig || x.cm.replace(/\D/g, '').includes(dig)))).slice(0, 8).map(x => ({ tipo: 'p', x }));
    const cs = t.length >= 2 ? cands.filter(c => norm(c.nome).includes(t)).slice(0, 6).map(c => ({ tipo: 'c', c })) : [];
    res = [...pes, ...cs, ...mods];
    $('#cmdk-l').innerHTML = (pes.length ? '<div class="cmdk-sec">Pessoas</div>' : '') + pes.map((p, i) => `<div class="cmdk-it" data-i="${i}"><span class="av">${esc(iniciais(p.x.n))}</span><div><b>${esc(p.x.n)}</b><small>${esc(p.x.c)} · ${esc(p.x.f)} · matrícula ${esc(p.x.m)}</small></div></div>`).join('')
      + (cs.length ? '<div class="cmdk-sec">Candidatos</div>' : '') + cs.map((c, i) => `<div class="cmdk-it" data-i="${pes.length + i}"><span class="av">${esc(iniciais(c.c.nome))}</span><div><b>${esc(c.c.nome)}</b><small>${esc(c.c.vagaCodigo ? c.c.vagaCodigo + ' · ' + (c.c.vagaCargo || '') : 'Banco de currículos')}</small></div></div>`).join('')
      + (mods.length ? '<div class="cmdk-sec">Módulos</div>' : '') + mods.map((m, i) => `<div class="cmdk-it" data-i="${pes.length + cs.length + i}"><span class="ic"><i class="ti ${m.r.ic}"></i></span><div><b>${esc(m.r.nome)}</b><small>${esc(m.r.grupo || 'Início')}</small></div></div>`).join('')
      || '<div class="cmdk-sec">Nada encontrado.</div>';
    sel = Math.min(sel, res.length - 1); marcar();
  };
  const marcar = () => $$('.cmdk-it').forEach((x, i) => { x.classList.toggle('sel', i === sel); if (i === sel) x.scrollIntoView({ block: 'nearest' }); });
  const abrir = i => { const r = res[i]; if (!r) return; fechar(); location.hash = r.tipo === 'p' ? '#/pessoa/' + r.x.i : r.tipo === 'c' ? (r.c.vagaId ? '#/vaga/' + r.c.vagaId + '/' + r.c.id : '#/curriculos/c/' + r.c.id) : '#/' + r.r.id; };
  $('#cmdk-l').addEventListener('click', e => { const it = e.target.closest('.cmdk-it'); if (it) abrir(+it.dataset.i); });
  q.addEventListener('input', () => { sel = 0; listar(); });
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, res.length - 1); marcar(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); marcar(); }
    else if (e.key === 'Enter') { e.preventDefault(); abrir(sel); }
    else if (e.key === 'Escape') fechar();
  });
  listar();
}

// ---------------------------------------------------------------------------
// Sino: pendências do usuário
// ---------------------------------------------------------------------------
async function abrirPendencias() {
  if ($('.gaveta')) return;
  const bg = document.createElement('div'); bg.className = 'gaveta-bg';
  const g = document.createElement('aside'); g.className = 'gaveta'; g.setAttribute('aria-label', 'Pendências');
  const fechar = () => { bg.remove(); g.remove(); document.removeEventListener('keydown', esc1); };
  const esc1 = e => { if (e.key === 'Escape') fechar(); };
  bg.onclick = fechar; document.addEventListener('keydown', esc1);
  g.innerHTML = '<div class="gaveta-h"><h3 class="d">Pendências</h3><button class="ico-btn" aria-label="Fechar" id="g-x"><i class="ti ti-x"></i></button></div><div class="gaveta-c" id="g-c"><div class="esq-l" style="height:60px;margin:10px"></div></div>';
  document.body.append(bg, g); $('#g-x').onclick = fechar;
  let h = '';
  try {
    if (ctx.pode('experiencia')) {
      const r = await ctx.resumo(), ex = await ctx.experiencias();
      const p = pendenciasExperiencia(r.itens, ex, await ctx.inicioExp());
      h += '<div class="cmdk-sec">Experiência</div>' + (p.length ? p.slice(0, 30).map(x => `<a class="aviso" href="#/experiencia"><span class="ic" style="background:${x.estado === 'atr' ? 'var(--verm-bg)' : 'var(--ceu-bg)'};color:${x.estado === 'atr' ? 'var(--verm)' : 'var(--ceu-tx)'}"><i class="ti ti-hourglass"></i></span><span><b>${esc(x.pessoa.n)}: ${esc(x.marco.nome.toLowerCase())}</b><small>${st(x.estado)} venceu em ${fmtData(x.data)}</small></span></a>`).join('') : '<p class="small muted" style="padding:0 10px">Nada pendente.</p>');
    }
    if (ctx.pode('selecao')) {
      const p = pendenciasSelecao(await carregarSelecao(ctx));
      h += '<div class="cmdk-sec">Vagas e seleção</div>' + (p.length ? p.map(x => `<a class="aviso" href="${x.link}"><span class="ic" style="background:${x.estado === 'atr' ? 'var(--verm-bg)' : 'var(--ceu-bg)'};color:${x.estado === 'atr' ? 'var(--verm)' : 'var(--ceu-tx)'}"><i class="ti ${x.ic}"></i></span><span><b>${esc(x.titulo)}</b><small>${esc(x.sub || '')}</small></span></a>`).join('') : '<p class="small muted" style="padding:0 10px">Nada pendente.</p>');
    }
    if (ctx.pode('pessoas')) {
      const r = await ctx.resumo(); const an = aniversariantes(r.itens, 1);
      if (an.length) h += '<div class="cmdk-sec">Aniversariantes de hoje</div>' + an.map(a => `<a class="aviso" href="#/pessoa/${a.pessoa.i}"><span class="ic" style="background:var(--sol-bg);color:var(--sol-tx)"><i class="ti ti-cake"></i></span><span><b>${esc(a.pessoa.n)}</b><small>${esc(a.pessoa.c)} · ${esc(a.pessoa.f)}</small></span></a>`).join('');
    }
  } catch (e) { h = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; }
  $('#g-c').innerHTML = h || '<p class="small muted" style="padding:10px">Nenhuma pendência para você agora.</p>';
  $$('#g-c a').forEach(a => a.addEventListener('click', fechar));
}

if (!D) mostrar('carregando');
