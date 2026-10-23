// Equipe RH: demandas recorrentes com prazo e KPI, quem é quem (áreas e colaboradores) e funções.
import { $, $$, esc, iniciais, tit, kpis, card, st, pill, fmtData, fmtPct, hojeISO, somarDias, diasEntre, modal, toast, erroAmigavel, confirmar, norm } from '../ui.js?v=13';

const PER = ['Única', 'Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'];
const PRI = [['alta', 'Alta', 'atr'], ['media', 'Média', 'pend'], ['baixa', 'Baixa', '']];
const F = { aba: 'demandas', resp: '', sit: 'abertas', q: '' };
function proximoPrazo(per, d) {
  if (!per || per === 'Única' || !d) return null;
  const x = new Date(d + 'T12:00:00');
  const dias = { 'Diária': 1, 'Semanal': 7, 'Quinzenal': 14 }[per];
  if (dias) { x.setDate(x.getDate() + dias); if (per === 'Diária') while ([0, 6].includes(x.getDay())) x.setDate(x.getDate() + 1); }
  else x.setMonth(x.getMonth() + ({ 'Mensal': 1, 'Bimestral': 2, 'Trimestral': 3, 'Semestral': 6, 'Anual': 12 }[per] || 1));
  return x.toISOString().slice(0, 10);
}

