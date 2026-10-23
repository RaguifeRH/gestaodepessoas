// ============================================================================
// Páginas públicas (sem login de usuário): pedido de vaga do gestor e resposta do N2.
// Entram com uma sessão anônima do Firebase; as regras só deixam criar o pedido
// e responder ao pedido que está com o N2.
// ============================================================================
import { D } from './dados.js?v=7';
import { MOTIVOS_VAGA, EMPRESAS_PADRAO, STATUS_SOL } from './config.js?v=7';
import { $, esc, fmtDataHora, st, erroAmigavel } from './ui.js?v=7';

const pagina = document.body.dataset.pagina;
const params = new URLSearchParams(location.search);
const id = params.get('s');
const caixa = $('#pub');
const demo = params.has('demo');
const urlCom = (arq, s) => arq + '?s=' + encodeURIComponent(s) + (demo ? '&demo' : '');

function tela(titulo, sub, corpo) {
  caixa.innerHTML = `<div class="pc"><img src="img/raguife-logo-branco.png" alt="Raguife"><h2 class="d">${esc(titulo)}</h2>${sub ? `<p>${sub}</p>` : ''}</div><div class="pub-c">${corpo}</div>`;
  document.title = titulo + ' — Raguife';
}
const erro = (t, e) => tela(t, '', `<div class="erro-msg">${esc(e ? erroAmigavel(e) : '')}</div><p class="small muted">Se o problema continuar, fale com o RH.</p>`);
const opts = (l, v) => l.map(x => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');

async function iniciar() {
  try { await D.entrarAnonimo(); } catch (e) { return erro('Não foi possível conectar', e); }
  if (pagina === 'pedido') return id ? acompanhar() : formPedido();
  if (pagina === 'n2') return id ? respostaN2() : tela('Link incompleto', '', '<p>Este link não tem o código do pedido. Peça ao RH para enviar de novo.</p>');
}

// ---------------------------------------------------------------------------
// Gestor: formulário do pedido
// ---------------------------------------------------------------------------
async function formPedido() {
  const cfg = (await D.lerConfig('selecao').catch(() => null)) || {};
  const setores = (cfg.setores || []).slice().sort((a, b) => a.localeCompare(b, 'pt-BR')), escalas = cfg.escalas || [], empresas = cfg.empresas && cfg.empresas.length ? cfg.empresas : EMPRESAS_PADRAO;
  let rasc = {}; try { rasc = JSON.parse(localStorage.getItem('gp-pedido-gestor') || '{}'); } catch (e) {}
  tela('Pedido de abertura de vaga', 'Preencha e o pedido segue para o RH e para a aprovação do N2.', `<form id="f" novalidate>
    <div class="linha2"><div class="campo"><label for="p-gestor">Seu nome completo *</label><input class="inp" id="p-gestor" required autocomplete="name" value="${esc(rasc.gestor || '')}"></div>
      <div class="campo"><label for="p-email">Seu e-mail *</label><input class="inp" id="p-email" type="email" required autocomplete="email" value="${esc(rasc.email || '')}"></div></div>
    <div class="campo"><label for="p-emp">Empresa *</label><select class="inp" id="p-emp">${opts(empresas, rasc.empresa || empresas[0])}</select></div>
    <div class="linha2"><div class="campo"><label for="p-setor">Setor *</label>${setores.length ? `<select class="inp" id="p-setor"><option value="">Escolha</option>${opts(setores, rasc.setor)}</select>` : `<input class="inp" id="p-setor" value="${esc(rasc.setor || '')}">`}</div>
      <div class="campo"><label for="p-cargo">Cargo *</label><input class="inp" id="p-cargo" required></div></div>
    <div class="linha2"><div class="campo"><label for="p-mot">Motivo *</label><select class="inp" id="p-mot">${opts(MOTIVOS_VAGA, 'Substituição')}</select></div>
      <div class="campo"><label for="p-qtd">Quantidade *</label><input class="inp" id="p-qtd" type="number" min="1" max="50" value="1"></div></div>
    <div class="campo" id="p-sub-c"><label for="p-sub">Quem vai ser substituído?</label><input class="inp" id="p-sub" placeholder="Nome do colaborador"></div>
    <div class="campo"><label for="p-esc">Escala / horário *</label>${escalas.length ? `<select class="inp" id="p-esc">${opts(escalas.concat(['Outra']), escalas[0])}</select><input class="inp" id="p-esc2" placeholder="Descreva a escala" hidden style="margin-top:6px">` : '<input class="inp" id="p-esc" placeholder="Ex.: 6x1, 07h às 15h20">'}</div>
    <div class="campo"><label for="p-req">Requisitos da vaga</label><textarea class="inp" id="p-req" rows="3" placeholder="Escolaridade, experiência, CNH, cursos…"></textarea></div>
    <div class="campo"><label for="p-obs">Justificativa / observações</label><textarea class="inp" id="p-obs" rows="3"></textarea></div>
    <div id="p-msg"></div>
    <button class="btn prim" type="submit" style="justify-content:center;padding:12px"><i class="ti ti-send"></i>Enviar pedido</button></form>`);
  const sub = () => { $('#p-sub-c').hidden = !['Substituição', 'Reposição'].includes($('#p-mot').value); };
  $('#p-mot').onchange = sub; sub();
  if ($('#p-esc2')) $('#p-esc').onchange = e => { $('#p-esc2').hidden = e.target.value !== 'Outra'; };
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const v = s => ($(s) ? $(s).value.trim() : '');
    const escala = v('#p-esc') === 'Outra' ? v('#p-esc2') : v('#p-esc');
    const falta = [['#p-gestor', 'seu nome'], ['#p-email', 'seu e-mail'], ['#p-setor', 'o setor'], ['#p-cargo', 'o cargo']].filter(([s]) => !v(s)).map(x => x[1]);
    if (!escala) falta.push('a escala');
    if (falta.length) { $('#p-msg').innerHTML = `<div class="erro-msg">Falta preencher: ${falta.join(', ')}.</div>`; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('#p-email'))) { $('#p-msg').innerHTML = '<div class="erro-msg">Confira o e-mail.</div>'; return; }
    const b = e.submitter || $('#f .btn.prim'); b.disabled = true; b.textContent = 'Enviando…';
    const agora = new Date().toISOString();
    const dados = { gestor: v('#p-gestor'), email: v('#p-email').toLowerCase(), empresa: v('#p-emp'), setor: v('#p-setor'), cargo: v('#p-cargo'), motivo: v('#p-mot'), qtd: Math.max(1, Math.min(50, +v('#p-qtd') || 1)),
      substituido: $('#p-sub-c').hidden ? '' : v('#p-sub'), escala, requisitos: v('#p-req'), obs: v('#p-obs'), status: 'pendente', criadoEm: agora,
      historico: [{ dt: agora, acao: 'Pedido enviado pelo gestor', por: v('#p-gestor') }] };
    try {
      const novo = await D.criarPublico('solicitacoes', dados);
      try { localStorage.setItem('gp-pedido-gestor', JSON.stringify({ gestor: dados.gestor, email: dados.email, empresa: dados.empresa, setor: dados.setor })); } catch (e2) {}
      const link = location.origin + location.pathname.replace(/[^/]*$/, '') + urlCom('pedido.html', novo);
      tela('Pedido enviado', 'O RH recebeu e vai encaminhar ao N2.', `<div class="ok-msg"><b>${esc(dados.cargo)}</b> · ${dados.qtd} vaga${dados.qtd > 1 ? 's' : ''} · ${esc(dados.setor)}</div>
        <p class="small" style="margin:0">Guarde este link para acompanhar o pedido:</p><div style="display:flex;gap:8px"><input class="inp" id="lk" value="${esc(link)}" readonly><button class="btn" id="cp" type="button"><i class="ti ti-copy"></i>Copiar</button></div>
        <a class="btn" href="${esc(link)}" style="justify-content:center"><i class="ti ti-eye"></i>Acompanhar agora</a><a class="btn ghost" href="${esc(location.pathname + (demo ? '?demo' : ''))}" style="justify-content:center">Fazer outro pedido</a>`);
      $('#cp').onclick = async () => { try { await navigator.clipboard.writeText(link); $('#cp').innerHTML = '<i class="ti ti-check"></i>Copiado'; } catch (e3) { $('#lk').select(); } };
    } catch (err) { $('#p-msg').innerHTML = `<div class="erro-msg">${esc(erroAmigavel(err))}</div>`; b.disabled = false; b.innerHTML = '<i class="ti ti-send"></i>Enviar pedido'; }
  };
}

