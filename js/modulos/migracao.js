// Dados dos sistemas antigos: importa os backups (.json) gerados em 22/10/2026.
// Os sistemas antigos não são alterados: o backup é só lido.
import { ETAPAS } from '../config.js?v=6';
import { $, esc, tit, card, kpis, fmtNum, fmtDataHora, capitalizar, toast, erroAmigavel, confirmar } from '../ui.js?v=6';
import { carregar, normalizarMotivo } from '../selecao.js?v=6';

const SISTEMAS = [
  { id: 'novaRH', nome: 'Raguife (novaRH) · Vagas e seleção', etapa: 2, desc: 'Pedidos de vaga, N2, vagas, candidatos, banco de talentos e agenda do R&S.' },
  { id: 'novaRH-adm', nome: 'Raguife (novaRH) · Admissão, dossiê, rescisão e movimentações', etapa: 3, desc: 'Entra junto com a etapa 3 e 4.' },
  { id: 'beneficios', nome: 'Benefícios', etapa: 5, desc: 'Entra com o portal do funcionário.' },
  { id: 'indicadores', nome: 'Indicadores', etapa: 6, desc: 'Entra com os indicadores das áreas.' },
  { id: 'jornal', nome: 'Jornal', etapa: 5, desc: 'Entra com o portal do funcionário.' },
  { id: 'avaliacao', nome: 'Avaliação de desempenho', etapa: 7, desc: '' },
  { id: 'auditoria', nome: 'Auditoria interna', etapa: 7, desc: '' },
];
const ORIGEM = { WHATSAPP: 'WhatsApp', INHIRE: 'InHire', INDICACAO: 'Indicação', 'CURRICULO ESPONTANEO': 'Currículo espontâneo', HUNTER: 'Hunter', INDEED: 'Indeed', LINKEDIN: 'LinkedIn', 'FEIRAO DE VAGAS': 'Feirão de vagas', HISTORICO: 'Histórico (sistema antigo)', OUTRO: 'Outro' };
const ACAO = { SOLICITACAO_CRIADA: 'Pedido enviado pelo gestor', ENCAMINHADO_N2: 'Encaminhado ao N2', APROVADO_N2: 'N2 aprovou', REPROVADO_N2: 'N2 reprovou', APROVADO_RH: 'Vaga aberta pelo RH', REPROVADO_RH: 'Reprovado pelo RH' };
const PERFIL = n => { const t = String(n || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return { OPERACIONAL: 'Operacional', MANUTENCAO: 'Manutenção', GESTAO: 'Gestão', ADMINISTRATIVO: 'Administrativo', PCD: 'PCD', 'AJUDANTE DE MOTORISTA': 'Ajudante de motorista', MOTORISTA: 'Motorista' }[t] || (n && n !== '—' ? capitalizar(n) : ''); };
const cap = s => s ? capitalizar(String(s).trim()) : '';
const motivoRep = m => { if (!m) return ''; const t = cap(m); return t.replace(/^Competencia/, 'Competência').replace('Tecnicos', 'técnicos').replace('Tecnica', 'técnica').replace('Pretensao', 'Pretensão').replace('Saude', 'saúde').replace('Horario', 'horário'); };
const resultado = r => ({ aprovado: 'apto', reprovado: 'inapto' }[r] || '');
const dataOk = d => /^\d{4}-\d{2}-\d{2}/.test(d || '') && !String(d).startsWith('0001') ? String(d).slice(0, 16) : '';

export async function render(el, ctx) {
  const imps = await ctx.D.listar('migracoes').catch(() => []);
  const ultima = id => imps.filter(i => i.sistema === id).sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''))[0];
  el.innerHTML = tit('ti-database-import', 'Dados dos sistemas antigos', 'Traz o histórico dos backups de 22/10. Os sistemas antigos não são alterados.')
    + `<div class="ok-msg" style="margin-bottom:16px">Pode importar mais de uma vez (por exemplo, com um backup mais novo antes de desligar o sistema antigo). Registros que já foram alterados aqui no sistema novo não são sobrescritos.</div>`
    + card('Sistemas', SISTEMAS.map(s => { const u = ultima(s.id); return `<div class="anexo"><span class="ic"><i class="ti ti-database"></i></span><div><b>${esc(s.nome)}</b><small class="muted" style="display:block">${esc(s.desc)}${u ? ` · última importação ${fmtDataHora(u.criadoEm)} por ${esc(u.porNome || '')}` : ''}</small></div>${s.etapa === 2 ? `<label class="btn sm ${u ? '' : 'prim'}"><i class="ti ti-upload"></i>${u ? 'Importar de novo' : 'Escolher backup'}<input type="file" accept=".json,application/json" id="arq-${s.id}" hidden></label>` : `<span class="pill">Etapa ${s.etapa}</span>`}</div>`; }).join(''))
    + '<div id="prev" class="mt"></div>';
  $('#arq-novaRH').onchange = e => { const f = e.target.files[0]; if (f) previa(el, ctx, f); };
}

