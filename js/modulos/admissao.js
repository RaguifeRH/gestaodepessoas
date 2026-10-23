// Admissão: checklist por perfil (quem fez e quando), cruzamento com o FO1029 pelo CPF,
// documentos para imprimir, anexos e benefício do sindicato dos motoristas.
import { ADM_SECOES, ADM_PERFIS_PADRAO, ADM_ITENS_PADRAO, PERFIL_VAGA_ADM, SINDICATO_MOTORISTAS } from '../config.js?v=9';
import { $, $$, esc, iniciais, tit, kpis, card, st, pill, fmtData, fmtDataHora, hojeISO, somarDias, diasEntre, modal, toast, erroAmigavel, confirmar, vazio, norm } from '../ui.js?v=9';
import { carregar as carregarSelecao } from '../selecao.js?v=9';

let aba = 'andamento';

async function carregarAdm(ctx, forcar) {
  if (ctx._adm && !forcar) return ctx._adm;
  const [procs, cfg] = await Promise.all([ctx.D.listar('admissoes'), ctx.D.lerConfig('admissao').catch(() => null)]);
  const c = cfg || {};
  ctx._adm = { procs, cfg: { itens: c.itens && c.itens.length ? c.itens : ADM_ITENS_PADRAO, perfis: c.perfis && c.perfis.length ? c.perfis : ADM_PERFIS_PADRAO, inicio: c.inicio || somarDias(hojeISO(), -15) } };
  return ctx._adm;
}
export const itensDoPerfil = (cfg, perfil) => cfg.itens.filter(i => !i.perfis || !i.perfis.length || i.perfis.includes(perfil));
const nomePerfil = (cfg, id) => (cfg.perfis.find(p => p.id === id) || { nome: id || '—' }).nome;
const fq = q => !q ? '—' : q.length > 10 ? fmtDataHora(q) : fmtData(q);
const feito = v => !!v && (v === 'na' || !!v.em);

// Vínculo na folha (FO1029) que corresponde a esta admissão.
function naFolha(resumo, p) {
  const x = resumo.itens.find(i => i.i === p.pid);
  if (!x || !x.a) return null;
  const ref = p.dataIntegracao ? p.dataIntegracao.slice(0, 10) : (p.criadoEm || '').slice(0, 10);
  if (ref && diasEntre(ref, x.a) < -20) return null; // vínculo antigo: ainda não registrou este
  return x;
}
function perfilPorCargo(texto) { const t = norm(texto); if (/ajudante.*motorista/.test(t)) return 'ajudante_de_motorista'; if (/motorista/.test(t)) return 'motorista'; if (/pcd/.test(t)) return 'pcd'; return ''; }

