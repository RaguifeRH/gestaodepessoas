// Importar FO1029 — atualiza o cadastro único pelo relatório da folha.
import { $, $$, esc, tit, card, kpis, fmtNum, fmtDataHora, toast, erroAmigavel, confirmar } from '../ui.js';
import { lerArquivo, montar, filiaisDasLinhas, NOME_GRUPO } from '../fo1029.js';

export async function render(el, ctx) {
  const hist = await ctx.D.importacoes().catch(() => []);
  el.innerHTML = tit('ti-file-import', 'Importar FO1029', 'Planilha de Dados Cadastrais de Funcionários. Uma pessoa por CPF, com todos os vínculos. Dados bancários não são importados.')
    + `<div class="g2"><div id="imp-area">${zona()}</div>`
    + card('Importações anteriores', hist.length ? `<ul class="agenda">${hist.map(h => `<li><span class="hora" style="font-size:11.5px">${esc((h.criadoEm || '').slice(8, 10) + '/' + (h.criadoEm || '').slice(5, 7))}</span><div><b>${fmtNum(h.pessoas)} pessoas · ${fmtNum(h.ativos)} ativas</b><small>${esc(h.arquivo || '')} · ${esc(h.porNome || '')} · ${fmtDataHora(h.criadoEm)}</small></div></li>`).join('')}</ul>` : '<p class="muted small" style="margin:0">Nenhuma importação ainda.</p>') + '</div>';
  ligarZona();

  function zona() {
    return `<label class="soltar" id="soltar"><i class="ti ti-file-spreadsheet"></i><b>Arraste o arquivo do FO1029 aqui</b><span class="muted small">ou clique para escolher (.xlsx ou .xls)</span><input type="file" id="arq" accept=".xlsx,.xls" hidden></label>
      <p class="ajuda" style="margin-top:10px">O arquivo é lido aqui no seu navegador. Antes de gravar, você vê um resumo e escolhe as filiais.</p>`;
  }
  function ligarZona() {
    const z = $('#soltar'), inp = $('#arq');
    inp.onchange = () => inp.files[0] && ler(inp.files[0]);
    z.ondragover = e => { e.preventDefault(); z.classList.add('sobre'); };
    z.ondragleave = () => z.classList.remove('sobre');
    z.ondrop = e => { e.preventDefault(); z.classList.remove('sobre'); const f = e.dataTransfer.files[0]; if (f) ler(f); };
  }

  async function ler(arquivo) {
    const area = $('#imp-area');
    area.innerHTML = '<div class="card" style="padding:22px;display:grid;gap:10px;justify-items:center"><div class="girando"></div><b>Lendo o arquivo…</b></div>';
    try {
      for (let i = 0; i < 50 && !window.XLSX; i++) await new Promise(r => setTimeout(r, 100));
      const linhas = await lerArquivo(arquivo);
      const filiais = filiaisDasLinhas(linhas);
      previa(arquivo, linhas, filiais, filiais.map(f => f[0]));
    } catch (e) {
      area.innerHTML = `<div class="erro-msg" style="margin-bottom:12px">${esc(e.message || erroAmigavel(e))}</div>` + zona(); ligarZona();
    }
  }

  async function previa(arquivo, linhas, filiais, escolhidas) {
    const area = $('#imp-area');
    const { pessoas, itens, stats } = await montar(linhas, escolhidas);
    const atuais = new Set(((await ctx.resumo()).itens || []).map(x => x.i));
    const novas = pessoas.filter(p => !atuais.has(p.id)).length;
    const ativos = (stats.porGrupo.ativo || 0) + (stats.porGrupo.afastado || 0);
    area.innerHTML = `<section class="card"><div class="card-h"><h3 class="d">Conferir antes de gravar</h3><span class="pill">${esc(arquivo.name)}</span></div><div class="card-b">
      ${kpis([['Pessoas (CPFs)', fmtNum(stats.pessoas), fmtNum(stats.linhas) + ' linhas no arquivo'], ['Ativas e afastadas', fmtNum(ativos), 'entram nos indicadores'], ['Novas no sistema', fmtNum(novas), fmtNum(stats.pessoas - novas) + ' já existiam e serão atualizadas'], ['Recontratadas', fmtNum(stats.recontratados), 'mais de um vínculo']])}
      <div class="g2i"><div><h4 class="d" style="font-size:15px;margin-bottom:6px">Filiais a importar</h4><div class="chk-grade" style="grid-template-columns:1fr" id="fil">${filiais.map(f => `<label><input type="checkbox" value="${esc(f[0])}"${escolhidas.includes(f[0]) ? ' checked' : ''}> ${esc(f[0])} <span class="muted small">(${fmtNum(f[1])} linhas)</span></label>`).join('')}</div></div>
      <div><h4 class="d" style="font-size:15px;margin-bottom:6px">Situação atual</h4>${Object.entries(stats.porGrupo).map(([g, n]) => `<div class="barra-h" style="grid-template-columns:140px 1fr auto"><span>${esc(NOME_GRUPO[g] || g)}</span><span class="bh"><i style="width:${n / stats.pessoas * 100}%"></i></span><b>${fmtNum(n)}</b></div>`).join('')}</div></div>
      ${stats.ignoradas ? `<p class="erro-msg" style="margin-top:12px">${stats.ignoradas} linha(s) sem CPF válido foram ignoradas.</p>` : ''}
      <div id="grav" style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="outro"><i class="ti ti-arrow-back-up"></i>Escolher outro arquivo</button><button class="btn prim" id="gravar"><i class="ti ti-database-import"></i>Gravar ${fmtNum(stats.pessoas)} pessoas</button></div>
    </div></section>`;
    $$('#fil input').forEach(c => c.onchange = () => previa(arquivo, linhas, filiais, $$('#fil input:checked').map(i => i.value)));
    $('#outro').onclick = () => { area.innerHTML = zona(); ligarZona(); };
    $('#gravar').onclick = async () => {
      if (!stats.pessoas) return toast('Marque pelo menos uma filial.', 'erro');
      if (!await confirmar('Gravar no sistema?', `${fmtNum(stats.pessoas)} pessoas serão gravadas ou atualizadas. O que já foi registrado no sistema (dossiê, anexos, experiência) não é apagado.`, 'Gravar')) return;
      $('#grav').innerHTML = '<div style="width:100%;display:grid;gap:8px"><div class="progresso"><i id="barra"></i></div><span class="small muted" id="prog-t">Gravando…</span></div>';
      try {
        await ctx.D.importar(pessoas, itens, { arquivo: arquivo.name, linhas: stats.linhas, pessoas: stats.pessoas, ativos, novas, filiais: escolhidas, porNome: ctx.nome() }, (f, t) => { $('#barra').style.width = (f / t * 100) + '%'; $('#prog-t').textContent = `Gravando… ${fmtNum(f)} de ${fmtNum(t)}`; });
        ctx.D.log('fo1029_importado', `${stats.pessoas} pessoas`);
        await ctx.resumo(true); ctx.atualizarContadores();
        toast('Importação concluída.');
        render(el, ctx);
      } catch (e) {
        $('#grav').innerHTML = `<div class="erro-msg" style="width:100%">A gravação parou: ${esc(erroAmigavel(e))} Nada se perde: rode a importação de novo, ela continua de onde estiver.</div>`;
      }
    };
  }
}
