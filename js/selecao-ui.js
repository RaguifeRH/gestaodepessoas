// ============================================================================
// Vagas e seleção — janelas compartilhadas: vaga, candidato, mudança de etapa.
// ============================================================================
import { ETAPAS, MOTIVOS_REPROVA, ORIGENS, MOTIVOS_VAGA, EMPRESAS_PADRAO, PERFIS_PADRAO } from './config.js?v=6';
import { $, $$, esc, iniciais, fmtData, fmtDataHora, hojeISO, modal, toast, erroAmigavel, confirmar, st, pill } from './ui.js?v=6';
import { hashCpf, mascararCpf } from './fo1029.js?v=6';
import { etapa, ordemEtapa, carregar, retornoPendente } from './selecao.js?v=6';

const SO = s => String(s || '').replace(/\D/g, '');
export function cpfValido(c) {
  const d = SO(c); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
const opts = (l, v) => l.map(x => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
const optsV = (l, v) => l.map(([k, t]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('');
const agoraLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export const fmtQuando = q => !q ? '—' : q.length > 10 ? fmtDataHora(q) : fmtData(q);

// Listas configuráveis (com valores padrão enquanto o RH não cadastrar).
export function listas(sel) {
  const c = sel.cfg || {};
  return {
    setores: (c.setores && c.setores.length ? c.setores : []).slice().sort((a, b) => a.localeCompare(b, 'pt-BR')),
    escalas: c.escalas || [],
    empresas: c.empresas && c.empresas.length ? c.empresas : EMPRESAS_PADRAO,
    perfis: c.perfis && c.perfis.length ? c.perfis : PERFIS_PADRAO,
  };
}

// ---------------------------------------------------------------------------
// Vaga: criar (manual ou a partir do pedido) e editar
// ---------------------------------------------------------------------------
export async function modalVaga(ctx, sel, inicial = {}, { titulo = 'Nova vaga', solicitacao = null } = {}) {
  const L = listas(sel), v = inicial, editar = !!v.id;
  const perfilSla = n => (L.perfis.find(p => p.nome === n) || {}).sla || '';
  const corpo = `
    ${solicitacao ? `<div class="ok-msg" style="margin-bottom:4px">Dados trazidos do pedido ${esc(solicitacao.codigo || '')} de ${esc(solicitacao.gestor || '')}. Confira e complete.</div>` : ''}
    <div class="linha2"><div class="campo"><label for="v-cargo">Cargo</label><input class="inp" id="v-cargo" value="${esc(v.cargo || '')}" required></div>
      <div class="campo"><label for="v-qtd">Quantidade</label><input class="inp" id="v-qtd" type="number" min="1" value="${esc(v.qtd || 1)}"></div></div>
    <div class="linha2"><div class="campo"><label for="v-setor">Setor</label><input class="inp" id="v-setor" list="v-setores" value="${esc(v.setor || '')}"><datalist id="v-setores">${L.setores.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="campo"><label for="v-gestor">Gestor</label><input class="inp" id="v-gestor" value="${esc(v.gestor || '')}"></div></div>
    <div class="campo"><label for="v-emp">Empresa</label><select class="inp" id="v-emp">${opts(L.empresas.includes(v.empresa) || !v.empresa ? L.empresas : [v.empresa, ...L.empresas], v.empresa || L.empresas[0])}</select></div>
    <div class="linha3"><div class="campo"><label for="v-perfil">Perfil</label><select class="inp" id="v-perfil">${opts(L.perfis.map(p => p.nome).concat(v.perfil && !L.perfis.some(p => p.nome === v.perfil) ? [v.perfil] : []), v.perfil || L.perfis[0].nome)}</select></div>
      <div class="campo"><label for="v-sla">Prazo (dias)</label><input class="inp" id="v-sla" type="number" min="1" value="${esc(v.sla || perfilSla(v.perfil || L.perfis[0].nome))}"></div>
      <div class="campo"><label for="v-ab">Abertura</label><input class="inp" id="v-ab" type="date" value="${esc(v.abertura || hojeISO())}"></div></div>
    <div class="linha2"><div class="campo"><label for="v-mot">Motivo</label><select class="inp" id="v-mot">${opts(MOTIVOS_VAGA, v.motivo || 'Aumento de quadro')}</select></div>
      <div class="campo"><label for="v-sub">Substitui quem?</label><input class="inp" id="v-sub" value="${esc(v.substituido || '')}" placeholder="Se for substituição"></div></div>
    <div class="campo"><label for="v-esc">Escala / horário</label><input class="inp" id="v-esc" list="v-escalas" value="${esc(v.escala || '')}"><datalist id="v-escalas">${L.escalas.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
    <div class="campo"><label for="v-req">Requisitos</label><textarea class="inp" id="v-req" rows="2">${esc(v.requisitos || '')}</textarea></div>
    <div class="campo"><label for="v-obs">Observações</label><textarea class="inp" id="v-obs" rows="2">${esc(v.obs || '')}</textarea></div>
    <div id="v-msg"></div>`;
  let novoId = null;
  const r = await modal({ titulo, corpo, larga: true, botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: editar ? 'Salvar' : 'Abrir vaga', cls: 'prim' }],
    aoAbrir: bg => { $('#v-perfil', bg).onchange = e => { const s = perfilSla(e.target.value); if (s) $('#v-sla', bg).value = s; }; },
    antesDeFechar: async (b, bg) => {
      const val = id => $(id, bg).value.trim();
      if (!val('#v-cargo')) { $('#v-msg', bg).innerHTML = '<div class="erro-msg">Informe o cargo.</div>'; return false; }
      const dados = { cargo: val('#v-cargo'), qtd: Math.max(1, +val('#v-qtd') || 1), setor: val('#v-setor'), gestor: val('#v-gestor'), empresa: val('#v-emp'), perfil: val('#v-perfil'), sla: Math.max(1, +val('#v-sla') || 1), abertura: val('#v-ab') || hojeISO(), motivo: val('#v-mot'), substituido: val('#v-sub'), escala: val('#v-esc'), requisitos: val('#v-req'), obs: val('#v-obs') };
      try {
        if (editar) { await ctx.D.atualizar('vagas', v.id, dados); novoId = v.id; }
        else {
          const ano = new Date().getFullYear(), n = await ctx.D.proximoCodigo('vaga_' + ano);
          const codigo = `RH-${ano}-${String(n).padStart(3, '0')}`;
          novoId = await ctx.D.criar('vagas', { ...dados, codigo, status: 'aberta', porNome: ctx.nome(), ...(solicitacao ? { solicitacaoId: solicitacao.id, solicitacaoCodigo: solicitacao.codigo || '', gestorEmail: solicitacao.email || '' } : {}) });
          if (solicitacao) await ctx.D.atualizar('solicitacoes', solicitacao.id, { status: 'aprovado', vagaId: novoId, vagaCodigo: codigo, historico: [...(solicitacao.historico || []), { dt: new Date().toISOString(), acao: 'Vaga aberta: ' + codigo, por: ctx.nome() }] });
          ctx.D.log('vaga_aberta', codigo);
        }
      } catch (e) { $('#v-msg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
    } });
  if (r === 'ok') { await carregar(ctx, true); ctx.atualizarContadores(); return novoId; }
  return null;
}

// ---------------------------------------------------------------------------
// Candidato: cadastro e ficha completa
// ---------------------------------------------------------------------------
// Confere o CPF contra o cadastro único (o FO1029): já trabalhou aqui?
async function historicoNaCasa(ctx, pid) {
  if (!pid) return '';
  try {
    const r = await ctx.resumo(); const x = r.itens.find(i => i.i === pid);
    if (!x) return '<div class="small muted"><i class="ti ti-user-check"></i> CPF sem vínculo anterior no FO1029.</div>';
    const g = { ativo: 'trabalha aqui hoje', afastado: 'está afastado(a) hoje', desligando: 'está em desligamento', desligado: 'já trabalhou aqui' }[x.g];
    return `<div class="faixa-erro" style="background:var(--sol-bg);color:var(--sol-tx);border-color:#ecd9a6;margin:0"><i class="ti ti-history" style="font-size:20px"></i><div>Esta pessoa ${g}: <span>${esc(x.c)} · ${esc(x.f)} · admissão ${fmtData(x.a)}${x.d ? ' · saída ' + fmtData(x.d) : ''}${x.v && x.v.length > 1 ? ' · ' + x.v.length + ' vínculos' : ''}</span></div></div>`;
  } catch (e) { return ''; }
}

export async function salvarCpf(ctx, candId, cpf) {
  const d = SO(cpf); const pid = await hashCpf(d);
  await ctx.D.definirSub('candidatos', candId, 'privado', 'dados', { cpf: d });
  return { pid, cpfMasc: mascararCpf(d) };
}

// Cadastro novo (na vaga ou no banco de currículos).
export async function novoCandidato(ctx, sel, { vagaId = null } = {}) {
  const vaga = vagaId ? sel.vagas.find(v => v.id === vagaId) : null;
  const corpo = `
    <div class="campo"><label for="c-nome">Nome completo</label><input class="inp" id="c-nome" autocomplete="off" required></div>
    <div class="linha2"><div class="campo"><label for="c-tel">Telefone / WhatsApp</label><input class="inp" id="c-tel" inputmode="tel"></div>
      <div class="campo"><label for="c-cpf">CPF</label><input class="inp" id="c-cpf" inputmode="numeric" placeholder="Pode deixar para a entrevista"><span class="ajuda" id="c-cpf-a"></span></div></div>
    <div class="linha2"><div class="campo"><label for="c-cid">Cidade</label><input class="inp" id="c-cid"></div>
      <div class="campo"><label for="c-area">Área de interesse</label><input class="inp" id="c-area" list="c-areas" value="${esc(vaga ? vaga.setor || '' : '')}"><datalist id="c-areas">${listas(sel).setores.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div></div>
    <div class="linha2"><div class="campo"><label for="c-ori">Origem</label><select class="inp" id="c-ori">${opts(ORIGENS, 'WhatsApp')}</select></div>
      <div class="campo" id="c-ind-c" hidden><label for="c-ind">Indicado por</label><input class="inp" id="c-ind"></div></div>
    ${vaga ? `<div class="linha2"><div class="campo"><label for="c-et">Etapa</label><select class="inp" id="c-et">${optsV(ETAPAS.slice(0, 2).map(e => [e.id, e.nome]), 'ent_ag')}</select></div><div class="campo" id="c-ent-c"><label for="c-ent">Data e hora da entrevista</label><input class="inp" id="c-ent" type="datetime-local"></div></div>` : ''}
    <div class="campo"><label for="c-obs">Observações</label><textarea class="inp" id="c-obs" rows="2" placeholder="Experiência, CNH, disponibilidade…"></textarea></div>
    <div id="c-hist"></div><div id="c-msg"></div>`;
  let id = null;
  const r = await modal({ titulo: vaga ? `Novo candidato · ${vaga.codigo} ${vaga.cargo}` : 'Cadastrar currículo', corpo, larga: true,
    botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Cadastrar', cls: 'prim' }],
    aoAbrir: bg => {
      $('#c-ori', bg).onchange = e => { $('#c-ind-c', bg).hidden = e.target.value !== 'Indicação'; };
      if ($('#c-et', bg)) $('#c-et', bg).onchange = e => { $('#c-ent-c', bg).hidden = e.target.value !== 'ent_ag'; };
      $('#c-cpf', bg).onblur = async e => {
        const v = e.target.value; if (!SO(v)) { $('#c-cpf-a', bg).textContent = ''; $('#c-hist', bg).innerHTML = ''; return; }
        if (!cpfValido(v)) { $('#c-cpf-a', bg).textContent = 'CPF inválido.'; return; }
        $('#c-cpf-a', bg).textContent = ''; $('#c-hist', bg).innerHTML = await historicoNaCasa(ctx, await hashCpf(v));
        const pid = await hashCpf(v), ja = sel.candidatos.find(c => c.pid === pid);
        if (ja) $('#c-hist', bg).insertAdjacentHTML('beforeend', `<div class="small" style="margin-top:6px"><i class="ti ti-alert-circle"></i> Já existe no R&S: <b>${esc(ja.nome)}</b> ${ja.vagaCodigo ? '· ' + esc(ja.vagaCodigo) : '· banco de currículos'}. Prefira "Levar para uma vaga" no banco de currículos.</div>`);
      };
    },
    antesDeFechar: async (b, bg) => {
      const val = s => $(s, bg).value.trim(), msg = t => { $('#c-msg', bg).innerHTML = `<div class="erro-msg">${esc(t)}</div>`; return false; };
      if (!val('#c-nome')) return msg('Informe o nome.');
      const cpf = val('#c-cpf'); if (SO(cpf) && !cpfValido(cpf)) return msg('CPF inválido. Corrija ou deixe em branco.');
      const et = $('#c-et', bg) ? $('#c-et', bg).value : 'triagem';
      if (et === 'ent_ag' && vaga && !val('#c-ent')) return msg('Informe a data e a hora da entrevista.');
      const dados = { nome: val('#c-nome'), tel: val('#c-tel'), cidade: val('#c-cid'), area: val('#c-area'), origem: val('#c-ori'), indicadoPor: val('#c-ori') === 'Indicação' ? val('#c-ind') : '', obs: val('#c-obs'),
        vagaId: vaga ? vaga.id : null, vagaCodigo: vaga ? vaga.codigo : '', vagaCargo: vaga ? vaga.cargo : '', vagaSetor: vaga ? vaga.setor || '' : '', etapa: et, situacao: vaga ? 'andamento' : 'banco',
        datas: et === 'ent_ag' && vaga ? { entrevista: val('#c-ent') } : {}, checks: {}, porNome: ctx.nome(),
        historico: [{ etapa: et, em: new Date().toISOString(), porNome: ctx.nome(), acao: vaga ? 'Cadastrado na vaga ' + vaga.codigo : 'Cadastrado no banco de currículos' }], participacoes: [] };
      try {
        id = await ctx.D.criar('candidatos', dados);
        if (SO(cpf)) { const x = await salvarCpf(ctx, id, cpf); await ctx.D.atualizar('candidatos', id, x); }
      } catch (e) { return msg(erroAmigavel(e)); }
    } });
  if (r === 'ok') { await carregar(ctx, true); toast(vaga ? 'Candidato cadastrado na vaga.' : 'Currículo cadastrado.'); return id; }
  return null;
}

// Campos pedidos ao entrar em cada etapa (mesmos do R&S antigo).
function camposEtapa(destino, c) {
  const d = c.datas || {}, k = c.checks || {};
  const dt = (id, rot, v, req) => `<div class="campo"><label for="${id}">${rot}${req ? ' *' : ''}</label><input class="inp" type="datetime-local" id="${id}" value="${esc((v || '').slice(0, 16))}"></div>`;
  const sel = (id, rot, l, v) => `<div class="campo"><label for="${id}">${rot}</label><select class="inp" id="${id}">${optsV(l, v)}</select></div>`;
  switch (destino) {
    case 'ent_ag': return dt('e-ent', 'Data e hora da entrevista', d.entrevista, true);
    case 'ent_re': return `<div class="linha2">${sel('e-ficha', 'Ficha de solicitação de emprego', [['recebida', 'Recebida'], ['pendente', 'Pendente']], k.ficha || 'recebida')}${sel('e-res', 'Resultado da entrevista', [['apto', 'Apto'], ['inapto', 'Inapto']], c.resultadoEntrevista || 'apto')}</div>
      ${c.cpfMasc ? '' : '<div class="campo"><label for="e-cpf">CPF</label><input class="inp" id="e-cpf" inputmode="numeric" placeholder="Peça na entrevista"></div>'}
      <div class="campo" id="e-mot-c" hidden><label for="e-mot">Motivo (inapto) *</label><select class="inp" id="e-mot">${opts(MOTIVOS_REPROVA, '')}</select><span class="ajuda">A pessoa vai para o banco de currículos com a área desta vaga.</span></div>`;
    case 'teste_ag': return dt('e-teste', 'Data e hora do teste prático', d.teste, true);
    case 'teste_re': return `<div class="linha2">${sel('e-termo', 'Termo de regras do teste', [['assinado', 'Assinado'], ['pendente', 'Pendente']], k.termo || 'assinado')}${sel('e-aval', 'Avaliação do gestor', [['aprovado', 'Aprovado'], ['reprovado', 'Reprovado'], ['pendente', 'Pendente']], k.avaliacaoGestor || 'pendente')}</div>
      <div class="campo" id="e-mot-c" hidden><label for="e-mot">Motivo (reprovado) *</label><select class="inp" id="e-mot">${opts(MOTIVOS_REPROVA, '')}</select></div>
      <div class="ajuda">A avaliação do gestor continua em papel, com a assinatura do candidato. Depois, anexe o digitalizado na ficha.</div>`;
    case 'docs': return `<div class="linha2">${sel('e-int', 'Interesse do candidato', [['sim', 'Confirmou interesse'], ['nao', 'Não tem interesse']], k.interesse || 'sim')}<div class="campo"><label for="e-aceite">Data do aceite</label><input class="inp" type="date" id="e-aceite" value="${esc(d.aceite || hojeISO())}"></div></div>
      <div class="linha2">${sel('e-chk', 'Lista de documentos', [['enviado', 'Enviada ao candidato'], ['pendente', 'Pendente']], k.checklistDocs || 'enviado')}<div class="campo"><label for="e-exame">Data do exame</label><input class="inp" type="date" id="e-exame" value="${esc(d.exame || '')}"></div></div>`;
    case 'exame': return `<div class="linha2">${sel('e-guia', 'Guia do exame (Multimed)', [['enviada', 'Enviada'], ['pendente', 'Pendente']], k.guia || 'enviada')}${sel('e-docs', 'Documentação', [['recebida', 'Recebida'], ['pendente', 'Pendente']], k.docs || 'pendente')}</div>`;
    case 'integracao': return `${dt('e-integ', 'Data e hora da integração', d.integracao, true)}${c.cpfMasc ? '' : '<div class="campo"><label for="e-cpf">CPF *</label><input class="inp" id="e-cpf" inputmode="numeric"><span class="ajuda">Obrigatório a partir daqui: é ele que liga o candidato ao cadastro da folha.</span></div>'}`;
    default: return '';
  }
}

// Move o candidato de etapa, pedindo os dados de cada etapa. Devolve true se mudou.
export async function moverEtapa(ctx, c, destino) {
  if (destino === c.etapa) return false;
  const voltando = ordemEtapa(destino) < ordemEtapa(c.etapa);
  const e = etapa(destino);
  const corpo = `<div class="small muted" style="margin-bottom:2px">${esc(c.nome)} · de <b>${esc(etapa(c.etapa).nome)}</b> para <b>${esc(e.nome)}</b></div>
    ${voltando ? '<div class="small">Voltando de etapa: os dados já registrados ficam guardados.</div>' : camposEtapa(destino, c)}
    <div class="campo"><label for="e-obs">Observação (opcional)</label><textarea class="inp" id="e-obs" rows="2"></textarea></div><div id="e-hist"></div><div id="e-msg"></div>`;
  let mudou = false;
  const r = await modal({ titulo: e.nome, corpo, botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Confirmar', cls: 'prim' }],
    aoAbrir: bg => {
      const res = $('#e-res', bg) || $('#e-aval', bg);
      if (res) { const t = () => { $('#e-mot-c', bg).hidden = !['inapto', 'reprovado'].includes(res.value); }; res.onchange = t; t(); }
      const cpf = $('#e-cpf', bg); if (cpf) cpf.onblur = async () => { if (cpfValido(cpf.value)) $('#e-hist', bg).innerHTML = await historicoNaCasa(ctx, await hashCpf(cpf.value)); };
    },
    antesDeFechar: async (b, bg) => {
      const val = s => ($(s, bg) ? $(s, bg).value.trim() : ''), msg = t => { $('#e-msg', bg).innerHTML = `<div class="erro-msg">${esc(t)}</div>`; return false; };
      const datas = { ...(c.datas || {}) }, checks = { ...(c.checks || {}) }; const extra = {};
      let situacao = 'andamento', motivo = '';
      if (!voltando) {
        if (destino === 'ent_ag') { if (!val('#e-ent')) return msg('Informe a data e a hora.'); datas.entrevista = val('#e-ent'); }
        if (destino === 'teste_ag') { if (!val('#e-teste')) return msg('Informe a data e a hora.'); datas.teste = val('#e-teste'); }
        if (destino === 'integracao') { if (!val('#e-integ')) return msg('Informe a data e a hora.'); datas.integracao = val('#e-integ'); }
        if (destino === 'ent_re') { checks.ficha = val('#e-ficha'); extra.resultadoEntrevista = val('#e-res'); if (val('#e-res') === 'inapto') { situacao = 'reprovado'; motivo = val('#e-mot'); if (!motivo) return msg('Escolha o motivo.'); } }
        if (destino === 'teste_re') { checks.termo = val('#e-termo'); checks.avaliacaoGestor = val('#e-aval'); if (val('#e-aval') === 'reprovado') { situacao = 'reprovado'; motivo = val('#e-mot'); if (!motivo) return msg('Escolha o motivo.'); } }
        if (destino === 'docs') { checks.interesse = val('#e-int'); checks.checklistDocs = val('#e-chk'); datas.aceite = val('#e-aceite'); datas.exame = val('#e-exame'); if (val('#e-int') === 'nao') { situacao = 'desistiu'; motivo = 'Não tem interesse'; } }
        if (destino === 'exame') { checks.guia = val('#e-guia'); checks.docs = val('#e-docs'); }
        const cpf = val('#e-cpf');
        if (destino === 'integracao' && !c.cpfMasc && !cpfValido(cpf)) return msg('Informe um CPF válido.');
        if (cpf && !cpfValido(cpf)) return msg('CPF inválido.');
        if (cpf) Object.assign(extra, await salvarCpf(ctx, c.id, cpf));
      }
      const hist = [...(c.historico || []), { etapa: destino, em: new Date().toISOString(), porNome: ctx.nome(), obs: val('#e-obs'), ...(situacao !== 'andamento' ? { acao: (situacao === 'desistiu' ? 'Desistiu' : 'Reprovado') + ': ' + motivo } : {}) }];
      try { await ctx.D.atualizar('candidatos', c.id, { etapa: destino, situacao, ...(motivo ? { motivo, retorno: null, area: c.area || c.vagaSetor || '' } : {}), datas, checks, historico: hist, ...extra }); mudou = true; }
      catch (e2) { return msg(erroAmigavel(e2)); }
    } });
  if (r === 'ok' && mudou) { await carregar(ctx, true); ctx.atualizarContadores(); return true; }
  return false;
}

// Reprovar ou registrar desistência a qualquer momento.
export async function tirarDoProcesso(ctx, c) {
  const corpo = `<div class="small muted">${esc(c.nome)} · ${esc(etapa(c.etapa).nome)}</div>
    <div class="campo"><label for="t-tipo">O que aconteceu</label><select class="inp" id="t-tipo"><option value="reprovado">Reprovado</option><option value="desistiu">Desistiu</option></select></div>
    <div class="campo"><label for="t-mot">Motivo</label><select class="inp" id="t-mot">${opts(MOTIVOS_REPROVA, '')}</select></div>
    <div class="campo"><label for="t-obs">Observação</label><textarea class="inp" id="t-obs" rows="2"></textarea></div>
    <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="t-ret"> Já dei o retorno ao candidato</label>`;
  let ok = false;
  const r = await modal({ titulo: 'Tirar do processo', corpo, botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Confirmar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => {
      const tipo = $('#t-tipo', bg).value, motivo = $('#t-mot', bg).value;
      try {
        await ctx.D.atualizar('candidatos', c.id, { situacao: tipo, motivo, retorno: $('#t-ret', bg).checked ? { em: new Date().toISOString(), porNome: ctx.nome(), canal: '' } : null,
          historico: [...(c.historico || []), { etapa: c.etapa, em: new Date().toISOString(), porNome: ctx.nome(), acao: (tipo === 'desistiu' ? 'Desistiu' : 'Reprovado') + ': ' + motivo, obs: $('#t-obs', bg).value.trim() }] });
        ok = true;
      } catch (e) { toast(erroAmigavel(e), 'erro'); return false; }
    } });
  if (r === 'ok' && ok) { await carregar(ctx, true); ctx.atualizarContadores(); return true; }
  return false;
}

export async function registrarRetorno(ctx, c) {
  const r = await modal({ titulo: 'Retorno dado ao candidato', corpo: `<div class="small muted">${esc(c.nome)} · ${esc(c.situacao === 'desistiu' ? 'desistiu' : 'reprovado')}${c.motivo ? ': ' + esc(c.motivo) : ''}</div><div class="campo"><label for="r-canal">Como?</label><select class="inp" id="r-canal">${opts(['WhatsApp', 'Ligação', 'E-mail', 'Pessoalmente'], 'WhatsApp')}</select></div>`,
    botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Registrar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => { try { await ctx.D.atualizar('candidatos', c.id, { retorno: { em: new Date().toISOString(), porNome: ctx.nome(), canal: $('#r-canal', bg).value } }); } catch (e) { toast(erroAmigavel(e), 'erro'); return false; } } });
  if (r === 'ok') { await carregar(ctx, true); ctx.atualizarContadores(); toast('Retorno registrado.'); return true; }
  return false;
}

// Leva alguém do banco de currículos (ou de outra vaga) para uma vaga aberta.
export async function levarParaVaga(ctx, sel, c) {
  const abertas = sel.vagas.filter(v => v.status === 'aberta' && v.id !== c.vagaId).sort((a, b) => (b.abertura || '').localeCompare(a.abertura || ''));
  if (!abertas.length) { toast('Não há vaga aberta no momento.', 'erro'); return false; }
  const r = await modal({ titulo: 'Levar para uma vaga', corpo: `<div class="small muted">${esc(c.nome)}${c.area ? ' · ' + esc(c.area) : ''}</div>
      <div class="campo"><label for="l-vaga">Vaga</label><select class="inp" id="l-vaga">${optsV(abertas.map(v => [v.id, `${v.codigo} · ${v.cargo}${v.setor ? ' · ' + v.setor : ''}`]), abertas[0].id)}</select></div>
      <div class="campo"><label for="l-ent">Entrevista (opcional)</label><input class="inp" type="datetime-local" id="l-ent"><span class="ajuda">Com data, entra em "Entrevista agendada". Sem data, entra em "Triagem".</span></div>`,
    botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Levar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => {
      const v = abertas.find(x => x.id === $('#l-vaga', bg).value), ent = $('#l-ent', bg).value;
      const part = c.vagaId ? [...(c.participacoes || []), { vagaCodigo: c.vagaCodigo, cargo: c.vagaCargo, etapa: c.etapa, situacao: c.situacao, motivo: c.motivo || '', ate: new Date().toISOString() }] : (c.participacoes || []);
      try {
        await ctx.D.atualizar('candidatos', c.id, { vagaId: v.id, vagaCodigo: v.codigo, vagaCargo: v.cargo, vagaSetor: v.setor || '', etapa: ent ? 'ent_ag' : 'triagem', situacao: 'andamento', motivo: '', retorno: null, resultadoEntrevista: '', checks: {}, datas: ent ? { entrevista: ent } : {}, participacoes: part,
          historico: [...(c.historico || []), { etapa: ent ? 'ent_ag' : 'triagem', em: new Date().toISOString(), porNome: ctx.nome(), acao: 'Levado para a vaga ' + v.codigo }] });
      } catch (e) { toast(erroAmigavel(e), 'erro'); return false; }
    } });
  if (r === 'ok') { await carregar(ctx, true); ctx.atualizarContadores(); toast('Candidato levado para a vaga.'); return true; }
  return false;
}

// Ficha do candidato (dados, histórico, documentos e ações).
export async function fichaCandidato(ctx, id, aoMudar) {
  const sel = await carregar(ctx); const c = sel.candidatos.find(x => x.id === id);
  if (!c) { toast('Candidato não encontrado.', 'erro'); return; }
  const vaga = sel.vagas.find(v => v.id === c.vagaId);
  const anexos = await ctx.D.anexosDe('candidatos', id).catch(() => []);
  const d = c.datas || {}, k = c.checks || {};
  const sit = { andamento: ['Em andamento', 'ok'], reprovado: ['Reprovado', 'atr'], desistiu: ['Desistiu', 'atr'], banco: ['No banco de currículos', ''], contratado: ['Admitido', 'ok'] }[c.situacao] || [c.situacao, ''];
  const linhaCk = [['Ficha de solicitação', k.ficha], ['Termo do teste', k.termo], ['Avaliação do gestor', k.avaliacaoGestor], ['Interesse', k.interesse], ['Lista de documentos', k.checklistDocs], ['Guia do exame', k.guia], ['Documentação', k.docs]].filter(x => x[1]);
  const ok = v => ['recebida', 'assinado', 'aprovado', 'sim', 'enviado', 'enviada'].includes(v);
  const corpo = `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px"><span class="av">${esc(iniciais(c.nome))}</span><div><b style="font-size:17px;display:block">${esc(c.nome)}</b><small class="muted">${esc([c.tel, c.cidade, c.cpfMasc ? 'CPF ' + c.cpfMasc : 'sem CPF'].filter(Boolean).join(' · '))}</small></div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${pill(sit[0], sit[1])}${c.situacao === 'andamento' ? pill(etapa(c.etapa).nome, 'lim') : ''}${vaga ? pill(vaga.codigo + ' · ' + vaga.cargo) : ''}${c.area ? pill('Área: ' + c.area) : ''}${c.legado ? pill('Veio do sistema antigo') : ''}
      ${['reprovado', 'desistiu'].includes(c.situacao) ? (c.retorno ? st('ok', 'Retorno dado' + (c.retorno.porNome ? ' por ' + c.retorno.porNome.split(' ')[0] : '')) : c.legado ? '' : st('atr', 'Retorno pendente')) : ''}</div>
    ${c.situacao === 'andamento' ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;background:var(--orvalho-2);padding:10px;border-radius:12px"><label for="f-mover" class="small" style="font-weight:600">Mudar de etapa</label><select class="inp" id="f-mover" style="width:auto;flex:1;min-width:180px">${optsV(ETAPAS.map(e => [e.id, e.nome]), c.etapa)}</select><button class="btn sm prim" id="f-mover-b">Mover</button></div>` : ''}
    ${c.motivo ? `<div class="small" style="margin-bottom:8px"><b>Motivo:</b> ${esc(c.motivo)}</div>` : ''}
    <div class="dados" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:12px">
      <div><small>Origem</small><b>${esc(c.origem || '—')}${c.indicadoPor ? ' · ' + esc(c.indicadoPor) : ''}</b></div>
      <div><small>Entrevista</small><b>${fmtQuando(d.entrevista)}</b></div>
      <div><small>Teste</small><b>${fmtQuando(d.teste)}</b></div>
      <div><small>Exame</small><b>${fmtQuando(d.exame)}</b></div>
      <div><small>Aceite</small><b>${fmtQuando(d.aceite)}</b></div>
      <div><small>Integração</small><b>${fmtQuando(d.integracao)}</b></div>
    </div>
    ${linhaCk.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${linhaCk.map(x => st(ok(x[1]) ? 'ok' : x[1] === 'reprovado' || x[1] === 'nao' ? 'atr' : 'pend', x[0] + ': ' + x[1])).join('')}</div>` : ''}
    ${c.obs ? `<div class="small" style="white-space:pre-wrap;margin-bottom:12px;background:var(--nevoa);padding:10px;border-radius:10px">${esc(c.obs)}</div>` : ''}
    <h4 class="d" style="font-size:15px;margin:14px 0 6px">Documentos</h4>
    <div id="f-anexos">${anexos.length ? anexos.map(a => `<div class="anexo"><span class="ic"><i class="ti ti-file-text"></i></span><div><b>${esc(a.descricao || a.nome)}</b><small class="muted"> · ${fmtDataHora(a.criadoEm)} · ${esc(a.porNome || '')}</small></div><button class="btn sm" data-ver="${esc(a.caminho)}">Abrir</button></div>`).join('') : '<p class="small muted" style="margin:0">Nenhum documento anexado. Anexe a ficha, o termo do teste e a avaliação do gestor assinados.</p>'}</div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><select class="inp" id="f-tipo" style="width:auto">${opts(['Currículo', 'Ficha de solicitação de emprego', 'Termo de regras do teste', 'Avaliação do gestor (teste)', 'Outro'], 'Currículo')}</select><label class="btn sm"><i class="ti ti-paperclip"></i>Anexar PDF ou foto<input type="file" id="f-arq" accept="application/pdf,image/*" hidden></label><span class="progresso" id="f-prog" hidden style="flex:1;min-width:80px"><i></i></span></div>
    ${(c.participacoes || []).length ? `<h4 class="d" style="font-size:15px;margin:16px 0 6px">Outras vagas</h4>${c.participacoes.map(p => `<div class="small" style="padding:4px 0">${esc(p.vagaCodigo || '')} · ${esc(p.cargo || '')} · ${esc(etapa(p.etapa).nome)}${p.motivo ? ' · ' + esc(p.situacao) + ': ' + esc(p.motivo) : ''}</div>`).join('')}` : ''}
    <h4 class="d" style="font-size:15px;margin:16px 0 6px">Histórico</h4>
    <ul class="tl">${(c.historico || []).slice().reverse().map(h => `<li><b>${esc(h.acao || etapa(h.etapa).nome)}</b><small>${fmtDataHora(h.em)}${h.porNome ? ' · ' + esc(h.porNome) : ''}</small>${h.obs ? `<div class="small" style="white-space:pre-wrap">${esc(h.obs)}</div>` : ''}</li>`).join('')}</ul>`;
  const botoes = [{ id: 'editar', texto: '<i class="ti ti-pencil"></i>Editar dados' }];
  if (c.situacao === 'andamento') { botoes.push({ id: 'tirar', texto: '<i class="ti ti-user-x"></i>Reprovar / desistiu' }); if (c.etapa === 'integracao') botoes.push({ id: 'admitir', texto: '<i class="ti ti-user-check"></i>Admitido', cls: 'prim' }); }
  if (['reprovado', 'desistiu'].includes(c.situacao) && !c.retorno) botoes.push({ id: 'retorno', texto: '<i class="ti ti-message-check"></i>Retorno dado', cls: 'prim' });
  if (c.situacao !== 'andamento' && c.situacao !== 'contratado') botoes.push({ id: 'levar', texto: '<i class="ti ti-arrow-right"></i>Levar para uma vaga', cls: c.retorno || c.situacao === 'banco' ? 'prim' : '' });
  const r = await modal({ titulo: 'Candidato', corpo, larga: true, botoes,
    aoAbrir: bg => {
      if ($('#f-mover-b', bg)) $('#f-mover-b', bg).onclick = async () => { const dest = $('#f-mover', bg).value; if (dest === c.etapa) return; bg.remove(); if (await moverEtapa(ctx, c, dest) && aoMudar) aoMudar(); };
      $$('[data-ver]', bg).forEach(b => b.onclick = async () => { try { window.open(await ctx.D.urlAnexo(b.dataset.ver), '_blank'); } catch (e) { toast(erroAmigavel(e), 'erro'); } });
      $('#f-arq', bg).onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        if (f.size > 15 * 1024 * 1024) return toast('O arquivo passa de 15 MB.', 'erro');
        if (!(f.type === 'application/pdf' || f.type.startsWith('image/'))) return toast('Use PDF ou imagem.', 'erro');
        $('#f-prog', bg).hidden = false;
        try { await ctx.D.enviarAnexoEm('candidatos', id, f, $('#f-tipo', bg).value, p => { $('#f-prog i', bg).style.width = (p * 100) + '%'; }, ctx.nome()); toast('Documento anexado.'); bg.remove(); fichaCandidato(ctx, id, aoMudar); }
        catch (err) { toast(erroAmigavel(err), 'erro'); $('#f-prog', bg).hidden = true; }
      };
    } });
  let mudou = false;
  if (r === 'editar') mudou = await editarCandidato(ctx, sel, c);
  if (r === 'tirar') mudou = await tirarDoProcesso(ctx, c);
  if (r === 'retorno') mudou = await registrarRetorno(ctx, c);
  if (r === 'levar') mudou = await levarParaVaga(ctx, sel, c);
  if (r === 'admitir') mudou = await admitir(ctx, sel, c);
  if (mudou && aoMudar) aoMudar();
}

async function editarCandidato(ctx, sel, c) {
  const corpo = `<div class="campo"><label for="ed-nome">Nome completo</label><input class="inp" id="ed-nome" value="${esc(c.nome)}"></div>
    <div class="linha2"><div class="campo"><label for="ed-tel">Telefone</label><input class="inp" id="ed-tel" value="${esc(c.tel || '')}"></div><div class="campo"><label for="ed-cpf">CPF</label><input class="inp" id="ed-cpf" inputmode="numeric" placeholder="${esc(c.cpfMasc ? c.cpfMasc + ' (digite para trocar)' : '')}"></div></div>
    <div class="linha2"><div class="campo"><label for="ed-cid">Cidade</label><input class="inp" id="ed-cid" value="${esc(c.cidade || '')}"></div><div class="campo"><label for="ed-area">Área de interesse</label><input class="inp" id="ed-area" list="ed-areas" value="${esc(c.area || '')}"><datalist id="ed-areas">${listas(sel).setores.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div></div>
    <div class="linha2"><div class="campo"><label for="ed-ori">Origem</label><select class="inp" id="ed-ori">${opts(ORIGENS.includes(c.origem) || !c.origem ? ORIGENS : [c.origem, ...ORIGENS], c.origem || 'WhatsApp')}</select></div><div class="campo"><label for="ed-ind">Indicado por</label><input class="inp" id="ed-ind" value="${esc(c.indicadoPor || '')}"></div></div>
    <div class="campo"><label for="ed-obs">Observações</label><textarea class="inp" id="ed-obs" rows="3">${esc(c.obs || '')}</textarea></div><div id="ed-msg"></div>`;
  const r = await modal({ titulo: 'Editar candidato', corpo, larga: true, botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => {
      const val = s => $(s, bg).value.trim(); const cpf = val('#ed-cpf');
      if (cpf && !cpfValido(cpf)) { $('#ed-msg', bg).innerHTML = '<div class="erro-msg">CPF inválido.</div>'; return false; }
      try {
        const extra = cpf ? await salvarCpf(ctx, c.id, cpf) : {};
        await ctx.D.atualizar('candidatos', c.id, { nome: val('#ed-nome') || c.nome, tel: val('#ed-tel'), cidade: val('#ed-cid'), area: val('#ed-area'), origem: val('#ed-ori'), indicadoPor: val('#ed-ind'), obs: val('#ed-obs'), ...extra });
      } catch (e) { $('#ed-msg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
    } });
  if (r === 'ok') { await carregar(ctx, true); toast('Dados salvos.'); return true; }
  return false;
}

// Marca como admitido. A etapa 3 (Admissão) parte daqui.
async function admitir(ctx, sel, c) {
  if (!c.cpfMasc) { toast('Informe o CPF antes (Editar dados).', 'erro'); return false; }
  if (!(await confirmar('Admitido', `Confirmar a admissão de <b>${esc(c.nome)}</b>? Ele sai do kanban e passa a contar como vaga preenchida.`, 'Confirmar'))) return false;
  try {
    await ctx.D.atualizar('candidatos', c.id, { situacao: 'contratado', admitidoEm: new Date().toISOString(), historico: [...(c.historico || []), { etapa: c.etapa, em: new Date().toISOString(), porNome: ctx.nome(), acao: 'Admitido' }] });
    const v = sel.vagas.find(x => x.id === c.vagaId);
    await carregar(ctx, true);
    if (v) {
      const preenchidas = (ctx._sel.porVaga[v.id] || []).filter(x => x.situacao === 'contratado').length;
      if (preenchidas >= (v.qtd || 1) && v.status === 'aberta' && await confirmar('Vaga preenchida', `${v.codigo} tinha ${v.qtd || 1} vaga(s) e já tem ${preenchidas} admitido(s). Encerrar a vaga?`, 'Encerrar vaga')) {
        await ctx.D.atualizar('vagas', v.id, { status: 'encerrada', encerradaEm: hojeISO() }); await carregar(ctx, true);
      }
    }
    ctx.atualizarContadores(); toast('Admissão registrada.'); return true;
  } catch (e) { toast(erroAmigavel(e), 'erro'); return false; }
}

export const etiquetaRetorno = c => ['reprovado', 'desistiu'].includes(c.situacao) ? (c.retorno ? 'ok' : retornoPendente(c) ? 'atr' : '') : '';
