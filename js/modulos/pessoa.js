// Pasta da pessoa: jornada, linha do tempo, documentos, vínculos e dados.
import { TIPOS_EVENTO } from '../config.js?v=9';
import { $, $$, esc, iniciais, fmtData, fmtDataHora, hojeISO, diasEntre, fmtReais, pill, modal, toast, erroAmigavel, vazio } from '../ui.js?v=9';
import { NOME_GRUPO, formatarCpf } from '../fo1029.js?v=9';

export async function render(el, ctx, id) {
  const p = await ctx.D.pessoa(id);
  if (!p) { el.innerHTML = vazio('ti-user-question', 'Pessoa não encontrada', 'O cadastro pode ter sido removido ou o endereço está errado.', '<a class="btn" href="#/pessoas"><i class="ti ti-arrow-left"></i>Voltar para Pessoas</a>'); return; }
  const [eventos, anexos] = await Promise.all([ctx.D.eventos(id).catch(() => []), ctx.D.anexos(id).catch(() => [])]);
  let priv = null, privErro = '';
  if (ctx.pode('sensiveis')) { try { priv = await ctx.D.privado(id); } catch (e) { privErro = erroAmigavel(e); } }
  const a = p.atual || {}, hoje = hojeISO();
  const diasCasa = a.admissao ? diasEntre(a.admissao, hoje) : 0;

  // Jornada: onde a pessoa está
  const g = p.grupo;
  const etapas = [['Vaga', 'ok'], ['Seleção', 'ok'], ['Admissão', 'ok'],
    ['Experiência', g === 'desligado' || g === 'desligando' || diasCasa > 90 ? 'ok' : 'agora'],
    ['Ativo', g === 'desligado' || g === 'desligando' ? 'ok' : diasCasa > 90 ? 'agora' : ''],
    ['Rescisão', g === 'desligado' ? 'ok' : g === 'desligando' ? 'agora' : '']];
  const iAgora = Math.max(0, etapas.findIndex(e => e[1] === 'agora')), pctTrilho = g === 'desligado' ? 100 : (iAgora / 5) * 100;

  // Linha do tempo: registros + marcos dos vínculos
  const auto = [];
  [a].filter(v => v.admissao || v.demissao).forEach(v => { // só o vínculo atual; os anteriores ficam na aba Vínculos
    if (v.admissao) auto.push({ data: v.admissao, tipo: 'Admissão', titulo: `${v.cargo} · ${v.filial}`, porNome: 'FO1029', auto: true });
    if (v.demissao) auto.push({ data: v.demissao, tipo: 'Desligamento', titulo: v.tipoDemissao || 'Desligamento', porNome: 'FO1029', auto: true });
  });
  const linha = [...eventos, ...auto].sort((x, y) => (y.data || '').localeCompare(x.data || ''));

  const corG = { ativo: 'ok', afastado: 'sol', desligando: 'amb', desligado: '' }[g];
  el.innerHTML = `<button class="btn ghost sm" id="voltar" style="margin-bottom:12px"><i class="ti ti-arrow-left"></i>Voltar</button>
  <section class="card" style="margin-bottom:18px">
    <div class="pessoa-h"><span class="av g">${esc(iniciais(p.nome))}</span><div><h2 class="d">${esc(p.nome)}</h2><div class="meta"><span>CPF ${esc(p.cpfMasc)}</span><span>${esc(a.cargo || '')}</span><span>${esc(a.filial || '')}</span><span>Matrícula ${esc(a.matricula || '')}</span>${a.admissao ? `<span>Desde ${fmtData(a.admissao)}</span>` : ''}</div></div>
      <div class="acoes" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${pill(a.status || NOME_GRUPO[g], corG)}<button class="btn" id="imprimir"><i class="ti ti-printer"></i>Imprimir dossiê</button></div></div>
    <div class="trilha-p"><i class="feito" style="width:calc(${pctTrilho}% - ${pctTrilho ? 10 : 0}px)"></i>${etapas.map(e => `<div class="${e[1]}"><span>${e[1] === 'ok' ? '<i class="ti ti-check"></i>' : ''}</span>${e[0]}</div>`).join('')}</div>
    <div class="abas" role="tablist"><button class="on" data-p="tl" role="tab">Linha do tempo (${linha.length})</button><button data-p="docs" role="tab">Documentos (${anexos.length})</button><button data-p="vinc" role="tab">Vínculos (${(p.vinculos || []).length})</button><button data-p="dados" role="tab">Dados pessoais</button></div>
    <div class="painel on" id="p-tl"><div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap"><span class="muted small">Registros do dossiê e marcos vindos da folha.</span><button class="btn prim sm" id="novo-ev"><i class="ti ti-plus"></i>Novo registro</button></div>
      ${linha.length ? `<ul class="tl">${linha.map(e => `<li><b>${esc(e.tipo)}${e.titulo ? ' · ' + esc(e.titulo) : ''}</b><small>${fmtData(e.data)} · ${e.auto ? 'da folha (FO1029)' : 'por ' + esc(e.porNome || '—') + ' em ' + fmtDataHora(e.criadoEm)}</small>${e.obs ? `<div class="small" style="margin-top:4px;white-space:pre-wrap">${esc(e.obs)}</div>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Nenhum registro ainda.</p>'}</div>
    <div class="painel" id="p-docs"><div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap"><span class="muted small">PDF ou foto, até 15 MB. Ficam guardados no Brasil, só para quem tem acesso.</span><button class="btn prim sm" id="anexar"><i class="ti ti-paperclip"></i>Anexar documento</button></div>
      ${anexos.length ? anexos.map(x => `<div class="anexo"><span class="ic"><i class="ti ${(x.tipo || '').includes('pdf') ? 'ti-file-type-pdf' : 'ti-photo'}"></i></span><div><b style="font-weight:600">${esc(x.descricao || x.nome)}</b><div class="small muted">${esc(x.nome)} · ${(x.tamanho / 1024 / 1024).toFixed(1).replace('.', ',')} MB · por ${esc(x.porNome || '—')} em ${fmtDataHora(x.criadoEm)}</div></div><button class="btn sm" data-abrir="${esc(x.caminho)}"><i class="ti ti-external-link"></i>Abrir</button></div>`).join('') : '<p class="muted">Nenhum documento anexado.</p>'}</div>
    <div class="painel" id="p-vinc">${(p.vinculos || []).slice().reverse().map(v => `<div class="vinc"><span class="av">${esc((v.matricula || '').slice(-2))}</span><div><b>${esc(v.cargo)}</b><div class="small muted">${esc(v.filial)} · ${esc(v.setor)} · matrícula ${esc(v.matricula)} · ${esc(v.tipo)}</div><div class="small">${fmtData(v.admissao)} até ${v.demissao ? fmtData(v.demissao) : 'hoje'}${v.tipoDemissao ? ' · ' + esc(v.tipoDemissao) : ''}</div></div>${pill(v.status, { ativo: 'ok', afastado: 'sol', desligando: 'amb', desligado: '' }[v.grupo])}</div>`).join('')}</div>
    <div class="painel" id="p-dados">
      <div class="dados"><div><small>Nome</small><b>${esc(p.nome)}</b></div><div><small>Sexo</small><b>${esc(p.sexo || '—')}</b></div><div><small>Estado civil</small><b>${esc(p.estCivil || '—')}</b></div><div><small>Naturalidade</small><b>${esc(p.naturalidade || '—')}</b></div><div><small>Escolaridade</small><b>${esc(p.escolaridade || '—')}</b></div><div><small>Sindicato</small><b>${esc(a.sindicato || '—')}</b></div><div><small>Empresa</small><b>${esc(a.empresa || '—')}</b></div><div><small>Função</small><b>${esc(a.funcao || a.cargo || '—')}</b></div><div><small>CBO</small><b>${esc(a.cbo || '—')}</b></div></div>
      <h4 class="d" style="font-size:15px;margin:20px 0 10px">Dados sensíveis</h4>
      ${priv ? `<div class="dados"><div><small>CPF</small><b class="mascara">${esc(formatarCpf(priv.cpf))}</b></div><div><small>Nascimento</small><b>${fmtData(priv.nascimento)}</b></div><div><small>RG</small><b>${esc(priv.rg || '—')} ${esc(priv.rgEmissor || '')}</b></div><div><small>CTPS</small><b>${esc(priv.ctps || '—')} série ${esc(priv.ctpsSerie || '—')} ${esc(priv.ctpsUf || '')}</b></div><div><small>PIS</small><b>${esc(priv.pis || '—')}</b></div><div><small>Título de eleitor</small><b>${esc(priv.titulo || '—')}</b></div><div><small>Salário atual</small><b>${fmtReais(priv.salarioAtual)}</b></div><div><small>Mãe</small><b>${esc(priv.mae || '—')}</b></div><div><small>Pai</small><b>${esc(priv.pai || '—')}</b></div><div><small>Celular</small><b>${esc(priv.celular || '—')}</b></div><div><small>E-mail</small><b>${esc(priv.email || '—')}</b></div><div style="grid-column:1/-1"><small>Endereço</small><b>${esc(priv.endereco || '—')}</b></div></div>`
        : `<div class="restrito"><i class="ti ti-lock" style="font-size:20px"></i>${privErro ? esc(privErro) : 'CPF completo, salário, documentos, filiação e contato só aparecem para quem tem a permissão "Dados sensíveis".'}</div>`}
    </div></section>`;

  $$('.abas button').forEach(b => b.onclick = () => { $$('.abas button').forEach(x => x.classList.toggle('on', x === b)); $$('.painel').forEach(x => x.classList.toggle('on', x.id === 'p-' + b.dataset.p)); });
  $$('[data-abrir]').forEach(b => b.onclick = async () => { try { window.open(await ctx.D.urlAnexo(b.dataset.abrir), '_blank', 'noopener'); } catch (e) { toast(erroAmigavel(e), 'erro'); } });

  $('#novo-ev').onclick = async () => {
    const r = await modal({ titulo: 'Novo registro no dossiê', corpo: `
      <div class="linha2"><div class="campo"><label for="ev-tipo">Tipo</label><select class="inp" id="ev-tipo">${TIPOS_EVENTO.map(t => `<option>${esc(t)}</option>`).join('')}</select></div><div class="campo"><label for="ev-data">Data</label><input class="inp" id="ev-data" type="date" value="${hoje}" max="${hoje}"></div></div>
      <div class="campo"><label for="ev-tit">Resumo</label><input class="inp" id="ev-tit" maxlength="140" placeholder="Ex.: Feedback sobre pontualidade"></div>
      <div class="campo"><label for="ev-obs">Detalhes (opcional)</label><textarea class="inp" id="ev-obs" rows="4" maxlength="4000"></textarea></div>
      <div class="ajuda">Fica registrado com seu nome (${esc(ctx.nome())}) e a hora. Registros não podem ser editados depois, só pelo administrador.</div><div id="ev-msg"></div>`,
      botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'salvar', texto: 'Registrar', cls: 'prim' }],
      antesDeFechar: async (b, bg) => {
        const data = $('#ev-data', bg).value; if (!data) { $('#ev-msg', bg).innerHTML = '<div class="erro-msg">Informe a data.</div>'; return false; }
        try { await ctx.D.novoEvento(id, { tipo: $('#ev-tipo', bg).value, data, titulo: $('#ev-tit', bg).value.trim(), obs: $('#ev-obs', bg).value.trim(), porNome: ctx.nome() }); }
        catch (e) { $('#ev-msg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
      } });
    if (r === 'salvar') { toast('Registro salvo no dossiê.'); render(el, ctx, id); }
  };

  $('#anexar').onclick = async () => {
    const r = await modal({ titulo: 'Anexar documento', corpo: `
      <div class="campo"><label for="an-desc">O que é</label><input class="inp" id="an-desc" list="an-sug" placeholder="Ex.: Ficha de solicitação assinada"><datalist id="an-sug"><option>Ficha de solicitação de emprego</option><option>Termo de regras do teste</option><option>Avaliação do teste pelo gestor</option><option>ASO admissional</option><option>Termo de adesão ao plano de saúde</option><option>Termo de adesão ao plano odontológico</option><option>Contrato de experiência</option><option>Atestado médico</option></datalist></div>
      <div class="campo"><label for="an-arq">Arquivo (PDF ou foto, até 15 MB)</label><input class="inp" id="an-arq" type="file" accept="application/pdf,image/*"></div>
      <div class="progresso" id="an-prog" hidden><i></i></div><div id="an-msg"></div>`,
      botoes: [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'enviar', texto: 'Enviar', cls: 'prim' }],
      antesDeFechar: async (b, bg) => {
        const f = $('#an-arq', bg).files[0], msg = t => { $('#an-msg', bg).innerHTML = `<div class="erro-msg">${esc(t)}</div>`; return false; };
        if (!f) return msg('Escolha o arquivo.');
        if (f.size > 15 * 1024 * 1024) return msg('O arquivo passa de 15 MB.');
        if (!(f.type === 'application/pdf' || f.type.startsWith('image/'))) return msg('Use PDF ou imagem.');
        $('#an-prog', bg).hidden = false;
        try { await ctx.D.enviarAnexo(id, f, $('#an-desc', bg).value.trim() || f.name, pr => { $('#an-prog i', bg).style.width = (pr * 100) + '%'; }, ctx.nome()); }
        catch (e) { return msg(erroAmigavel(e)); }
      } });
    if (r === 'enviar') { toast('Documento anexado.'); render(el, ctx, id); setTimeout(() => $('[data-p="docs"]').click(), 0); }
  };

  // De onde veio: vaga do R&S, pedido do gestor e processo de admissão (cruzamento pelo CPF).
  (async () => {
    const [adm, cand] = await Promise.all([ctx.pode('admissao') ? ctx.D.listarOnde('admissoes', 'pid', id).catch(() => []) : [], ctx.pode('selecao') ? ctx.D.listarOnde('candidatos', 'pid', id).catch(() => []) : []]);
    const a1 = adm.sort((x, y) => (y.criadoEm || '').localeCompare(x.criadoEm || ''))[0], c1 = cand.find(c => c.situacao === 'contratado') || cand[0];
    const vaga = (a1 && a1.vagaCodigo) || (c1 && c1.vagaCodigo), sol = a1 && a1.solicitacaoCodigo;
    const meta = $('.pessoa-h .meta'); if (!meta) return;
    if (vaga) meta.insertAdjacentHTML('beforeend', `<span><i class="ti ti-user-search"></i>Vaga ${esc(vaga)}${sol ? ' · pedido ' + esc(sol) : ''}</span>`);
    if (a1) meta.insertAdjacentHTML('beforeend', `<span><a href="#/admissao/${esc(a1.id)}" style="color:inherit"><i class="ti ti-file-check"></i>Admissão ${a1.status === 'concluido' ? 'concluída' : 'em andamento'}</a></span>`);
  })();
  $('#voltar').onclick = () => { location.hash = window.__gpAnterior || '#/pessoas'; };
  $('#imprimir').onclick = () => {
    const w = window.open('', '_blank'); if (!w) return toast('Permita pop-ups para imprimir.', 'erro');
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Dossiê · ${esc(p.nome)}</title><style>body{font:12px/1.5 Arial,sans-serif;color:#15201a;margin:28px}h1{font-size:20px;margin:0;color:#01361d}h2{font-size:14px;color:#01361d;border-bottom:2px solid #9dcd46;padding-bottom:3px;margin-top:22px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #dbe4dc;padding:5px;text-align:left;vertical-align:top}small{color:#55635a}.cab{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:4px solid #01361d;padding-bottom:10px}</style></head><body>
      <div class="cab"><div><h1>${esc(p.nome)}</h1><small>CPF ${esc(p.cpfMasc)} · ${esc(a.cargo || '')} · ${esc(a.filial || '')} · matrícula ${esc(a.matricula || '')}</small></div><small>Raguife · Gestão de Pessoas<br>Emitido em ${new Date().toLocaleString('pt-BR')} por ${esc(ctx.nome())}</small></div>
      <h2>Vínculos</h2><table><tr><th>Matrícula</th><th>Cargo</th><th>Filial</th><th>Admissão</th><th>Demissão</th></tr>${(p.vinculos || []).map(v => `<tr><td>${esc(v.matricula)}</td><td>${esc(v.cargo)}</td><td>${esc(v.filial)}</td><td>${fmtData(v.admissao)}</td><td>${v.demissao ? fmtData(v.demissao) + ' · ' + esc(v.tipoDemissao || '') : '—'}</td></tr>`).join('')}</table>
      <h2>Linha do tempo</h2><table><tr><th>Data</th><th>Registro</th><th>Por</th></tr>${linha.map(e => `<tr><td>${fmtData(e.data)}</td><td><b>${esc(e.tipo)}</b>${e.titulo ? ' · ' + esc(e.titulo) : ''}${e.obs ? '<br>' + esc(e.obs) : ''}</td><td>${e.auto ? 'FO1029' : esc(e.porNome || '')}</td></tr>`).join('')}</table>
      <h2>Documentos anexados</h2><table>${anexos.map(x => `<tr><td>${esc(x.descricao || x.nome)}</td><td>${fmtDataHora(x.criadoEm)} · ${esc(x.porNome || '')}</td></tr>`).join('') || '<tr><td>Nenhum.</td></tr>'}</table>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
    ctx.D.log('dossie_impresso', id);
  };
}
