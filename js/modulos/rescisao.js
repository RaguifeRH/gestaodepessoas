// Rescisão: desligamento com checklist por setor (RH, SESMT, TI, almoxarifado), homologação e dossiê.
import { RESC_SETORES, TIPOS_DESLIG, RESC_ITENS_PADRAO, RESC_PERFIS_PADRAO } from '../config.js?v=13';
import { $, $$, esc, iniciais, tit, kpis, card, st, pill, fmtData, fmtDataHora, hojeISO, somarDias, modal, toast, erroAmigavel, confirmar, vazio, norm } from '../ui.js?v=13';

let aba = 'andamento', meus = false;
const nomeTipo = k => (TIPOS_DESLIG.find(t => t[0] === k) || [k, k || '—'])[1];
const fq = q => !q ? '—' : q.length > 10 ? fmtDataHora(q) : fmtData(q);
const feito = v => !!v && (v === 'na' || !!v.em);

async function carregarResc(ctx, forcar) {
  if (ctx._resc && !forcar) return ctx._resc;
  const [procs, cfg] = await Promise.all([ctx.D.listar('rescisoes'), ctx.D.lerConfig('rescisao').catch(() => null)]);
  const c = cfg || {};
  ctx._resc = { procs, cfg: c.modelo === 2 && c.itens && c.itens.length ? { itens: c.itens, perfis: c.perfis } : converter(c.itens && c.itens.length ? c.itens : RESC_ITENS_PADRAO, c.perfis && c.perfis.length ? c.perfis : RESC_PERFIS_PADRAO) };
  return ctx._resc;
}
// Itens do perfil: lista própria do perfil ou, sem lista, os gerais + os condicionais do perfil.
export function itensDoPerfil(cfg, perfilId) {
  return cfg.itens.filter(i => !i.perfis || !i.perfis.length || i.perfis.includes(perfilId));
}
// Modelo do novaRH (perfil com lista própria ou condições adm/lider/mot) → cada item diz para quais perfis vale.
function converter(itens, perfis) {
  const antigo = (p) => p.itens && p.itens.length ? itens.filter(i => p.itens.includes(i.id)) : itens.filter(i => !i.conds || !i.conds.length || i.conds.some(c => (p.conds || []).includes(c)));
  const conj = new Map(perfis.map(p => [p.id, new Set(antigo(p).map(i => i.id))]));
  return { perfis: perfis.map(p => ({ id: p.id, nome: p.nome })), itens: itens.map(i => { const pf = perfis.filter(p => conj.get(p.id).has(i.id)).map(p => p.id); return { id: i.id, setor: i.setor, texto: i.texto, perfis: pf.length === perfis.length ? [] : pf }; }) };
}
const nomePerfil = (cfg, id) => (cfg.perfis.find(p => p.id === id) || { nome: id || '—' }).nome;
function perfilSugerido(cfg, x, tipo) {
  const t = norm(x.c), achar = n => (cfg.perfis.find(p => norm(p.nome) === n) || {}).id;
  if (tipo === 'termino_experiencia') return achar(/assist|analista|auxiliar adm|administ/.test(t) ? 'administrativo - termino de experiencia' : 'operacional - termino de experiencia') || achar('operacional');
  if (/aprendiz/.test(norm(x.t)) || /aprendiz/.test(t)) return achar('menor aprendiz');
  if (/motorista/.test(t)) return achar('motorista');
  if (/coorden|gerente|supervis|encarreg|lider/.test(t)) return achar('lideranca');
  if (/vendedor|comercial|representante/.test(t)) return achar('comercial');
  if (/assist|analista|administ|comprador|contador|advog/.test(t)) return achar('administrativo');
  return achar('operacional') || cfg.perfis[0].id;
}

