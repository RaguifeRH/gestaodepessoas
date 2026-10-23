// Pedidos de vaga: o gestor pede pelo link, o RH encaminha ao N2, o N2 aprova pelo link e o RH abre a vaga.
import { STATUS_SOL } from '../config.js?v=13';
import { $, $$, esc, tit, kpis, card, st, fmtData, fmtDataHora, modal, toast, erroAmigavel, confirmar, vazio, norm } from '../ui.js?v=13';
import { carregar, linkPedido, linkN2, linkAcompanhar } from '../selecao.js?v=13';
import { modalVaga, listas } from '../selecao-ui.js?v=13';

let aba = 'abertos', busca = '';
const ABAS = [['abertos', 'Em andamento', s => ['pendente', 'com_n2', 'aprovado_n2'].includes(s.status)], ['aprovado', 'Vaga aberta', s => s.status === 'aprovado'], ['reprovados', 'Reprovados', s => ['reprovado', 'reprovado_n2'].includes(s.status)], ['todos', 'Todos', () => true]];
const copiar = async (t, msg) => { try { await navigator.clipboard.writeText(t); toast(msg); } catch (e) { prompt('Copie o link:', t); } };

export async function render(el, ctx) {
  const sel = await carregar(ctx, true);
  const sol = sel.solicitacoes.slice().sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  const n = k => sol.filter(s => s.status === k).length;
  const filtro = ABAS.find(a => a[0] === aba)[2];
  const lista = sol.filter(filtro).filter(s => !busca || norm([s.codigo, s.cargo, s.setor, s.gestor].join(' ')).includes(norm(busca)));
  const ordem = { pendente: 0, aprovado_n2: 1, com_n2: 2 };
  if (aba === 'abertos') lista.sort((a, b) => (ordem[a.status] - ordem[b.status]) || (a.criadoEm || '').localeCompare(b.criadoEm || ''));

  el.innerHTML = tit('ti-file-plus', 'Pedidos de vaga', 'O gestor pede pelo link, o N2 aprova pelo link e o RH abre a vaga',
    `<button class="btn prim" id="link"><i class="ti ti-link"></i>Copiar link do pedido</button><a class="btn ghost" href="${esc(linkPedido())}" target="_blank" rel="noopener"><i class="ti ti-eye"></i>Ver como o gestor vê</a><button class="btn ghost" id="cfg"><i class="ti ti-settings"></i>Listas</button>`)
    + kpis([['Novos', n('pendente'), 'encaminhar ao N2', n('pendente') ? 'neutro' : 'sobe'], ['Com o N2', n('com_n2'), 'aguardando resposta'], ['N2 aprovou', n('aprovado_n2'), 'abrir a vaga', n('aprovado_n2') ? 'neutro' : 'sobe'], ['Viraram vaga', n('aprovado'), 'desde o início']])
    + `<section class="card"><div class="card-h" style="flex-wrap:wrap;gap:10px"><div class="filtros">${ABAS.map(a => `<button data-a="${a[0]}" class="${a[0] === aba ? 'on' : ''}">${a[1]} (${sol.filter(a[2]).length})</button>`).join('')}</div><label class="busca" style="margin:0 0 0 auto;width:min(280px,100%)"><i class="ti ti-search"></i><input id="q" placeholder="Cargo, setor, gestor ou código" value="${esc(busca)}"></label></div>
      <div class="card-b">${lista.length ? `<div class="tw"><table class="tb"><thead><tr><th>Pedido</th><th>Gestor</th><th>Qtd</th><th>Motivo</th><th>Situação</th><th></th></tr></thead><tbody>${lista.map(s => linha(s)).join('')}</tbody></table></div>` : `<p class="muted" style="margin:6px 0">${aba === 'abertos' ? 'Nenhum pedido em andamento. Envie o link do pedido aos gestores.' : 'Nada aqui.'}</p>`}</div></section>`;

  function linha(s) {
    const [nome, k] = STATUS_SOL[s.status] || [s.status, ''];
    const acao = s.status === 'pendente' ? `<button class="btn sm prim" data-enc="${s.id}">Encaminhar ao N2</button>`
      : s.status === 'com_n2' ? `<button class="btn sm" data-lk="${s.id}"><i class="ti ti-link"></i>Link do N2</button>`
      : s.status === 'aprovado_n2' ? `<button class="btn sm prim" data-abrir="${s.id}">Abrir vaga</button>`
      : s.status === 'aprovado' && s.vagaId ? `<a class="btn sm" href="#/vaga/${esc(s.vagaId)}">${esc(s.vagaCodigo || 'Ver vaga')}</a>` : '';
    return `<tr class="clic" data-ver="${s.id}"><td><b>${esc(s.cargo)}</b><small class="muted" style="display:block">${esc(s.codigo || 'Novo')} · ${esc(s.setor || '')} · ${fmtData((s.criadoEm || '').slice(0, 10))}</small></td>
      <td class="small">${esc(s.gestor || '')}</td><td>${esc(s.qtd || 1)}</td><td class="small">${esc(s.motivo || '')}${s.substituido ? '<br><span class="muted">substitui ' + esc(s.substituido) + '</span>' : ''}</td>
      <td>${k ? st(k, nome) : esc(nome)}${s.status === 'com_n2' && s.n2Nome ? `<small class="muted" style="display:block">${esc(s.n2Nome)}</small>` : ''}</td><td style="text-align:right;white-space:nowrap">${acao}</td></tr>`;
  }

  $$('[data-a]').forEach(b => b.onclick = () => { aba = b.dataset.a; render(el, ctx); });
  $('#q').oninput = e => { busca = e.target.value; clearTimeout(el._t); el._t = setTimeout(() => { render(el, ctx).then(() => { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }); }, 250); };
  $('#link').onclick = () => copiar(linkPedido(), 'Link do pedido copiado. Envie aos gestores.');
  $('#cfg').onclick = () => configurar(ctx, sel).then(m => m && render(el, ctx));
  $$('[data-ver]').forEach(tr => tr.onclick = e => { if (e.target.closest('button,a')) return; detalhe(ctx, sel, sol.find(s => s.id === tr.dataset.ver)).then(m => m && render(el, ctx)); });
  $$('[data-enc]').forEach(b => b.onclick = () => encaminhar(ctx, sel, sol.find(s => s.id === b.dataset.enc)).then(m => m && render(el, ctx)));
  $$('[data-lk]').forEach(b => b.onclick = () => enviarLinkN2(sol.find(s => s.id === b.dataset.lk)));
  $$('[data-abrir]').forEach(b => b.onclick = async () => { const s = sol.find(x => x.id === b.dataset.abrir); const id = await abrirVaga(ctx, sel, s); if (id) location.hash = '#/vaga/' + id; });
}