export async function render(el, ctx) {
  const [areas, colabs, funcoes, demandas] = await Promise.all(['equipe_areas', 'equipe_colaboradores', 'equipe_funcoes', 'equipe_demandas'].map(c => ctx.D.listar(c).catch(() => [])));
  const vivo = x => !x.apagado;
  const A = areas.filter(vivo), C = colabs.filter(vivo).sort((a, b) => a.nome.localeCompare(b.nome)), FN = funcoes.filter(vivo), D = demandas.filter(vivo);
  const nomeC = id => (C.find(c => c.id === id) || { nome: '—' }).nome, area = id => A.find(a => a.id === id) || { nome: '—', cor: '#86978b' };
  const hoje = hojeISO(), mes = hoje.slice(0, 7);
  const eu = C.find(c => norm(c.nome) === norm(ctx.nome())) || C.find(c => norm(c.nome).split(' ')[0] === norm(ctx.nome()).split(' ')[0] && norm(c.nome).split(' ').slice(-1)[0] === norm(ctx.nome()).split(' ').slice(-1)[0]);
  const abertas = D.filter(d => d.status === 'pendente'), atras = abertas.filter(d => d.dataPrevista && d.dataPrevista < hoje);
  const doMes = D.filter(d => d.status !== 'pendente' && (d.dataConclusao || '').slice(0, 7) === mes && !d.excluirKPI);
  const noPrazo = l => l.length ? l.filter(d => d.status === 'concluido').length / l.length * 100 : 0;

  el.innerHTML = tit('ti-users-group', 'Equipe RH', 'Demandas da equipe com prazo e recorrência, quem é quem e funções', `<button class="btn prim" id="nova"><i class="ti ti-plus"></i>Nova demanda</button>`)
    + kpis([['Abertas', abertas.length, eu ? abertas.filter(d => d.respId === eu.id).length + ' suas' : ''], ['Atrasadas', atras.length, 'prazo vencido', atras.length ? 'desce' : 'sobe'], ['Concluídas no mês', doMes.length, ''], ['No prazo (mês)', fmtPct(noPrazo(doMes), 0), 'das concluídas que contam no KPI']])
    + `<div class="filtros" style="margin-bottom:14px;flex-wrap:wrap">${[['demandas', 'ti-checklist', 'Demandas'], ['kpi', 'ti-chart-bar', 'Indicadores'], ['equipe', 'ti-sitemap', 'Quem é quem'], ['funcoes', 'ti-briefcase', 'Funções']].map(([k, ic, n]) => `<button data-aba="${k}" class="${k === F.aba ? 'on' : ''}"><i class="ti ${ic}"></i> ${n}</button>`).join('')}</div><div id="corpo"></div>`;
  const corpo = $('#corpo'), re = () => render(el, ctx);

  if (F.aba === 'demandas') {
    const t = norm(F.q);
    const l = D.filter(d => (!F.resp || (F.resp === 'eu' ? eu && d.respId === eu.id : d.respId === F.resp))
      && (F.sit === 'todas' || (F.sit === 'abertas' ? d.status === 'pendente' : F.sit === 'atrasadas' ? d.status === 'pendente' && d.dataPrevista < hoje : d.status !== 'pendente'))
      && (!t || norm(d.nome + ' ' + d.obs).includes(t)))
      .sort((a, b) => F.sit === 'concluidas' ? (b.dataConclusao || '').localeCompare(a.dataConclusao || '') : (a.dataPrevista || '').localeCompare(b.dataPrevista || ''));
    corpo.innerHTML = `<div class="filtros-l" style="margin-bottom:14px"><label class="busca"><i class="ti ti-search"></i><input id="q" placeholder="Buscar demanda" value="${esc(F.q)}"></label>
      <select class="inp" id="f-resp" style="width:auto"><option value="">Toda a equipe</option>${eu ? `<option value="eu"${F.resp === 'eu' ? ' selected' : ''}>Só as minhas</option>` : ''}${C.map(c => `<option value="${esc(c.id)}"${c.id === F.resp ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
      <select class="inp" id="f-sit" style="width:auto">${[['abertas', 'Abertas'], ['atrasadas', 'Atrasadas'], ['concluidas', 'Concluídas'], ['todas', 'Todas']].map(([k, n]) => `<option value="${k}"${k === F.sit ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <section class="card"><div class="card-b">${l.length ? `<div class="tw"><table class="tb"><thead><tr><th>Demanda</th><th>Responsável</th><th>Prazo</th><th>Situação</th><th></th></tr></thead><tbody>${l.slice(0, 300).map(d => { const atr = d.status === 'pendente' && d.dataPrevista < hoje, hj = d.status === 'pendente' && d.dataPrevista === hoje; const pr = PRI.find(p => p[0] === d.prioridade) || PRI[1];
        return `<tr class="clic" data-d="${esc(d.id)}"><td><b>${esc(d.nome)}</b>${d.periodicidade && d.periodicidade !== 'Única' ? ` <i class="ti ti-repeat muted" title="${esc(d.periodicidade)}"></i>` : ''}<small class="muted" style="display:block">${esc(d.periodicidade || 'Única')} · prioridade ${pr[1].toLowerCase()}${d.obs ? ' · ' + esc(d.obs.slice(0, 80)) : ''}</small></td><td class="small">${esc(nomeC(d.respId))}</td><td class="small">${fmtData(d.dataPrevista)}</td>
          <td>${d.status === 'pendente' ? (atr ? st('atr', `${diasEntre(d.dataPrevista, hoje)} dia(s) de atraso`) : hj ? st('hoje') : st('pend')) : st(d.status === 'concluido' ? 'ok' : 'atr', d.status === 'concluido' ? 'No prazo' : 'Com atraso')}${d.excluirKPI ? ' ' + pill('fora do KPI') : ''}</td>
          <td style="text-align:right">${d.status === 'pendente' ? `<button class="btn sm prim" data-ok="${esc(d.id)}"><i class="ti ti-check"></i>Concluir</button>` : `<small class="muted">${fmtData(d.dataConclusao)}</small>`}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted" style="margin:6px 0">Nada aqui.</p>'}</div></section>`;
    $('#q').oninput = e => { F.q = e.target.value; clearTimeout(el._t); el._t = setTimeout(() => re().then(() => { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }), 250); };
    $('#f-resp').onchange = e => { F.resp = e.target.value; re(); };
    $('#f-sit').onchange = e => { F.sit = e.target.value; re(); };
    $$('[data-ok]').forEach(b => b.onclick = ev => { ev.stopPropagation(); concluir(ctx, D.find(d => d.id === b.dataset.ok), eu).then(m => m && re()); });
    $$('tr[data-d]').forEach(tr => tr.onclick = () => editarDemanda(ctx, D.find(d => d.id === tr.dataset.d), C, eu).then(m => m && re()));
  }
  if (F.aba === 'kpi') {
    const meses = []; for (let k = 5; k >= 0; k--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); meses.push(d.toISOString().slice(0, 7)); }
    const conta = (cid, m) => { const l = D.filter(d => d.respId === cid && d.status !== 'pendente' && !d.excluirKPI && (d.dataConclusao || '').slice(0, 7) === m); return l.length ? Math.round(noPrazo(l)) + '% · ' + l.length : '—'; };
    corpo.innerHTML = card('Concluídas no prazo, por pessoa e mês (percentual · quantidade)', `<div class="tw"><table class="tb"><thead><tr><th>Pessoa</th>${meses.map(m => `<th>${m.split('-').reverse().join('/')}</th>`).join('')}<th>Abertas</th><th>Atrasadas</th></tr></thead><tbody>${C.map(c => `<tr><td><b>${esc(c.nome)}</b><small class="muted" style="display:block">${esc(area(c.area).nome)}</small></td>${meses.map(m => `<td class="small">${conta(c.id, m)}</td>`).join('')}<td>${abertas.filter(d => d.respId === c.id).length}</td><td>${atras.filter(d => d.respId === c.id).length || ''}</td></tr>`).join('')}</tbody></table></div><p class="small muted" style="margin:8px 0 0">Demandas marcadas "fora do KPI" não entram na conta.</p>`);
  }
  if (F.aba === 'equipe') {
    corpo.innerHTML = A.map(a => `<section class="card" style="margin-bottom:14px;border-left:5px solid ${esc(a.cor || 'var(--verde)')}"><div class="card-h"><h3 class="d">${esc(a.nome)}</h3><button class="btn sm ghost" data-ea="${esc(a.id)}"><i class="ti ti-pencil"></i></button></div><div class="card-b">${C.filter(c => c.area === a.id).map(c => `<div class="anexo clic" data-c="${esc(c.id)}" style="cursor:pointer"><span class="av">${esc(iniciais(c.nome))}</span><div><b>${esc(c.nome)}</b><small class="muted" style="display:block">${esc(c.cargo || '')}${c.reportaPara ? ' · reporta para ' + esc(nomeC(c.reportaPara)) : ''}</small></div><span class="small muted">${abertas.filter(d => d.respId === c.id).length} abertas</span></div>`).join('') || '<p class="small muted" style="margin:0">Ninguém nesta área.</p>'}</div></section>`).join('')
      + `<div style="display:flex;gap:8px"><button class="btn" id="nc"><i class="ti ti-user-plus"></i>Nova pessoa</button><button class="btn ghost" id="na"><i class="ti ti-plus"></i>Nova área</button></div>`;
    $$('[data-c]').forEach(x => x.onclick = () => editarColab(ctx, C.find(c => c.id === x.dataset.c), A, C).then(m => m && re()));
    $$('[data-ea]').forEach(x => x.onclick = () => editarArea(ctx, A.find(a => a.id === x.dataset.ea)).then(m => m && re()));
    $('#nc').onclick = () => editarColab(ctx, null, A, C).then(m => m && re());
    $('#na').onclick = () => editarArea(ctx, null).then(m => m && re());
  }
  if (F.aba === 'funcoes') {
    corpo.innerHTML = FN.map(f => `<section class="card" style="margin-bottom:14px"><div class="card-h"><h3 class="d">${esc(f.nome)}</h3>${pill(area(f.area).nome)}<button class="btn sm ghost" data-ef="${esc(f.id)}" style="margin-left:8px"><i class="ti ti-pencil"></i></button></div><div class="card-b">${f.desc ? `<p class="small" style="margin:0 0 8px">${esc(f.desc)}</p>` : ''}<ul style="margin:0;padding-left:18px;display:grid;gap:4px">${(f.atividades || []).map(a => `<li class="small">${esc(a)}</li>`).join('')}</ul></div></section>`).join('') + '<button class="btn" id="nf"><i class="ti ti-plus"></i>Nova função</button>';
    $$('[data-ef]').forEach(x => x.onclick = () => editarFuncao(ctx, FN.find(f => f.id === x.dataset.ef), A).then(m => m && re()));
    $('#nf').onclick = () => editarFuncao(ctx, null, A).then(m => m && re());
  }
  $$('[data-aba]').forEach(b => b.onclick = () => { F.aba = b.dataset.aba; re(); });
  $('#nova').onclick = () => editarDemanda(ctx, null, C, eu).then(m => m && re());
}

async function concluir(ctx, d, eu) {
  let ok = false;
  const r = await modal({ titulo: 'Concluir demanda', corpo: `<div class="small muted">${esc(d.nome)} · prazo ${fmtData(d.dataPrevista)}</div><div class="campo"><label for="c-dt">Concluída em</label><input class="inp" type="date" id="c-dt" value="${hojeISO()}" max="${hojeISO()}"></div><div class="campo"><label for="c-obs">Observação</label><input class="inp" id="c-obs" value="${esc(d.obs || '')}"></div>${d.periodicidade && d.periodicidade !== 'Única' ? `<div class="auto" style="margin:0"><i class="ti ti-repeat"></i>A próxima (${esc(d.periodicidade.toLowerCase())}) é criada sozinha para ${fmtData(proximoPrazo(d.periodicidade, d.dataPrevista))}.</div>` : ''}`,
    botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Concluir', cls: 'prim' }],
    antesDeFechar: async (b, bg) => {
      const dt = $('#c-dt', bg).value || hojeISO();
      try {
        await ctx.D.atualizar('equipe_demandas', d.id, { status: dt > d.dataPrevista ? 'concluido_atraso' : 'concluido', dataConclusao: dt, concluidoPor: eu ? eu.id : '', concluidoPorNome: ctx.nome(), obs: $('#c-obs', bg).value.trim() });
        const prox = proximoPrazo(d.periodicidade, d.dataPrevista);
        if (prox) await ctx.D.criar('equipe_demandas', { nome: d.nome, respId: d.respId, prioridade: d.prioridade, periodicidade: d.periodicidade, dataPrevista: prox, status: 'pendente', obs: '', excluirKPI: false, origemId: d.id });
        ok = true;
      } catch (e) { toast(erroAmigavel(e), 'erro'); return false; }
    } });
  if (ok) toast('Demanda concluída.');
  return ok;
}

async function editarDemanda(ctx, d, C, eu) {
  const novo = !d; d = d || { periodicidade: 'Única', prioridade: 'media', respId: eu ? eu.id : '', dataPrevista: hojeISO() }; let ok = false;
  const r = await modal({ titulo: novo ? 'Nova demanda' : 'Demanda', larga: true, corpo: `<div class="campo"><label for="d-n">Demanda</label><input class="inp" id="d-n" value="${esc(d.nome || '')}"></div>
      <div class="linha3"><div class="campo"><label for="d-r">Responsável</label><select class="inp" id="d-r">${C.map(c => `<option value="${esc(c.id)}"${c.id === d.respId ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div><div class="campo"><label for="d-p">Prazo</label><input class="inp" type="date" id="d-p" value="${esc(d.dataPrevista || '')}"></div><div class="campo"><label for="d-per">Repete</label><select class="inp" id="d-per">${PER.map(p => `<option${p === d.periodicidade ? ' selected' : ''}>${p}</option>`).join('')}</select></div></div>
      <div class="linha2"><div class="campo"><label for="d-pri">Prioridade</label><select class="inp" id="d-pri">${PRI.map(([k, n]) => `<option value="${k}"${k === d.prioridade ? ' selected' : ''}>${n}</option>`).join('')}</select></div><div class="campo"><label for="d-st">Situação</label><select class="inp" id="d-st">${[['pendente', 'Aberta'], ['concluido', 'Concluída no prazo'], ['concluido_atraso', 'Concluída com atraso']].map(([k, n]) => `<option value="${k}"${k === (d.status || 'pendente') ? ' selected' : ''}>${n}</option>`).join('')}</select></div></div>
      <div class="campo"><label for="d-o">Observação</label><textarea class="inp" id="d-o" rows="2">${esc(d.obs || '')}</textarea></div>
      <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="d-x"${d.excluirKPI ? ' checked' : ''}> Fora do KPI</label><div class="campo" id="d-xm-c"${d.excluirKPI ? '' : ' hidden'}><label for="d-xm">Motivo</label><input class="inp" id="d-xm" value="${esc(d.motivoExclusao || '')}"></div>`,
    botoes: [...(novo ? [] : [{ id: 'apagar', texto: 'Apagar', cls: 'ghost' }]), { id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    aoAbrir: bg => { $('#d-x', bg).onchange = e => { $('#d-xm-c', bg).hidden = !e.target.checked; }; },
    antesDeFechar: async (b, bg) => {
      try {
        if (b === 'apagar') { if (!(await confirmar('Apagar demanda', 'Apagar esta demanda?', 'Apagar'))) return false; await ctx.D.atualizar('equipe_demandas', d.id, { apagado: true }); ok = true; return; }
        const v = s => $(s, bg).value.trim(); if (!v('#d-n')) return false;
        const dados = { nome: v('#d-n'), respId: v('#d-r'), dataPrevista: v('#d-p'), periodicidade: v('#d-per'), prioridade: v('#d-pri'), status: v('#d-st'), obs: v('#d-o'), excluirKPI: $('#d-x', bg).checked, motivoExclusao: v('#d-xm') };
        if (dados.status !== 'pendente' && !d.dataConclusao) dados.dataConclusao = hojeISO();
        if (novo) await ctx.D.criar('equipe_demandas', dados); else await ctx.D.atualizar('equipe_demandas', d.id, dados); ok = true;
      } catch (e) { toast(erroAmigavel(e), 'erro'); return false; }
    } });
  return ok;
}
async function editarColab(ctx, c, A, C) {
  const novo = !c; c = c || {}; let ok = false;
  const r = await modal({ titulo: novo ? 'Nova pessoa na equipe' : c.nome, corpo: `<div class="campo"><label for="e-n">Nome completo</label><input class="inp" id="e-n" value="${esc(c.nome || '')}"></div><div class="campo"><label for="e-c">Cargo</label><input class="inp" id="e-c" value="${esc(c.cargo || '')}"></div>
      <div class="linha2"><div class="campo"><label for="e-a">Área</label><select class="inp" id="e-a">${A.map(a => `<option value="${esc(a.id)}"${a.id === c.area ? ' selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></div><div class="campo"><label for="e-r">Reporta para</label><select class="inp" id="e-r"><option value="">Ninguém</option>${C.filter(x => x.id !== c.id).map(x => `<option value="${esc(x.id)}"${x.id === c.reportaPara ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div></div>`,
    botoes: [...(novo ? [] : [{ id: 'apagar', texto: 'Tirar da equipe', cls: 'ghost' }]), { id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => { try { if (b === 'apagar') { await ctx.D.atualizar('equipe_colaboradores', c.id, { apagado: true }); ok = true; return; } const d = { nome: $('#e-n', bg).value.trim(), cargo: $('#e-c', bg).value.trim(), area: $('#e-a', bg).value, reportaPara: $('#e-r', bg).value }; if (!d.nome) return false; if (novo) await ctx.D.criar('equipe_colaboradores', d); else await ctx.D.atualizar('equipe_colaboradores', c.id, d); ok = true; } catch (e) { toast(erroAmigavel(e), 'erro'); return false; } } });
  return ok;
}
async function editarArea(ctx, a) {
  const novo = !a; a = a || { cor: '#036c3b' }; let ok = false;
  await modal({ titulo: novo ? 'Nova área' : a.nome, corpo: `<div class="linha2"><div class="campo"><label for="a-n">Nome</label><input class="inp" id="a-n" value="${esc(a.nome || '')}"></div><div class="campo"><label for="a-c">Cor</label><input class="inp" type="color" id="a-c" value="${esc(a.cor || '#036c3b')}" style="height:42px"></div></div>`,
    botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => { try { const d = { nome: $('#a-n', bg).value.trim(), cor: $('#a-c', bg).value }; if (!d.nome) return false; if (novo) await ctx.D.criar('equipe_areas', d); else await ctx.D.atualizar('equipe_areas', a.id, d); ok = true; } catch (e) { toast(erroAmigavel(e), 'erro'); return false; } } });
  return ok;
}
async function editarFuncao(ctx, f, A) {
  const novo = !f; f = f || { atividades: [] }; let ok = false;
  await modal({ titulo: novo ? 'Nova função' : f.nome, larga: true, corpo: `<div class="linha2"><div class="campo"><label for="f-n">Função</label><input class="inp" id="f-n" value="${esc(f.nome || '')}"></div><div class="campo"><label for="f-a">Área</label><select class="inp" id="f-a">${A.map(a => `<option value="${esc(a.id)}"${a.id === f.area ? ' selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></div></div>
      <div class="campo"><label for="f-d">Objetivo</label><textarea class="inp" id="f-d" rows="2">${esc(f.desc || '')}</textarea></div><div class="campo"><label for="f-at">Atividades (uma por linha)</label><textarea class="inp" id="f-at" rows="9">${esc((f.atividades || []).join('\n'))}</textarea></div>`,
    botoes: [...(novo ? [] : [{ id: 'apagar', texto: 'Apagar', cls: 'ghost' }]), { id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => { try { if (b === 'apagar') { await ctx.D.atualizar('equipe_funcoes', f.id, { apagado: true }); ok = true; return; } const d = { nome: $('#f-n', bg).value.trim(), area: $('#f-a', bg).value, desc: $('#f-d', bg).value.trim(), atividades: $('#f-at', bg).value.split('\n').map(x => x.trim()).filter(Boolean) }; if (!d.nome) return false; if (novo) await ctx.D.criar('equipe_funcoes', d); else await ctx.D.atualizar('equipe_funcoes', f.id, d); ok = true; } catch (e) { toast(erroAmigavel(e), 'erro'); return false; } } });
  return ok;
}
