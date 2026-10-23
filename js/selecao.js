// ============================================================================
// Vagas e seleção — regras compartilhadas entre as telas, o início e o sino.
// ============================================================================
import { ETAPAS, STATUS_SOL } from './config.js?v=11';
import { hojeISO, somarDias, diasEntre } from './ui.js?v=11';

export const etapa = id => ETAPAS.find(e => e.id === id) || ETAPAS[0];
export const ordemEtapa = id => Math.max(0, ETAPAS.findIndex(e => e.id === id));

// Carrega pedidos, vagas e candidatos (poucos documentos: lê tudo e filtra aqui).
export async function carregar(ctx, forcar) {
  if (ctx._sel && !forcar) return ctx._sel;
  const [solicitacoes, vagas, candidatos, cfg, cfgN2] = await Promise.all([
    ctx.D.listar('solicitacoes'), ctx.D.listar('vagas'), ctx.D.listar('candidatos'),
    ctx.D.lerConfig('selecao').catch(() => null), ctx.D.lerConfig('selecao_n2').catch(() => null),
  ]);
  const porVaga = {};
  candidatos.forEach(c => { if (c.vagaId) (porVaga[c.vagaId] = porVaga[c.vagaId] || []).push(c); });
  ctx._sel = { solicitacoes, vagas, candidatos, porVaga, cfg: cfg || {}, n2s: (cfgN2 && cfgN2.lista) || [] };
  return ctx._sel;
}

// Prazo da vaga: abertura + SLA do perfil (dias corridos).
export function prazoVaga(v) {
  const hoje = hojeISO();
  if (!v.abertura || !v.sla) return null;
  const prazo = somarDias(v.abertura, v.sla), passados = diasEntre(v.abertura, hoje), restam = diasEntre(hoje, prazo);
  return { prazo, restam, pct: Math.max(0, Math.min(100, Math.round(passados / v.sla * 100))) };
}

// Candidatos que contam como "em andamento" numa vaga.
export const emAndamento = c => c.situacao === 'andamento';
export const foraDoProcesso = c => c.situacao === 'reprovado' || c.situacao === 'desistiu';
// Retorno pendente: reprovou ou desistiu e ninguém registrou o retorno (dados antigos não contam).
// Quem saiu do processo (inclusive por vaga cancelada/encerrada) precisa receber retorno.
export const precisaRetorno = c => foraDoProcesso(c) || !!c.retornoDevido;
export const retornoPendente = c => precisaRetorno(c) && !c.retorno && !c.legado;

// Datas marcadas do candidato (para a agenda e o "para hoje").
export function compromissos(c) {
  const d = c.datas || {}; const l = [];
  if (c.situacao !== 'andamento') return l;
  if (d.entrevista && c.etapa === 'ent_ag') l.push({ tipo: 'Entrevista', quando: d.entrevista, ic: 'ti-message-circle', cor: 'var(--ceu-bg)', tx: 'var(--ceu-tx)' });
  if (d.teste && c.etapa === 'teste_ag') l.push({ tipo: 'Teste prático', quando: d.teste, ic: 'ti-tool', cor: 'var(--sol-bg)', tx: 'var(--sol-tx)' });
  if (d.exame && (c.etapa === 'docs')) l.push({ tipo: 'Exame admissional', quando: d.exame, ic: 'ti-stethoscope', cor: 'var(--ambar-bg)', tx: 'var(--sol-tx)' });
  if (d.integracao && c.etapa === 'integracao') l.push({ tipo: 'Integração', quando: d.integracao, ic: 'ti-users', cor: 'var(--orvalho)', tx: 'var(--mata)' });
  return l;
}

