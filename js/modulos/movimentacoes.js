// Movimentações: promoções e mudanças, motoristas (cesta/ticket), multiplicadores, auxílio educação e adiantamentos.
import { MOTIVOS_MOV } from '../config.js?v=12';
import { $, $$, esc, tit, kpis, st, pill, fmtData, fmtReais, hojeISO, modal, toast, erroAmigavel, norm } from '../ui.js?v=12';

const SN = ['Não', 'Sim'];
// Cada aba é uma lista simples descrita por campos. pessoa: escolhe do FO1029 e preenche nome/cargo/setor.
const ABAS = {
  movs: { col: 'movimentacoes', nome: 'Movimentações', ic: 'ti-arrows-exchange', ordem: 'competencia', campos: [
    { k: 'pessoa', rot: 'Pessoa', tipo: 'pessoa', lista: true },
    { k: 'motivo', rot: 'Motivo', tipo: 'sel', ops: MOTIVOS_MOV, lista: true },
    { k: 'competencia', rot: 'Competência', tipo: 'mes', lista: true },
    { k: 'cargoAnt', rot: 'Cargo atual', auto: 'c' }, { k: 'cargoNovo', rot: 'Cargo novo', lista: true },
    { k: 'deptoAnt', rot: 'Setor atual', auto: 's' }, { k: 'deptoNovo', rot: 'Setor novo' },
    { k: 'salarioAnt', rot: 'Salário atual', tipo: 'reais', auto: 'sal' }, { k: 'salarioNovo', rot: 'Salário novo', tipo: 'reais', lista: true },
    { k: 'escalaAnt', rot: 'Escala atual' }, { k: 'escalaNovo', rot: 'Escala nova' },
    { k: 'liderAnt', rot: 'Líder atual' }, { k: 'liderNovo', rot: 'Líder novo' },
    { k: 'mudancaRisco', rot: 'Muda o risco (exame)?', tipo: 'sel', ops: SN }, { k: 'insalPeric', rot: 'Insalubridade / periculosidade?', tipo: 'sel', ops: SN },
    { k: 'mudancaSindicato', rot: 'Muda o sindicato?', tipo: 'sel', ops: SN }, { k: 'dtExame', rot: 'Data do exame', tipo: 'data' }, { k: 'dtAso', rot: 'Data do ASO', tipo: 'data' },
    { k: 'responsavel', rot: 'Responsável (gestor)' }, { k: 'obs', rot: 'Observações', tipo: 'longo' },
    { k: 'dpStatus', rot: 'Situação no DP', tipo: 'sel', ops: ['Pendente', 'Ajustado'], lista: true, estado: true }, { k: 'dpComp', rot: 'Competência ajustada na folha', tipo: 'mes' } ] },
  motoristas: { col: 'motoristas', nome: 'Motoristas', ic: 'ti-truck', ordem: 'nome', campos: [
    { k: 'pessoa', rot: 'Motorista', tipo: 'pessoa', lista: true },
    { k: 'opcao', rot: 'Opção atual', tipo: 'sel', ops: ['Cesta básica', 'Ticket'], lista: true },
    { k: 'opcaoProx', rot: 'Troca para', tipo: 'sel', ops: ['', 'Cesta básica', 'Ticket'], lista: true }, { k: 'compProx', rot: 'A partir da competência', tipo: 'mes', lista: true },
    { k: 'admissao', rot: 'Admissão', tipo: 'data', auto: 'a' }, { k: 'sindicato', rot: 'Sindicato' }, { k: 'status', rot: 'Situação', tipo: 'sel', ops: ['ATIVO', 'INATIVO'], lista: true } ] },
  mult: { col: 'multiplicadores', nome: 'Multiplicadores', ic: 'ti-school', ordem: 'nome', campos: [
    { k: 'pessoa', rot: 'Pessoa', tipo: 'pessoa', lista: true }, { k: 'nivel', rot: 'Nível', tipo: 'sel', ops: ['MULTIPLICADOR I', 'MULTIPLICADOR II', 'MULTIPLICADOR III'], lista: true },
    { k: 'valor', rot: 'Valor', tipo: 'reais', lista: true }, { k: 'dtInclusao', rot: 'Inclusão', tipo: 'mes', lista: true }, { k: 'pontuacao', rot: 'Pontuação' },
    { k: 'alterouNivelEm', rot: 'Mudou de nível em', tipo: 'mes' }, { k: 'responsavel', rot: 'Responsável' }, { k: 'ativo', rot: 'Ativo', tipo: 'sel', ops: ['SIM', 'NÃO'], lista: true }, { k: 'obs', rot: 'Observações', tipo: 'longo' } ] },
  auxedu: { col: 'auxilio_educacao', nome: 'Auxílio educação', ic: 'ti-certificate', ordem: 'nome', campos: [
    { k: 'pessoa', rot: 'Pessoa', tipo: 'pessoa', lista: true }, { k: 'instituicao', rot: 'Instituição', lista: true }, { k: 'curso', rot: 'Curso', lista: true },
    { k: 'modalidade', rot: 'Modalidade', tipo: 'sel', ops: ['Graduação', 'Pós-graduação', 'MBA', 'Técnico', 'Idiomas', 'Outro'] }, { k: 'dtInicio', rot: 'Início', tipo: 'data' }, { k: 'dtTermino', rot: 'Término', tipo: 'data', lista: true },
    { k: 'mensalidade', rot: 'Mensalidade', tipo: 'reais' }, { k: 'percentual', rot: 'Percentual pago pela empresa (%)', tipo: 'num' }, { k: 'parcelas', rot: 'Parcelas', tipo: 'num' },
    { k: 'custoEmpresa', rot: 'Custo da empresa', tipo: 'reais', lista: true }, { k: 'formaAuxilio', rot: 'Forma do auxílio' }, { k: 'compInicial', rot: 'Competência inicial', tipo: 'mes' },
    { k: 'aprovadoPor', rot: 'Aprovado por' }, { k: 'termo', rot: 'Termo', tipo: 'sel', ops: ['PENDENTE', 'ASSINADO', 'FINALIZADO'], lista: true }, { k: 'avaliacao', rot: 'Avaliação' }, { k: 'obs', rot: 'Observações', tipo: 'longo' } ] },
  adiant: { col: 'adiantamentos', nome: 'Adiantamentos por afastamento', ic: 'ti-cash', ordem: 'data', campos: [
    { k: 'pessoa', rot: 'Pessoa', tipo: 'pessoa', lista: true }, { k: 'data', rot: 'Data', tipo: 'data', lista: true }, { k: 'valor', rot: 'Valor', tipo: 'reais', lista: true },
    { k: 'devolvido', rot: 'Devolvido?', tipo: 'sel', ops: ['Não', 'Sim'], lista: true }, { k: 'devolvidoEm', rot: 'Devolvido em', tipo: 'data' }, { k: 'resp', rot: 'Responsável' }, { k: 'obs', rot: 'Observações', tipo: 'longo' } ] },
};
let aba = 'movs', busca = '';

