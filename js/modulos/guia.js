// Guia RH: fases da jornada e as etapas de cada uma (passos, responsáveis, documentos e gatilhos).
import { $, $$, esc, tit, modal, toast, erroAmigavel, confirmar, vazio, norm } from '../ui.js?v=13';

let busca = '', abertos = new Set();
const TIPOS_DOC = [['IT', 'Instrução de trabalho'], ['POP', 'Procedimento (POP)'], ['FORM', 'Formulário'], ['CHK', 'Checklist'], ['LINK', 'Link / pasta']];
const linkDoc = d => { const u = (d.url || '').trim(); const txt = `<span class="pill" style="font-size:11px">${esc(d.tipo || 'LINK')}</span> ${d.codigo ? esc(d.codigo) + ' · ' : ''}${esc(d.titulo || u)}`;
  return /^https?:/i.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener" class="small">${txt} <i class="ti ti-external-link"></i></a>` : `<span class="small" title="${esc(u)}">${txt}${u ? ` <span class="muted">(${esc(u)})</span>` : ''}</span>`; };

export async function render(el, ctx) {
  const [fases, etapas] = await Promise.all([ctx.D.listar('guia_fases').catch(() => []), ctx.D.listar('guia_etapas').catch(() => [])]);
  const fs = fases.filter(f => !f.apagado).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const et = etapas.filter(e => !e.apagado);
  const adm = ctx.admin(); const t = norm(busca);
  const bate = e => !t || norm([e.titulo, e.descricao, (e.gatilho || {}).texto, ...(e.passos || []).map(p => [p.texto, p.obs, (p.resp || []).join(' ')].join(' ')), ...(e.docs || []).map(d => d.titulo)].join(' ')).includes(t);
  if (!fs.length) { el.innerHTML = tit('ti-map-2', 'Guia RH') + vazio('ti-map-2', 'O Guia RH está vazio', 'Importe o guia do sistema antigo em Dados dos sistemas antigos' + (adm ? ' ou crie a primeira fase.' : '.'), adm ? '<button class="btn prim" id="nf"><i class="ti ti-plus"></i>Nova fase</button>' : ''); if ($('#nf')) $('#nf').onclick = () => editarFase(ctx, null, fs).then(m => m && render(el, ctx)); return; }
  el.innerHTML = tit('ti-map-2', 'Guia RH', 'O passo a passo de cada etapa da jornada do colaborador', adm ? '<button class="btn" id="nf"><i class="ti ti-plus"></i>Nova fase</button><button class="btn prim" id="ne"><i class="ti ti-plus"></i>Nova etapa</button>' : '')
    + `<div class="filtros-l" style="margin-bottom:14px"><label class="busca"><i class="ti ti-search"></i><input id="q" placeholder="Buscar no guia (passo, responsável, documento…)" value="${esc(busca)}"></label></div>`
    + fs.map(f => { const l = et.filter(e => e.faseId === f.id && bate(e)).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)); if (t && !l.length) return '';
      return `<section class="card" style="margin-bottom:16px;border-top:4px solid ${esc(f.cor || 'var(--verde)')}"><div class="card-h"><h3 class="d" style="display:flex;gap:8px;align-items:center"><i class="ti ${esc(f.icon || 'ti-flag')}" style="color:${esc(f.cor || 'var(--verde)')}"></i>${esc(f.nome)}</h3>${adm ? `<button class="btn sm ghost" data-ef="${esc(f.id)}"><i class="ti ti-pencil"></i>Fase</button>` : ''}</div>
        <div class="card-b">${f.descricao ? `<p class="small muted" style="margin:0 0 10px">${esc(f.descricao)}</p>` : ''}${l.map(e => { const ab = abertos.has(e.id) || !!t;
          return `<div class="bloco" style="margin:0 0 10px"><h4 class="d" style="cursor:pointer" data-ab="${esc(e.id)}"><i class="ti ${esc(e.icon || 'ti-point')}"></i>${esc(e.titulo)}${(e.perfis || []).length ? `<span class="pill" style="margin-left:6px;font-size:11px">${esc(e.perfis.join(', '))}</span>` : ''}<i class="ti ti-chevron-${ab ? 'up' : 'down'}" style="margin-left:auto"></i></h4>
            ${ab ? `<div style="padding:12px 16px;display:grid;gap:10px">${e.descricao ? `<div class="small">${esc(e.descricao)}</div>` : ''}${e.gatilho && e.gatilho.texto ? `<div class="auto" style="margin:0"><i class="ti ti-bolt"></i>Quando: ${esc(e.gatilho.texto)}</div>` : ''}
              ${(e.passos || []).length ? `<ol style="margin:0;padding-left:20px;display:grid;gap:8px">${e.passos.map(p => `<li><b style="font-weight:600">${esc(p.texto)}</b> ${(p.resp || []).map(r => `<span class="pill" style="font-size:11px">${esc(r)}</span>`).join(' ')}${(p.perfis || []).length ? ` <span class="small muted">só ${esc(p.perfis.join(', '))}</span>` : ''}${p.obs ? `<div class="small muted">${esc(p.obs)}</div>` : ''}${(p.docs || []).length ? `<div style="display:grid;gap:2px;margin-top:4px">${p.docs.map(linkDoc).join('')}</div>` : ''}</li>`).join('')}</ol>` : ''}
              ${(e.docs || []).length ? `<div><div class="small" style="font-weight:700;margin-bottom:4px">Documentos</div><div style="display:grid;gap:4px">${e.docs.map(linkDoc).join('')}</div></div>` : ''}
              ${adm ? `<div><button class="btn sm" data-ee="${esc(e.id)}"><i class="ti ti-pencil"></i>Editar etapa</button></div>` : ''}</div>` : ''}</div>`; }).join('') || '<p class="small muted" style="margin:0">Nenhuma etapa.</p>'}</div></section>`; }).join('');
  $('#q').oninput = e => { busca = e.target.value; clearTimeout(el._t); el._t = setTimeout(() => render(el, ctx).then(() => { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }), 300); };
  $$('[data-ab]').forEach(h => h.onclick = () => { const id = h.dataset.ab; abertos.has(id) ? abertos.delete(id) : abertos.add(id); render(el, ctx); });
  if ($('#nf')) $('#nf').onclick = () => editarFase(ctx, null, fs).then(m => m && render(el, ctx));
  if ($('#ne')) $('#ne').onclick = () => editarEtapa(ctx, null, fs, et).then(m => m && render(el, ctx));
  $$('[data-ef]').forEach(b => b.onclick = () => editarFase(ctx, fs.find(f => f.id === b.dataset.ef), fs).then(m => m && render(el, ctx)));
  $$('[data-ee]').forEach(b => b.onclick = () => editarEtapa(ctx, et.find(e => e.id === b.dataset.ee), fs, et).then(m => m && render(el, ctx)));
}