function abrirVaga(ctx, sel, s) {
  const L = listas(sel);
  const perfil = (L.perfis.find(p => norm(s.cargo).includes(norm(p.nome))) || L.perfis[0]).nome;
  return modalVaga(ctx, sel, { cargo: s.cargo, qtd: s.qtd, setor: s.setor, gestor: s.gestor, empresa: s.empresa, perfil, motivo: s.motivo, substituido: s.substituido, escala: s.escala, requisitos: s.requisitos, obs: s.obs }, { titulo: 'Abrir vaga', solicitacao: s });
}

async function encaminhar(ctx, sel, s) {
  const lista = sel.n2s.slice().sort((a, b) => (a.setor === s.setor ? -1 : 0) - (b.setor === s.setor ? -1 : 0) || a.nome.localeCompare(b.nome));
  const corpo = `<div class="small muted">${esc(s.cargo)} · ${esc(s.setor || '')} · pedido de ${esc(s.gestor || '')}</div>
    ${lista.length ? `<div class="campo"><label for="n2-l">N2</label><select class="inp" id="n2-l"><option value="">Digitar outro…</option>${lista.map((n, i) => `<option value="${i}"${i === 0 ? ' selected' : ''}>${esc(n.nome)}${n.setor ? ' · ' + esc(n.setor) : ''}</option>`).join('')}</select></div>` : ''}
    <div class="linha2"><div class="campo"><label for="n2-nome">Nome do N2</label><input class="inp" id="n2-nome" value="${esc(lista[0]?.nome || '')}"></div><div class="campo"><label for="n2-email">E-mail do N2</label><input class="inp" id="n2-email" type="email" value="${esc(lista[0]?.email || '')}"></div></div>
    <div class="ajuda">Depois de encaminhar, envie o link ao N2 por e-mail ou WhatsApp. Ele aprova ou reprova sem precisar de login.</div><div id="n2-msg"></div>`;
  let ok = false;
  const r = await modal({ titulo: 'Encaminhar ao N2', corpo, botoes: [{ id: 'reprovar', texto: 'Reprovar o pedido', cls: 'ghost' }, { id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Encaminhar', cls: 'prim' }],
    aoAbrir: bg => { const l = $('#n2-l', bg); if (l) l.onchange = () => { const n = lista[+l.value]; $('#n2-nome', bg).value = n ? n.nome : ''; $('#n2-email', bg).value = n ? n.email : ''; }; },
    antesDeFechar: async (b, bg) => {
      if (b === 'reprovar') return true;
      const nome = $('#n2-nome', bg).value.trim(), email = $('#n2-email', bg).value.trim();
      if (!nome) { $('#n2-msg', bg).innerHTML = '<div class="erro-msg">Informe o N2.</div>'; return false; }
      try {
        const ano = new Date().getFullYear(); const codigo = s.codigo || `SOL-${ano}-${String(await ctx.D.proximoCodigo('sol_' + ano)).padStart(3, '0')}`;
        await ctx.D.atualizar('solicitacoes', s.id, { status: 'com_n2', codigo, n2Nome: nome, n2Email: email, historico: [...(s.historico || []), { dt: new Date().toISOString(), acao: 'Encaminhado ao N2 ' + nome, por: ctx.nome() }] });
        s.codigo = codigo; s.n2Nome = nome; s.n2Email = email; ok = true;
      } catch (e) { $('#n2-msg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
    } });
  if (r === 'reprovar') return reprovar(ctx, s);
  if (r === 'ok' && ok) { await carregar(ctx, true); ctx.atualizarContadores(); await enviarLinkN2(s); return true; }
  return false;
}

async function enviarLinkN2(s) {
  const link = linkN2(s.id);
  const assunto = `Aprovação de vaga: ${s.cargo} (${s.codigo || ''})`;
  const texto = `Olá, ${(s.n2Nome || '').split(' ')[0]}!\n\nO gestor ${s.gestor || ''} pediu a abertura de vaga para ${s.cargo} (${s.qtd || 1}) no setor ${s.setor || ''}.\nPara aprovar ou reprovar, acesse:\n${link}\n\nObrigado,\nRH Raguife`;
  const r = await modal({ titulo: 'Enviar o link ao N2', corpo: `<p class="small" style="margin:0 0 8px">O N2 abre o link, vê o pedido e responde. A resposta aparece aqui na hora.</p><div class="campo"><label for="lk-n2">Link</label><input class="inp" id="lk-n2" value="${esc(link)}" readonly></div>`,
    botoes: [{ id: 'email', texto: '<i class="ti ti-mail"></i>Abrir e-mail' }, { id: 'zap', texto: '<i class="ti ti-brand-whatsapp"></i>WhatsApp' }, { id: 'copiar', texto: '<i class="ti ti-copy"></i>Copiar link', cls: 'prim' }] });
  if (r === 'copiar') copiar(link, 'Link do N2 copiado.');
  if (r === 'email') location.href = `mailto:${encodeURIComponent(s.n2Email || '')}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
  if (r === 'zap') window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
}

async function reprovar(ctx, s) {
  let ok = false;
  const r = await modal({ titulo: 'Reprovar o pedido', corpo: `<div class="small muted">${esc(s.cargo)} · pedido de ${esc(s.gestor || '')}</div><div class="campo"><label for="rp-j">Justificativa</label><textarea class="inp" id="rp-j" rows="3" required></textarea></div>`,
    botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Reprovar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => { const j = $('#rp-j', bg).value.trim(); if (!j) return false; try { await ctx.D.atualizar('solicitacoes', s.id, { status: 'reprovado', justReprovacao: j, historico: [...(s.historico || []), { dt: new Date().toISOString(), acao: 'Reprovado pelo RH', obs: j, por: ctx.nome() }] }); ok = true; } catch (e) { toast(erroAmigavel(e), 'erro'); return false; } } });
  if (r === 'ok' && ok) { await carregar(ctx, true); ctx.atualizarContadores(); toast('Pedido reprovado.'); return true; }
  return false;
}

async function detalhe(ctx, sel, s) {
  const [nome, k] = STATUS_SOL[s.status] || [s.status, ''];
  const resp = s.n2Resposta;
  const corpo = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">${k ? st(k, nome) : esc(nome)}<span class="small muted">${esc(s.codigo || 'Sem código ainda')}</span></div>
    <div class="dados" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div><small>Cargo</small><b>${esc(s.cargo)}</b></div><div><small>Quantidade</small><b>${esc(s.qtd || 1)}</b></div>
      <div><small>Setor</small><b>${esc(s.setor || '—')}</b></div><div><small>Empresa</small><b>${esc(s.empresa || '—')}</b></div>
      <div><small>Motivo</small><b>${esc(s.motivo || '—')}${s.substituido ? ' · substitui ' + esc(s.substituido) : ''}</b></div><div><small>Escala</small><b>${esc(s.escala || '—')}</b></div>
      <div><small>Gestor</small><b>${esc(s.gestor || '—')}</b><small>${esc(s.email || '')}</small></div><div><small>N2</small><b>${esc(s.n2Nome || '—')}</b><small>${esc(s.n2Email || '')}</small></div>
    </div>
    ${s.requisitos ? `<div class="campo" style="margin-top:12px"><label>Requisitos</label><div class="small" style="white-space:pre-wrap">${esc(s.requisitos)}</div></div>` : ''}
    ${s.obs ? `<div class="campo"><label>Justificativa do gestor</label><div class="small" style="white-space:pre-wrap">${esc(s.obs)}</div></div>` : ''}
    ${resp ? `<div class="${resp.decisao === 'aprovado' ? 'ok-msg' : 'erro-msg'}" style="margin-top:10px">N2 ${resp.decisao === 'aprovado' ? 'aprovou' : 'reprovou'} em ${fmtDataHora(resp.em)}${resp.obs ? ': ' + esc(resp.obs) : ''}</div>` : ''}
    ${s.justReprovacao ? `<div class="erro-msg" style="margin-top:10px">Reprovado pelo RH: ${esc(s.justReprovacao)}</div>` : ''}
    <h4 class="d" style="font-size:15px;margin:16px 0 6px">Histórico</h4><ul class="tl">${(s.historico || []).slice().reverse().map(h => `<li><b>${esc(h.acao || '')}</b><small>${fmtDataHora(h.dt)}${h.por ? ' · ' + esc(h.por) : ''}</small>${h.obs ? `<div class="small">${esc(h.obs)}</div>` : ''}</li>`).join('')}</ul>`;
  const botoes = [{ id: 'acomp', texto: '<i class="ti ti-link"></i>Link de acompanhamento do gestor' }];
  if (s.status === 'pendente') botoes.push({ id: 'enc', texto: 'Encaminhar ao N2', cls: 'prim' });
  if (s.status === 'com_n2') botoes.push({ id: 'lk', texto: 'Enviar link ao N2', cls: 'prim' });
  if (['pendente', 'com_n2', 'aprovado_n2'].includes(s.status)) botoes.unshift({ id: 'rep', texto: 'Reprovar', cls: 'ghost' });
  if (['aprovado_n2', 'com_n2', 'pendente'].includes(s.status)) botoes.push({ id: 'abrir', texto: s.status === 'aprovado_n2' ? 'Abrir vaga' : 'Abrir vaga sem esperar o N2', cls: s.status === 'aprovado_n2' ? 'prim' : '' });
  const r = await modal({ titulo: 'Pedido de vaga', corpo, larga: true, botoes });
  if (r === 'acomp') { copiar(linkAcompanhar(s.id), 'Link copiado. Com ele o gestor acompanha o pedido.'); return false; }
  if (r === 'enc') return encaminhar(ctx, sel, s);
  if (r === 'lk') { enviarLinkN2(s); return false; }
  if (r === 'rep') return reprovar(ctx, s);
  if (r === 'abrir') { if (s.status !== 'aprovado_n2' && !(await confirmar('Abrir sem o N2', 'O N2 ainda não respondeu. Abrir a vaga mesmo assim? Fica registrado no histórico do pedido.', 'Abrir vaga'))) return false; const id = await abrirVaga(ctx, sel, s); if (id) location.hash = '#/vaga/' + id; return !!id; }
  return false;
}

// Listas usadas no pedido do gestor e no encaminhamento ao N2.
async function configurar(ctx, sel) {
  const L = listas(sel);
  const corpo = `<p class="small muted" style="margin:0 0 6px">Uma por linha. Setores, escalas e empresas aparecem no formulário do gestor.</p>
    <div class="linha2"><div class="campo"><label for="cf-set">Setores</label><textarea class="inp" id="cf-set" rows="8">${esc(L.setores.join('\n'))}</textarea></div>
      <div class="campo"><label for="cf-esc">Escalas</label><textarea class="inp" id="cf-esc" rows="8">${esc(L.escalas.join('\n'))}</textarea></div></div>
    <div class="campo"><label for="cf-emp">Empresas</label><textarea class="inp" id="cf-emp" rows="4">${esc(L.empresas.join('\n'))}</textarea></div>
    <div class="campo"><label for="cf-per">Perfis da vaga e prazo em dias (Nome; dias)</label><textarea class="inp" id="cf-per" rows="5">${esc(L.perfis.map(p => p.nome + '; ' + p.sla).join('\n'))}</textarea></div>
    <div class="campo"><label for="cf-n2">N2 (Nome; e-mail; setor)</label><textarea class="inp" id="cf-n2" rows="6">${esc(sel.n2s.map(n => [n.nome, n.email, n.setor].join('; ')).join('\n'))}</textarea><span class="ajuda">Os e-mails dos N2 não aparecem para os gestores.</span></div><div id="cf-msg"></div>`;
  const r = await modal({ titulo: 'Listas do R&S', corpo, larga: true, botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => {
      const linhas = id => $(id, bg).value.split('\n').map(x => x.trim()).filter(Boolean);
      const perfis = linhas('#cf-per').map(l => { const [n, d] = l.split(';').map(x => x.trim()); return { nome: n, sla: Math.max(1, parseInt(d, 10) || 15) }; });
      const n2s = linhas('#cf-n2').map(l => { const [nome, email, setor] = l.split(';').map(x => (x || '').trim()); return { nome, email: email || '', setor: setor || '' }; });
      try { await ctx.D.salvarConfig('selecao', { setores: linhas('#cf-set'), escalas: linhas('#cf-esc'), empresas: linhas('#cf-emp'), perfis }); await ctx.D.salvarConfig('selecao_n2', { lista: n2s }); }
      catch (e) { $('#cf-msg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
    } });
  if (r === 'ok') { await carregar(ctx, true); toast('Listas salvas.'); return true; }
  return false;
}