export async function render(el, ctx, id) {
  if (id) return detalhe(el, ctx, id);
  const [A, resumo] = await Promise.all([carregarAdm(ctx, true), ctx.resumo().catch(() => ({ itens: [] }))]);
  const sel = ctx.pode('selecao') ? await carregarSelecao(ctx, true).catch(() => null) : null;
  const porPid = new Set(A.procs.map(p => p.pid).filter(Boolean)), porCand = new Set(A.procs.map(p => p.candidatoId).filter(Boolean));
  // Prontos para iniciar: do R&S (integração marcada ou admitido) e do FO1029 (admitidos recentes sem processo).
  const doRS = sel ? sel.candidatos.filter(c => ((c.situacao === 'andamento' && c.etapa === 'integracao') || (c.situacao === 'contratado' && !c.legado)) && !porCand.has(c.id) && !(c.pid && porPid.has(c.pid))) : [];
  const pidsRS = new Set(doRS.map(c => c.pid).filter(Boolean));
  const doFO = resumo.itens.filter(x => (x.g === 'ativo' || x.g === 'afastado') && x.a && x.a >= A.cfg.inicio && !porPid.has(x.i) && !pidsRS.has(x.i));
  const andamento = A.procs.filter(p => p.status === 'andamento');
  const concl = A.procs.filter(p => p.status === 'concluido');
  const mes = hojeISO().slice(0, 7);
  const prog = p => { const it = itensDoPerfil(A.cfg, p.perfil).filter(i => !i.opcional); const f = it.filter(i => feito((p.checks || {})[i.id])).length; return it.length ? Math.round(f / it.length * 100) : 0; };

  const lista = (aba === 'andamento' ? andamento : aba === 'concluido' ? concl : A.procs).slice().sort((a, b) => (b.dataIntegracao || b.criadoEm || '').localeCompare(a.dataIntegracao || a.criadoEm || ''));
  el.innerHTML = tit('ti-file-check', 'Admissão', 'Checklist por perfil, com quem fez e quando · cruzamento com o FO1029 pelo CPF',
    `<button class="btn" id="manual"><i class="ti ti-plus"></i>Admissão sem o R&S</button>${ctx.admin() ? '<button class="btn ghost" id="cfg"><i class="ti ti-settings"></i>Configurar checklist</button>' : ''}`)
    + kpis([['Em andamento', andamento.length, 'processos abertos'], ['Para iniciar', doRS.length + doFO.length, 'do R&S e do FO1029', doRS.length + doFO.length ? 'neutro' : 'sobe'], ['Aguardando a folha', andamento.filter(p => !naFolha(resumo, p)).length, 'ainda sem matrícula no FO1029'], ['Concluídas no mês', concl.filter(p => (p.concluidoEm || '').slice(0, 7) === mes).length, '']])
    + (doRS.length || doFO.length ? card('Para iniciar', `${doRS.map(c => `<div class="anexo"><span class="av">${esc(iniciais(c.nome))}</span><div><b>${esc(c.nome)}</b><small class="muted" style="display:block">R&S · ${esc(c.vagaCodigo || '')} ${esc(c.vagaCargo || '')} · integração ${c.datas && c.datas.integracao ? fmtDataHora(c.datas.integracao) : '—'}${c.cpfMasc ? '' : ' · sem CPF'}</small></div><button class="btn sm prim" data-rs="${esc(c.id)}">Iniciar</button></div>`).join('')}
        ${doFO.map(x => `<div class="anexo"><span class="av">${esc(iniciais(x.n))}</span><div><b>${esc(x.n)}</b><small class="muted" style="display:block">FO1029 · matrícula ${esc(x.m)} · ${esc(x.c)} · ${esc(x.f)} · admitido em ${fmtData(x.a)}</small></div><button class="btn sm prim" data-fo="${esc(x.i)}">Iniciar</button></div>`).join('')}
        <p class="small muted" style="margin:8px 0 0">Do FO1029 aparecem os admitidos a partir de ${fmtData(A.cfg.inicio)}${ctx.admin() ? ' (muda em "Configurar checklist")' : ''}.</p>`) + '<div class="mt"></div>' : '')
    + `<section class="card"><div class="card-h"><div class="filtros">${[['andamento', 'Em andamento', andamento.length], ['concluido', 'Concluídas', concl.length], ['todos', 'Todas', A.procs.length]].map(f => `<button data-a="${f[0]}" class="${f[0] === aba ? 'on' : ''}">${f[1]} (${f[2]})</button>`).join('')}</div></div>
      <div class="card-b">${lista.length ? `<div class="tw"><table class="tb"><thead><tr><th>Pessoa</th><th>Perfil</th><th>Integração</th><th>Folha (FO1029)</th><th>Checklist</th></tr></thead><tbody>${lista.slice(0, 150).map(p => { const f = naFolha(resumo, p), pr = prog(p);
        return `<tr class="clic" data-p="${esc(p.id)}"><td><b>${esc(p.nome)}</b><small class="muted" style="display:block">${esc(p.cargo || '')}${p.vagaCodigo ? ' · ' + esc(p.vagaCodigo) : ''}${p.legado ? ' · sistema antigo' : ''}</small></td><td class="small">${esc(nomePerfil(A.cfg, p.perfil))}</td><td class="small">${fq(p.dataIntegracao)}</td>
          <td>${f ? st('ok', 'Matrícula ' + f.m) : st('pend', 'Aguardando')}</td><td><div style="display:flex;align-items:center;gap:8px"><div class="progresso" style="width:90px;margin:0"><i style="width:${pr}%"></i></div><span class="small"><b>${pr}%</b></span>${p.status === 'concluido' ? st('ok') : ''}</div></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted" style="margin:6px 0">Nada aqui.</p>'}</div></section>`;

  $$('[data-a]').forEach(b => b.onclick = () => { aba = b.dataset.a; render(el, ctx); });
  $$('tr[data-p]').forEach(tr => tr.onclick = () => { location.hash = '#/admissao/' + tr.dataset.p; });
  $$('[data-rs]').forEach(b => b.onclick = async () => { const c = sel.candidatos.find(x => x.id === b.dataset.rs); const v = sel.vagas.find(x => x.id === c.vagaId); const nid = await iniciar(ctx, A, { nome: c.nome, pid: c.pid || '', cpfMasc: c.cpfMasc || '', candidatoId: c.id, vagaId: c.vagaId || null, vagaCodigo: c.vagaCodigo || '', cargo: c.vagaCargo || '', setor: (v && v.setor) || c.vagaSetor || '', solicitacaoCodigo: (v && v.solicitacaoCodigo) || '', dataIntegracao: (c.datas && c.datas.integracao) || '', perfil: (v && PERFIL_VAGA_ADM[v.perfil]) || perfilPorCargo(c.vagaCargo) || 'geral' }); if (nid) location.hash = '#/admissao/' + nid; });
  $$('[data-fo]').forEach(b => b.onclick = async () => { const x = resumo.itens.find(i => i.i === b.dataset.fo); const nid = await iniciar(ctx, A, { nome: x.n, pid: x.i, cpfMasc: x.cm, cargo: x.c, setor: x.s, filial: x.f, matricula: x.m, admissao: x.a, dataIntegracao: x.a, perfil: perfilPorCargo(x.c) || 'geral' }); if (nid) location.hash = '#/admissao/' + nid; });
  $('#manual').onclick = () => manual(ctx, A).then(nid => { if (nid) location.hash = '#/admissao/' + nid; });
  if ($('#cfg')) $('#cfg').onclick = () => configurar(ctx, A).then(m => m && render(el, ctx));
}

async function iniciar(ctx, A, base) {
  let escolha = null;
  const r = await modal({ titulo: 'Iniciar admissão', corpo: `<div class="small muted">${esc(base.nome)}${base.cargo ? ' · ' + esc(base.cargo) : ''}</div>
      <div class="campo"><label for="ad-perfil">Perfil do checklist</label><select class="inp" id="ad-perfil">${A.cfg.perfis.map(p => `<option value="${esc(p.id)}"${p.id === base.perfil ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select><span class="ajuda">Define os itens: motorista pede CNH, PCD pede laudo, liderança pede a gratificação…</span></div>
      <div class="campo"><label for="ad-int">Data da integração</label><input class="inp" type="datetime-local" id="ad-int" value="${esc((base.dataIntegracao || '').length === 10 ? base.dataIntegracao + 'T07:00' : (base.dataIntegracao || '').slice(0, 16))}"></div>`,
    botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Iniciar', cls: 'prim' }],
    antesDeFechar: (b, bg) => { escolha = { perfil: $('#ad-perfil', bg).value, dataIntegracao: $('#ad-int', bg).value || base.dataIntegracao || '' }; } });
  if (r !== 'ok' || !escolha) return null;
  try {
    const dados = { ...base, ...escolha, status: 'andamento', checks: {}, porNome: ctx.nome(), historico: [{ dt: new Date().toISOString(), acao: 'Admissão iniciada', por: ctx.nome() }] };
    return await ctx.D.criar('admissoes', dados);
  } catch (e) { toast(erroAmigavel(e), 'erro'); return null; }
}

async function manual(ctx, A) {
  const { cpfValido, salvarCpf } = await import('../selecao-ui.js?v=9');
  const { hashCpf, mascararCpf } = await import('../fo1029.js?v=9');
  let base = null;
  const r = await modal({ titulo: 'Admissão sem o R&S', corpo: `<p class="small muted" style="margin:0">Para quem não passou pelo kanban (transferência, recontratação direta, sócio…).</p>
      <div class="campo"><label for="m-nome">Nome completo</label><input class="inp" id="m-nome"></div>
      <div class="linha2"><div class="campo"><label for="m-cpf">CPF</label><input class="inp" id="m-cpf" inputmode="numeric"></div><div class="campo"><label for="m-cargo">Cargo</label><input class="inp" id="m-cargo"></div></div><div id="m-msg"></div>`,
    botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Continuar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => {
      const nome = $('#m-nome', bg).value.trim(), cpf = $('#m-cpf', bg).value, cargo = $('#m-cargo', bg).value.trim();
      if (!nome || !cpfValido(cpf)) { $('#m-msg', bg).innerHTML = '<div class="erro-msg">Informe o nome e um CPF válido.</div>'; return false; }
      base = { nome, pid: await hashCpf(cpf), cpfMasc: mascararCpf(cpf), cargo, perfil: perfilPorCargo(cargo) || 'geral' };
    } });
  if (r !== 'ok' || !base) return null;
  if (A.procs.some(p => p.pid === base.pid && p.status === 'andamento')) { toast('Já existe uma admissão em andamento para este CPF.', 'erro'); return null; }
  return iniciar(ctx, A, base);
}

// ---------------------------------------------------------------------------
// Detalhe: checklist
// ---------------------------------------------------------------------------
async function detalhe(el, ctx, id) {
  const A = await carregarAdm(ctx, true);
  const p = A.procs.find(x => x.id === id);
  if (!p) { el.innerHTML = vazio('ti-file-off', 'Admissão não encontrada', '', '<a class="btn" href="#/admissao"><i class="ti ti-arrow-left"></i>Voltar</a>'); return; }
  const resumo = await ctx.resumo().catch(() => ({ itens: [] }));
  const f = naFolha(resumo, p);
  // Dados do FO1029 para confirmar itens automaticamente (CPF, RG, PIS…).
  let pub = null, priv = null;
  if (f && ctx.pode('pessoas')) pub = await ctx.D.pessoa(p.pid).catch(() => null);
  if (f && ctx.pode('sensiveis')) priv = await ctx.D.privado(p.pid).catch(() => null);
  const autoVal = campo => campo === 'chapa' ? (pub && pub.atual && pub.atual.chapa) : priv ? priv[campo] : '';
  const itens = itensDoPerfil(A.cfg, p.perfil);
  const checks = p.checks || {};
  const estado = i => checks[i.id] ? checks[i.id] : (i.auto && autoVal(i.auto) ? { auto: true } : null);
  const obrig = itens.filter(i => !i.opcional);
  const pr = obrig.length ? Math.round(obrig.filter(i => feito(estado(i)) || (estado(i) && estado(i).auto)).length / obrig.length * 100) : 0;
  const motorista = ['motorista', 'ajudante_de_motorista'].includes(p.perfil) || (pub && SINDICATO_MOTORISTAS.test((pub.atual || {}).sindicato || ''));
  const anexos = await ctx.D.anexosDe('admissoes', id).catch(() => []);
  const andamento = A.procs.filter(x => x.status === 'andamento').sort((a, b) => (a.dataIntegracao || '').localeCompare(b.dataIntegracao || ''));
  const fechado = p.status === 'concluido';

  const item = i => {
    const e = estado(i), ok = feito(e) || (e && e.auto);
    const quem = !e ? '' : e === 'na' ? 'Não se aplica' : e.auto && !e.em ? 'Pelo FO1029' : `${esc((e.porNome || '').split(' ').slice(0, 2).join(' '))}, ${e.em && e.em.length > 10 ? fmtDataHora(e.em) : fmtData(e.em)}`;
    return `<div class="item${ok ? ' feito' : ''}"><input type="checkbox" data-i="${esc(i.id)}"${ok ? ' checked' : ''}${fechado || (e && e.auto && !e.em) ? ' disabled' : ''} aria-label="${esc(i.texto)}"><span><b>${esc(i.texto)}</b>${i.it ? `<span class="it">${esc(i.it)}</span>` : ''}${i.opcional ? '<span class="it">Opcional</span>' : ''}${e && e.obs ? `<span class="it">Obs.: ${esc(e.obs)}</span>` : ''}</span>
      <span class="quem">${quem}${!fechado && !ok ? ` <button class="btn sm ghost" data-na="${esc(i.id)}" title="Não se aplica">N/A</button>` : ''}</span></div>`;
  };

  el.innerHTML = `<button class="btn ghost sm" id="voltar" style="margin-bottom:12px"><i class="ti ti-arrow-left"></i>Admissões</button>
  <div class="adm"><section class="card"><div class="card-h"><h3 class="d">Em andamento</h3></div><ul class="fila">${andamento.map(x => `<li class="${x.id === id ? 'on' : ''}" data-p="${esc(x.id)}"><span class="av">${esc(iniciais(x.nome))}</span><div><b>${esc(x.nome)}</b><small>${esc(nomePerfil(A.cfg, x.perfil))}${x.dataIntegracao ? ' · ' + fmtData(x.dataIntegracao.slice(0, 10)) : ''}</small></div></li>`).join('') || '<li class="small muted">Nenhuma.</li>'}</ul></section>
  <section class="card" style="padding-bottom:22px"><div class="chk-h"><div><div class="small muted">${esc(p.nome)} · perfil ${esc(nomePerfil(A.cfg, p.perfil))}${p.vagaCodigo ? ' · ' + esc(p.vagaCodigo) : ''}${p.solicitacaoCodigo ? ' · ' + esc(p.solicitacaoCodigo) : ''}${p.cpfMasc ? ' · CPF ' + esc(p.cpfMasc) : ''}</div>
      <h2 class="d" style="font-size:24px;font-weight:850;margin-top:3px">Registro da admissão</h2>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">${fechado ? st('ok', 'Concluída em ' + fmtData((p.concluidoEm || '').slice(0, 10))) : st('pend', 'Em andamento')}${f ? st('ok', `Na folha: matrícula ${f.m} · admissão ${fmtData(f.a)}`) : st('pend', 'Aguardando o FO1029')}${f && ctx.pode('pessoas') ? `<a class="btn sm" href="#/pessoa/${esc(p.pid)}"><i class="ti ti-folder-open"></i>Pasta da pessoa</a>` : ''}</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" id="imp-chk"><i class="ti ti-printer"></i>Checklist para o dossiê</button><button class="btn sm" id="imp-docs"><i class="ti ti-list-check"></i>Lista de documentos</button><button class="btn sm" id="imp-saude"><i class="ti ti-heart-plus"></i>Termo plano de saúde</button><button class="btn sm" id="imp-odonto"><i class="ti ti-dental"></i>Termo plano odontológico</button>${fechado ? '' : '<button class="btn sm ghost" id="perfil"><i class="ti ti-adjustments"></i>Trocar perfil</button>'}</div></div>
    <div class="anel" style="--p:${pr}"><span>${pr}%</span></div></div>
    ${!f ? '<div class="auto" style="margin:10px 22px 0"><i class="ti ti-bolt"></i>Quando o FO1029 trouxer este CPF, o sistema mostra a matrícula e confirma sozinho os documentos que já estão na folha (CPF, RG, PIS, CTPS…).</div>' : priv ? '' : '<div class="auto" style="margin:10px 22px 0"><i class="ti ti-lock"></i>Sem a permissão "Dados sensíveis", os documentos não são confirmados automaticamente pelo FO1029.</div>'}
    ${ADM_SECOES.map(s => { const l = itens.filter(i => i.secao === s.id); if (!l.length) return ''; const pend = l.filter(i => !i.opcional && !(feito(estado(i)) || (estado(i) && estado(i).auto))).length; return `<div class="bloco"><h4 class="d"><i class="ti ${s.ic}"></i>${esc(s.nome)} ${pend ? pill(pend + ' pendente' + (pend > 1 ? 's' : ''), 'amb') : pill('Completo', 'ok')}</h4>${l.map(item).join('')}</div>`; }).join('')}
    ${motorista ? `<div class="bloco"><h4 class="d"><i class="ti ti-gift"></i>Sindicato dos motoristas</h4><div class="item"><span></span><span><b>Cesta básica ou ticket?</b><div class="escolha" role="group">${['Cesta básica', 'Ticket'].map(o => `<button data-op="${o}" class="${p.beneficio && p.beneficio.opcao === o ? 'on' : ''}"${fechado ? ' disabled' : ''}>${o}</button>`).join('')}</div><div class="auto"><i class="ti ti-bolt"></i>Vai para a lista de motoristas (Movimentações) sem redigitar.</div></span><span class="quem">${p.beneficio ? esc(p.beneficio.porNome.split(' ')[0]) + ', ' + fmtDataHora(p.beneficio.em) : ''}</span></div></div>` : ''}
    <div class="bloco"><h4 class="d"><i class="ti ti-paperclip"></i>Documentos anexados ${pill(String(anexos.length))}</h4><div style="padding:6px 16px 12px">${anexos.map(a => `<div class="anexo"><span class="ic"><i class="ti ti-file-text"></i></span><div><b>${esc(a.descricao || a.nome)}</b><small class="muted"> · ${fmtDataHora(a.criadoEm)} · ${esc(a.porNome || '')}</small></div><button class="btn sm" data-ver="${esc(a.caminho)}">Abrir</button></div>`).join('')}
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><input class="inp" id="an-desc" placeholder="Descrição (ex.: Contrato de experiência assinado)" style="flex:1;min-width:200px"><label class="btn sm"><i class="ti ti-upload"></i>Anexar PDF ou foto<input type="file" id="an-arq" accept="application/pdf,image/*" hidden></label><span class="progresso" id="an-prog" hidden style="flex:1;min-width:80px"><i></i></span></div></div></div>
    <div style="display:flex;gap:8px;margin:18px 22px 0;flex-wrap:wrap">${fechado ? (ctx.admin() ? '<button class="btn" id="reabrir">Reabrir</button>' : '') : `<button class="btn prim" id="concluir"${pr < 100 ? ' disabled title="Conclua os itens obrigatórios"' : ''}><i class="ti ti-circle-check"></i>Concluir admissão</button>`}</div>
  </section></div>`;

  const recarregar = () => detalhe(el, ctx, id);
  const salvar = async (dados, acao) => { try { await ctx.D.atualizar('admissoes', id, { ...dados, historico: [...(p.historico || []), { dt: new Date().toISOString(), acao, por: ctx.nome() }].slice(-200) }); await carregarAdm(ctx, true); recarregar(); } catch (e) { toast(erroAmigavel(e), 'erro'); } };
  $('#voltar').onclick = () => { location.hash = '#/admissao'; };
  $$('.fila li[data-p]').forEach(li => li.onclick = () => { location.hash = '#/admissao/' + li.dataset.p; });
  $$('[data-i]').forEach(cb => cb.onchange = async () => {
    const i = itens.find(x => x.id === cb.dataset.i);
    const novo = { ...checks };
    if (cb.checked) novo[i.id] = { em: new Date().toISOString(), porNome: ctx.nome(), porUid: ctx.uid };
    else { if (!(await confirmar('Desmarcar', `Desmarcar "${esc(i.texto)}"? Fica registrado no histórico.`, 'Desmarcar'))) { cb.checked = true; return; } delete novo[i.id]; }
    salvar({ checks: novo }, (cb.checked ? 'Marcou: ' : 'Desmarcou: ') + i.texto);
  });
  $$('[data-na]').forEach(b => b.onclick = () => { const i = itens.find(x => x.id === b.dataset.na); salvar({ checks: { ...checks, [i.id]: 'na' } }, 'Não se aplica: ' + i.texto); });
  $$('[data-op]').forEach(b => b.onclick = async () => {
    const opcao = b.dataset.op, em = new Date().toISOString();
    try {
      if (p.pid) await ctx.D.definir('motoristas', p.pid, { nome: p.nome, cargo: (f && f.c) || p.cargo || '', setor: (f && f.s) || p.setor || '', admissao: (f && f.a) || (p.dataIntegracao || '').slice(0, 10), matricula: (f && f.m) || '', opcao, sindicato: (pub && pub.atual && pub.atual.sindicato) || 'Sindicato dos Motoristas', status: 'ATIVO', origem: 'Admissão', admissaoId: id, porNome: ctx.nome() });
      salvar({ beneficio: { opcao, em, porNome: ctx.nome() } }, 'Sindicato dos motoristas: ' + opcao);
    } catch (e) { toast(erroAmigavel(e), 'erro'); }
  });
  $$('[data-ver]').forEach(b => b.onclick = async () => { try { window.open(await ctx.D.urlAnexo(b.dataset.ver), '_blank'); } catch (e) { toast(erroAmigavel(e), 'erro'); } });
  $('#an-arq').onchange = async e => {
    const fl = e.target.files[0]; if (!fl) return;
    if (fl.size > 15 * 1024 * 1024) return toast('O arquivo passa de 15 MB.', 'erro');
    if (!(fl.type === 'application/pdf' || fl.type.startsWith('image/'))) return toast('Use PDF ou imagem.', 'erro');
    $('#an-prog').hidden = false;
    try { await ctx.D.enviarAnexoEm('admissoes', id, fl, $('#an-desc').value.trim() || fl.name, x => { $('#an-prog i').style.width = (x * 100) + '%'; }, ctx.nome()); toast('Documento anexado.'); recarregar(); }
    catch (err) { toast(erroAmigavel(err), 'erro'); $('#an-prog').hidden = true; }
  };
  // O modal já foi removido do DOM quando a promessa resolve: lê o valor antes.
  if ($('#perfil')) { $('#perfil').onclick = async () => {
    let escolhido = p.perfil;
    const r = await modal({ titulo: 'Trocar perfil', corpo: `<div class="campo"><label for="tp">Perfil</label><select class="inp" id="tp">${A.cfg.perfis.map(x => `<option value="${esc(x.id)}"${x.id === p.perfil ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}</select><span class="ajuda">Os itens já marcados continuam guardados.</span></div>`, botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Trocar', cls: 'prim' }], antesDeFechar: (b, bg) => { escolhido = $('#tp', bg).value; } });
    if (r === 'ok' && escolhido !== p.perfil) salvar({ perfil: escolhido }, 'Perfil alterado para ' + nomePerfil(A.cfg, escolhido));
  }; }
  if ($('#concluir')) $('#concluir').onclick = async () => {
    if (!(await confirmar('Concluir admissão', `Concluir a admissão de <b>${esc(p.nome)}</b>? ${f ? 'Entra um registro "Admissão" na linha do tempo da pessoa.' : 'Ainda não há matrícula no FO1029; a pasta da pessoa nasce na próxima importação.'}`, 'Concluir'))) return;
    const novo = { ...checks }; const em = new Date().toISOString();
    itens.forEach(i => { const e = estado(i); if (e && e.auto && !e.em) novo[i.id] = { em, porNome: 'FO1029', auto: true }; });
    try {
      if (f && ctx.pode('pessoas')) await ctx.D.novoEvento(p.pid, { tipo: 'Admissão', data: f.a || hojeISO(), titulo: `Checklist de admissão concluído · perfil ${nomePerfil(A.cfg, p.perfil)}${p.vagaCodigo ? ' · ' + p.vagaCodigo : ''}`, obs: '', porNome: ctx.nome() }).catch(() => {});
      if (p.candidatoId && ctx.pode('selecao')) await ctx.D.atualizar('candidatos', p.candidatoId, { situacao: 'contratado', admitidoEm: em }).catch(() => {});
      await salvar({ checks: novo, status: 'concluido', concluidoEm: em, ...(f ? { matricula: f.m, admissao: f.a } : {}) }, 'Admissão concluída');
      toast('Admissão concluída.');
    } catch (e) { toast(erroAmigavel(e), 'erro'); }
  };
  if ($('#reabrir')) $('#reabrir').onclick = () => salvar({ status: 'andamento' }, 'Admissão reaberta');

  // Impressões
  const imprimir = (titulo, corpo) => {
    const w = window.open('', '_blank'); if (!w) return toast('Permita pop-ups para imprimir.', 'erro');
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)} · ${esc(p.nome)}</title><style>body{font:12.5px/1.55 Arial,sans-serif;color:#15201a;margin:30px}h1{font-size:19px;margin:0;color:#01361d}h2{font-size:14px;color:#01361d;border-bottom:2px solid #9dcd46;padding-bottom:3px;margin-top:20px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #dbe4dc;padding:5px;text-align:left;vertical-align:top}small,.m{color:#55635a}.cab{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:4px solid #01361d;padding-bottom:10px;margin-bottom:8px}.ass{margin-top:60px;display:flex;gap:40px}.ass div{flex:1;border-top:1px solid #15201a;padding-top:4px;text-align:center}.box{width:14px;height:14px;border:1.5px solid #15201a;display:inline-block;vertical-align:middle;margin-right:6px}.prov{background:#fcf2dc;border:1px solid #ecd9a6;padding:6px 10px;border-radius:6px;font-size:11px;margin:10px 0}</style></head><body>
      <div class="cab"><div><h1>${esc(titulo)}</h1><small>${esc(p.nome)}${p.cpfMasc ? ' · CPF ' + esc(priv && priv.cpf ? priv.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : p.cpfMasc) : ''} · ${esc((f && f.c) || p.cargo || '')}${f ? ' · matrícula ' + esc(f.m) : ''}</small></div><small>Raguife · Gestão de Pessoas<br>Emitido em ${new Date().toLocaleString('pt-BR')} por ${esc(ctx.nome())}</small></div>${corpo}<script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };
  $('#imp-chk').onclick = () => imprimir('Checklist de admissão', `<p class="m">Perfil ${esc(nomePerfil(A.cfg, p.perfil))}${p.vagaCodigo ? ' · vaga ' + esc(p.vagaCodigo) : ''}${p.solicitacaoCodigo ? ' · pedido ' + esc(p.solicitacaoCodigo) : ''}${p.dataIntegracao ? ' · integração ' + fq(p.dataIntegracao) : ''}</p>`
    + ADM_SECOES.map(s => { const l = itens.filter(i => i.secao === s.id); return l.length ? `<h2>${esc(s.nome)}</h2><table><tr><th>Item</th><th>Feito por</th><th>Quando</th></tr>${l.map(i => { const e = estado(i); return `<tr><td>${esc(i.texto)}${i.opcional ? ' <small>(opcional)</small>' : ''}</td><td>${!e ? '—' : e === 'na' ? 'Não se aplica' : esc(e.porNome || (e.auto ? 'FO1029' : ''))}</td><td>${e && e.em ? (e.em.length > 10 ? fmtDataHora(e.em) : fmtData(e.em)) : ''}</td></tr>`; }).join('')}</table>` : ''; }).join('')
    + (p.beneficio ? `<h2>Sindicato dos motoristas</h2><p>Opção: <b>${esc(p.beneficio.opcao)}</b> · ${esc(p.beneficio.porNome)}, ${fmtDataHora(p.beneficio.em)}</p>` : '')
    + '<div class="ass"><div>Responsável pelo RH</div><div>Colaborador</div></div>');
  $('#imp-docs').onclick = () => imprimir('Lista de documentos admissionais', `<p>Olá, ${esc(p.nome.split(' ')[0])}! Para concluir sua admissão, entregue ao RH cópia dos documentos abaixo:</p><table>${itens.filter(i => i.secao === 'documentos' && !/ASO|psicossocial/i.test(i.texto)).map(i => `<tr><td><span class="box"></span>${esc(i.texto)}${i.it ? ' <small>(' + esc(i.it) + ')</small>' : ''}${i.opcional ? ' <small>(se houver)</small>' : ''}</td></tr>`).join('')}</table><p class="m" style="margin-top:16px">Dúvidas: fale com o RH.</p>`);
  const termo = tipo => imprimir(`Termo de adesão ao plano ${tipo}`, `<div class="prov">Modelo provisório: envie ao Claude o termo oficial para ficar igual ao da operadora.</div>
    <h2>Dados do titular</h2><table><tr><td>Nome</td><td><b>${esc(p.nome)}</b></td></tr><tr><td>CPF</td><td>${esc(priv && priv.cpf ? priv.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : p.cpfMasc || '')}</td></tr><tr><td>Data de nascimento</td><td>${priv && priv.nascimento ? fmtData(priv.nascimento) : '____/____/______'}</td></tr><tr><td>Nome da mãe</td><td>${esc((priv && priv.mae) || '')}</td></tr><tr><td>Cargo</td><td>${esc((f && f.c) || p.cargo || '')}</td></tr><tr><td>Empresa / filial</td><td>${esc((f && (f.e + ' · ' + f.f)) || '')}</td></tr><tr><td>Matrícula</td><td>${esc((f && f.m) || '')}</td></tr><tr><td>Admissão</td><td>${f ? fmtData(f.a) : ''}</td></tr><tr><td>Endereço</td><td>${esc((priv && priv.endereco) || '')}</td></tr><tr><td>Celular</td><td>${esc((priv && priv.celular) || '')}</td></tr></table>
    <h2>Opção</h2><p><span class="box"></span>Desejo aderir ao plano ${tipo} oferecido pela empresa, nas condições vigentes, e autorizo o desconto em folha da minha participação.</p><p><span class="box"></span>Não desejo aderir neste momento.</p>
    <h2>Dependentes</h2><table><tr><th>Nome</th><th>Parentesco</th><th>Nascimento</th><th>CPF</th></tr>${'<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>'.repeat(4)}</table>
    <p style="margin-top:18px">Jales/SP, ____ de ______________ de ________.</p><div class="ass"><div>${esc(p.nome)}</div><div>RH Raguife</div></div>`);
  $('#imp-saude').onclick = () => termo('de saúde');
  $('#imp-odonto').onclick = () => termo('odontológico');
}

// Itens e perfis do checklist (administrador).
async function configurar(ctx, A) {
  const linhas = A.cfg.itens.map(i => [i.id, i.secao, i.texto, i.it || '', (i.perfis || []).join(','), i.auto || '', i.opcional ? 'sim' : ''].join(' | ')).join('\n');
  const corpo = `<div class="campo"><label for="cf-ini">Mostrar em "Para iniciar" os admitidos no FO1029 a partir de</label><input class="inp" type="date" id="cf-ini" value="${esc(A.cfg.inicio)}"></div>
    <div class="campo"><label for="cf-per">Perfis (id; nome), um por linha</label><textarea class="inp" id="cf-per" rows="5">${esc(A.cfg.perfis.map(p => p.id + '; ' + p.nome).join('\n'))}</textarea></div>
    <div class="campo"><label for="cf-it">Itens: código | seção (documentos, cadastro ou integracao) | texto | instrução (IT) | perfis separados por vírgula (vazio = todos) | campo do FO1029 | opcional</label><textarea class="inp" id="cf-it" rows="14" style="font-family:monospace;font-size:12px">${esc(linhas)}</textarea><span class="ajuda">Não troque o código de um item que já está em uso: é por ele que o sistema sabe o que foi marcado.</span></div><div id="cf-msg"></div>`;
  const r = await modal({ titulo: 'Configurar checklist', corpo, larga: true, botoes: [{ id: 'padrao', texto: 'Voltar ao padrão', cls: 'ghost' }, { id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => {
      try {
        if (b === 'padrao') { await ctx.D.salvarConfig('admissao', { itens: ADM_ITENS_PADRAO, perfis: ADM_PERFIS_PADRAO }); return; }
        const perfis = $('#cf-per', bg).value.split('\n').map(l => l.split(';').map(x => x.trim())).filter(x => x[0]).map(([id, nome]) => ({ id, nome: nome || id }));
        const itens = $('#cf-it', bg).value.split('\n').map(l => l.split('|').map(x => x.trim())).filter(x => x[0] && x[2]).map(([id, secao, texto, it, perf, auto, opc]) => ({ id, secao: ['documentos', 'cadastro', 'integracao'].includes(secao) ? secao : 'cadastro', texto, it: it || '', perfis: (perf || '').split(',').map(x => x.trim()).filter(Boolean), auto: auto || '', opcional: /^s/i.test(opc || '') }));
        if (new Set(itens.map(i => i.id)).size !== itens.length) { $('#cf-msg', bg).innerHTML = '<div class="erro-msg">Há códigos repetidos.</div>'; return false; }
        await ctx.D.salvarConfig('admissao', { itens, perfis, inicio: $('#cf-ini', bg).value || A.cfg.inicio });
      } catch (e) { $('#cf-msg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
    } });
  if (r === 'ok' || r === 'padrao') { await carregarAdm(ctx, true); toast('Checklist salvo.'); return true; }
  return false;
}