// Gestor: acompanhar o pedido pelo link
async function acompanhar() {
  let s; try { s = await D.ler('solicitacoes', id); } catch (e) { return erro('Não foi possível abrir o pedido', e); }
  if (!s) return tela('Pedido não encontrado', '', '<p>Confira o link. Se precisar, fale com o RH.</p>');
  const [nome, k] = STATUS_SOL[s.status] || [s.status, 'pend'];
  const passos = [['Pedido enviado', true], ['Com o N2', ['com_n2', 'aprovado_n2', 'reprovado_n2', 'aprovado'].includes(s.status)], ['N2 respondeu', ['aprovado_n2', 'reprovado_n2', 'aprovado'].includes(s.status)], ['Vaga aberta pelo RH', s.status === 'aprovado']];
  tela(s.cargo, `${esc(s.codigo || 'Pedido')} · ${esc(s.setor || '')} · ${s.qtd || 1} vaga${(s.qtd || 1) > 1 ? 's' : ''}`, `<div>${k ? st(k, nome) : esc(nome)}</div>
    <ol class="pub-passos">${passos.map(p => `<li class="${p[1] ? 'ok' : ''}"><span>${p[1] ? '<i class="ti ti-check"></i>' : ''}</span>${p[0]}</li>`).join('')}</ol>
    ${s.status === 'aprovado' && s.vagaCodigo ? `<div class="ok-msg">Vaga ${esc(s.vagaCodigo)} aberta. O RH já está no processo seletivo.</div>` : ''}
    ${s.status === 'reprovado_n2' || s.status === 'reprovado' ? `<div class="erro-msg">Pedido não aprovado${s.n2Resposta && s.n2Resposta.obs ? ': ' + esc(s.n2Resposta.obs) : s.justReprovacao ? ': ' + esc(s.justReprovacao) : '.'}</div>` : ''}
    <ul class="tl">${(s.historico || []).slice().reverse().map(h => `<li><b>${esc(h.acao || '')}</b><small>${fmtDataHora(h.dt)}</small></li>`).join('')}</ul>`);
}