// Pendências da seleção para o início, o sino e os contadores do menu.
export function pendenciasSelecao(sel) {
  const hoje = hojeISO(), l = [];
  const sol = sel.solicitacoes;
  const novas = sol.filter(s => s.status === 'pendente');
  if (novas.length) l.push({ id: 'solicitacoes', estado: 'hoje', ic: 'ti-file-plus', titulo: `${novas.length} pedido${novas.length > 1 ? 's' : ''} de vaga para encaminhar ao N2`, sub: novas.slice(0, 3).map(s => s.cargo).join(', '), link: '#/solicitacoes', n: novas.length });
  const n2ok = sol.filter(s => s.status === 'aprovado_n2');
  if (n2ok.length) l.push({ id: 'solicitacoes', estado: 'hoje', ic: 'ti-circle-check', titulo: `${n2ok.length} pedido${n2ok.length > 1 ? 's' : ''} aprovado${n2ok.length > 1 ? 's' : ''} pelo N2: abrir a vaga`, sub: n2ok.slice(0, 3).map(s => s.cargo).join(', '), link: '#/solicitacoes', n: n2ok.length });
  const paradas = sol.filter(s => s.status === 'com_n2' && ultimaData(s) && diasEntre(ultimaData(s).slice(0, 10), hoje) >= 2);
  if (paradas.length) l.push({ id: 'solicitacoes', estado: 'atr', ic: 'ti-clock-exclamation', titulo: `${paradas.length} pedido${paradas.length > 1 ? 's' : ''} parado${paradas.length > 1 ? 's' : ''} com o N2 há 2 dias ou mais`, sub: 'Cobre a resposta do N2', link: '#/solicitacoes', n: paradas.length });
  const ret = sel.candidatos.filter(retornoPendente);
  if (ret.length) l.push({ id: 'vagas', estado: 'atr', ic: 'ti-message-2-exclamation', titulo: `${ret.length} candidato${ret.length > 1 ? 's' : ''} sem retorno`, sub: 'Reprovados ou desistentes que ainda não receberam resposta', link: '#/curriculos/retorno', n: ret.length });
  const atrasadas = sel.vagas.filter(v => v.status === 'aberta' && prazoVaga(v) && prazoVaga(v).restam < 0);
  if (atrasadas.length) l.push({ id: 'vagas', estado: 'atr', ic: 'ti-hourglass-high', titulo: `${atrasadas.length} vaga${atrasadas.length > 1 ? 's' : ''} com prazo vencido`, sub: atrasadas.slice(0, 3).map(v => v.codigo + ' ' + v.cargo).join(', '), link: '#/vagas', n: atrasadas.length });
  const doDia = sel.candidatos.flatMap(c => compromissos(c).map(x => ({ ...x, c }))).filter(x => x.quando.slice(0, 10) === hoje);
  if (doDia.length) l.push({ id: 'agenda', estado: 'hoje', ic: 'ti-calendar-event', titulo: `${doDia.length} compromisso${doDia.length > 1 ? 's' : ''} do R&S hoje`, sub: doDia.slice(0, 3).map(x => x.tipo + ': ' + x.c.nome).join(' · '), link: '#/agenda', n: doDia.length, naoConta: true });
  return l;
}
const ultimaData = s => (s.historico && s.historico.length ? s.historico[s.historico.length - 1].dt : s.criadoEm) || '';

export const nomeStatusSol = s => (STATUS_SOL[s] || [s, ''])[0];

// Links públicos (gestor e N2).
export const base = () => location.origin + location.pathname.replace(/[^/]*$/, '');
export const linkPedido = () => base() + 'pedido.html' + (location.search.includes('demo') ? '?demo' : '');
export const linkN2 = id => base() + 'n2.html?s=' + encodeURIComponent(id) + (location.search.includes('demo') ? '&demo' : '');
export const linkAcompanhar = id => base() + 'pedido.html?s=' + encodeURIComponent(id) + (location.search.includes('demo') ? '&demo' : '');

// Normaliza texto livre do sistema antigo ("SUBSTITUICAO" → "Substituição").
export function normalizarMotivo(m) {
  const t = String(m || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.startsWith('SUBST') || t.startsWith('SUBSTI')) return 'Substituição';
  if (t.startsWith('REPOS')) return 'Reposição';
  if (t.startsWith('AUMENTO')) return 'Aumento de quadro';
  return m ? 'Outro' : '';
}
