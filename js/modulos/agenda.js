// Agenda do R&S: entrevistas, testes, exames e integrações marcados nos candidatos.
import { $, $$, esc, tit, card, fmtData, hojeISO, norm } from '../ui.js?v=12';
import { carregar, compromissos, etapa } from '../selecao.js?v=12';
import { fichaCandidato } from '../selecao-ui.js?v=12';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
let mes = null, diaSel = null, histQ = '', hist = null;

export async function render(el, ctx) {
  const sel = await carregar(ctx);
  const hoje = hojeISO();
  if (!mes) mes = hoje.slice(0, 7); if (!diaSel) diaSel = hoje;
  const evs = sel.candidatos.flatMap(c => compromissos(c).map(x => ({ ...x, c, dia: x.quando.slice(0, 10), hora: x.quando.length > 10 ? x.quando.slice(11, 16) : '' }))).sort((a, b) => a.quando.localeCompare(b.quando));
  const passados = evs.filter(e => e.dia < hoje);
  const [ano, m] = mes.split('-').map(Number);
  const primeiro = new Date(ano, m - 1, 1), dias = new Date(ano, m, 0).getDate(), ini = (primeiro.getDay() + 6) % 7;
  const iso = d => `${ano}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  let cal = '<div class="cal">' + ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => `<div class="dw">${d}</div>`).join('') + '<div class="d fora"></div>'.repeat(ini);
  for (let d = 1; d <= dias; d++) {
    const ds = iso(d), l = evs.filter(e => e.dia === ds);
    cal += `<button class="d${ds === hoje ? ' hj' : ''}${ds === diaSel ? ' sel' : ''}" data-d="${ds}"><b>${d}</b>${l.slice(0, 3).map(e => `<span class="ev" style="background:${e.cor};color:${e.tx}">${esc(e.hora)} ${esc(e.c.nome.split(' ')[0])}</span>`).join('')}${l.length > 3 ? `<span class="small muted">+${l.length - 3}</span>` : ''}<span class="dots">${l.slice(0, 4).map(e => `<i style="background:${e.tx}"></i>`).join('')}</span></button>`;
  }
  cal += '</div>';
  const doDia = evs.filter(e => e.dia === diaSel);
  const itemEv = e => `<div class="dia-it" data-c="${esc(e.c.id)}" style="cursor:pointer"><span class="hora" style="background:${e.cor};color:${e.tx}">${esc(e.hora || '—')}</span><div><b>${esc(e.tipo)} · ${esc(e.c.nome)}</b><small class="muted" style="display:block">${esc(e.c.vagaCodigo || '')} ${esc(e.c.vagaCargo || '')}${e.c.tel ? ' · ' + esc(e.c.tel) : ''}</small></div></div>`;

  el.innerHTML = tit('ti-calendar', 'Agenda do R&S', 'Entrevistas, testes, exames e integrações marcados nos candidatos', '')
    + (passados.length ? `<div class="faixa-erro" style="background:var(--sol-bg);color:var(--sol-tx);border-color:#ecd9a6"><i class="ti ti-alert-triangle" style="font-size:20px"></i><div>${passados.length} compromisso${passados.length > 1 ? 's' : ''} com data passada e o candidato ainda na mesma etapa. <span>Atualize a etapa na vaga.</span></div></div>` : '')
    + `<div class="graf-grade" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">${card(`${MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)} de ${ano}`, cal, `<div style="display:flex;gap:6px"><button class="btn sm" id="ant" aria-label="Mês anterior"><i class="ti ti-chevron-left"></i></button><button class="btn sm" id="hoje">Hoje</button><button class="btn sm" id="prox" aria-label="Próximo mês"><i class="ti ti-chevron-right"></i></button></div>`)}
      ${card(diaSel === hoje ? 'Hoje' : fmtData(diaSel), doDia.length ? doDia.map(itemEv).join('') : '<p class="small muted" style="margin:0">Nada marcado neste dia.</p>')}</div>
    ${passados.length ? `<div class="mt">${card('Datas que já passaram', passados.slice(-30).reverse().map(e => itemEv(e).replace('<b>', `<b>${fmtData(e.dia)} · `)).join(''))}</div>` : ''}
    <div class="mt">${card('Histórico da agenda do sistema antigo', `<label class="busca" style="margin:0 0 10px"><i class="ti ti-search"></i><input id="hq" placeholder="Buscar candidato, vaga ou observação" value="${esc(histQ)}"></label><div id="hist"><button class="btn sm" id="hist-b">Carregar histórico</button></div>`)}</div>`;

  const ir = (dm) => { const d = new Date(ano, m - 1 + dm, 1); mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); render(el, ctx); };
  $('#ant').onclick = () => ir(-1); $('#prox').onclick = () => ir(1);
  $('#hoje').onclick = () => { mes = hoje.slice(0, 7); diaSel = hoje; render(el, ctx); };
  $$('.cal .d[data-d]').forEach(b => b.onclick = () => { diaSel = b.dataset.d; render(el, ctx); });
  $$('[data-c]').forEach(x => x.onclick = () => fichaCandidato(ctx, x.dataset.c, () => render(el, ctx)));
  const desenharHist = () => {
    const t = norm(histQ);
    const l = hist.filter(h => !t || norm([h.candidato, h.idVaga, h.desc, h.obs, h.tipo, h.aprovacao].join(' ')).includes(t)).slice(0, 80);
    $('#hist').innerHTML = hist.length ? `<div class="tw"><table class="tb"><thead><tr><th>Data</th><th>Tipo</th><th>Candidato</th><th>Vaga</th><th>Resultado</th></tr></thead><tbody>${l.map(h => `<tr><td class="small">${esc(dataLegada(h.dt))}</td><td class="small">${esc(h.tipo || '')}</td><td><b>${esc(h.candidato || h.desc || '')}</b>${h.obs ? `<small class="muted" style="display:block">${esc(h.obs)}</small>` : ''}</td><td class="small">${esc(h.idVaga || '')}</td><td class="small">${esc(h.aprovacao || '')}${h.aceite ? ' · aceite: ' + esc(h.aceite) : ''}</td></tr>`).join('')}</tbody></table></div><div class="small muted">${hist.length} registros${t ? ' · ' + l.length + ' encontrados (mostrando até 80)' : ' (mostrando os 80 mais recentes)'}</div>` : '<p class="small muted" style="margin:0">Nenhum histórico importado. O administrador importa em Administração → Dados dos sistemas antigos.</p>';
  };
  const carregarHist = async () => { $('#hist').innerHTML = '<div class="esq-l" style="height:40px"></div>'; hist = (await ctx.D.listar('agenda_antiga').catch(() => [])).sort((a, b) => String(b.dt || '').localeCompare(String(a.dt || ''))); desenharHist(); };
  $('#hist-b').onclick = carregarHist;
  $('#hq').oninput = e => { histQ = e.target.value; if (hist) desenharHist(); else carregarHist(); };
  if (hist) desenharHist();
}

// O sistema antigo guardava datas em formatos variados ("2026-06-10T07:00", "14:00:00T08:00…").
const dataLegada = d => /^\d{4}-\d{2}-\d{2}/.test(d || '') && !d.startsWith('0001') ? fmtData(d.slice(0, 10)) + (d.length > 11 && d[10] === 'T' ? ' ' + d.slice(11, 16) : '') : '—';
