// Banco de currículos: quem não está em andamento numa vaga (cadastrados, reprovados e desistentes).
import { $, $$, esc, iniciais, tit, kpis, st, pill, fmtData, norm } from '../ui.js?v=7';
import { carregar, retornoPendente, etapa } from '../selecao.js?v=7';
import { novoCandidato, fichaCandidato, levarParaVaga, registrarRetorno } from '../selecao-ui.js?v=7';

const F = { q: '', area: '', sit: '', n: 60 };

export async function render(el, ctx, p1, p2) {
  if (p1 === 'retorno') { F.sit = 'retorno'; history.replaceState(null, '', '#/curriculos'); }
  const sel = await carregar(ctx);
  const todos = sel.candidatos.filter(c => c.situacao !== 'andamento' && c.situacao !== 'contratado')
    .sort((a, b) => (ultima(b)).localeCompare(ultima(a)));
  const areas = [...new Set(todos.map(c => (c.area || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const t = norm(F.q);
  const lista = todos.filter(c => (!F.area || c.area === F.area)
    && (!F.sit || (F.sit === 'retorno' ? retornoPendente(c) : c.situacao === F.sit))
    && (!t || norm([c.nome, c.area, c.cidade, c.vagaCargo, c.vagaCodigo, c.obs, c.motivo, c.tel].join(' ')).includes(t)));
  const nRet = todos.filter(retornoPendente).length;

  el.innerHTML = tit('ti-id-badge-2', 'Banco de currículos', `${todos.length} pessoas guardadas, com ou sem vaga aberta`, '<button class="btn prim" id="novo"><i class="ti ti-plus"></i>Cadastrar currículo</button>')
    + kpis([['No banco', todos.filter(c => c.situacao === 'banco').length, 'cadastrados sem vaga'], ['Reprovados', todos.filter(c => c.situacao === 'reprovado').length, 'ficam para outras vagas'], ['Desistentes', todos.filter(c => c.situacao === 'desistiu').length, ''], ['Retornos pendentes', nRet, 'sem resposta ao candidato', nRet ? 'desce' : 'sobe']])
    + `<div class="busca-g" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px"><label class="busca" style="flex:1;min-width:220px;margin:0"><i class="ti ti-search"></i><input id="q" placeholder="Nome, área, cidade, cargo ou observação" value="${esc(F.q)}"></label>
      <select class="inp" id="f-area" style="width:auto"><option value="">Todas as áreas</option>${areas.map(a => `<option${a === F.area ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select>
      <select class="inp" id="f-sit" style="width:auto">${[['', 'Qualquer situação'], ['banco', 'No banco (sem vaga)'], ['reprovado', 'Reprovados'], ['desistiu', 'Desistentes'], ['retorno', 'Retorno pendente']].map(([k, n]) => `<option value="${k}"${k === F.sit ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
    <section class="card"><div class="card-b">${lista.length ? `<div class="small muted" style="margin-bottom:4px">${lista.length} pessoa${lista.length === 1 ? '' : 's'}</div>` + lista.slice(0, F.n).map(item).join('') + (lista.length > F.n ? `<div class="mais"><button class="btn" id="mais">Mostrar mais ${Math.min(60, lista.length - F.n)}</button></div>` : '') : '<p class="muted" style="margin:6px 0">Ninguém com esses filtros.</p>'}</div></section>`;

  const recarregar = () => render(el, ctx);
  $('#novo').onclick = async () => { if (await novoCandidato(ctx, sel)) recarregar(); };
  $('#q').oninput = e => { F.q = e.target.value; F.n = 60; clearTimeout(el._t); el._t = setTimeout(() => render(el, ctx).then(() => { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }), 250); };
  $('#f-area').onchange = e => { F.area = e.target.value; F.n = 60; recarregar(); };
  $('#f-sit').onchange = e => { F.sit = e.target.value; F.n = 60; recarregar(); };
  if ($('#mais')) $('#mais').onclick = () => { F.n += 60; recarregar(); };
  $$('[data-c]').forEach(x => x.onclick = e => { if (e.target.closest('button')) return; fichaCandidato(ctx, x.dataset.c, recarregar); });
  $$('[data-levar]').forEach(b => b.onclick = async () => { if (await levarParaVaga(ctx, sel, sel.candidatos.find(c => c.id === b.dataset.levar))) recarregar(); });
  $$('[data-ret]').forEach(b => b.onclick = async () => { if (await registrarRetorno(ctx, sel.candidatos.find(c => c.id === b.dataset.ret))) recarregar(); });
  if (p1 === 'c' && p2) { history.replaceState(null, '', '#/curriculos'); fichaCandidato(ctx, p2, recarregar); }
}

const ultima = c => ((c.historico || []).slice(-1)[0] || {}).em || c.criadoEm || '';

function item(c) {
  const hist = c.vagaCodigo ? `${c.situacao === 'banco' && c.retornoDevido ? `Estava na <b>${esc(c.vagaCodigo)} ${esc(c.vagaCargo || '')}</b> em ${esc(etapa(c.etapa).nome.toLowerCase())} · ${esc((c.motivo || '').toLowerCase())}` : c.situacao === 'banco' ? 'Ainda não entrevistado' : `Participou da <b>${esc(c.vagaCodigo)} ${esc(c.vagaCargo || '')}</b> · ${c.situacao === 'desistiu' ? 'desistiu' : 'reprovado'} em ${esc(etapa(c.etapa).nome.toLowerCase())}${c.motivo ? ': ' + esc(c.motivo.toLowerCase()) : ''}`}` : 'Ainda não participou de vaga';
  const ret = retornoPendente(c);
  return `<div class="cv" data-c="${esc(c.id)}" style="cursor:pointer"><span class="av">${esc(iniciais(c.nome))}</span><div><b>${esc(c.nome)}</b><small>${esc([c.cidade, c.area, c.origem].filter(Boolean).join(' · '))} · ${fmtData(ultima(c).slice(0, 10))}</small><div class="hist"><i class="ti ti-history"></i> ${hist}${(c.participacoes || []).length ? ` · +${c.participacoes.length} vaga(s) antes` : ''}</div></div>
    <div style="display:grid;gap:8px;justify-items:end">${ret ? st('atr', 'Retorno pendente') : c.retorno ? st('ok', 'Retorno dado') : c.situacao === 'banco' ? pill('Disponível', 'ok') : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${ret ? `<button class="btn sm" data-ret="${esc(c.id)}"><i class="ti ti-message-check"></i>Retorno dado</button>` : ''}<button class="btn sm" data-levar="${esc(c.id)}"><i class="ti ti-arrow-right"></i>Levar para uma vaga</button></div></div></div>`;
}
