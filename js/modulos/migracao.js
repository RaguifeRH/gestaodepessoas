// Dados dos sistemas antigos: importa os backups (.json) gerados em 22/10/2026.
// Os sistemas antigos não são alterados: o backup é só lido.
import { ETAPAS } from '../config.js?v=12';
import { $, esc, tit, card, kpis, fmtNum, fmtDataHora, capitalizar, toast, erroAmigavel, confirmar } from '../ui.js?v=12';
import { carregar, normalizarMotivo } from '../selecao.js?v=12';
import { hashCpf, mascararCpf } from '../fo1029.js?v=12';

const SISTEMAS = [
  { id: 'novaRH', nome: 'Raguife (novaRH) · Vagas, seleção e admissão', etapa: 2, desc: 'Pedidos de vaga, N2, vagas, candidatos, banco de talentos, agenda do R&S, processos de admissão e lista de motoristas (cesta/ticket).' },
  { id: 'novaRH-hist', nome: 'Raguife (novaRH) · Dossiê, experiência, rescisão e movimentações', etapa: 2, desc: 'Linha do tempo do dossiê (DDS, DSP, pílulas, ginástica, advertências…), acompanhamento da experiência, desligamentos, movimentações, multiplicadores, auxílio educação e adiantamentos. Importe o FO1029 antes: é por ele que cada registro encontra a pessoa.' },
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
  $('#arq-novaRH-hist').onchange = e => { const f = e.target.files[0]; if (f) previaHist(el, ctx, f); };
}

