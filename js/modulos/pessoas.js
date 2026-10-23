// Pessoas e dossiê — lista com busca e filtros.
import { $, $$, esc, tit, kpis, norm, fmtData, fmtNum, pill, vazio, modal, toast, erroAmigavel, hojeISO } from '../ui.js?v=11';
import { TIPOS_EVENTO } from '../config.js?v=11';
import { NOME_GRUPO } from '../fo1029.js?v=11';

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
  el.innerHTML = tit('ti-folder-open', 'Pessoas e dossiê', `${fmtNum(cont('ativo') + cont('afastado'))} na folha hoje · ${fmtNum(itens.length)} pessoas no histórico`, `<button class="btn prim" id="grupo"><i class="ti ti-users-plus"></i>Registro em grupo</button><button class="btn" id="csv"><i class="ti ti-file-spreadsheet"></i>Baixar lista</button>${ctx.pode('importar') ? '<a class="btn prim" href="#/importar"><i class="ti ti-file-import"></i>Importar FO1029</a>' : ''}`)
    + kpis([['Ativos', fmtNum(cont('ativo')), 'inclui férias e aviso prévio'], ['Afastados', fmtNum(cont('afastado')), 'previdência, acidente ou invalidez'], ['Em desligamento', fmtNum(cont('desligando')), 'rescisão calculada ou aguardando'], ['Desligados', fmtNum(cont('desligado')), 'histórico']])
    + `<div class="filtros-l"><label class="busca"><i class="ti ti-search"></i><span class="sr">Buscar</span><input id="q" placeholder="Nome, matrícula ou parte do CPF" value="${esc(estado.q)}" autocomplete="off"></label>
      <select class="inp" id="f" style="width:auto"><option value="">Todas as filiais</option>${filiais.map(f => `<option${f === estado.f ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select>
      <select class="inp" id="s" style="width:auto;max-width:260px"><option value="">Todos os setores</option>${setores.map(s => `<option${s === estado.s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <select class="inp" id="g" style="width:auto"><option value="atuais">Na folha (ativos e afastados)</option><option value="todos">Todos</option>${Object.entries(NOME_GRUPO).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
    <section class="card"><div class="card-b" id="lista"></div></section>`;
  $('#grupo').onclick = () => registroEmGrupo(ctx, itens);
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

// Registro em grupo: o mesmo evento (DDS, treinamento, pílula, ginástica…) na pasta de várias pessoas de uma vez.
async function registroEmGrupo(ctx, itens) {
  const naFolha = itens.filter(x => x.g === 'ativo' || x.g === 'afastado' || x.g === 'desligando');
  const filiais = [...new Set(naFolha.map(x => x.f).filter(Boolean))].sort(), setores = [...new Set(naFolha.map(x => x.s).filter(Boolean))].sort();
  const marcados = new Set(); let f = { q: '', f: '', s: '' }; let gravados = 0;
  const corpo = `<div class="linha3"><div class="campo"><label for="g-tipo">Tipo</label><select class="inp" id="g-tipo">${TIPOS_EVENTO.map(t => `<option${t === 'DDS - Diálogo de Segurança' ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="campo"><label for="g-data">Data</label><input class="inp" type="date" id="g-data" value="${hojeISO()}" max="${hojeISO()}"></div><div class="campo"><label for="g-tit">Resumo</label><input class="inp" id="g-tit" maxlength="140" placeholder="Ex.: DDS do SESMT"></div></div>
    <div class="campo"><label for="g-obs">Detalhes / tema (opcional)</label><textarea class="inp" id="g-obs" rows="2" maxlength="4000"></textarea></div>
    <div class="card" style="padding:12px;box-shadow:none"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <label class="busca" style="margin:0;flex:1;min-width:180px;display:flex"><i class="ti ti-search"></i><input id="g-q" placeholder="Nome ou matrícula"></label>
      <select class="inp" id="g-f" style="width:auto"><option value="">Todas as filiais</option>${filiais.map(x => `<option>${esc(x)}</option>`).join('')}</select>
      <select class="inp" id="g-s" style="width:auto;max-width:220px"><option value="">Todos os setores</option>${setores.map(x => `<option>${esc(x)}</option>`).join('')}</select></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px"><button type="button" class="btn sm" id="g-todos">Marcar os da lista</button><button type="button" class="btn sm ghost" id="g-limpar">Desmarcar todos</button><button type="button" class="btn sm ghost" id="g-colar"><i class="ti ti-clipboard"></i>Colar matrículas</button><b class="small" id="g-n" style="margin-left:auto">0 selecionadas</b></div>
      <div id="g-lista" style="max-height:280px;overflow:auto;display:grid;gap:2px"></div></div>
    <div class="ajuda">Entra na pasta de cada pessoa com seu nome (${esc(ctx.nome())}) e a hora.</div><div id="g-msg"></div><div class="progresso" id="g-prog" hidden><i></i></div>`;
  const r = await modal({ titulo: 'Registro em grupo', larga: true, corpo, botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Registrar', cls: 'prim' }],
    aoAbrir: bg => {
      const filtrados = () => { const t = norm(f.q.trim()); return naFolha.filter(x => (!f.f || x.f === f.f) && (!f.s || x.s === f.s) && (!t || norm(x.n).includes(t) || x.m === f.q.trim())); };
      const contar = () => { $('#g-n', bg).textContent = marcados.size + ' selecionada' + (marcados.size === 1 ? '' : 's'); };
      const desenhar = () => { const l = filtrados();
        $('#g-lista', bg).innerHTML = l.slice(0, 400).map(x => `<label style="display:flex;gap:8px;align-items:center;padding:4px 6px;border-radius:8px;font-size:13px"><input type="checkbox" value="${esc(x.i)}"${marcados.has(x.i) ? ' checked' : ''} style="accent-color:var(--verde)"><span><b style="font-weight:600">${esc(x.n)}</b> <span class="muted">· ${esc(x.m)} · ${esc(x.s)} · ${esc(x.f)}</span></span></label>`).join('') + (l.length > 400 ? `<p class="small muted">Mostrando 400 de ${l.length}. Use os filtros.</p>` : '') || '<p class="small muted">Ninguém com esses filtros.</p>';
        $$('#g-lista input', bg).forEach(c => c.onchange = () => { c.checked ? marcados.add(c.value) : marcados.delete(c.value); contar(); }); };
      $('#g-q', bg).oninput = e => { f.q = e.target.value; desenhar(); };
      $('#g-f', bg).onchange = e => { f.f = e.target.value; desenhar(); };
      $('#g-s', bg).onchange = e => { f.s = e.target.value; desenhar(); };
      $('#g-todos', bg).onclick = () => { filtrados().forEach(x => marcados.add(x.i)); desenhar(); contar(); };
      $('#g-limpar', bg).onclick = () => { marcados.clear(); desenhar(); contar(); };
      $('#g-colar', bg).onclick = () => {
        const t = prompt('Cole as matrículas (uma por linha ou separadas por vírgula):'); if (!t) return;
        const ms = t.split(/[\s,;]+/).filter(Boolean); let n = 0; const nao = [];
        ms.forEach(m => { const x = naFolha.find(i => i.m === m.replace(/\D/g, '')); if (x) { marcados.add(x.i); n++; } else nao.push(m); });
        desenhar(); contar(); toast(`${n} encontrada(s)${nao.length ? ' · não encontradas: ' + nao.slice(0, 8).join(', ') : ''}.`, nao.length ? 'erro' : '');
      };
      desenhar(); contar();
    },
    antesDeFechar: async (b, bg) => {
      const msg = t => { $('#g-msg', bg).innerHTML = `<div class="erro-msg">${esc(t)}</div>`; return false; };
      if (!marcados.size) return msg('Selecione pelo menos uma pessoa.');
      const data = $('#g-data', bg).value; if (!data) return msg('Informe a data.');
      const grupoId = 'g' + Date.now().toString(36), agora = new Date().toISOString();
      const ev = { tipo: $('#g-tipo', bg).value, data, titulo: $('#g-tit', bg).value.trim(), obs: $('#g-obs', bg).value.trim(), porNome: ctx.nome(), porUid: ctx.uid, criadoEm: agora, grupo: true, grupoId, grupoTamanho: marcados.size };
      const ops = [...marcados].map((pid, k) => ({ caminho: ['pessoas', pid, 'eventos', grupoId + '_' + k.toString(36)], dados: ev }));
      $('#g-prog', bg).hidden = false; $$('.modal-r button', bg).forEach(x => x.disabled = true);
      try { await ctx.D.gravarLote(ops, (a, t) => { $('#g-prog i', bg).style.width = Math.round(a / t * 100) + '%'; }); gravados = ops.length; ctx.D.log('evento_grupo', ev.tipo + ' · ' + ops.length + ' pessoas'); }
      catch (e) { $$('.modal-r button', bg).forEach(x => x.disabled = false); return msg(erroAmigavel(e) + ' Os que já foram gravados ficam; rode de novo só com os que faltaram.'); }
    } });
  if (r === 'ok' && gravados) toast(`Registrado na pasta de ${gravados} pessoa${gravados > 1 ? 's' : ''}.`);
}