export async function render(el, ctx, id) {
  if (id) return detalhe(el, ctx, id);
  const [R, resumo] = await Promise.all([carregarResc(ctx, true), ctx.resumo().catch(() => ({ itens: [] }))]);
  const meuSetor = ctx.perfil.setorRescisao || '';
  const andamento = R.procs.filter(p => p.status !== 'finalizado'), fin = R.procs.filter(p => p.status === 'finalizado');
  const comProc = new Set(R.procs.filter(p => p.status !== 'finalizado').map(p => p.pid));
  const sugeridos = resumo.itens.filter(x => x.g === 'desligando' && !comProc.has(x.i));
  const pendSetor = p => itensDoPerfil(R.cfg, p.perfil).filter(i => i.setor === meuSetor && !feito((p.checks || {})[i.id])).length;
  const prog = p => { const it = itensDoPerfil(R.cfg, p.perfil); const f = it.filter(i => feito((p.checks || {})[i.id])).length; return it.length ? Math.round(f / it.length * 100) : 100; };
  let lista = aba === 'andamento' ? andamento : aba === 'finalizado' ? fin : R.procs;
  if (meus && meuSetor) lista = lista.filter(p => pendSetor(p) > 0);
  lista = lista.slice().sort((a, b) => (b.deslig || '').localeCompare(a.deslig || ''));

  el.innerHTML = tit('ti-door-exit', 'Rescisão', 'Checklist do desligamento por setor, homologação e registro no dossiê',
    `<button class="btn prim" id="novo"><i class="ti ti-plus"></i>Novo desligamento</button>${ctx.admin() ? '<button class="btn ghost" id="cfg"><i class="ti ti-settings"></i>Configurar checklist</button>' : ''}`)
    + kpis([['Em andamento', andamento.length, 'desligamentos abertos'], [meuSetor ? 'Para o ' + RESC_SETORES[meuSetor] : 'Seu setor', meuSetor ? andamento.filter(p => pendSetor(p)).length : '—', meuSetor ? 'com itens do seu setor' : 'defina em Usuários e acessos', meuSetor && andamento.some(p => pendSetor(p)) ? 'neutro' : 'sobe'], ['Homologações em 7 dias', andamento.filter(p => p.homologacao && p.homologacao.data && p.homologacao.data >= hojeISO() && p.homologacao.data <= somarDias(hojeISO(), 7)).length, ''], ['Finalizados no mês', fin.filter(p => (p.finalizadoEm || '').slice(0, 7) === hojeISO().slice(0, 7)).length, '']])
    + (sugeridos.length ? card('Em desligamento no FO1029, sem processo aqui', sugeridos.map(x => `<div class="anexo"><span class="av">${esc(iniciais(x.n))}</span><div><b>${esc(x.n)}</b><small class="muted" style="display:block">${esc(x.c)} · ${esc(x.f)} · matrícula ${esc(x.m)} · ${esc(x.st)}</small></div><button class="btn sm prim" data-ini="${esc(x.i)}">Iniciar</button></div>`).join('')) + '<div class="mt"></div>' : '')
    + `<section class="card"><div class="card-h" style="flex-wrap:wrap;gap:10px"><div class="filtros">${[['andamento', 'Em andamento', andamento.length], ['finalizado', 'Finalizados', fin.length], ['todos', 'Todos', R.procs.length]].map(f => `<button data-a="${f[0]}" class="${f[0] === aba ? 'on' : ''}">${f[1]} (${f[2]})</button>`).join('')}</div>${meuSetor ? `<label class="small" style="margin-left:auto;display:flex;gap:6px;align-items:center"><input type="checkbox" id="meus" ${meus ? 'checked' : ''} style="accent-color:var(--verde)"> Só com itens do ${esc(RESC_SETORES[meuSetor])}</label>` : ''}</div>
      <div class="card-b">${lista.length ? `<div class="tw"><table class="tb"><thead><tr><th>Pessoa</th><th>Tipo</th><th>Desligamento</th><th>Homologação</th><th>Checklist</th></tr></thead><tbody>${lista.slice(0, 150).map(p => { const pr = prog(p), ps = meuSetor ? pendSetor(p) : 0;
        return `<tr class="clic" data-p="${esc(p.id)}"><td><b>${esc(p.nome)}</b><small class="muted" style="display:block">${esc(p.cargo || '')}${p.matricula ? ' · matrícula ' + esc(p.matricula) : ''}${p.legado ? ' · sistema antigo' : ''}</small></td><td class="small">${esc(nomeTipo(p.tipo))}<br><span class="muted">${esc(nomePerfil(R.cfg, p.perfil))}</span></td><td class="small">${fmtData(p.deslig)}</td>
          <td class="small">${p.homologacao && p.homologacao.data ? fmtData(p.homologacao.data) + (p.homologacao.hora ? ' ' + esc(p.homologacao.hora) : '') : '—'}</td>
          <td><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div class="progresso" style="width:80px;margin:0"><i style="width:${pr}%"></i></div><span class="small"><b>${pr}%</b></span>${p.status === 'finalizado' ? st('ok', 'Finalizado') : ps ? st('hoje', ps + ' do seu setor') : ''}</div></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted" style="margin:6px 0">Nada aqui.</p>'}</div></section>`;

  $$('[data-a]').forEach(b => b.onclick = () => { aba = b.dataset.a; render(el, ctx); });
  if ($('#meus')) $('#meus').onchange = e => { meus = e.target.checked; render(el, ctx); };
  $$('tr[data-p]').forEach(tr => tr.onclick = () => { location.hash = '#/rescisao/' + tr.dataset.p; });
  $('#novo').onclick = () => novo(ctx, R, resumo).then(nid => { if (nid) location.hash = '#/rescisao/' + nid; });
  $$('[data-ini]').forEach(b => b.onclick = () => novo(ctx, R, resumo, resumo.itens.find(x => x.i === b.dataset.ini)).then(nid => { if (nid) location.hash = '#/rescisao/' + nid; }));
  if ($('#cfg')) $('#cfg').onclick = () => configurar(ctx, R).then(m => m && render(el, ctx));
}

// Novo desligamento: escolhe a pessoa (do FO1029), o tipo, a data e o perfil.
export async function novo(ctx, R, resumo, pre) {
  R = R || await carregarResc(ctx); resumo = resumo || await ctx.resumo();
  let x = pre || null, res = null;
  const ativos = resumo.itens.filter(i => i.g !== 'desligado');
  const corpo = `<div class="campo" id="n-busca-c" ${x ? 'hidden' : ''}><label for="n-busca">Pessoa</label><input class="inp" id="n-busca" placeholder="Nome ou matrícula" autocomplete="off"><div id="n-res" style="display:grid;gap:4px;margin-top:6px"></div></div>
    <div id="n-sel">${x ? `<div class="ok-msg"><b>${esc(x.n)}</b> · ${esc(x.c)} · matrícula ${esc(x.m)}</div>` : ''}</div>
    <div class="linha2"><div class="campo"><label for="n-tipo">Tipo</label><select class="inp" id="n-tipo">${TIPOS_DESLIG.map(t => `<option value="${t[0]}">${esc(t[1])}</option>`).join('')}</select></div><div class="campo"><label for="n-data">Data do desligamento</label><input class="inp" type="date" id="n-data" value="${hojeISO()}"></div></div>
    <div class="campo"><label for="n-perfil">Perfil do checklist</label><select class="inp" id="n-perfil">${R.cfg.perfis.map(p => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('')}</select></div>
    <div class="linha2" id="n-exp" hidden><div class="campo"><label for="n-ini">Iniciativa</label><select class="inp" id="n-ini"><option value="empresa">Da empresa</option><option value="empregado">Do empregado</option></select></div><div class="campo"><label for="n-exptipo">Momento</label><select class="inp" id="n-exptipo"><option value="45">Aos 45 dias</option><option value="90">Aos 90 dias</option><option value="antecipado">Antecipado</option></select></div></div>
    <div class="campo"><label for="n-obs">Observação</label><textarea class="inp" id="n-obs" rows="2"></textarea></div><div id="n-msg"></div>`;
  const r = await modal({ titulo: 'Novo desligamento', corpo, larga: true, botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Iniciar', cls: 'prim' }],
    aoAbrir: bg => {
      const sug = () => { if (x) $('#n-perfil', bg).value = perfilSugerido(R.cfg, x, $('#n-tipo', bg).value) || $('#n-perfil', bg).value; $('#n-exp', bg).hidden = $('#n-tipo', bg).value !== 'termino_experiencia'; };
      $('#n-tipo', bg).onchange = sug; sug();
      const b = $('#n-busca', bg); if (b) b.oninput = () => {
        const t = norm(b.value.trim()); const l = t.length < 2 ? [] : ativos.filter(i => norm(i.n).includes(t) || i.m === b.value.trim()).slice(0, 8);
        $('#n-res', bg).innerHTML = l.map(i => `<button type="button" class="btn sm" style="justify-content:flex-start" data-x="${esc(i.i)}">${esc(i.n)} · ${esc(i.c)} · ${esc(i.m)}</button>`).join('');
        $$('[data-x]', bg).forEach(k => k.onclick = () => { x = ativos.find(i => i.i === k.dataset.x); $('#n-sel', bg).innerHTML = `<div class="ok-msg"><b>${esc(x.n)}</b> · ${esc(x.c)} · matrícula ${esc(x.m)}</div>`; $('#n-busca-c', bg).hidden = true; sug(); });
      };
    },
    antesDeFechar: async (b, bg) => {
      if (!x) { $('#n-msg', bg).innerHTML = '<div class="erro-msg">Escolha a pessoa.</div>'; return false; }
      if (R.procs.some(p => p.pid === x.i && p.status !== 'finalizado')) { $('#n-msg', bg).innerHTML = '<div class="erro-msg">Já existe um desligamento em andamento para esta pessoa.</div>'; return false; }
      const tipo = $('#n-tipo', bg).value;
      try {
        res = await ctx.D.criar('rescisoes', { pid: x.i, nome: x.n, cpfMasc: x.cm, matricula: x.m, cargo: x.c, setor: x.s, empresa: x.e, filial: x.f, admissao: x.a, deslig: $('#n-data', bg).value || hojeISO(), tipo, perfil: $('#n-perfil', bg).value,
          ...(tipo === 'termino_experiencia' ? { expIniciativa: $('#n-ini', bg).value, expTipo: $('#n-exptipo', bg).value } : {}), obs: $('#n-obs', bg).value.trim(), checks: {}, status: 'andamento', porNome: ctx.nome(), historico: [{ dt: new Date().toISOString(), acao: 'Desligamento iniciado', por: ctx.nome() }] });
      } catch (e) { $('#n-msg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
    } });
  if (r === 'ok' && res) { ctx._resc = null; toast('Desligamento iniciado.'); return res; }
  return null;
}

async function detalhe(el, ctx, id) {
  const R = await carregarResc(ctx, true);
  const p = R.procs.find(x => x.id === id);
  if (!p) { el.innerHTML = vazio('ti-file-off', 'Desligamento não encontrado', '', '<a class="btn" href="#/rescisao"><i class="ti ti-arrow-left"></i>Voltar</a>'); return; }
  const itens = itensDoPerfil(R.cfg, p.perfil), checks = p.checks || {}, fechado = p.status === 'finalizado';
  const meuSetor = ctx.perfil.setorRescisao || '';
  const pr = itens.length ? Math.round(itens.filter(i => feito(checks[i.id])).length / itens.length * 100) : 100;
  const setores = Object.keys(RESC_SETORES).filter(s => itens.some(i => i.setor === s)).sort((a, b) => (a === meuSetor ? -1 : 0) - (b === meuSetor ? -1 : 0));
  const h = p.homologacao || {};
  const anexos = await ctx.D.anexosDe('rescisoes', id).catch(() => []);
  const item = i => { const e = checks[i.id], ok = feito(e);
    return `<div class="item${ok ? ' feito' : ''}"><input type="checkbox" data-i="${esc(i.id)}"${ok ? ' checked' : ''}${fechado ? ' disabled' : ''} aria-label="${esc(i.texto)}"><span><b>${esc(i.texto)}</b>${e && e.obs ? `<span class="it">Obs.: ${esc(e.obs)}</span>` : ''}</span><span class="quem">${!e ? (fechado ? '' : `<button class="btn sm ghost" data-na="${esc(i.id)}">N/A</button>`) : e === 'na' ? 'Não se aplica' : esc((e.porNome || '').split(' ').slice(0, 2).join(' ')) + ', ' + fq(e.em)}</span></div>`; };

  el.innerHTML = `<button class="btn ghost sm" id="voltar" style="margin-bottom:12px"><i class="ti ti-arrow-left"></i>Rescisões</button>
  <section class="card" style="padding-bottom:22px"><div class="chk-h"><div><div class="small muted">${esc(p.cargo || '')}${p.matricula ? ' · matrícula ' + esc(p.matricula) : ''}${p.filial ? ' · ' + esc(p.filial) : ''}${p.admissao ? ' · admitido em ' + fmtData(p.admissao) : ''}</div>
      <h2 class="d" style="font-size:24px;font-weight:850;margin-top:3px">${esc(p.nome)}</h2>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">${fechado ? st('ok', 'Finalizado em ' + fmtData((p.finalizadoEm || '').slice(0, 10))) : st('pend', 'Em andamento')}${pill(nomeTipo(p.tipo))}${pill('Desligamento ' + fmtData(p.deslig))}${pill('Perfil ' + nomePerfil(R.cfg, p.perfil))}${p.expTipo ? pill('Experiência: ' + (p.expTipo === 'antecipado' ? 'antecipado' : p.expTipo + ' dias') + ' · iniciativa ' + (p.expIniciativa === 'empregado' ? 'do empregado' : 'da empresa')) : ''}${p.pid && ctx.pode('pessoas') ? `<a class="btn sm" href="#/pessoa/${esc(p.pid)}"><i class="ti ti-folder-open"></i>Pasta da pessoa</a>` : ''}</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" id="imp"><i class="ti ti-printer"></i>Checklist para o dossiê</button>${fechado ? '' : '<button class="btn sm ghost" id="editar"><i class="ti ti-pencil"></i>Tipo, data e perfil</button>'}</div></div>
    <div class="anel" style="--p:${pr}"><span>${pr}%</span></div></div>
    ${p.obs ? `<div class="auto" style="margin:10px 22px 0"><i class="ti ti-note"></i>${esc(p.obs)}</div>` : ''}
    ${setores.map(s => { const l = itens.filter(i => i.setor === s), pend = l.filter(i => !feito(checks[i.id])).length; return `<div class="bloco"${s === meuSetor ? ' style="border-color:var(--verde)"' : ''}><h4 class="d"><i class="ti ti-building"></i>${esc(RESC_SETORES[s] || s)}${s === meuSetor ? ' <small class="muted" style="font-weight:500">· seu setor</small>' : ''} ${pend ? pill(pend + ' pendente' + (pend > 1 ? 's' : ''), 'amb') : pill('Completo', 'ok')}</h4>${l.map(item).join('')}</div>`; }).join('')}
    <div class="bloco"><h4 class="d"><i class="ti ti-calendar-event"></i>Homologação</h4><div style="padding:12px 16px;display:grid;gap:10px">
      <div class="linha3"><div class="campo"><label for="h-data">Data</label><input class="inp" type="date" id="h-data" value="${esc(h.data || '')}"${fechado ? ' disabled' : ''}></div><div class="campo"><label for="h-hora">Hora</label><input class="inp" type="time" id="h-hora" value="${esc(h.hora || '')}"${fechado ? ' disabled' : ''}></div><div class="campo"><label for="h-local">Local</label><input class="inp" id="h-local" value="${esc(h.local || '')}" placeholder="Raguife, sindicato…"${fechado ? ' disabled' : ''}></div></div>
      <div class="campo"><label for="h-obs">Observação</label><input class="inp" id="h-obs" value="${esc(h.obs || '')}"${fechado ? ' disabled' : ''}></div>${fechado ? '' : '<div><button class="btn sm" id="h-salvar">Salvar homologação</button></div>'}</div></div>
    <div class="bloco"><h4 class="d"><i class="ti ti-paperclip"></i>Documentos anexados ${pill(String(anexos.length))}</h4><div style="padding:6px 16px 12px">${anexos.map(a => `<div class="anexo"><span class="ic"><i class="ti ti-file-text"></i></span><div><b>${esc(a.descricao || a.nome)}</b><small class="muted"> · ${fmtDataHora(a.criadoEm)} · ${esc(a.porNome || '')}</small></div><button class="btn sm" data-ver="${esc(a.caminho)}">Abrir</button></div>`).join('')}
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><input class="inp" id="an-desc" placeholder="Descrição (ex.: TRCT assinado, carta de demissão)" style="flex:1;min-width:200px"><label class="btn sm"><i class="ti ti-upload"></i>Anexar PDF ou foto<input type="file" id="an-arq" accept="application/pdf,image/*" hidden></label><span class="progresso" id="an-prog" hidden style="flex:1;min-width:80px"><i></i></span></div></div></div>
    <div style="display:flex;gap:8px;margin:18px 22px 0;flex-wrap:wrap">${fechado ? (ctx.admin() ? '<button class="btn" id="reabrir">Reabrir</button>' : '') : `<button class="btn prim" id="finalizar"${pr < 100 ? ' disabled title="Conclua ou marque N/A em todos os itens"' : ''}><i class="ti ti-circle-check"></i>Finalizar desligamento</button>`}</div>
  </section>`;

  const recarregar = () => detalhe(el, ctx, id);
  const salvar = async (dados, acao) => { try { await ctx.D.atualizar('rescisoes', id, { ...dados, historico: [...(p.historico || []), { dt: new Date().toISOString(), acao, por: ctx.nome() }].slice(-200) }); ctx._resc = null; recarregar(); } catch (e) { toast(erroAmigavel(e), 'erro'); } };
  $('#voltar').onclick = () => { location.hash = '#/rescisao'; };
  $$('[data-i]').forEach(cb => cb.onchange = async () => {
    const i = itens.find(x => x.id === cb.dataset.i); const novo = { ...checks };
    if (cb.checked) novo[i.id] = { em: new Date().toISOString(), porNome: ctx.nome(), porUid: ctx.uid };
    else { if (!(await confirmar('Desmarcar', `Desmarcar "${esc(i.texto)}"?`, 'Desmarcar'))) { cb.checked = true; return; } delete novo[i.id]; }
    salvar({ checks: novo }, (cb.checked ? 'Marcou: ' : 'Desmarcou: ') + i.texto);
  });
  $$('[data-na]').forEach(b => b.onclick = () => { const i = itens.find(x => x.id === b.dataset.na); salvar({ checks: { ...checks, [i.id]: 'na' } }, 'Não se aplica: ' + i.texto); });
  if ($('#h-salvar')) $('#h-salvar').onclick = () => salvar({ homologacao: { ...h, data: $('#h-data').value, hora: $('#h-hora').value, local: $('#h-local').value.trim(), obs: $('#h-obs').value.trim() } }, 'Homologação salva');
  $$('[data-ver]').forEach(b => b.onclick = async () => { try { window.open(await ctx.D.urlAnexo(b.dataset.ver), '_blank'); } catch (e) { toast(erroAmigavel(e), 'erro'); } });
  $('#an-arq').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 15 * 1024 * 1024) return toast('O arquivo passa de 15 MB.', 'erro');
    if (!(f.type === 'application/pdf' || f.type.startsWith('image/'))) return toast('Use PDF ou imagem.', 'erro');
    $('#an-prog').hidden = false;
    try { await ctx.D.enviarAnexoEm('rescisoes', id, f, $('#an-desc').value.trim() || f.name, x => { $('#an-prog i').style.width = (x * 100) + '%'; }, ctx.nome()); toast('Documento anexado.'); recarregar(); }
    catch (err) { toast(erroAmigavel(err), 'erro'); $('#an-prog').hidden = true; }
  };
  if ($('#editar')) $('#editar').onclick = async () => {
    let d = null;
    const r = await modal({ titulo: 'Tipo, data e perfil', corpo: `<div class="linha2"><div class="campo"><label for="e-tipo">Tipo</label><select class="inp" id="e-tipo">${TIPOS_DESLIG.map(t => `<option value="${t[0]}"${t[0] === p.tipo ? ' selected' : ''}>${esc(t[1])}</option>`).join('')}</select></div><div class="campo"><label for="e-data">Data</label><input class="inp" type="date" id="e-data" value="${esc(p.deslig || '')}"></div></div><div class="campo"><label for="e-perfil">Perfil</label><select class="inp" id="e-perfil">${R.cfg.perfis.map(x => `<option value="${esc(x.id)}"${x.id === p.perfil ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}</select><span class="ajuda">Os itens já marcados ficam guardados.</span></div>`,
      botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }], antesDeFechar: (b, bg) => { d = { tipo: $('#e-tipo', bg).value, deslig: $('#e-data', bg).value, perfil: $('#e-perfil', bg).value }; } });
    if (r === 'ok' && d) salvar(d, 'Dados do desligamento alterados');
  };
  if ($('#finalizar')) $('#finalizar').onclick = async () => {
    if (!(await confirmar('Finalizar desligamento', `Finalizar o desligamento de <b>${esc(p.nome)}</b>? Entra um registro "Desligamento" na linha do tempo da pessoa.`, 'Finalizar'))) return;
    try {
      if (p.pid && ctx.pode('pessoas')) await ctx.D.novoEvento(p.pid, { tipo: 'Desligamento', data: p.deslig || hojeISO(), titulo: nomeTipo(p.tipo) + (h.data ? ' · homologação ' + fmtData(h.data) : ''), obs: p.obs || '', porNome: ctx.nome() }).catch(() => {});
      await salvar({ status: 'finalizado', finalizadoEm: new Date().toISOString() }, 'Desligamento finalizado');
      toast('Desligamento finalizado.');
    } catch (e) { toast(erroAmigavel(e), 'erro'); }
  };
  if ($('#reabrir')) $('#reabrir').onclick = () => salvar({ status: 'andamento' }, 'Desligamento reaberto');
  $('#imp').onclick = () => {
    const w = window.open('', '_blank'); if (!w) return toast('Permita pop-ups para imprimir.', 'erro');
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Desligamento · ${esc(p.nome)}</title><style>body{font:12.5px/1.55 Arial,sans-serif;color:#15201a;margin:30px}h1{font-size:19px;margin:0;color:#01361d}h2{font-size:14px;color:#01361d;border-bottom:2px solid #9dcd46;padding-bottom:3px;margin-top:20px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #dbe4dc;padding:5px;text-align:left}small{color:#55635a}.cab{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:4px solid #01361d;padding-bottom:10px}.ass{margin-top:60px;display:flex;gap:40px}.ass div{flex:1;border-top:1px solid #15201a;padding-top:4px;text-align:center}</style></head><body>
      <div class="cab"><div><h1>Checklist de desligamento</h1><small>${esc(p.nome)} · ${esc(p.cargo || '')} · matrícula ${esc(p.matricula || '')} · ${esc(nomeTipo(p.tipo))} · ${fmtData(p.deslig)}</small></div><small>Raguife · Gestão de Pessoas<br>Emitido em ${new Date().toLocaleString('pt-BR')} por ${esc(ctx.nome())}</small></div>
      ${setores.map(s => `<h2>${esc(RESC_SETORES[s] || s)}</h2><table><tr><th>Item</th><th>Feito por</th><th>Quando</th></tr>${itens.filter(i => i.setor === s).map(i => { const e = checks[i.id]; return `<tr><td>${esc(i.texto)}</td><td>${!e ? '—' : e === 'na' ? 'Não se aplica' : esc(e.porNome || '')}</td><td>${e && e.em ? fq(e.em) : ''}</td></tr>`; }).join('')}</table>`).join('')}
      <h2>Homologação</h2><p>${h.data ? fmtData(h.data) + ' ' + esc(h.hora || '') + ' · ' + esc(h.local || '') : 'Não informada'}</p><div class="ass"><div>Responsável pelo RH</div><div>Colaborador</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };
}

async function configurar(ctx, R) {
  const { editarChecklist } = await import('../checklist-editor.js?v=13');
  const ok = await editarChecklist({ titulo: 'Checklist da rescisão', nomeGrupo: 'Setor',
    itens: R.cfg.itens.map(i => ({ ...i, grupo: i.setor })), perfis: R.cfg.perfis, grupos: Object.entries(RESC_SETORES), campos: {},
    padrao: () => { const c = converter(RESC_ITENS_PADRAO, RESC_PERFIS_PADRAO); return { itens: c.itens.map(i => ({ ...i, grupo: i.setor })), perfis: c.perfis }; },
    aoSalvar: (itens, perfis) => ctx.D.salvarConfig('rescisao', { modelo: 2, perfis, itens: itens.map(i => ({ id: i.id, setor: i.grupo, texto: i.texto, perfis: i.perfis })) }) });
  if (ok) ctx._resc = null;
  return ok;
}
