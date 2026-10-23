// Tabela salarial: cargos × faixas A–F, por área e setor. Conferência com os salários do FO1029.
import { $, $$, esc, tit, kpis, card, st, pill, fmtReais, fmtNum, modal, toast, erroAmigavel, confirmar, vazio, norm, hojeISO } from '../ui.js?v=13';

const FX = ['A', 'B', 'C', 'D', 'E', 'F'];
const F = { q: '', area: '', depto: '', tabela: '', aba: 'tabela' };
const N = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export async function render(el, ctx) {
  const cargos = (await ctx.D.listar('salario_cargos').catch(() => [])).filter(c => !c.apagado)
    .sort((a, b) => (a.area || '').localeCompare(b.area || '') || (a.depto || '').localeCompare(b.depto || '') || (parseInt(a.seq) || 99) - (parseInt(b.seq) || 99) || (a.cargo || '').localeCompare(b.cargo || ''));
  const uniq = k => [...new Set(cargos.map(c => c[k]).filter(Boolean))].sort();
  const t = norm(F.q);
  const lista = cargos.filter(c => (!F.area || c.area === F.area) && (!F.depto || c.depto === F.depto) && (!F.tabela || c.tabela === F.tabela) && (!t || norm([c.cargo, c.depto, c.tabela, c.cargoEfetivo].join(' ')).includes(t)));
  if (!cargos.length) { el.innerHTML = tit('ti-table', 'Tabela salarial') + vazio('ti-table', 'Tabela vazia', 'Importe a tabela do sistema antigo em Administração → Dados dos sistemas antigos, ou cadastre o primeiro cargo.', '<button class="btn prim" id="novo"><i class="ti ti-plus"></i>Novo cargo</button>'); $('#novo').onclick = () => editar(ctx, null, cargos).then(m => m && render(el, ctx)); return; }

  el.innerHTML = tit('ti-table', 'Tabela salarial', `${cargos.length} cargos · faixas A a F`, `<button class="btn prim" id="novo"><i class="ti ti-plus"></i>Novo cargo</button><button class="btn" id="xls"><i class="ti ti-download"></i>Baixar planilha</button>${ctx.admin() ? '<button class="btn ghost" id="reaj"><i class="ti ti-percentage"></i>Aplicar reajuste</button>' : ''}`)
    + `<div class="filtros" style="margin-bottom:14px"><button data-aba="tabela" class="${F.aba === 'tabela' ? 'on' : ''}"><i class="ti ti-table"></i> Tabela</button><button data-aba="conferir" class="${F.aba === 'conferir' ? 'on' : ''}"><i class="ti ti-scale"></i> Conferir com o FO1029</button></div>`
    + `<div class="filtros-l" style="margin-bottom:14px"><label class="busca"><i class="ti ti-search"></i><input id="q" placeholder="Cargo ou setor" value="${esc(F.q)}"></label>
      ${[['area', 'Todas as áreas'], ['depto', 'Todos os setores'], ['tabela', 'Todas as tabelas']].map(([k, n]) => `<select class="inp" data-f="${k}" style="width:auto;max-width:240px"><option value="">${n}</option>${uniq(k).map(v => `<option${v === F[k] ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`).join('')}</div><div id="corpo"></div>`;

  const desenharTabela = () => {
    let area = '', h = '';
    lista.forEach(c => { if (c.area !== area) { area = c.area; h += `<tr><td colspan="9" style="background:var(--orvalho-2);font-weight:800;color:var(--mata)">${esc(area || 'Sem área')}</td></tr>`; }
      h += `<tr class="clic" data-id="${esc(c.id)}"><td><b>${esc(c.cargo)}</b><small class="muted" style="display:block">${esc(c.depto || '')} · ${esc(c.tabela || '')}${c.grat ? ' · gratificação' : ''}</small>${c.cargoEfetivo || c.faixaEfetiva ? `<small style="display:block;color:var(--oliva)"><i class="ti ti-arrow-right"></i> efetivado vira ${esc(c.cargoEfetivo || c.cargo)}${c.faixaEfetiva ? ' faixa ' + esc(c.faixaEfetiva) : ''}</small>` : ''}</td>${FX.map(f => `<td class="small" style="text-align:right;white-space:nowrap">${c.faixas && c.faixas[f] ? fmtReais(c.faixas[f]) : '—'}</td>`).join('')}</tr>`; });
    $('#corpo').innerHTML = `<section class="card"><div class="card-b"><div class="small muted" style="margin-bottom:6px">${lista.length} cargo${lista.length === 1 ? '' : 's'}</div><div class="tw"><table class="tb"><thead><tr><th>Cargo</th>${FX.map(f => `<th style="text-align:right">Faixa ${f}</th>`).join('')}</tr></thead><tbody>${h}</tbody></table></div></div></section>`;
    $$('tr[data-id]').forEach(tr => tr.onclick = () => editar(ctx, cargos.find(c => c.id === tr.dataset.id), cargos).then(m => m && render(el, ctx)));
  };

  const conferir = async () => {
    if (!ctx.pode('sensiveis')) { $('#corpo').innerHTML = '<div class="erro-msg">Para conferir salários é preciso a permissão "Dados sensíveis".</div>'; return; }
    $('#corpo').innerHTML = '<div class="card" style="padding:20px"><div class="esq-l" style="height:40px"></div><p class="small muted">Lendo os salários do FO1029…</p></div>';
    const resumo = await ctx.resumo();
    const pessoas = resumo.itens.filter(x => (x.g === 'ativo' || x.g === 'afastado') && !/aprendiz|estagi|socio|pessoa juridica|autonomo/.test(norm(x.t + ' ' + x.c)));
    const porCD = new Map(), porC = new Map();
    cargos.forEach(c => { porCD.set(N(c.cargo) + '|' + N(c.depto), c); if (!porC.has(N(c.cargo))) porC.set(N(c.cargo), c); });
    const linhas = [];
    for (let i = 0; i < pessoas.length; i += 40) {
      const parte = await Promise.all(pessoas.slice(i, i + 40).map(async x => ({ x, pv: await ctx.D.privado(x.i).catch(() => null) })));
      parte.forEach(({ x, pv }) => {
        const c = porCD.get(N(x.c) + '|' + N(x.s)) || porC.get(N(x.c)); const sal = pv && pv.salarioAtual;
        let sit = 'sem', faixa = '';
        if (!c) sit = 'sem_cargo'; else if (!sal) sit = 'sem_salario'; else {
          const fx = FX.filter(f => c.faixas && c.faixas[f]);
          if (!fx.length) sit = 'sem_faixa';
          else if (sal < c.faixas[fx[0]] - 0.5) sit = 'abaixo';
          else if (sal > c.faixas[fx[fx.length - 1]] + 0.5) sit = 'acima';
          else { sit = 'ok'; faixa = fx.reduce((m, f) => Math.abs(c.faixas[f] - sal) < Math.abs(c.faixas[m] - sal) ? f : m, fx[0]); if (Math.abs(c.faixas[faixa] - sal) > 0.5) sit = 'entre'; }
        }
        linhas.push({ x, c, sal, sit, faixa });
      });
    }
    const nome = { ok: ['Na faixa', 'ok'], entre: ['Entre faixas', 'pend'], abaixo: ['Abaixo da faixa A', 'atr'], acima: ['Acima da última faixa', 'atr'], sem_cargo: ['Cargo fora da tabela', 'hoje'], sem_salario: ['Sem salário no FO1029', 'pend'], sem_faixa: ['Cargo sem faixas', 'pend'] };
    const conta = k => linhas.filter(l => l.sit === k).length;
    let filtro = 'problemas';
    const desenhar = () => {
      const l = linhas.filter(r => filtro === 'todos' || (filtro === 'problemas' ? r.sit !== 'ok' : r.sit === filtro)).sort((a, b) => a.sit.localeCompare(b.sit) || a.x.n.localeCompare(b.x.n));
      $('#conf').innerHTML = `<div class="filtros" style="margin-bottom:10px;flex-wrap:wrap">${[['problemas', 'Para revisar'], ['todos', 'Todos'], ...Object.entries(nome).map(([k, v]) => [k, v[0]])].map(([k, n]) => `<button data-cf="${k}" class="${k === filtro ? 'on' : ''}">${esc(n)} (${k === 'todos' ? linhas.length : k === 'problemas' ? linhas.filter(r => r.sit !== 'ok').length : conta(k)})</button>`).join('')}</div>
        <div class="tw"><table class="tb"><thead><tr><th>Pessoa</th><th>Cargo no FO1029</th><th style="text-align:right">Salário</th><th>Na tabela</th><th>Situação</th></tr></thead><tbody>${l.slice(0, 400).map(r => `<tr><td><b>${esc(r.x.n)}</b><small class="muted" style="display:block">matrícula ${esc(r.x.m)} · ${esc(r.x.f)}</small></td><td class="small">${esc(r.x.c)}<br><span class="muted">${esc(r.x.s)}</span></td><td class="small" style="text-align:right">${r.sal ? fmtReais(r.sal) : '—'}</td><td class="small">${r.c ? `${FX.filter(f => r.c.faixas && r.c.faixas[f]).map(f => f + ' ' + fmtReais(r.c.faixas[f])).slice(0, 1).join('')}${r.c.faixas && r.c.faixas.F ? ' … F ' + fmtReais(r.c.faixas.F) : ''}` : '—'}</td><td>${st(nome[r.sit][1], nome[r.sit][0] + (r.faixa ? ' ' + r.faixa : ''))}</td></tr>`).join('')}</tbody></table></div>`;
      $$('[data-cf]').forEach(b => b.onclick = () => { filtro = b.dataset.cf; desenhar(); });
    };
    $('#corpo').innerHTML = kpis([['Conferidos', fmtNum(linhas.length), 'na folha, sem aprendizes e estagiários'], ['Na faixa', fmtNum(conta('ok')), ''], ['Fora da faixa', fmtNum(conta('abaixo') + conta('acima') + conta('entre')), 'abaixo, acima ou entre faixas', conta('abaixo') + conta('acima') ? 'desce' : 'sobe'], ['Cargo fora da tabela', fmtNum(conta('sem_cargo')), 'nome do cargo diferente da tabela']]) + `<section class="card"><div class="card-b" id="conf"></div></section>`;
    desenhar();
  };

  (F.aba === 'tabela' ? desenharTabela : conferir)();
  $$('[data-aba]').forEach(b => b.onclick = () => { F.aba = b.dataset.aba; render(el, ctx); });
  $('#q').oninput = e => { F.q = e.target.value; clearTimeout(el._t); el._t = setTimeout(() => render(el, ctx).then(() => { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }), 250); };
  $$('[data-f]').forEach(s => s.onchange = () => { F[s.dataset.f] = s.value; render(el, ctx); });
  $('#novo').onclick = () => editar(ctx, null, cargos).then(m => m && render(el, ctx));
  $('#xls').onclick = () => {
    const linhas = [['Área', 'Setor', 'Tabela', 'Seq', 'Cargo', 'Gratificação', ...FX.map(f => 'Faixa ' + f), 'Efetivado vira', 'Faixa ao efetivar'], ...lista.map(c => [c.area, c.depto, c.tabela, c.seq, c.cargo, c.grat ? 'Sim' : 'Não', ...FX.map(f => (c.faixas && c.faixas[f]) || ''), c.cargoEfetivo || '', c.faixaEfetiva || ''])];
    if (window.XLSX) { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'Tabela salarial'); XLSX.writeFile(wb, 'tabela-salarial-' + hojeISO() + '.xlsx'); }
    else toast('Leitor de planilhas não carregou. Recarregue a página.', 'erro');
  };
  if ($('#reaj')) $('#reaj').onclick = () => reajuste(ctx, lista).then(m => m && render(el, ctx));
}

async function editar(ctx, c, cargos) {
  const novo = !c; c = c || { faixas: {} };
  const dl = (id, k) => `<datalist id="${id}">${[...new Set(cargos.map(x => x[k]).filter(Boolean))].sort().map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
  let ok = false;
  const r = await modal({ titulo: novo ? 'Novo cargo' : c.cargo, larga: true, corpo: `<div class="linha2"><div class="campo"><label for="s-cargo">Cargo</label><input class="inp" id="s-cargo" value="${esc(c.cargo || '')}"></div><div class="campo"><label for="s-depto">Setor</label><input class="inp" id="s-depto" list="dl-d" value="${esc(c.depto || '')}">${dl('dl-d', 'depto')}</div></div>
      <div class="linha3"><div class="campo"><label for="s-area">Área</label><input class="inp" id="s-area" list="dl-a" value="${esc(c.area || '')}">${dl('dl-a', 'area')}</div><div class="campo"><label for="s-tab">Tabela</label><input class="inp" id="s-tab" list="dl-t" value="${esc(c.tabela || '')}">${dl('dl-t', 'tabela')}</div><div class="campo"><label for="s-seq">Ordem no setor</label><input class="inp" id="s-seq" type="number" value="${esc(c.seq || '')}"></div></div>
      <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px">${FX.map(f => `<div class="campo"><label for="s-${f}">Faixa ${f}</label><input class="inp" id="s-${f}" type="number" step="0.01" value="${esc((c.faixas || {})[f] ?? '')}"></div>`).join('')}</div>
      <label class="small" style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="checkbox" id="s-grat"${c.grat ? ' checked' : ''}> Cargo com gratificação / confiança</label>
      <h4 class="d" style="font-size:15px;margin:14px 0 6px">Ao efetivar (fim da experiência)</h4>
      <div class="linha3"><div class="campo"><label for="s-cef">Passa para o cargo</label><input class="inp" id="s-cef" value="${esc(c.cargoEfetivo || '')}" placeholder="Vazio = mesmo cargo"></div><div class="campo"><label for="s-fef">Na faixa</label><select class="inp" id="s-fef"><option value="">Mesma</option>${FX.map(f => `<option${f === c.faixaEfetiva ? ' selected' : ''}>${f}</option>`).join('')}</select></div><div class="campo"><label for="s-oef">Observação</label><input class="inp" id="s-oef" value="${esc(c.obsEfetiva || '')}"></div></div><div id="s-msg"></div>`,
    botoes: [...(novo || !ctx.admin() ? [] : [{ id: 'apagar', texto: 'Apagar', cls: 'ghost' }]), { id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => {
      try {
        if (b === 'apagar') { if (!(await confirmar('Apagar cargo', `Apagar ${esc(c.cargo)} da tabela?`, 'Apagar'))) return false; await ctx.D.atualizar('salario_cargos', c.id, { apagado: true }); ok = true; return; }
        const v = id => $(id, bg).value.trim();
        if (!v('#s-cargo')) { $('#s-msg', bg).innerHTML = '<div class="erro-msg">Informe o cargo.</div>'; return false; }
        const faixas = {}; FX.forEach(f => { const n = parseFloat(v('#s-' + f)); faixas[f] = isNaN(n) ? null : Math.round(n * 100) / 100; });
        const dados = { cargo: v('#s-cargo').toUpperCase(), depto: v('#s-depto').toUpperCase(), area: v('#s-area').toUpperCase(), tabela: v('#s-tab').toUpperCase(), seq: v('#s-seq'), faixas, grat: $('#s-grat', bg).checked, cargoEfetivo: v('#s-cef').toUpperCase(), faixaEfetiva: v('#s-fef'), obsEfetiva: v('#s-oef'), filial: c.filial || 'MATRIZ' };
        if (novo) await ctx.D.criar('salario_cargos', dados); else await ctx.D.atualizar('salario_cargos', c.id, { ...dados, historico: [...(c.historico || []), { em: new Date().toISOString(), por: ctx.nome(), faixasAntes: c.faixas || {} }].slice(-30) });
        ok = true;
      } catch (e) { $('#s-msg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
    } });
  if (ok) toast(r === 'apagar' ? 'Cargo apagado.' : 'Salvo.');
  return ok;
}

async function reajuste(ctx, lista) {
  let ok = false;
  const r = await modal({ titulo: 'Aplicar reajuste', corpo: `<p class="small" style="margin:0">Aplica o percentual em todas as faixas dos <b>${lista.length}</b> cargos que estão no filtro atual. Os valores anteriores ficam guardados no histórico de cada cargo.</p><div class="campo"><label for="rj">Percentual (%)</label><input class="inp" id="rj" type="number" step="0.01" placeholder="Ex.: 5,5"></div><div id="rj-msg"></div>`,
    botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Aplicar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => {
      const p = parseFloat($('#rj', bg).value.replace(',', '.')); if (!p) { $('#rj-msg', bg).innerHTML = '<div class="erro-msg">Informe o percentual.</div>'; return false; }
      if (!(await confirmar('Confirmar reajuste', `Reajustar ${lista.length} cargos em ${p}%?`, 'Aplicar'))) return false;
      try {
        const em = new Date().toISOString();
        await ctx.D.gravarLote(lista.map(c => { const fx = {}; FX.forEach(f => { fx[f] = c.faixas && c.faixas[f] ? Math.round(c.faixas[f] * (1 + p / 100) * 100) / 100 : null; }); return { caminho: ['salario_cargos', c.id], dados: { faixas: fx, historico: [...(c.historico || []), { em, por: ctx.nome(), faixasAntes: c.faixas || {}, reajuste: p }].slice(-30), editadoEm: em }, merge: true }; }));
        ctx.D.log('reajuste_tabela', p + '% em ' + lista.length + ' cargos'); ok = true;
      } catch (e) { $('#rj-msg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
    } });
  if (ok) toast('Reajuste aplicado.');
  return ok;
}
