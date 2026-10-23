// Vagas e seleção: lista de vagas com prazo e funil de candidatos.
import { ETAPAS, STATUS_VAGA } from '../config.js?v=5';
import { $, $$, esc, tit, kpis, st, fmtData, vazio, norm } from '../ui.js?v=5';
import { carregar, prazoVaga, retornoPendente } from '../selecao.js?v=5';
import { modalVaga } from '../selecao-ui.js?v=5';

let filtro = 'aberta', busca = '';

export async function render(el, ctx) {
  const sel = await carregar(ctx, true);
  const vagas = sel.vagas.filter(v => v.codigo !== 'BT-0001').sort((a, b) => (b.abertura || b.criadoEm || '').localeCompare(a.abertura || a.criadoEm || ''));
  const conta = k => vagas.filter(v => v.status === k).length;
  const abertas = vagas.filter(v => v.status === 'aberta');
  const emAnd = sel.candidatos.filter(c => c.situacao === 'andamento' && abertas.some(v => v.id === c.vagaId)).length;
  const atrasadas = abertas.filter(v => (prazoVaga(v) || {}).restam < 0).length;
  const lista = vagas.filter(v => filtro === 'todas' || v.status === filtro).filter(v => !busca || norm([v.codigo, v.cargo, v.setor, v.gestor].join(' ')).includes(norm(busca)));

  el.innerHTML = tit('ti-user-search', 'Vagas e seleção', `${abertas.length} vaga${abertas.length === 1 ? '' : 's'} aberta${abertas.length === 1 ? '' : 's'} · ${emAnd} candidato${emAnd === 1 ? '' : 's'} em andamento`,
    `<a class="btn" href="#/solicitacoes"><i class="ti ti-file-plus"></i>Pedidos de vaga</a><button class="btn prim" id="nova"><i class="ti ti-plus"></i>Nova vaga</button>`)
    + kpis([['Vagas abertas', abertas.length, abertas.reduce((s, v) => s + (+v.qtd || 1), 0) + ' posições'], ['Prazo vencido', atrasadas, 'vagas abertas além do prazo', atrasadas ? 'desce' : 'sobe'], ['Em andamento', emAnd, 'candidatos nas vagas abertas'], ['Retornos pendentes', sel.candidatos.filter(retornoPendente).length, 'reprovados sem resposta', sel.candidatos.filter(retornoPendente).length ? 'desce' : 'sobe']])
    + `<section class="card"><div class="card-h" style="flex-wrap:wrap;gap:10px"><div class="filtros">${[['aberta', 'Abertas'], ['pausada', 'Pausadas'], ['encerrada', 'Encerradas'], ['cancelada', 'Canceladas'], ['todas', 'Todas']].map(f => `<button data-f="${f[0]}" class="${f[0] === filtro ? 'on' : ''}">${f[1]} (${f[0] === 'todas' ? vagas.length : conta(f[0])})</button>`).join('')}</div><label class="busca" style="margin:0 0 0 auto;width:min(280px,100%)"><i class="ti ti-search"></i><input id="q" placeholder="Cargo, setor, gestor ou código" value="${esc(busca)}"></label></div>
    <div class="card-b">${lista.length ? `<div class="tw"><table class="tb"><thead><tr><th>Vaga</th><th>Abertura</th><th>Prazo</th><th>Funil</th><th>Situação</th></tr></thead><tbody>${lista.slice(0, 200).map(v => linha(v, sel)).join('')}</tbody></table></div>` : '<p class="muted" style="margin:6px 0">Nenhuma vaga neste filtro.</p>'}</div></section>`;

  $$('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; render(el, ctx); });
  $('#q').oninput = e => { busca = e.target.value; clearTimeout(el._t); el._t = setTimeout(() => render(el, ctx).then(() => { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }), 250); };
  $$('tr[data-v]').forEach(tr => tr.onclick = () => { location.hash = '#/vaga/' + tr.dataset.v; });
  $('#nova').onclick = async () => { const id = await modalVaga(ctx, sel); if (id) location.hash = '#/vaga/' + id; };
}

function linha(v, sel) {
  const cs = sel.porVaga[v.id] || [];
  const p = prazoVaga(v);
  const prazo = v.status !== 'aberta' || !p ? '<span class="muted small">—</span>' : p.restam < 0 ? st('atr', `${-p.restam} dia${p.restam === -1 ? '' : 's'} além`) : p.restam === 0 ? st('hoje', 'Vence hoje') : st('pend', `${p.restam} dia${p.restam === 1 ? '' : 's'}`);
  const funil = ETAPAS.map(e => cs.filter(c => c.situacao === 'andamento' && c.etapa === e.id).length);
  const adm = cs.filter(c => c.situacao === 'contratado').length;
  const [sn, sk] = STATUS_VAGA[v.status] || [v.status, ''];
  return `<tr class="clic" data-v="${esc(v.id)}"><td><b>${esc(v.cargo)}</b><small class="muted" style="display:block">${esc(v.codigo)} · ${esc(v.setor || '')}${v.gestor ? ' · ' + esc(v.gestor) : ''} · ${esc(v.qtd || 1)} vaga${(+v.qtd || 1) > 1 ? 's' : ''}</small></td>
    <td class="small">${fmtData(v.abertura)}</td><td>${prazo}</td>
    <td><div class="funil" title="${ETAPAS.map((e, i) => e.nome + ': ' + funil[i]).join(' · ')}">${funil.map((n, i) => `<i style="background:${n ? ETAPAS[i].cor : 'var(--nevoa)'};color:${i > 4 ? '#fff' : 'var(--mata)'}">${n || ''}</i>`).join('')}</div><small class="muted">${cs.filter(c => c.situacao === 'andamento').length} em andamento${adm ? ' · ' + adm + ' admitido' + (adm > 1 ? 's' : '') : ''}</small></td>
    <td>${sk ? st(sk, sn) : `<span class="pill">${esc(sn)}</span>`}</td></tr>`;
}