async function editarFase(ctx, f, fs) {
  const novo = !f; f = f || { cor: '#036c3b', icon: 'ti-flag', ordem: fs.length + 1 }; let ok = false;
  const r = await modal({ titulo: novo ? 'Nova fase' : 'Fase', corpo: `<div class="campo"><label for="gf-n">Nome</label><input class="inp" id="gf-n" value="${esc(f.nome || '')}"></div><div class="campo"><label for="gf-d">Descrição</label><textarea class="inp" id="gf-d" rows="2">${esc(f.descricao || '')}</textarea></div>
      <div class="linha3"><div class="campo"><label for="gf-c">Cor</label><input class="inp" id="gf-c" type="color" value="${esc(f.cor || '#036c3b')}" style="height:42px"></div><div class="campo"><label for="gf-i">Ícone (Tabler)</label><input class="inp" id="gf-i" value="${esc(f.icon || '')}" placeholder="ti-flag"></div><div class="campo"><label for="gf-o">Ordem</label><input class="inp" id="gf-o" type="number" value="${esc(f.ordem || 1)}"></div></div>`,
    botoes: [...(novo ? [] : [{ id: 'apagar', texto: 'Apagar', cls: 'ghost' }]), { id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    antesDeFechar: async (b, bg) => {
      try {
        if (b === 'apagar') { if (!(await confirmar('Apagar fase', 'Apagar esta fase? As etapas dela ficam guardadas, mas somem do guia.', 'Apagar'))) return false; await ctx.D.atualizar('guia_fases', f.id, { apagado: true }); ok = true; return; }
        const d = { nome: $('#gf-n', bg).value.trim(), descricao: $('#gf-d', bg).value.trim(), cor: $('#gf-c', bg).value, icon: $('#gf-i', bg).value.trim() || 'ti-flag', ordem: +$('#gf-o', bg).value || 1, atualizadoPor: ctx.nome() };
        if (!d.nome) return false;
        if (novo) await ctx.D.criar('guia_fases', d); else await ctx.D.atualizar('guia_fases', f.id, d); ok = true;
      } catch (e) { toast(erroAmigavel(e), 'erro'); return false; }
    } });
  return ok;
}

async function editarEtapa(ctx, e, fs, et) {
  const novo = !e; e = JSON.parse(JSON.stringify(e || { faseId: fs[0].id, passos: [], docs: [], perfis: [], gatilho: { tipo: 'evento', texto: '' }, icon: 'ti-point' })); let ok = false;
  const linhaPasso = (p, k) => `<div class="ce-item" data-p="${k}" style="padding:8px 0"><div class="ce-l1"><input class="inp" data-pf="texto" value="${esc(p.texto || '')}" placeholder="O que fazer"><button type="button" class="ico-btn" data-prm="${k}" style="color:var(--verm)"><i class="ti ti-trash"></i></button></div>
      <div class="ce-l3"><input class="inp" data-pf="resp" value="${esc((p.resp || []).join(', '))}" placeholder="Responsáveis (RH, DP, Ambulatório…)" style="flex:1;min-width:160px;padding:5px 9px"><input class="inp" data-pf="perfis" value="${esc((p.perfis || []).join(', '))}" placeholder="Só para perfis (vazio = todos)" style="flex:1;min-width:160px;padding:5px 9px"><input class="inp" data-pf="obs" value="${esc(p.obs || '')}" placeholder="Observação" style="flex:2;min-width:200px;padding:5px 9px"></div></div>`;
  const linhaDoc = (d, k) => `<div class="ce-l1" data-d="${k}" style="margin-bottom:6px"><select class="inp" data-df="tipo" style="width:auto">${TIPOS_DOC.map(([t, n]) => `<option value="${t}"${t === d.tipo ? ' selected' : ''}>${n}</option>`).join('')}</select><input class="inp" data-df="titulo" value="${esc(d.titulo || '')}" placeholder="Título"><input class="inp" data-df="codigo" value="${esc(d.codigo || '')}" placeholder="Código" style="max-width:110px"><input class="inp" data-df="url" value="${esc(d.url || '')}" placeholder="Link ou caminho da rede"><button type="button" class="ico-btn" data-drm="${k}" style="color:var(--verm)"><i class="ti ti-trash"></i></button></div>`;
  const r = await modal({ titulo: novo ? 'Nova etapa' : 'Etapa', larga: true, corpo: `<div class="linha2"><div class="campo"><label for="ge-t">Título</label><input class="inp" id="ge-t" value="${esc(e.titulo || '')}"></div><div class="campo"><label for="ge-f">Fase</label><select class="inp" id="ge-f">${fs.map(f => `<option value="${esc(f.id)}"${f.id === e.faseId ? ' selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></div></div>
      <div class="campo"><label for="ge-d">Descrição</label><textarea class="inp" id="ge-d" rows="2">${esc(e.descricao || '')}</textarea></div>
      <div class="linha3"><div class="campo"><label for="ge-g">Quando acontece</label><input class="inp" id="ge-g" value="${esc((e.gatilho || {}).texto || '')}" placeholder="Ex.: Após o aceite da proposta"></div><div class="campo"><label for="ge-p">Só para perfis</label><input class="inp" id="ge-p" value="${esc((e.perfis || []).join(', '))}" placeholder="Vazio = todos"></div><div class="campo"><label for="ge-o">Ordem</label><input class="inp" id="ge-o" type="number" value="${esc(e.ordem || 1)}"></div></div>
      <h4 class="d" style="font-size:15px;margin:10px 0 4px">Passos</h4><div id="ge-passos"></div><button type="button" class="btn sm" id="ge-padd"><i class="ti ti-plus"></i>Adicionar passo</button>
      <h4 class="d" style="font-size:15px;margin:14px 0 6px">Documentos da etapa</h4><div id="ge-docs"></div><button type="button" class="btn sm" id="ge-dadd"><i class="ti ti-plus"></i>Adicionar documento</button>`,
    botoes: [...(novo ? [] : [{ id: 'apagar', texto: 'Apagar', cls: 'ghost' }]), { id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    aoAbrir: bg => {
      const lista = s => s.split(',').map(x => x.trim()).filter(Boolean);
      const desenhar = () => {
        $('#ge-passos', bg).innerHTML = e.passos.map(linhaPasso).join('');
        $('#ge-docs', bg).innerHTML = e.docs.map(linhaDoc).join('');
        $$('[data-p]', bg).forEach(row => $$('[data-pf]', row).forEach(f => f.oninput = () => { const p = e.passos[+row.dataset.p]; p[f.dataset.pf] = ['resp', 'perfis'].includes(f.dataset.pf) ? lista(f.value) : f.value; }));
        $$('[data-prm]', bg).forEach(b => b.onclick = () => { e.passos.splice(+b.dataset.prm, 1); desenhar(); });
        $$('[data-d]', bg).forEach(row => $$('[data-df]', row).forEach(f => f[f.tagName === 'SELECT' ? 'onchange' : 'oninput'] = () => { e.docs[+row.dataset.d][f.dataset.df] = f.value; }));
        $$('[data-drm]', bg).forEach(b => b.onclick = () => { e.docs.splice(+b.dataset.drm, 1); desenhar(); });
      };
      $('#ge-padd', bg).onclick = () => { e.passos.push({ texto: '', resp: [], perfis: [], obs: '', docs: [] }); desenhar(); };
      $('#ge-dadd', bg).onclick = () => { e.docs.push({ tipo: 'IT', titulo: '', codigo: '', url: '' }); desenhar(); };
      desenhar();
    },
    antesDeFechar: async (b, bg) => {
      try {
        if (b === 'apagar') { if (!(await confirmar('Apagar etapa', 'Apagar esta etapa do guia?', 'Apagar'))) return false; await ctx.D.atualizar('guia_etapas', e.id, { apagado: true }); ok = true; return; }
        const lista = s => s.split(',').map(x => x.trim()).filter(Boolean);
        const d = { titulo: $('#ge-t', bg).value.trim(), faseId: $('#ge-f', bg).value, descricao: $('#ge-d', bg).value.trim(), gatilho: { ...(e.gatilho || {}), texto: $('#ge-g', bg).value.trim() }, perfis: lista($('#ge-p', bg).value), ordem: +$('#ge-o', bg).value || 1,
          passos: e.passos.filter(p => (p.texto || '').trim()), docs: e.docs.filter(x => (x.titulo || x.url || '').trim()), icon: e.icon || 'ti-point', atualizadoPor: ctx.nome() };
        if (!d.titulo) return false;
        if (novo) await ctx.D.criar('guia_etapas', d); else await ctx.D.atualizar('guia_etapas', e.id, d); ok = true;
      } catch (err) { toast(erroAmigavel(err), 'erro'); return false; }
    } });
  if (ok) toast('Guia atualizado.');
  return ok;
}
