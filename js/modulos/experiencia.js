// Experiência: marcos de 10, 30, 45, 60 e 90 dias, calculados pela admissão.
import { MARCOS } from '../config.js?v=3';
import { $, $$, esc, tit, kpis, card, st, fmtData, hojeISO, somarDias, diasEntre, modal, toast, erroAmigavel, vazio } from '../ui.js?v=3';
import { emExperiencia, estadoMarco } from '../pendencias.js?v=3';

let filtro = 'todos';

export async function render(el, ctx) {
  const itens = (await ctx.resumo()).itens;
  const exp = await ctx.experiencias();
  const links = (await ctx.D.lerConfig('links').catch(() => null)) || {};
  const inicio = await ctx.inicioExp();
  const hoje = hojeISO();
  const lista = emExperiencia(itens).map(x => {
    const est = MARCOS.map(m => estadoMarco(x, m, exp[x.i], inicio));
    const prox = MARCOS.findIndex((m, k) => est[k] !== 'ok' && est[k] !== 'na');
    return { x, est, prox, dias: diasEntre(x.a, hoje), dataProx: prox >= 0 ? somarDias(x.a, MARCOS[prox].dia) : '9999' };
  }).sort((a, b) => a.dataProx.localeCompare(b.dataProx));
  const nHoje = lista.filter(l => l.est.includes('hoje')).length, nAtr = lista.filter(l => l.est.includes('atr')).length;
  const nove = lista.filter(l => { const d = somarDias(l.x.a, 90); return d.slice(0, 7) === hoje.slice(0, 7); }).length;

  if (!lista.length) { el.innerHTML = tit('ti-hourglass', 'Experiência') + vazio('ti-hourglass', 'Ninguém em experiência agora', 'Aparecem aqui as pessoas admitidas nos últimos 100 dias. Os dados vêm da importação do FO1029.'); return; }

  el.innerHTML = tit('ti-hourglass', 'Experiência', `${lista.length} pessoas · acompanhamento desde ${fmtData(inicio)} · contatos aos 10, 30 e 60 dias, avaliação aos 45, pesquisa aos 45 e 90`,
    `<button class="btn" id="copiar"><i class="ti ti-link"></i>Copiar link da pesquisa</button>${ctx.admin() ? '<button class="btn ghost" id="cfg"><i class="ti ti-settings"></i>Configurar</button>' : ''}`)
    + kpis([['Em experiência', lista.length, 'admitidos nos últimos 100 dias'], ['Marcos de hoje', nHoje, 'para registrar hoje', nHoje ? 'neutro' : 'sobe'], ['Atrasados', nAtr, 'venceram sem registro', nAtr ? 'desce' : 'sobe'], ['Completam 90 dias este mês', nove, 'decidir efetivação']])
    + card('Acompanhamento', `<div style="margin-bottom:12px" class="estados-leg">${st('pend')}${st('hoje')}${st('atr')}${st('ok')}</div><div class="tw"><table class="tb"><thead><tr><th>Pessoa</th><th>Admissão</th><th>Dias</th><th>Marcos (dias)</th><th>Próximo passo</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`,
      `<div class="filtros"><button data-f="todos">Todos</button><button data-f="hoje">Hoje</button><button data-f="atr">Atrasados</button></div>`);

  const desenhar = () => {
    $$('[data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === filtro));
    const l = lista.filter(r => filtro === 'todos' || r.est.includes(filtro));
    $('#tb').innerHTML = l.map(r => `<tr><td><a href="#/pessoa/${esc(r.x.i)}" style="text-decoration:none"><div class="pes"><span class="av">${esc(r.x.n[0])}${esc((r.x.n.split(' ').slice(-1)[0] || '')[0] || '')}</span><div><b>${esc(r.x.n)}</b><small>${esc(r.x.c)} · ${esc(r.x.f)}</small></div></div></a></td><td>${fmtData(r.x.a)}</td><td>${r.dias}</td>
      <td><div class="marcos">${MARCOS.map((m, k) => `${k ? '<i class="sep"></i>' : ''}<span class="${r.est[k] === 'pend' || r.est[k] === 'na' ? '' : r.est[k]}" style="${r.est[k] === 'na' ? 'opacity:.35;border-style:dashed' : ''}" title="${esc(m.nome)}: ${fmtData(somarDias(r.x.a, m.dia))}${r.est[k] === 'na' ? ' · antes do início do acompanhamento no sistema' : ''}${exp[r.x.i]?.[m.id]?.em ? ' · registrado por ' + esc(exp[r.x.i][m.id].porNome || '') : ''}">${r.est[k] === 'ok' ? '<i class="ti ti-check"></i>' : m.dia}</span>`).join('')}</div></td>
      <td>${r.prox >= 0 ? `${st(r.est[r.prox])} <span class="small">${esc(MARCOS[r.prox].nome)} · ${fmtData(r.dataProx)}</span>` : st('ok', 'Tudo registrado')}</td>
      <td>${r.prox >= 0 ? `<button class="btn sm" data-reg="${esc(r.x.i)}">Registrar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nada nesse filtro.</td></tr>';
    $$('[data-reg]').forEach(b => b.onclick = () => registrar(lista.find(r => r.x.i === b.dataset.reg)));
  };
  $$('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; desenhar(); });
  $('#copiar').onclick = async () => {
    if (!links.pesquisaExperiencia) return toast(ctx.admin() ? 'Cadastre o link da pesquisa no botão "Configurar".' : 'O administrador ainda não cadastrou o link da pesquisa.', 'erro');
    try { await navigator.clipboard.writeText(links.pesquisaExperiencia); toast('Link copiado. Cole no WhatsApp ou no e-mail da pessoa.'); } catch (e) { toast(links.pesquisaExperiencia); }
  };
  const cfg = $('#cfg'); if (cfg) cfg.onclick = async () => {
    const r = await modal({ titulo: 'Configurar a experiência', corpo: `<div class="campo"><label for="ini">Início do acompanhamento no sistema</label><input class="inp" type="date" id="ini" value="${esc(inicio)}"><span class="ajuda">Marcos que venceram antes desta data não aparecem como atrasados. Use a data em que a equipe começou a registrar aqui.</span></div>
      <div class="campo"><label for="lk">Link da pesquisa dos 45 e 90 dias</label><input class="inp" id="lk" value="${esc(links.pesquisaExperiencia || '')}" placeholder="https://…"><span class="ajuda">Hoje a pesquisa fica no sistema Indicadores. Cole aqui o link que o RH envia.</span></div>`,
      botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
      antesDeFechar: async (b, bg) => { try { await ctx.D.salvarConfig('links', { pesquisaExperiencia: $('#lk', bg).value.trim() }); if ($('#ini', bg).value) await ctx.D.salvarConfig('experiencia', { inicio: $('#ini', bg).value }); } catch (e) { toast(erroAmigavel(e), 'erro'); return false; } } });
    if (r === 'ok') { toast('Configuração salva.'); await ctx.inicioExp(true); ctx.atualizarContadores(); render(el, ctx); }
  };
  desenhar();

  async function registrar(r) {
    const reg = exp[r.x.i] || {};
    const abertos = MARCOS.map((m, k) => ({ m, e: r.est[k] })).filter(o => o.e !== 'ok' && o.e !== 'na');
    const corpo = `<div class="small muted">${esc(r.x.n)} · admitido em ${fmtData(r.x.a)} · ${r.dias} dias de casa</div>
      <div class="campo"><label for="mc">Marco</label><select class="inp" id="mc">${abertos.map(o => `<option value="${o.m.id}">${esc(o.m.nome)} (${fmtData(somarDias(r.x.a, o.m.dia))})</option>`).join('')}</select></div>
      <div class="campo"><label for="md">Data em que foi feito</label><input class="inp" type="date" id="md" value="${hojeISO()}" max="${hojeISO()}"></div>
      <div id="extra"></div>
      <div class="campo"><label for="mo">Observação (opcional)</label><textarea class="inp" id="mo" rows="3" maxlength="2000" placeholder="Como foi a conversa, combinados, pontos de atenção…"></textarea></div>
      <div class="ajuda">Fica registrado com seu nome (${esc(ctx.nome())}).${ctx.pode('pessoas') ? ' Avaliação e efetivação também entram no dossiê.' : ''}</div><div id="mmsg"></div>`;
    const res = await modal({ titulo: 'Registrar marco da experiência', corpo,
      botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Registrar', cls: 'prim' }],
      aoAbrir: bg => { const ex = () => { const id = $('#mc', bg).value; $('#extra', bg).innerHTML = id === 'd45' ? '<div class="chk-grade" style="grid-template-columns:1fr"><label><input type="checkbox" id="x-av"> Avaliação do gestor recebida</label><label><input type="checkbox" id="x-pq"> Link da pesquisa dos 45 dias enviado</label></div>' : id === 'd90' ? '<div class="campo"><label for="x-dec">Decisão</label><select class="inp" id="x-dec"><option value="efetivar">Efetivar</option><option value="nao_efetivar">Não efetivar (encerrar contrato)</option></select></div><div class="chk-grade" style="grid-template-columns:1fr"><label><input type="checkbox" id="x-pq"> Link da pesquisa dos 90 dias enviado</label></div>' : ''; }; $('#mc', bg).onchange = ex; ex(); },
      antesDeFechar: async (b, bg) => {
        const id = $('#mc', bg).value, em = $('#md', bg).value, obs = $('#mo', bg).value.trim();
        if (!em) { $('#mmsg', bg).innerHTML = '<div class="erro-msg">Informe a data.</div>'; return false; }
        const dado = { em, obs, porNome: ctx.nome(), porUid: ctx.uid };
        if ($('#x-av', bg)) dado.avaliacaoGestor = $('#x-av', bg).checked;
        if ($('#x-pq', bg)) dado.pesquisaEnviada = $('#x-pq', bg).checked;
        if ($('#x-dec', bg)) dado.decisao = $('#x-dec', bg).value;
        try {
          await ctx.D.salvarExperiencia(r.x.i, { [id]: dado });
          if (ctx.pode('pessoas') && (id === 'd45' || id === 'd90')) {
            await ctx.D.novoEvento(r.x.i, { tipo: id === 'd45' ? 'Avaliação período de experiência' : (dado.decisao === 'efetivar' ? 'Promoção / movimentação' : 'Avaliação período de experiência'), data: em, titulo: id === 'd45' ? '45 dias' + (dado.avaliacaoGestor ? ' · avaliação do gestor recebida' : '') : (dado.decisao === 'efetivar' ? 'Efetivado aos 90 dias' : 'Não efetivado aos 90 dias'), obs, porNome: ctx.nome() }).catch(() => {});
          }
        } catch (e) { $('#mmsg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
      } });
    if (res === 'ok') { toast('Marco registrado.'); await ctx.experiencias(true); ctx.atualizarContadores(); render(el, ctx); }
  }
}
