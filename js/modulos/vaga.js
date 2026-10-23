// Uma vaga: cabeçalho com prazo e o kanban dos candidatos.
import { ETAPAS, STATUS_VAGA } from '../config.js?v=5';
import { $, $$, esc, iniciais, fmtData, st, pill, vazio, modal, toast, erroAmigavel, confirmar, hojeISO } from '../ui.js?v=5';
import { carregar, prazoVaga, etapa, retornoPendente } from '../selecao.js?v=5';
import { modalVaga, novoCandidato, moverEtapa, fichaCandidato, levarParaVaga, fmtQuando } from '../selecao-ui.js?v=5';

let verFora = false, verAdm = false;

export async function render(el, ctx, id, abrirCand) {
  const sel = await carregar(ctx);
  const v = sel.vagas.find(x => x.id === id);
  if (!v) { el.innerHTML = vazio('ti-briefcase-off', 'Vaga não encontrada', 'Ela pode ter sido removida ou o endereço está errado.', '<a class="btn" href="#/vagas"><i class="ti ti-arrow-left"></i>Voltar para as vagas</a>'); return; }
  const cs = (sel.porVaga[v.id] || []);
  const ativos = cs.filter(c => c.situacao === 'andamento'), fora = cs.filter(c => c.situacao === 'reprovado' || c.situacao === 'desistiu'), adm = cs.filter(c => c.situacao === 'contratado');
  const p = prazoVaga(v);
  const [sn, sk] = STATUS_VAGA[v.status] || [v.status, ''];
  const sol = v.solicitacaoId ? sel.solicitacoes.find(s => s.id === v.solicitacaoId) : null;
  const banco = v.codigo === 'BT-0001';

  const cartao = c => {
    const d = c.datas || {}, k = c.checks || {};
    const quando = c.etapa === 'ent_ag' ? d.entrevista : c.etapa === 'teste_ag' ? d.teste : c.etapa === 'docs' ? d.exame : c.etapa === 'integracao' ? d.integracao : '';
    const tags = [];
    if (c.situacao === 'andamento') {
      if (c.cpfMasc) tags.push(st('ok', 'CPF')); else if (['ent_re', 'teste_ag', 'teste_re', 'docs', 'exame', 'integracao'].includes(c.etapa)) tags.push(st('pend', 'Sem CPF'));
      if (k.ficha) tags.push(st(k.ficha === 'recebida' ? 'ok' : 'pend', 'Ficha'));
      if (c.etapa === 'teste_re' && k.avaliacaoGestor) tags.push(st(k.avaliacaoGestor === 'aprovado' ? 'ok' : k.avaliacaoGestor === 'pendente' ? 'pend' : 'atr', 'Avaliação'));
      if (c.etapa === 'exame' && k.docs) tags.push(st(k.docs === 'recebida' ? 'ok' : 'pend', 'Docs'));
      if (quando && quando.slice(0, 10) === hojeISO()) tags.push(st('hoje'));
      else if (quando && quando.slice(0, 10) < hojeISO()) tags.push(st('atr', 'Data passou'));
    } else if (c.situacao !== 'contratado') tags.push(c.retorno ? st('ok', 'Retorno') : retornoPendente(c) ? st('atr', 'Retorno') : '');
    return `<div class="cand" draggable="${c.situacao === 'andamento'}" data-c="${esc(c.id)}" tabindex="0"><div class="top"><span class="av">${esc(iniciais(c.nome))}</span><div><b>${esc(c.nome)}</b><small>${esc(c.origem || '')}${c.indicadoPor ? ' · ' + esc(c.indicadoPor) : ''}</small></div></div>
      ${c.situacao === 'andamento' ? (quando ? `<small class="muted"><i class="ti ti-calendar-event"></i> ${fmtQuando(quando)}</small>` : '') : `<small class="muted">${esc(c.situacao === 'contratado' ? 'Admitido' : (c.situacao === 'desistiu' ? 'Desistiu' : 'Reprovado') + ' em ' + etapa(c.etapa).nome.toLowerCase())}${c.motivo ? ' · ' + esc(c.motivo) : ''}</small>`}
      ${tags.filter(Boolean).length ? `<div class="tags">${tags.join('')}</div>` : ''}</div>`;
  };

  const cols = ETAPAS.map(e => ({ ...e, c: ativos.filter(c => c.etapa === e.id) }));
  el.innerHTML = `<button class="btn ghost sm" id="voltar" style="margin-bottom:12px"><i class="ti ti-arrow-left"></i>Vagas</button>
    <section class="card vaga-h"><div><div class="cod d">${esc(v.codigo)}${sol ? ' · pedido ' + esc(sol.codigo || '') + (sol.n2Resposta ? ' · aprovado pelo N2 em ' + fmtData((sol.n2Resposta.em || '').slice(0, 10)) : '') : ''}${v.legado ? ' · veio do sistema antigo' : ''}</div><h2 class="d">${esc(v.cargo)}</h2>
      <div class="meta"><span><i class="ti ti-building"></i>${esc(v.setor || '—')}</span><span><i class="ti ti-users"></i>${esc(v.qtd || 1)} vaga${(+v.qtd || 1) > 1 ? 's' : ''}${adm.length ? ' · ' + adm.length + ' admitido' + (adm.length > 1 ? 's' : '') : ''}</span>${v.gestor ? `<span><i class="ti ti-user"></i>Gestor: ${esc(v.gestor)}</span>` : ''}${v.escala ? `<span><i class="ti ti-clock"></i>${esc(v.escala)}</span>` : ''}<span><i class="ti ti-tag"></i>${esc(v.perfil || '')} · ${esc(v.motivo || '')}${v.substituido ? ' de ' + esc(v.substituido) : ''}</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${sk ? st(sk, sn) : pill(sn)}<button class="btn sm" id="editar"><i class="ti ti-pencil"></i>Editar</button>${v.status === 'aberta' ? '<button class="btn sm" id="pausar"><i class="ti ti-player-pause"></i>Pausar</button><button class="btn sm" id="encerrar"><i class="ti ti-flag-check"></i>Encerrar</button>' : v.status === 'pausada' || v.status === 'encerrada' || v.status === 'cancelada' ? '<button class="btn sm" id="reabrir"><i class="ti ti-player-play"></i>Reabrir</button>' : ''}${v.status === 'aberta' || v.status === 'pausada' ? '<button class="btn sm ghost" id="cancelar">Cancelar vaga</button>' : ''}</div></div>
      ${p && v.status === 'aberta' ? `<div class="sla"><div class="small muted">Prazo da vaga (${v.sla} dias${v.perfil ? ', perfil ' + esc(v.perfil) : ''})</div><div class="barra"><i style="width:${p.pct}%;${p.restam < 0 ? 'background:var(--verm)' : ''}"></i></div><div class="small"><b>${p.restam < 0 ? `Venceu há ${-p.restam} dia${p.restam === -1 ? '' : 's'}` : p.restam === 0 ? 'Vence hoje' : `Faltam ${p.restam} dia${p.restam === 1 ? '' : 's'}`}</b> · até ${fmtData(p.prazo)}</div></div>` : ''}</section>
    <div class="vaga-sel"><button class="btn prim" id="novo"><i class="ti ti-user-plus"></i>Novo candidato</button><a class="btn" href="#/curriculos"><i class="ti ti-id-badge-2"></i>Trazer do banco de currículos</a>
      <label class="btn sm" style="cursor:pointer"><input type="checkbox" id="ver-fora" ${verFora ? 'checked' : ''} style="accent-color:var(--verde)"> Reprovados e desistentes (${fora.length})</label>
      ${adm.length ? `<label class="btn sm" style="cursor:pointer"><input type="checkbox" id="ver-adm" ${verAdm ? 'checked' : ''} style="accent-color:var(--verde)"> Admitidos (${adm.length})</label>` : ''}</div>
    ${!cs.length ? `<div class="ok-msg" style="margin-bottom:12px">${banco ? 'Este é o banco de talentos do sistema antigo. Os currículos estão em Banco de currículos.' : 'Nenhum candidato ainda. Cadastre o primeiro ou traga alguém do banco de currículos.'}</div>` : ''}
    <div class="kb-wrap"><div class="kanban" id="kb">${cols.map(e => `<section class="col" data-e="${e.id}"><div class="col-h"><span class="cor" style="background:${e.cor}"></span>${esc(e.nome)}<span class="n">${e.c.length}</span></div>${e.c.map(cartao).join('')}</section>`).join('')}
      ${verAdm && adm.length ? `<section class="col"><div class="col-h"><span class="cor" style="background:var(--mata)"></span>Admitidos<span class="n">${adm.length}</span></div>${adm.map(cartao).join('')}</section>` : ''}
      ${verFora ? `<section class="col rep"><div class="col-h"><span class="cor" style="background:#c9706a"></span>Reprovado ou desistiu<span class="n">${fora.length}</span></div>${fora.map(cartao).join('')}</section>` : ''}</div></div>
    <div class="dica-kb"><i class="ti ti-arrows-horizontal"></i>Arraste o cartão para mudar de etapa, ou clique nele para abrir a ficha. Role para o lado para ver todas as etapas.</div>`;

  const recarregar = () => render(el, ctx, id);
  $('#voltar').onclick = () => { location.hash = window.__gpAnterior && window.__gpAnterior !== location.hash ? window.__gpAnterior : '#/vagas'; };
  $('#editar').onclick = async () => { if (await modalVaga(ctx, sel, v, { titulo: 'Editar vaga' })) recarregar(); };
  const status = async (novo, texto, extra = {}) => { if (!(await confirmar(texto[0], texto[1], texto[2]))) return; try { await ctx.D.atualizar('vagas', v.id, { status: novo, ...extra }); await carregar(ctx, true); ctx.atualizarContadores(); toast('Vaga atualizada.'); recarregar(); } catch (e) { toast(erroAmigavel(e), 'erro'); } };
  const b = s => $(s);
  if (b('#pausar')) b('#pausar').onclick = () => status('pausada', ['Pausar a vaga', 'Os candidatos ficam onde estão. O prazo para de aparecer como atrasado.', 'Pausar']);
  if (b('#encerrar')) b('#encerrar').onclick = () => status('encerrada', ['Encerrar a vaga', ativos.length ? `Ainda há ${ativos.length} candidato(s) em andamento. Eles continuam na ficha da vaga; reprove ou leve para outra vaga se precisar.` : 'Encerrar esta vaga?', 'Encerrar'], { encerradaEm: hojeISO() });
  if (b('#reabrir')) b('#reabrir').onclick = () => status('aberta', ['Reabrir a vaga', 'A vaga volta para a lista de abertas.', 'Reabrir']);
  if (b('#cancelar')) b('#cancelar').onclick = () => status('cancelada', ['Cancelar a vaga', 'A vaga sai das abertas e fica como cancelada.', 'Cancelar vaga']);
  $('#novo').onclick = async () => { if (await novoCandidato(ctx, sel, { vagaId: v.id })) recarregar(); };
  $('#ver-fora').onchange = e => { verFora = e.target.checked; recarregar(); };
  if ($('#ver-adm')) $('#ver-adm').onchange = e => { verAdm = e.target.checked; recarregar(); };
  $$('.cand').forEach(k => {
    k.onclick = () => fichaCandidato(ctx, k.dataset.c, recarregar);
    k.onkeydown = e => { if (e.key === 'Enter') fichaCandidato(ctx, k.dataset.c, recarregar); };
    k.ondragstart = e => { e.dataTransfer.setData('text/plain', k.dataset.c); k.classList.add('arrastando'); };
    k.ondragend = () => k.classList.remove('arrastando');
  });
  $$('.col[data-e]').forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('sobre'); };
    col.ondragleave = () => col.classList.remove('sobre');
    col.ondrop = async e => { e.preventDefault(); col.classList.remove('sobre'); const c = cs.find(x => x.id === e.dataTransfer.getData('text/plain')); if (c && await moverEtapa(ctx, c, col.dataset.e)) recarregar(); };
  });
  if (abrirCand && cs.some(c => c.id === abrirCand)) { history.replaceState(null, '', '#/vaga/' + id); fichaCandidato(ctx, abrirCand, recarregar); }
}