async function previa(el, ctx, arquivo) {
  const box = $('#prev'); box.innerHTML = '<div class="card" style="padding:20px"><div class="esq-l" style="height:60px"></div></div>';
  let bk;
  try { bk = JSON.parse(await arquivo.text()); } catch (e) { box.innerHTML = '<div class="erro-msg">Não consegui ler o arquivo. Use o .json gerado pela ferramenta de backup.</div>'; return; }
  if (!bk.colecoes || (bk.sistema !== 'novaRH' && bk.projeto !== 'novarh-4fbc6')) { box.innerHTML = `<div class="erro-msg">Este backup é do sistema "${esc(bk.sistema || '?')}". Escolha o backup do novaRH (backup_novarh-4fbc6_….json).</div>`; return; }
  const m = montar(bk.colecoes);
  Object.assign(m, await montarAdm(bk.colecoes));
  const sel = await carregar(ctx, true);
  const [admEx, motEx] = await Promise.all([ctx.D.listar('admissoes').catch(() => []), ctx.D.listar('motoristas').catch(() => [])]);
  const existentes = { solicitacoes: new Map(sel.solicitacoes.map(x => [x.id, x])), vagas: new Map(sel.vagas.map(x => [x.id, x])), candidatos: new Map(sel.candidatos.map(x => [x.id, x])), admissoes: new Map(admEx.map(x => [x.id, x])), motoristas: new Map(motEx.map(x => [x.id, x])) };
  const ops = []; const st = { novos: 0, atualizados: 0, mantidos: 0 };
  for (const col of ['solicitacoes', 'vagas', 'candidatos', 'admissoes', 'motoristas']) {
    for (const [id, dados] of m[col]) {
      const ja = existentes[col].get(id);
      if (ja && ja.editadoEm) { st.mantidos++; continue; } // mexido no sistema novo: não sobrescreve
      ja ? st.atualizados++ : st.novos++;
      ops.push({ caminho: [col, id], dados });
    }
  }
  m.agenda.forEach(([id, dados]) => ops.push({ caminho: ['agenda_antiga', id], dados }));
  box.innerHTML = card('Conferir antes de gravar', kpis([['Pedidos de vaga', fmtNum(m.solicitacoes.length), 'com o histórico do N2'], ['Vagas', fmtNum(m.vagas.length), m.vagas.filter(v => v[1].status === 'aberta').length + ' abertas hoje'], ['Candidatos', fmtNum(m.candidatos.length), m.candidatos.filter(c => c[1].situacao === 'banco').length + ' do banco de talentos · ' + m.candidatos.filter(c => c[1].situacao === 'contratado').length + ' admitidos'], ['Agenda antiga', fmtNum(m.agenda.length), 'entrevistas e testes']])
    + `<p class="small" style="margin:12px 0 4px">Admissão: ${m.admissoes.length} processos com checklist (${m.admissoes.filter(a => a[1].status === 'andamento').length} em andamento) · ${m.motoristas.length} motoristas com a opção cesta/ticket. Os ${m.admImportados} processos que só copiavam o FO1029 não são trazidos (o FO1029 já está aqui).</p><p class="small" style="margin:0 0 4px">Listas: ${m.cfg.setores.length} setores, ${m.cfg.perfis.length} perfis com prazo, ${m.n2.length} N2. Backup gerado em ${fmtDataHora(bk.geradoEm)}.</p>
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

// Admissão (processos com checklist) e lista de motoristas do sindicato.
async function montarAdm(C) {
  const docs = col => Object.entries(C[col] || {}).map(([id, x]) => [id, x.dados || x]);
  const agora = new Date().toISOString();
  const iso = d => { const t = String(d || ''); const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t); return m ? `${m[3]}-${m[2]}-${m[1]}` : /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : ''; };
  const todos = docs('adm_processos');
  const admissoes = [];
  for (const [id, p] of todos.filter(([, p]) => p.status !== 'importado')) {
    const dd = p.dados || {}; const cpf = String(dd.cpf || '').replace(/\D/g, '');
    const checks = {};
    Object.entries(p.checks || {}).forEach(([k, v]) => { if (v === 'na') checks[k] = 'na'; else if (v && v.done) checks[k] = { em: v.data || '', porNome: cap(v.resp), obs: v.obs || '', legado: true }; });
    admissoes.push([id, { nome: cap(dd.nome), pid: cpf.length >= 9 ? await hashCpf(cpf) : '', cpfMasc: cpf.length >= 9 ? mascararCpf(cpf) : '', cargo: cap(dd.cargo), setor: cap(dd.estrutura), filial: cap(dd.filial), matricula: dd.matricula || '', admissao: iso(dd.admissao), dataIntegracao: iso(dd.admissao),
      perfil: p.perfil || 'geral', status: p.status === 'concluido' ? 'concluido' : 'andamento', checks, obs: p.obs || '',
      papeis: { ...(p.brigadista ? { brigadista: p.brigadista } : {}), ...(p.cipa ? { cipa: p.cipa } : {}), ...(p.multiplicador ? { multiplicador: p.multiplicador } : {}) },
      historico: (p.historico || []).map(h => ({ dt: h.dt || '', acao: { PROCESSO_CRIADO: 'Admissão iniciada', SALVO: 'Checklist salvo' }[h.acao] || cap(String(h.acao || '').replace(/_/g, ' ')), por: h.por || '' })).slice(-50),
      ...(p.status === 'concluido' ? { concluidoEm: (p.atualizadoEm || p.criadoEm || '') } : {}), criadoEm: p.criadoEm || '', legado: true, importadoEm: agora }]);
  }
  const motoristas = docs('gp_motoristas').map(([id, x]) => ['L' + String(id).replace(/[^\w-]/g, '_'), { nome: cap(x.nome), cargo: cap(x.cargo), setor: cap(x.depto), admissao: iso(x.admissao), opcao: x.opcao === 'TICKET' ? 'Ticket' : x.opcao ? 'Cesta básica' : '', opcaoProx: x.opcaoProx ? (x.opcaoProx === 'TICKET' ? 'Ticket' : 'Cesta básica') : '', compProx: x.compProx || '', sindicato: x.sindicato || '', status: x.status || '', origem: 'Sistema antigo', legado: true, importadoEm: agora }]);
  return { admissoes, motoristas, admImportados: todos.length - admissoes.length };
}

// ---------------------------------------------------------------------------
// Histórico do novaRH: dossiê, experiência, rescisão e movimentações.
// Cada registro encontra a pessoa pelo CPF (processos de admissão) ou pelo nome (FO1029).
// Quem não for encontrado vai para dossie_orfaos: nada se perde.
// ---------------------------------------------------------------------------
async function previaHist(el, ctx, arquivo) {
  const box = $('#prev'); box.innerHTML = '<div class="card" style="padding:20px"><div class="esq-l" style="height:60px"></div><p class="small muted">Lendo o backup e procurando cada pessoa no FO1029…</p></div>';
  let bk;
  try { bk = JSON.parse(await arquivo.text()); } catch (e) { box.innerHTML = '<div class="erro-msg">Não consegui ler o arquivo.</div>'; return; }
  if (!bk.colecoes || (bk.sistema !== 'novaRH' && bk.projeto !== 'novarh-4fbc6')) { box.innerHTML = '<div class="erro-msg">Escolha o backup do novaRH (backup_novarh-4fbc6_….json).</div>'; return; }
  const resumo = await ctx.resumo(true).catch(() => ({ itens: [] }));
  if (!resumo.itens.length) { box.innerHTML = '<div class="erro-msg">Importe o FO1029 primeiro: é por ele que cada registro encontra a pessoa.</div>'; return; }
  const exist = await ctx.D.experiencias().catch(() => ({}));
  const m = await montarHist(bk.colecoes, resumo, exist, ctx.uid);
  const ops = [...m.eventos, ...m.orfaos, ...m.exp, ...m.resc, ...m.movs, ...m.mult, ...m.aux, ...m.adiant, ...m.pilulas];
  box.innerHTML = card('Conferir antes de gravar', kpis([['Dossiê', fmtNum(m.eventos.length), 'registros na linha do tempo'], ['Sem pessoa', fmtNum(m.orfaos.length), 'guardados à parte (não se perdem)', m.orfaos.length ? 'neutro' : 'sobe'], ['Experiência', fmtNum(m.exp.length), 'pessoas com marcos registrados'], ['Rescisões', fmtNum(m.resc.length), 'desligamentos com checklist']])
    + `<p class="small" style="margin:12px 0 4px">Movimentações: ${m.movs.length} · multiplicadores: ${m.mult.length} · auxílio educação: ${m.aux.length} · adiantamentos: ${m.adiant.length} · pílulas: ${m.pilulas.length}.</p>
       <p class="small" style="margin:0 0 4px">Pessoas encontradas: ${fmtNum(m.achadas)} pelo CPF e ${fmtNum(m.porNome)} pelo nome. ${m.orfaos.length ? `${fmtNum(m.orfaos.length)} registros de ${m.nOrfaos} pessoa(s) que não estão no FO1029 importado (outras filiais ou nome diferente) ficam guardados e aparecem quando o FO1029 trouxer essas pessoas e você importar de novo.` : ''}</p>
       <p class="small" style="margin:0 0 12px">Na experiência, marcos já registrados aqui não são trocados.</p>
       <div class="progresso" id="mg-prog" hidden><i></i></div><div id="mg-msg"></div>
       <div style="display:flex;gap:8px;margin-top:12px"><button class="btn prim" id="mg-ok"><i class="ti ti-database-import"></i>Gravar ${fmtNum(ops.length)} registros</button><button class="btn ghost" id="mg-x">Cancelar</button></div>`);
  $('#mg-x').onclick = () => { box.innerHTML = ''; };
  $('#mg-ok').onclick = async () => {
    if (!(await confirmar('Importar histórico', `Gravar ${fmtNum(ops.length)} registros do sistema antigo? Pode levar alguns minutos. O sistema antigo não é alterado.`, 'Gravar'))) return;
    $('#mg-ok').disabled = true; $('#mg-prog').hidden = false;
    try {
      await ctx.D.gravarLote(ops, (f, t) => { $('#mg-prog i').style.width = Math.round(f / t * 100) + '%'; });
      await ctx.D.criar('migracoes', { sistema: 'novaRH-hist', arquivo: arquivo.name, geradoEm: bk.geradoEm || '', registros: ops.length, orfaos: m.orfaos.length, porNome: ctx.nome() });
      ctx.D.log('migracao_novarh_hist', ops.length + ' registros'); ctx._exp = null; ctx._resc = null;
      toast('Histórico importado.'); render(el, ctx);
    } catch (e) { $('#mg-msg').innerHTML = `<div class="erro-msg">A gravação parou: ${esc(erroAmigavel(e))}. Nada se perde: rode de novo, ela continua de onde parou.</div>`; $('#mg-ok').disabled = false; }
  };
}

async function montarHist(C, resumo, exist, uid) {
  const docs = col => Object.entries(C[col] || {}).map(([id, x]) => [id, x.dados || x]);
  const agora = new Date().toISOString();
  const naFolha = new Map(resumo.itens.map(x => [x.i, x]));
  const porNome = new Map(); resumo.itens.forEach(x => { const k = normN(x.n); if (!porNome.has(k) || x.g !== 'desligado') porNome.set(k, x.i); });
  const iso = d => { const t = String(d || ''); const mm = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t); return mm ? `${mm[3]}-${mm[2]}-${mm[1]}` : /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : ''; };
  // funcId → pessoa
  const func = new Map(); let achadas = 0, nomeOk = 0;
  for (const [id, p] of docs('adm_processos')) {
    const dd = p.dados || {}; const cpf = String(dd.cpf || '').replace(/\D/g, ''); let pid = cpf.length >= 9 ? await hashCpf(cpf) : '';
    if (pid && naFolha.has(pid)) achadas++; else { pid = porNome.get(normN(dd.nome)) || ''; if (pid) nomeOk++; }
    func.set('adm_' + id, { pid, nome: cap(dd.nome) });
  }
  docs('dossie_funcs').forEach(([id, f]) => { const pid = porNome.get(normN(f.nome)) || ''; if (pid) nomeOk++; func.set(id, { pid, nome: cap(f.nome) }); });
  const achar = (funcId, nome) => { const f = func.get(funcId); if (f && f.pid) return f; const pid = porNome.get(normN(nome || (f && f.nome))); return { pid: pid || '', nome: cap(nome || (f && f.nome) || '') }; };
  const tipos = Object.fromEntries(docs('dossie_tipos').map(([, t]) => [t.id, t.nome]));
  Object.assign(tipos, { brigadista_ini: 'Brigadista — entrada', cipa_ini: 'CIPA — entrada', multiplicador_ini: 'Multiplicador — entrada' });
  const eventos = [], orfaos = [], quemOrfao = new Set();
  for (const [id, e] of docs('dossie_eventos')) {
    const f = achar(e.funcId);
    const ev = { tipo: tipos[e.tipoId] || cap(String(e.tipoId || 'Outro').replace(/_/g, ' ')), data: iso(e.data) || String(e.criadoEm || '').slice(0, 10), titulo: e.titulo || '', obs: e.obs || '', porNome: cap(e.resp) || '', porUid: uid, criadoEm: e.criadoEm || agora, legado: true,
      ...(e.grupo ? { grupo: true } : {}), ...(e.especial ? { especial: true } : {}), ...(e.discRecebido ? { devolucao: { recebido: e.discRecebido, em: e.discRecebidoData || e.discDataRec || '', por: e.discRecebidoResp || e.discRespRec || '' } } : {}) };
    if (f.pid && naFolha.has(f.pid)) eventos.push({ caminho: ['pessoas', f.pid, 'eventos', id], dados: ev });
    else { orfaos.push({ caminho: ['dossie_orfaos', id], dados: { ...ev, funcId: e.funcId, nome: f.nome } }); quemOrfao.add(e.funcId); }
  }
  // Experiência
  const cfgExp = (docs('exp_cfg')[0] || [null, {}])[1] || {};
  const contatos = Object.fromEntries((cfgExp.contatos || []).map(c => ['contato_' + c.id, c.dia]));
  const videos = Object.fromEntries((cfgExp.videos || []).map(v => ['video_' + v.id, v.titulo]));
  const marco = { 10: 'd10', 30: 'd30', 60: 'd60' };
  const exp = [];
  for (const [id, x] of docs('exp_data')) {
    const f = func.get(id); if (!f || !f.pid || !naFolha.has(f.pid)) continue;
    const ja = exist[f.pid] || {}; const r = {}; const vids = {};
    const reg = (k, v, extra = {}) => { if (!ja[k] || !ja[k].em) r[k] = { em: iso(v.date || v.data) || String(v.registradoEm || '').slice(0, 10), obs: v.obs || '', porNome: cap(v.resp) || '', legado: true, ...extra }; };
    Object.entries(x.checks || {}).forEach(([k, v]) => {
      if (!v || !v.done) return;
      if (contatos[k] && marco[contatos[k]]) reg(marco[contatos[k]], v);
      else if (k === 'feedback45') reg('d45', v, { avaliacaoGestor: true });
      else if (k === 'efetivacao') reg('d90', v, { decisao: 'efetivar' });
      else if (videos[k]) vids[k.slice(6)] = { titulo: videos[k], em: iso(v.date) || '', porNome: cap(v.resp) || '', obs: v.obs || '' };
    });
    const ef = x.efetivacao; if (ef && ef.efetivado && (!ja.d90 || !ja.d90.em) && !r.d90) r.d90 = { em: iso(ef.dtAlteracao) || iso(ef.registradoEm) || '', decisao: /^S/i.test(ef.efetivado) ? 'efetivar' : 'nao_efetivar', obs: [ef.obs, ef.cargo && ef.cargo !== 'O MESMO' ? 'Cargo: ' + ef.cargo : '', ef.salario ? 'Salário: ' + ef.salario : ''].filter(Boolean).join(' · '), porNome: cap(ef.responsavel) || '', legado: true };
    if (Object.keys(vids).length) r.videos = vids;
    if (Object.keys(r).length) exp.push({ caminho: ['experiencia', f.pid], dados: r, merge: true });
  }
  // Rescisões
  const resc = docs('rescisao_processos').map(([id, p]) => {
    const f = achar(p.funcId ? (String(p.funcId).startsWith('adm_') || String(p.funcId).startsWith('hist_') ? p.funcId : 'adm_' + p.funcId) : '', p.nome); const x = naFolha.get(f.pid) || {};
    const checks = {}; Object.entries(p.checks || {}).forEach(([k, v]) => { if (v === 'na') checks[k] = 'na'; else if (v && v.done) checks[k] = { em: v.data || '', porNome: cap(v.resp), obs: v.obs || '', legado: true }; });
    const h = p.homologacao || {};
    return { caminho: ['rescisoes', id], dados: { pid: f.pid || '', nome: cap(p.nome), cpfMasc: x.cm || '', matricula: x.m || '', cargo: cap(p.cargo), setor: cap(p.setor), empresa: p.empresa || '', filial: x.f || '', admissao: x.a || '', deslig: iso(p.deslig), tipo: p.tipo || 'outro', perfil: p.perfil || '',
      expTipo: p.expTipo || '', expIniciativa: p.expIniciativa || '', obs: p.obs || '', checks, homologacao: { data: h.data || '', hora: h.hora || '', local: h.local || '', obs: h.obs || '' },
      status: p.finalizado ? 'finalizado' : 'andamento', ...(p.finalizado ? { finalizadoEm: p.finalizadoEm || p.atualizadoEm || '' } : {}), porNome: cap(p.criadoPor), criadoEm: p.criadoEm || agora, legado: true, importadoEm: agora } };
  });
  const pessoaPorNome = nome => { const pid = porNome.get(normN(nome)) || ''; const x = naFolha.get(pid) || {}; return { pid, nome: cap(nome), cargo: x.c || '', setor: x.s || '', matricula: x.m || '', filial: x.f || '' }; };
  const mov = ({ 'PROMOÇÃO': 'Promoção', 'MOV. LATERAL': 'Movimentação lateral', 'EFETIVAÇÃO': 'Efetivação', 'RECRUTAMENTO INTERNO': 'Recrutamento interno', 'READAPTAÇÃO': 'Readaptação', 'AJUSTE EXCEPCIONAL': 'Ajuste excepcional' });
  const sn = v => /^S/i.test(v || '') ? 'Sim' : 'Não';
  const movs = docs('gp_movs').map(([id, x]) => ({ caminho: ['movimentacoes', 'L' + id], dados: { ...pessoaPorNome(x.nome), cargo: cap(x.cargoNovo || x.cargoAnt), motivo: mov[x.motivo] || cap(x.motivo), competencia: x.competencia || '', cargoAnt: cap(x.cargoAnt), cargoNovo: cap(x.cargoNovo), deptoAnt: cap(x.deptoAnt), deptoNovo: cap(x.deptoNovo), salarioAnt: +x.salarioAnt || null, salarioNovo: +x.salarioNovo || null,
    escalaAnt: x.escalaAnt || '', escalaNovo: x.escalaNovo || '', liderAnt: cap(x.liderAnt), liderNovo: cap(x.liderNovo), mudancaRisco: sn(x.mudancaRisco), insalPeric: sn(x.insalPeric), mudancaSindicato: sn(x.mudancaSindicato), dtExame: iso(x.dtExame), dtAso: iso(x.dtAso), responsavel: cap(x.responsavel), obs: x.obs || '',
    dpStatus: x.dp && /AJUST/i.test(x.dp.status || '') ? 'Ajustado' : 'Pendente', dpComp: (x.dp && x.dp.compFolha) || '', ...(x.dp && x.dp.responsavel ? { dpPor: cap(x.dp.responsavel), dpEm: x.dp.data || '' } : {}), criadoEm: x.criadoEm || agora, legado: true } }));
  const mult = docs('gp_mult').map(([id, x]) => ({ caminho: ['multiplicadores', 'L' + id], dados: { ...pessoaPorNome(x.nome), cargo: cap(x.cargo), setor: cap(x.depto), nivel: x.nivel || '', valor: +x.valor || null, dtInclusao: x.dtInclusao || '', pontuacao: String(x.pontuacao || ''), alterouNivelEm: x.alterouNivelEm || '', responsavel: cap(x.responsavel), ativo: x.ativo || 'SIM', obs: x.obs || '', dtAdmissao: x.dtAdmissao || '', legado: true } }));
  const aux = docs('gp_auxedu').map(([id, x]) => ({ caminho: ['auxilio_educacao', 'L' + id], dados: { ...pessoaPorNome(x.nome), cargo: cap(x.cargo), setor: cap(x.depto), email: x.email || '', instituicao: x.instituicao || '', curso: cap(x.curso), modalidade: cap(x.modalidade), dtInicio: iso(x.dtInicio), dtTermino: iso(x.dtTermino), mensalidade: +x.mensalidade || null, percentual: +x.percentual || null, parcelas: +x.parcelas || null,
    custoEmpresa: +x.custoEmpresa || null, custoAnual: +x.custoAnual || null, formaAuxilio: cap(x.formaAuxilio), compInicial: x.compInicial || '', aprovadoPor: cap(x.aprovadoPor), termo: x.termo || '', avaliacao: x.avaliacao || '', obs: x.obs || '', legado: true } }));
  const adiant = [...docs('dossie_adiant_dev'), ...docs('gp_adiantamentos')].map(([id, x]) => { const f = achar(x.funcId, x.nome); const p = naFolha.get(f.pid) || {}; return { caminho: ['adiantamentos', 'L' + id], dados: { pid: f.pid, nome: f.nome || p.n || '', cargo: p.c || '', setor: p.s || '', matricula: p.m || '', data: iso(x.data), valor: +x.valor || null, devolvido: 'Não', resp: cap(x.resp), obs: x.obs || '', legado: true } }; });
  const pilulas = docs('dossie_pilulas').map(([id, x]) => ({ caminho: ['pilulas', id], dados: { tema: x.tema || '', categoria: x.categoria || '', data: iso(x.data), obs: x.obs || '', criadoEm: x.criadoEm || '', legado: true } }));
  return { eventos, orfaos, exp, resc, movs, mult, aux, adiant, pilulas, achadas, porNome: nomeOk, nOrfaos: quemOrfao.size };
}
const normN = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
