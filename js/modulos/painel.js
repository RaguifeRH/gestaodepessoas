// Painel de RH: headcount, admissões, desligamentos e turnover (dados do FO1029).
import { $, esc, tit, kpis, card, barras, legenda, hbar, fmtNum, fmtPct, hojeISO, diasEntre, vazio } from '../ui.js?v=3';

let filial = '';
const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export async function render(el, ctx) {
  const todos = (await ctx.resumo()).itens;
  if (!todos.length) { el.innerHTML = tit('ti-chart-bar', 'Painel de RH') + vazio('ti-chart-bar', 'Sem dados ainda', 'Os números aparecem depois da primeira importação do FO1029.'); return; }
  const filiais = [...new Set(todos.map(x => x.f).filter(Boolean))].sort();
  const itens = filial ? todos.filter(x => x.f === filial) : todos;
  const hoje = hojeISO();

  // Últimos 12 meses (inclui o atual)
  const meses = []; const d0 = new Date(); d0.setDate(1);
  for (let k = 11; k >= 0; k--) { const d = new Date(d0); d.setMonth(d.getMonth() - k); meses.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
  const adm = meses.map(m => 0), dem = meses.map(m => 0), hc = meses.map(m => 0);
  itens.forEach(x => (x.v || []).map(p => Array.isArray(p) ? p : String(p).split('|')).forEach(([a, d]) => {
    meses.forEach((m, i) => {
      const fim = m + '-31';
      if (a && a.slice(0, 7) === m) adm[i]++;
      if (d && d.slice(0, 7) === m) dem[i]++;
      if (a && a <= fim && (!d || d > fim)) hc[i]++;
    });
  }));
  const naFolha = itens.filter(x => x.g === 'ativo' || x.g === 'afastado');
  const turn = meses.map((m, i) => hc[i] ? ((adm[i] + dem[i]) / 2) / hc[i] * 100 : 0);
  const turnMedio = turn.slice(0, 11).reduce((s, v) => s + v, 0) / 11;
  const i = meses.length - 1, ant = i - 1;
  const rot = meses.map(m => NOMES_MES[+m.slice(5) - 1]);
  const series = [{ n: 'Admissões', c: '#024f2b', v: adm }, { n: 'Desligamentos', c: '#9dcd46', v: dem }];

  const contar = (l, k) => Object.entries(l.reduce((o, x) => { const v = x[k] || '—'; o[v] = (o[v] || 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]);
  const porFilial = contar(naFolha, 'f'), porSetor = contar(naFolha, 's').slice(0, 10), porTipo = contar(naFolha, 't');
  const faixas = [['Até 90 dias', 0, 90], ['3 a 12 meses', 91, 365], ['1 a 3 anos', 366, 1095], ['3 a 5 anos', 1096, 1825], ['Mais de 5 anos', 1826, 1e9]];
  const casa = faixas.map(f => [f[0], naFolha.filter(x => { const dd = x.a ? diasEntre(x.a, hoje) : -1; return dd >= f[1] && dd <= f[2]; }).length]);
  const dif = (a, b, inv) => { const v = a - b; if (!v) return ['igual ao mês anterior', 'neutro']; return [(v > 0 ? '+' : '') + v + ' sobre o mês anterior', (v > 0) !== !!inv ? 'sobe' : 'desce']; };
  const dA = dif(adm[i], adm[ant]), dD = dif(dem[i], dem[ant], true);

  el.innerHTML = tit('ti-chart-bar', 'Painel de RH', `${filial ? esc(filial) : 'Todas as filiais'} · dados do FO1029`, `<select class="inp" id="fil" style="width:auto"><option value="">Todas as filiais</option>${filiais.map(f => `<option${f === filial ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select>`)
    + kpis([['Na folha hoje', fmtNum(naFolha.length), `${itens.filter(x => x.g === 'afastado').length} afastados`], ['Admissões no mês', fmtNum(adm[i]), dA[0], dA[1]], ['Desligamentos no mês', fmtNum(dem[i]), dD[0], dD[1]], ['Turnover médio', fmtPct(turnMedio), 'média mensal dos últimos 11 meses fechados']])
    + `<div class="graf-grade">${card('Admissões e desligamentos', barras(rot, series, { rotulo: 'Admissões e desligamentos por mês' }), legenda(series))}
      ${card('Tempo de casa', hbar(casa, Math.max(...casa.map(c => c[1]))) + '<p class="small muted" style="margin:8px 0 0">Pessoas na folha hoje, pelo vínculo atual.</p>')}</div>
    <div class="g2i mt">${card('Por filial', hbar(porFilial, porFilial[0]?.[1]))}${card('Por tipo de contrato', hbar(porTipo, porTipo[0]?.[1]))}</div>
    <div class="mt">${card('Setores com mais pessoas', hbar(porSetor, porSetor[0]?.[1]))}</div>
    <div class="mt">${card('Turnover por mês', barras(rot, [{ n: 'Turnover (%)', c: '#036c3b', v: turn.map(v => Math.round(v * 10) / 10) }], { rotulo: 'Turnover mensal' }) + '<p class="small muted" style="margin:6px 0 0">Turnover = média entre admissões e desligamentos, dividida pelo headcount do fim do mês.</p>')}</div>`;
  $('#fil').onchange = e => { filial = e.target.value; render(el, ctx); };
}