async function previa(el, ctx, arquivo) {
  const box = $('#prev'); box.innerHTML = '<div class="card" style="padding:20px"><div class="esq-l" style="height:60px"></div></div>';
  let bk;
  try { bk = JSON.parse(await arquivo.text()); } catch (e) { box.innerHTML = '<div class="erro-msg">Não consegui ler o arquivo. Use o .json gerado pela ferramenta de backup.</div>'; return; }
  if (!bk.colecoes || (bk.sistema !== 'novaRH' && bk.projeto !== 'novarh-4fbc6')) { box.innerHTML = `<div class="erro-msg">Este backup é do sistema "${esc(bk.sistema || '?')}". Escolha o backup do novaRH (backup_novarh-4fbc6_….json).</div>`; return; }
  const m = montar(bk.colecoes);
  const sel = await carregar(ctx, true);
  const existentes = { solicitacoes: new Map(sel.solicitacoes.map(x => [x.id, x])), vagas: new Map(sel.vagas.map(x => [x.id, x])), candidatos: new Map(sel.candidatos.map(x => [x.id, x])) };
  const ops = []; const st = { novos: 0, atualizados: 0, mantidos: 0 };
  for (const col of ['solicitacoes', 'vagas', 'candidatos']) {
    for (const [id, dados] of m[col]) {
      const ja = existentes[col].get(id);
      if (ja && ja.editadoEm) { st.mantidos++; continue; } // mexido no sistema novo: não sobrescreve
      ja ? st.atualizados++ : st.novos++;
      ops.push({ caminho: [col, id], dados });
    }
  }
  m.agenda.forEach(([id, dados]) => ops.push({ caminho: ['agenda_antiga', id], dados }));
  box.innerHTML = card('Conferir antes de gravar', kpis([['Pedidos de vaga', fmtNum(m.solicitacoes.length), 'com o histórico do N2'], ['Vagas', fmtNum(m.vagas.length), m.vagas.filter(v => v[1].status === 'aberta').length + ' abertas hoje'], ['Candidatos', fmtNum(m.candidatos.length), m.candidatos.filter(c => c[1].situacao === 'banco').length + ' do banco de talentos · ' + m.candidatos.filter(c => c[1].situacao === 'contratado').length + ' admitidos'], ['Agenda antiga', fmtNum(m.agenda.length), 'entrevistas e testes']])
    + `<p class="small" style="margin:12px 0 4px">Listas: ${m.cfg.setores.length} setores, ${m.cfg.perfis.length} perfis com prazo, ${m.n2.length} N2. Backup gerado em ${fmtDataHora(bk.geradoEm)}.</p>
       <p class="small" style="margin:0 0 12px">${st.novos} registros novos · ${st.atualizados} já importados antes (serão atualizados) · ${st.mantidos} alterados aqui (mantidos como estão).</p>
       <div class="progresso" id="mg-prog" hidden><i></i></div><div id="mg-msg"></div>
       <div style="display:flex;gap:8px;margin-top:12px"><button class="btn prim" id="mg-ok"><i class="ti ti-database-import"></i>Gravar no sistema novo</button><button class="btn ghost" id="mg-x">Cancelar</button></div>`);
  $('#mg-x').onclick = () => { box.innerHTML = ''; };
  $('#mg-ok').onclick = async () => {
    if (!(await confirmar('Importar', `Gravar ${fmtNum(ops.length)} registros do sistema antigo? O sistema antigo não é alterado.`, 'Gravar'))) return;
    $('#mg-ok').disabled = true; $('#mg-prog').hidden = false;
    try {
      // Listas: soma com o que já existe aqui.
      const atual = sel.cfg || {}; const uni = (a, b) => [...new Set([...(a || []), ...b])];
      const perfis = [...(atual.perfis || [])]; m.cfg.perfis.forEach(p => { if (!perfis.some(x => x.nome === p.nome)) perfis.push(p); });
      await ctx.D.salvarConfig('selecao', { setores: uni(atual.setores, m.cfg.setores), perfis, empresas: uni(atual.empresas, m.cfg.empresas), escalas: atual.escalas || [] });
      const n2 = [...sel.n2s]; m.n2.forEach(x => { if (!n2.some(y => y.email && y.email === x.email)) n2.push(x); });
      await ctx.D.salvarConfig('selecao_n2', { lista: n2 });
      await ctx.D.gravarLote(ops, (f, t) => { $('#mg-prog i').style.width = Math.round(f / t * 100) + '%'; });
      // Contadores de código: o sistema novo continua a numeração.
      const cont = await ctx.D.lerConfig('contadores').catch(() => null) || {};
      const novoCont = {}; Object.entries(m.contadores).forEach(([k, v]) => { if ((cont[k] || 0) < v) novoCont[k] = v; });
      if (Object.keys(novoCont).length) await ctx.D.gravarLote([{ caminho: ['config', 'contadores'], dados: novoCont, merge: true }]);
      await ctx.D.criar('migracoes', { sistema: 'novaRH', arquivo: arquivo.name, geradoEm: bk.geradoEm || '', registros: ops.length, ...st, porNome: ctx.nome() });
      ctx.D.log('migracao_novarh', ops.length + ' registros');
      await carregar(ctx, true); ctx.atualizarContadores();
      toast('Importação concluída.'); render(el, ctx);
    } catch (e) { $('#mg-msg').innerHTML = `<div class="erro-msg">A gravação parou: ${esc(erroAmigavel(e))}. Nada se perde: rode de novo, ela continua de onde parou.</div>`; $('#mg-ok').disabled = false; }
  };
}

