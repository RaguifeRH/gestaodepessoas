// Início: saudação, trilha com números reais, pendências do dia e atalhos.
import { esc, fmtNum, fmtData, st, card, iniciais } from '../ui.js?v=6';
import { emExperiencia, pendenciasExperiencia, aniversariantes } from '../pendencias.js?v=6';
import { carregar as carregarSelecao, pendenciasSelecao } from '../selecao.js?v=6';

export async function render(el, ctx) {
  const h = new Date().getHours(), oi = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  let hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); hoje = hoje[0].toUpperCase() + hoje.slice(1);
  const primeiro = (ctx.nome() || '').split(' ')[0];
  const vePessoas = ctx.pode('pessoas') || ctx.pode('experiencia') || ctx.pode('painel_rh');
  const r = vePessoas ? await ctx.resumo() : { itens: [] };
  const itens = r.itens;
  const ativos = itens.filter(x => x.g === 'ativo' || x.g === 'afastado').length;
  const desl = itens.filter(x => x.g === 'desligando').length;
  const exp = ctx.pode('experiencia') ? emExperiencia(itens) : [];
  const pend = ctx.pode('experiencia') ? pendenciasExperiencia(itens, await ctx.experiencias(), await ctx.inicioExp()) : [];
  const aniv = ctx.pode('pessoas') ? aniversariantes(itens, 7) : [];
  const atr = pend.filter(p => p.estado === 'atr').length, hj = pend.filter(p => p.estado === 'hoje').length;
  const sel = ctx.pode('selecao') ? await carregarSelecao(ctx).catch(() => null) : null;
  const vagasAb = sel ? sel.vagas.filter(v => v.status === 'aberta' && v.codigo !== 'BT-0001') : [];
  const emSel = sel ? sel.candidatos.filter(c => c.situacao === 'andamento') : [];
  const pedAb = sel ? sel.solicitacoes.filter(s => ['pendente', 'com_n2', 'aprovado_n2'].includes(s.status)).length : 0;

  const est = [
    sel ? ['#/vagas', '1', 'Vaga', `${vagasAb.length} aberta${vagasAb.length === 1 ? '' : 's'}${pedAb ? ' · ' + pedAb + ' pedido' + (pedAb > 1 ? 's' : '') : ''}`, false] : ['#/inicio', '1', 'Vaga', '—', true],
    sel ? ['#/vagas', '2', 'Seleção', `${emSel.filter(c => c.etapa !== 'integracao').length} em processo`, false] : ['#/inicio', '2', 'Seleção', '—', true],
    ['#/inicio', '3', 'Admissão', sel ? `${emSel.filter(c => c.etapa === 'integracao').length} com integração marcada` : 'Próxima etapa do sistema', !sel],
    ['#/experiencia', '4', 'Experiência', vePessoas ? `${exp.length} pessoas${hj ? ' · ' + hj + ' marcos hoje' : ''}` : '—', false],
    ['#/pessoas', '5', 'Ativos', vePessoas ? `${fmtNum(ativos)} colaboradores` : '—', false],
    ['#/pessoas', '6', 'Rescisão', vePessoas ? `${desl} em desligamento` : '—', false],
  ];
  const tarefas = [];
  if (sel) pendenciasSelecao(sel).forEach(x => tarefas.push([x.estado === 'atr' ? 'ver' : '', x.ic, x.titulo, x.sub || '', 'Ver', x.link]));
  if (atr) tarefas.push(['ver', 'ti-alert-triangle', `${atr} marco${atr > 1 ? 's' : ''} da experiência atrasado${atr > 1 ? 's' : ''}`, 'Contatos, avaliações ou pesquisas que já venceram', 'Ver', '#/experiencia']);
  if (hj) tarefas.push(['', 'ti-calendar-event', `${hj} marco${hj > 1 ? 's' : ''} da experiência vence${hj > 1 ? 'm' : ''} hoje`, 'Registre quando fizer o contato ou enviar a pesquisa', 'Ver', '#/experiencia']);
  if (ctx.pode('importar')) {
    const imp = await ctx.D.importacoes().catch(() => []);
    const ult = imp[0];
    if (!ult) tarefas.push(['amb', 'ti-file-import', 'Importe o FO1029 para carregar as pessoas', 'O cadastro único nasce dessa importação', 'Importar', '#/importar']);
    else { const dias = Math.floor((Date.now() - new Date(ult.criadoEm)) / 86400000); if (dias >= 7) tarefas.push(['amb', 'ti-file-import', `Última importação do FO1029 foi há ${dias} dias`, 'Importe de novo para atualizar admissões e desligamentos', 'Importar', '#/importar']); }
  }
  if (aniv.filter(a => a.dia === 0).length) tarefas.push(['', 'ti-cake', `${aniv.filter(a => a.dia === 0).length} aniversariante(s) hoje`, aniv.filter(a => a.dia === 0).slice(0, 3).map(a => a.pessoa.n).join(', '), 'Ver', '#/pessoas']);

  el.innerHTML = `
  <section class="hero"><div class="hero-top"><div><h1 class="d">${esc(oi)}${primeiro ? ', ' + esc(primeiro.charAt(0) + primeiro.slice(1).toLowerCase()) : ''}</h1><div class="data">${esc(hoje)}</div></div>
    <div class="resumo"><b>${tarefas.length}</b><span>coisa${tarefas.length === 1 ? '' : 's'} pede${tarefas.length === 1 ? '' : 'm'}<br>sua atenção hoje</span></div></div>
    <ol class="trilha" aria-label="Jornada do colaborador">${est.map(e => `<li><a href="${e[0]}" ${e[4] ? 'style="opacity:.55"' : ''}><span class="est">${e[1]}</span><b>${e[2]}</b><small>${esc(e[3])}</small></a></li>`).join('')}</ol></section>
  <div class="grade-inicio">
    <section class="card"><div class="card-h"><h3 class="d">Para hoje</h3></div><div class="card-b">${tarefas.length ? `<ul class="tarefas">${tarefas.map(t => `<li><span class="tipo ${t[0]}"><i class="ti ${t[1]}"></i></span><div><b>${esc(t[2])}</b><small>${esc(t[3])}</small></div><a class="btn sm" href="${t[5]}">${t[4]}</a></li>`).join('')}</ul>` : '<p class="muted" style="margin:6px 0">Nada pendente para você agora.</p>'}</div></section>
    <div style="display:grid;gap:20px;align-content:start">
      ${ctx.pode('pessoas') ? card('Aniversariantes da semana', aniv.length ? `<ul class="agenda">${aniv.slice(0, 8).map(a => `<li><span class="hora">${a.dia === 0 ? 'Hoje' : esc(a.pessoa.b.split('-').reverse().join('/'))}</span><div><b><a href="#/pessoa/${a.pessoa.i}" style="text-decoration:none">${esc(a.pessoa.n)}</a></b><small>${esc(a.pessoa.c)} · ${esc(a.pessoa.f)}</small></div></li>`).join('')}</ul>` : '<p class="muted small" style="margin:0">Ninguém faz aniversário nos próximos 7 dias.</p>') : ''}
      ${card('Atalhos', `<div style="display:flex;gap:8px;flex-wrap:wrap">${ctx.pode('selecao') ? '<a class="btn" href="#/vagas"><i class="ti ti-user-search"></i>Vagas</a><a class="btn" href="#/curriculos"><i class="ti ti-id-badge-2"></i>Currículos</a>' : ''}${ctx.pode('pessoas') ? '<a class="btn" href="#/pessoas"><i class="ti ti-folder-open"></i>Pessoas</a>' : ''}${ctx.pode('importar') ? '<a class="btn" href="#/importar"><i class="ti ti-file-import"></i>Importar FO1029</a>' : ''}${ctx.pode('painel_rh') ? '<a class="btn" href="#/painel_rh"><i class="ti ti-chart-bar"></i>Painel de RH</a>' : ''}${ctx.admin() ? '<a class="btn" href="#/usuarios"><i class="ti ti-shield-lock"></i>Usuários</a>' : ''}</div>`)}
    </div>
  </div>`;
}