const fmt = (c, v) => v == null || v === '' ? '—' : c.tipo === 'reais' ? fmtReais(+v) : c.tipo === 'data' ? fmtData(String(v).slice(0, 10)) : c.tipo === 'mes' ? String(v).split('-').reverse().join('/') : esc(v);

export async function render(el, ctx) {
  const A = ABAS[aba];
  const [lista, resumo] = await Promise.all([ctx.D.listar(A.col).catch(() => []), ctx.resumo().catch(() => ({ itens: [] }))]);
  const t = norm(busca);
  const l = lista.filter(x => !x.apagado).filter(x => !t || norm(Object.values(x).filter(v => typeof v === 'string').join(' ')).includes(t))
    .sort((a, b) => A.ordem === 'nome' ? (a.nome || '').localeCompare(b.nome || '', 'pt-BR') : String(b[A.ordem] || b.criadoEm || '').localeCompare(String(a[A.ordem] || a.criadoEm || '')));
  const cols = A.campos.filter(c => c.lista);
  const extra = aba === 'movs' ? kpis([['Movimentações', lista.length, 'registradas'], ['Pendentes no DP', lista.filter(x => x.dpStatus !== 'Ajustado').length, 'aguardando ajuste na folha', lista.some(x => x.dpStatus !== 'Ajustado') ? 'neutro' : 'sobe'], ['Promoções no ano', lista.filter(x => x.motivo === 'Promoção' && String(x.competencia || '').startsWith(hojeISO().slice(0, 4))).length, ''], ['Este mês', lista.filter(x => x.competencia === hojeISO().slice(0, 7)).length, '']])
    : aba === 'motoristas' ? kpis([['Motoristas ativos', lista.filter(x => x.status !== 'INATIVO').length, ''], ['Cesta básica', lista.filter(x => x.status !== 'INATIVO' && x.opcao === 'Cesta básica').length, ''], ['Ticket', lista.filter(x => x.status !== 'INATIVO' && x.opcao === 'Ticket').length, ''], ['Trocas agendadas', lista.filter(x => x.opcaoProx).length, '']]) : '';
  el.innerHTML = tit('ti-arrows-exchange', 'Movimentações', 'Promoções e mudanças, motoristas, multiplicadores, auxílio educação e adiantamentos', `<button class="btn prim" id="novo"><i class="ti ti-plus"></i>Novo registro</button><button class="btn ghost" id="csv"><i class="ti ti-download"></i>Baixar lista</button>`)
    + `<div class="filtros" style="margin-bottom:14px;flex-wrap:wrap">${Object.entries(ABAS).map(([k, a]) => `<button data-aba="${k}" class="${k === aba ? 'on' : ''}"><i class="ti ${a.ic}"></i> ${esc(a.nome)}</button>`).join('')}</div>` + extra
    + `<section class="card"><div class="card-h" style="gap:10px;flex-wrap:wrap"><h3 class="d">${esc(A.nome)} (${l.length})</h3><label class="busca" style="margin:0 0 0 auto;width:min(280px,100%)"><i class="ti ti-search"></i><input id="q" placeholder="Buscar" value="${esc(busca)}"></label></div>
      <div class="card-b">${l.length ? `<div class="tw"><table class="tb"><thead><tr>${cols.map(c => `<th>${esc(c.rot)}</th>`).join('')}</tr></thead><tbody>${l.slice(0, 300).map(x => `<tr class="clic" data-id="${esc(x.id)}">${cols.map(c => `<td${c.tipo === 'pessoa' ? '' : ' class="small"'}>${c.tipo === 'pessoa' ? `<b>${esc(x.nome || '')}</b><small class="muted" style="display:block">${esc([x.cargo, x.setor || x.depto].filter(Boolean).join(' · '))}${x.legado ? ' · sistema antigo' : ''}</small>` : c.estado ? (x[c.k] === 'Ajustado' ? st('ok', 'Ajustado') : st('pend', x[c.k] || 'Pendente')) : fmt(c, x[c.k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="muted" style="margin:6px 0">Nada aqui.</p>'}</div></section>`;
  $$('[data-aba]').forEach(b => b.onclick = () => { aba = b.dataset.aba; busca = ''; render(el, ctx); });
  $('#q').oninput = e => { busca = e.target.value; clearTimeout(el._t); el._t = setTimeout(() => render(el, ctx).then(() => { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }), 250); };
  $('#novo').onclick = () => form(ctx, A, null, resumo).then(m => m && render(el, ctx));
  $$('tr[data-id]').forEach(tr => tr.onclick = () => form(ctx, A, lista.find(x => x.id === tr.dataset.id), resumo).then(m => m && render(el, ctx)));
  $('#csv').onclick = () => {
    const cs = [{ k: 'nome', rot: 'Nome' }, { k: 'cargo', rot: 'Cargo' }, ...A.campos.filter(c => c.tipo !== 'pessoa')];
    const linhas = [cs.map(c => c.rot), ...l.map(x => cs.map(c => x[c.k] ?? ''))].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + linhas], { type: 'text/csv' })); a.download = A.col + '-' + hojeISO() + '.csv'; a.click();
  };
}

async function form(ctx, A, x, resumo) {
  const novo = !x; x = x || {};
  const campo = c => {
    const v = x[c.k] ?? '';
    if (c.tipo === 'pessoa') return `<div class="campo" style="grid-column:1/-1"><label for="f-p">${esc(c.rot)}</label>${novo ? `<input class="inp" id="f-p" placeholder="Nome ou matrícula (do FO1029)" autocomplete="off"><div id="f-pres" style="display:grid;gap:4px;margin-top:6px"></div>` : ''}<div id="f-psel">${x.nome ? `<div class="ok-msg"><b>${esc(x.nome)}</b>${x.cargo ? ' · ' + esc(x.cargo) : ''}${x.matricula ? ' · matrícula ' + esc(x.matricula) : ''}</div>` : ''}</div></div>`;
    const inp = c.tipo === 'sel' ? `<select class="inp" id="f-${c.k}">${c.ops.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : c.tipo === 'longo' ? `<textarea class="inp" id="f-${c.k}" rows="2">${esc(v)}</textarea>`
      : `<input class="inp" id="f-${c.k}" ${c.tipo === 'data' ? 'type="date"' : c.tipo === 'mes' ? 'type="month"' : c.tipo === 'num' || c.tipo === 'reais' ? 'type="number" step="0.01" inputmode="decimal"' : ''} value="${esc(c.tipo === 'data' ? String(v).slice(0, 10) : v)}">`;
    return `<div class="campo"${c.tipo === 'longo' ? ' style="grid-column:1/-1"' : ''}><label for="f-${c.k}">${esc(c.rot)}</label>${inp}</div>`;
  };
  let pessoa = x.pid ? { i: x.pid, n: x.nome } : null, salvo = false;
  const r = await modal({ titulo: (novo ? 'Novo · ' : '') + A.nome, larga: true, corpo: `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">${A.campos.map(campo).join('')}</div><div id="f-msg"></div>`,
    botoes: [...(novo || !ctx.admin() ? [] : [{ id: 'apagar', texto: 'Apagar', cls: 'ghost' }]), { id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    aoAbrir: bg => {
      if (novo && A.col === 'movimentacoes') { const c = $('#f-competencia', bg); if (c && !c.value) c.value = hojeISO().slice(0, 7); }
      const b = $('#f-p', bg); if (!b) return;
      b.oninput = () => {
        const t = norm(b.value.trim()); const l = t.length < 2 ? [] : resumo.itens.filter(i => i.g !== 'desligado' && (norm(i.n).includes(t) || i.m === b.value.trim())).slice(0, 8);
        $('#f-pres', bg).innerHTML = l.map(i => `<button type="button" class="btn sm" style="justify-content:flex-start" data-x="${esc(i.i)}">${esc(i.n)} · ${esc(i.c)} · ${esc(i.m)}</button>`).join('');
        $$('[data-x]', bg).forEach(k => k.onclick = async () => {
          pessoa = resumo.itens.find(i => i.i === k.dataset.x); b.value = ''; $('#f-pres', bg).innerHTML = '';
          $('#f-psel', bg).innerHTML = `<div class="ok-msg"><b>${esc(pessoa.n)}</b> · ${esc(pessoa.c)} · matrícula ${esc(pessoa.m)}</div>`;
          // Preenche o "atual" com o que está no FO1029.
          for (const c of A.campos.filter(c => c.auto)) { const f = $('#f-' + c.k, bg); if (!f || f.value) continue;
            if (c.auto === 'sal') { if (ctx.pode('sensiveis')) { const pv = await ctx.D.privado(pessoa.i).catch(() => null); if (pv && pv.salarioAtual) f.value = pv.salarioAtual; } }
            else f.value = pessoa[c.auto] || ''; }
        });
      };
    },
    antesDeFechar: async (b, bg) => {
      if (b === 'apagar') { try { await ctx.D.atualizar(A.col, x.id, { apagado: true }); } catch (e) { toast(erroAmigavel(e), 'erro'); return false; } return; }
      if (!pessoa && !x.nome) { $('#f-msg', bg).innerHTML = '<div class="erro-msg">Escolha a pessoa.</div>'; return false; }
      const dados = {};
      A.campos.filter(c => c.tipo !== 'pessoa').forEach(c => { const f = $('#f-' + c.k, bg); if (!f) return; let v = f.value.trim(); if (c.tipo === 'num' || c.tipo === 'reais') v = v === '' ? null : +v; dados[c.k] = v; });
      if (pessoa && pessoa.c !== undefined) Object.assign(dados, { pid: pessoa.i, nome: pessoa.n, cargo: pessoa.c, setor: pessoa.s, matricula: pessoa.m, filial: pessoa.f });
      if (A.col === 'movimentacoes' && dados.dpStatus === 'Ajustado' && x.dpStatus !== 'Ajustado') dados.dpEm = new Date().toISOString(), dados.dpPor = ctx.nome();
      try {
        if (novo) {
          const pid = dados.pid;
          // Motorista: um registro por pessoa (mesmo id da admissão).
          if (A.col === 'motoristas' && pid) await ctx.D.definir('motoristas', pid, { ...dados, porNome: ctx.nome(), criadoEm: new Date().toISOString() });
          else await ctx.D.criar(A.col, { ...dados, porNome: ctx.nome() });
          if (A.col === 'movimentacoes' && pid && ctx.pode('pessoas')) await ctx.D.novoEvento(pid, { tipo: 'Promoção / movimentação', data: (dados.competencia || hojeISO().slice(0, 7)) + '-01', titulo: `${dados.motivo}: ${dados.cargoAnt || ''} → ${dados.cargoNovo || dados.cargoAnt || ''}`, obs: dados.obs || '', porNome: ctx.nome() }).catch(() => {});
        } else await ctx.D.atualizar(A.col, x.id, dados);
        salvo = true;
      } catch (e) { $('#f-msg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
    } });
  if (r === 'apagar') { toast('Registro apagado.'); return true; }
  if (r === 'ok' && salvo) { toast('Salvo.'); return true; }
  return false;
}