// Converte as coleções do novaRH para o formato do sistema novo (mesmos ids, para poder repetir).
function montar(C) {
  const docs = col => Object.entries(C[col] || {}).map(([id, x]) => [id, x.dados || x]);
  const agora = new Date().toISOString();
  const vagasAnt = docs('vagas');
  const vagaPorId = new Map(vagasAnt);
  const solicitacoes = docs('solicitacoes').map(([id, s]) => {
    const h = (s.historico || []).map(x => ({ dt: x.dt || '', acao: ACAO[x.acao] || cap(String(x.acao || '').replace(/_/g, ' ')), por: x.por || '', ...(x.obs ? { obs: x.obs } : {}) }));
    const n2 = (s.historico || []).find(x => x.acao === 'APROVADO_N2' || x.acao === 'REPROVADO_N2');
    return [id, { codigo: s.codigo || '', gestor: cap(s.gestor), email: (s.email || '').toLowerCase(), empresa: s.empresa || '', setor: cap(s.setor), cargo: cap(s.cargo), motivo: normalizarMotivo(s.motivo), qtd: +s.qtd || 1, escala: s.escala || '', substituido: cap(s.substituto), requisitos: s.requisitos || '', obs: s.obs || '',
      status: s.status || 'pendente', n2Nome: cap(s.n2Nome), n2Email: (s.n2Email || '').toLowerCase(), vagaId: s.vagaId || null, vagaCodigo: s.vagaCodigo || '', justReprovacao: s.justReprovacao || '',
      ...(n2 ? { n2Resposta: { decisao: n2.acao === 'APROVADO_N2' ? 'aprovado' : 'reprovado', em: n2.dt || '', obs: s.justReprovacaoN2 || n2.obs || '' } } : {}),
      historico: h, criadoEm: s.criadoEm || '', legado: true, importadoEm: agora }];
  });
  const vagas = [], candidatos = [];
  vagasAnt.forEach(([id, v]) => {
    const banco = v.isBancoTalentos === true && v.codigo === 'BT-0001' || id === 'banco_talentos';
    if (!banco) vagas.push([id, { codigo: v.codigo || id, cargo: cap(v.cargo), setor: cap(v.departamento), empresa: v.empresa || '', perfil: PERFIL(v.perfil), motivo: normalizarMotivo(v.motivo), qtd: +v.qtd || 1, substituido: cap(v.substituto), obs: v.obs || '', abertura: (v.abertura || v.criadoEm || '').slice(0, 10), sla: +v.sla || 15, status: v.status || 'aberta', gestor: '', escala: '', requisitos: '',
      aceiteData: v.aceiteData || '', solicitacaoId: v.solicitacaoId || null, solicitacaoCodigo: v.solicitacaoCodigo || '', criadoEm: v.criadoEm || '', legado: true, importadoEm: agora }]);
    (v.candidatos || []).forEach(c => {
      const et = (ETAPAS.find(e => e.leg === c.etapa) || ETAPAS[0]).id;
      let situacao = 'andamento';
      if (banco) situacao = 'banco';
      else if (c.etapa === 8 || (c.motivoRep && c.etapa !== 7)) situacao = 'reprovado';
      else if (c.etapa === 7 && v.status !== 'aberta' && v.status !== 'pausada') situacao = 'contratado';
      else if (v.status === 'cancelada' || v.status === 'encerrada') situacao = 'reprovado';
      const etapaFinal = c.etapa === 8 ? (ETAPAS[Math.max(0, ...(c.historicoEtapas || [0]).filter(n => n < 8))] || ETAPAS[0]).id : et;
      const cid = 'L' + String(id).replace(/[^\w-]/g, '_') + '_' + String(c.id || Math.random().toString(36).slice(2)).replace(/[^\w-]/g, '_');
      candidatos.push([cid, {
        nome: cap(c.nome), tel: c.tel || '', cidade: '', area: banco ? '' : cap(v.departamento), origem: ORIGEM[String(c.origem || '').toUpperCase()] || cap(c.origem), indicadoPor: cap(c.indicado), obs: [c.obs, banco && c.motivoRep ? 'Motivo anterior: ' + motivoRep(c.motivoRep) : ''].filter(Boolean).join('\n'),
        vagaId: banco ? null : id, vagaCodigo: banco ? '' : (v.codigo || ''), vagaCargo: banco ? '' : cap(v.cargo), vagaSetor: banco ? '' : cap(v.departamento),
        etapa: etapaFinal, situacao, motivo: situacao === 'reprovado' ? (motivoRep(c.motivoRep) || (v.status === 'cancelada' ? 'Vaga cancelada' : 'Vaga encerrada')) : '', retorno: null, resultadoEntrevista: resultado(c.resultadoEntrevista),
        datas: { entrevista: dataOk(c.dtEntrevista), teste: dataOk(c.dtTeste), exame: dataOk(c.dtExame).slice(0, 10), integracao: dataOk(c.dtIntegracao), aceite: dataOk(c.dtAceite).slice(0, 10) },
        checks: { ficha: c.solicitacao || '', termo: c.termoRegras || '', avaliacaoGestor: c.avaliacao || '', interesse: c.interesse || '', checklistDocs: c.checklistDocs || '', guia: c.guia || '', docs: c.docsStatus || '' },
        ...(situacao === 'contratado' ? { admitidoEm: dataOk(c.dtIntegracao) || v.aceiteData || '' } : {}),
        historico: [{ etapa: etapaFinal, em: dataOk(c.dtIntegracao) || dataOk(c.dtEntrevista) || v.criadoEm || agora, porNome: '', acao: 'Importado do sistema antigo (etapas: ' + (c.historicoEtapas || []).map(n => (ETAPAS.find(e => e.leg === n) || { nome: n === 8 ? 'Reprovado' : n }).nome).join(' → ') + ')' }],
        participacoes: [], legado: true, importadoEm: agora, criadoEm: v.criadoEm || agora,
      }]);
    });
  });
  const agenda = docs('eventos').map(([id, e]) => [id, { tipo: cap(e.tipo), dt: e.dt || '', candidato: cap(e.candidato), idVaga: e.idVaga || '', origem: cap(e.origem), aprovacao: cap(e.aprovacao), aceite: e.aceite || '', desc: e.desc || '', obs: e.obs || '', empresa: e.empresa || '' }]);
  const perfisMap = new Map(); docs('perfis').forEach(([, p]) => { const n = PERFIL(p.nome); if (n && !perfisMap.has(n)) perfisMap.set(n, { nome: n, sla: +p.sla || 15 }); });
  const contadores = {};
  vagas.forEach(([, v]) => { const x = /^RH-(\d{4})-(\d+)$/.exec(v.codigo); if (x) contadores['vaga_' + x[1]] = Math.max(contadores['vaga_' + x[1]] || 0, +x[2]); });
  solicitacoes.forEach(([, s]) => { const x = /^SOL-(\d{4})-(\d+)$/.exec(s.codigo); if (x) contadores['sol_' + x[1]] = Math.max(contadores['sol_' + x[1]] || 0, +x[2]); });
  return {
    solicitacoes, vagas, candidatos, agenda, contadores,
    cfg: { setores: [...new Set(docs('sol_setores').map(([, s]) => cap(s.nome)).filter(Boolean))], perfis: [...perfisMap.values()], empresas: [...new Set(vagasAnt.map(([, v]) => v.empresa).filter(e => e && e.length > 8))] },
    n2: docs('sol_n2s').map(([, n]) => ({ nome: cap(n.nome), email: (n.email || '').toLowerCase(), setor: cap(n.setor) })).filter(n => n.nome),
  };
}