// ---------------------------------------------------------------------------
// N2: aprovar ou reprovar
// ---------------------------------------------------------------------------
async function respostaN2() {
  let s; try { s = await D.ler('solicitacoes', id); } catch (e) { return erro('Não foi possível abrir o pedido', e); }
  if (!s) return tela('Pedido não encontrado', '', '<p>Confira o link. Se precisar, fale com o RH.</p>');
  const sub = `Pedido de ${esc(s.gestor || '')} em ${fmtDataHora(s.criadoEm)}`;
  const dados = `<div class="dados" style="grid-template-columns:1fr 1fr"><div><small>Quantidade</small><b>${s.qtd || 1} vaga${(s.qtd || 1) > 1 ? 's' : ''}</b></div><div><small>Motivo</small><b>${esc(s.motivo || '—')}</b></div><div><small>Setor</small><b>${esc(s.setor || '—')}</b></div><div><small>Escala</small><b>${esc(s.escala || '—')}</b></div>${s.substituido ? `<div><small>Substitui</small><b>${esc(s.substituido)}</b></div>` : ''}<div><small>Empresa</small><b>${esc(s.empresa || '—')}</b></div></div>
    ${s.requisitos ? `<div class="campo"><label>Requisitos</label><div class="small" style="white-space:pre-wrap">${esc(s.requisitos)}</div></div>` : ''}${s.obs ? `<div class="campo"><label>Justificativa do gestor</label><div class="small" style="white-space:pre-wrap">${esc(s.obs)}</div></div>` : ''}`;
  if (s.status !== 'com_n2') {
    const r = s.n2Resposta;
    return tela(`${s.codigo || ''} · ${s.cargo}`, sub, dados + (r ? `<div class="${r.decisao === 'aprovado' ? 'ok-msg' : 'erro-msg'}">Você ${r.decisao === 'aprovado' ? 'aprovou' : 'reprovou'} em ${fmtDataHora(r.em)}${r.obs ? ': ' + esc(r.obs) : ''}. Obrigado!</div>` : `<div class="ok-msg">Este pedido não está aguardando sua resposta (${esc((STATUS_SOL[s.status] || [s.status])[0])}).</div>`));
  }
  tela(`${s.codigo || ''} · ${s.cargo}`, sub, `${dados}<div class="campo"><label for="n-obs">Observação (obrigatória para reprovar)</label><textarea class="inp" id="n-obs" rows="3"></textarea></div><div id="n-msg"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="n-rep" style="flex:1;justify-content:center;padding:12px;color:var(--verm)"><i class="ti ti-x"></i>Reprovar</button><button class="btn prim" id="n-ok" style="flex:1;justify-content:center;padding:12px"><i class="ti ti-check"></i>Aprovar</button></div>`);
  const responder = async decisao => {
    const obs = $('#n-obs').value.trim();
    if (decisao === 'reprovado' && !obs) { $('#n-msg').innerHTML = '<div class="erro-msg">Escreva o motivo da reprovação.</div>'; $('#n-obs').focus(); return; }
    $('#n-ok').disabled = $('#n-rep').disabled = true;
    const agora = new Date().toISOString();
    try {
      await D.atualizarPublico('solicitacoes', id, { status: decisao === 'aprovado' ? 'aprovado_n2' : 'reprovado_n2', n2Resposta: { decisao, em: agora, obs },
        historico: [...(s.historico || []), { dt: agora, acao: decisao === 'aprovado' ? 'N2 aprovou' : 'N2 reprovou', por: s.n2Nome || 'N2', ...(obs ? { obs } : {}) }] });
      respostaN2();
    } catch (e) { $('#n-msg').innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; $('#n-ok').disabled = $('#n-rep').disabled = false; }
  };
  $('#n-ok').onclick = () => responder('aprovado');
  $('#n-rep').onclick = () => responder('reprovado');
}

iniciar();
