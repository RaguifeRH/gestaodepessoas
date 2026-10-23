// Pessoas e dossiê — lista com busca e filtros.
import { $, $$, esc, tit, kpis, norm, fmtData, fmtNum, pill, vazio } from '../ui.js?v=4';
import { NOME_GRUPO } from '../fo1029.js?v=4';

const COR = { ativo: 'ok', afastado: 'sol', desligando: 'amb', desligado: '' };
let estado = { q: '', f: '', s: '', g: 'atuais', n: 60 };

export async function render(el, ctx) {
  const itens = (await ctx.resumo()).itens;
  if (!itens.length) {
    el.innerHTML = tit('ti-folder-open', 'Pessoas e dossiê') + vazio('ti-users', 'Nenhuma pessoa cadastrada ainda', 'O cadastro único nasce da importação do FO1029.', ctx.pode('importar') ? '<a class="btn prim" href="#/importar"><i class="ti ti-file-import"></i>Importar FO1029</a>' : '<p class="small">Peça a quem tem acesso para importar o FO1029.</p>');
    return;
  }
  const cont = g => itens.filter(x => x.g === g).length;
  const filiais = [...new Set(itens.map(x => x.f).filter(Boolean))].sort();
  const setores = [...new Set(itens.map(x => x.s).filter(Boolean))].sort();
  el.innerHTML = tit('ti-folder-open', 'Pessoas e dossiê', `${fmtNum(cont('ativo') + cont('afastado'))} na folha hoje · ${fmtNum(itens.length)} pessoas no histórico`, `<button class="btn" id="csv"><i class="ti ti-file-spreadsheet"></i>Baixar lista</button>${ctx.pode('importar') ? '<a class="btn prim" href="#/importar"><i class="ti ti-file-import"></i>Importar FO1029</a>' : ''}`)
    + kpis([['Ativos', fmtNum(cont('ativo')), 'inclui férias e aviso prévio'], ['Afastados', fmtNum(cont('afastado')), 'previdência, acidente ou invalidez'], ['Em desligamento', fmtNum(cont('desligando')), 'rescisão calculada ou aguardando'], ['Desligados', fmtNum(cont('desligado')), 'histórico']])
    + `<div class="filtros-l"><label class="busca"><i class="ti ti-search"></i><span class="sr">Buscar</span><input id="q" placeholder="Nome, matrícula ou parte do CPF" value="${esc(estado.q)}" autocomplete="off"></label>
      <select class="inp" id="f" style="width:auto"><option value="">Todas as filiais</option>${filiais.map(f => `<option${f === estado.f ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select>
      <select class="inp" id="s" style="width:auto;max-width:260px"><option value="">Todos os setores</option>${setores.map(s => `<option${s === estado.s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <select class="inp" id="g" style="width:auto"><option value="atuais">Na folha (ativos e afastados)</option><option value="todos">Todos</option>${Object.entries(NOME_GRUPO).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
    <section class="card"><div class="card-b" id="lista"></div></section>`;
  $('#g').value = estado.g;
  const filtrar = () => {
    const t = norm(estado.q.trim()), dig = estado.q.replace(/\D/g, '');
    return itens.filter(x => (!estado.f || x.f === estado.f) && (!estado.s || x.s === estado.s)
      && (estado.g === 'todos' || (estado.g === 'atuais' ? (x.g === 'ativo' || x.g === 'afastado') : x.g === estado.g))
      && (!t || norm(x.n).includes(t) || (dig.length >= 3 && (x.m === dig || x.cm.replace(/\D/g, '').includes(dig)))));
  };
  const desenhar = () => {
    const l = filtrar();
    $('#lista').innerHTML = l.length ? `<div class="small muted" style="margin-bottom:6px">${fmtNum(l.length)} pessoa${l.length === 1 ? '' : 's'}</div><div class="tw"><table class="tb"><thead><tr><th>Pessoa</th><th>Matrícula</th><th>Filial</th><th>Setor</th><th>Admissão</th><th>Situação</th></tr></thead><tbody>${l.slice(0, estado.n).map(x => `<tr class="clic" data-id="${esc(x.i)}" tabindex="0"><td><div class="pes"><span class="av">${esc(x.n.split(' ')[0][0] + (x.n.split(' ').slice(-1)[0][0] || ''))}</span><div><b>${esc(x.n)}</b><small>${esc(x.c)}</small></div></div></td><td class="mascara">${esc(x.m)}</td><td class="small">${esc(x.f)}</td><td class="small">${esc(x.s)}</td><td>${fmtData(x.a)}</td><td>${pill(x.st || NOME_GRUPO[x.g], COR[x.g])}${x.v.length > 1 ? ` <span class="pill" title="Vínculos">${x.v.length}×</span>` : ''}</td></tr>`).join('')}</tbody></table></div>${l.length > estado.n ? `<div class="mais"><button class="btn" id="mais">Mostrar mais ${Math.min(60, l.length - estado.n)}</button></div>` : ''}`
      : '<p class="muted" style="margin:6px 0">Ninguém encontrado com esses filtros.</p>';
    $$('#lista tr.clic').forEach(tr => { tr.onclick = () => location.hash = '#/pessoa/' + tr.dataset.id; tr.onkeydown = e => { if (e.key === 'Enter') tr.click(); }; });
    const m = $('#mais'); if (m) m.onclick = () => { estado.n += 60; desenhar(); };
  };
  let t0; $('#q').oninput = e => { clearTimeout(t0); t0 = setTimeout(() => { estado.q = e.target.value; estado.n = 60; desenhar(); }, 150); };
  ['f', 's', 'g'].forEach(k => $('#' + k).onchange = e => { estado[k] = e.target.value; estado.n = 60; desenhar(); });
  $('#csv').onclick = () => {
    const l = filtrar(); const linhas = [['Nome', 'Matrícula', 'Empresa', 'Filial', 'Setor', 'Cargo', 'Tipo', 'Situação', 'Admissão', 'Demissão']].concat(l.map(x => [x.n, x.m, x.e, x.f, x.s, x.c, x.t, x.st, fmtData(x.a), x.d ? fmtData(x.d) : '']));
    const csv = '﻿' + linhas.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'pessoas-raguife.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    ctx.D.log('lista_exportada', l.length + ' pessoas');
  };
  desenhar();
}
