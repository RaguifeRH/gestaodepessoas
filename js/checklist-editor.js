// ============================================================================
// Editor visual de checklist (admissão e rescisão): itens por seção, "vale para"
// por perfil, ordem, opcional e campo do FO1029. Sem códigos para digitar.
// ============================================================================
import { $, $$, esc, modal, toast, erroAmigavel, confirmar } from './ui.js?v=12';

const novoId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/**
 * opc: { titulo, itens:[{id, grupo, texto, it, perfis:[], auto, opcional}], perfis:[{id,nome}],
 *        grupos:[[id,nome]], nomeGrupo:'Seção', campos:{ it:bool, opcional:bool, auto:[[k,rotulo]] },
 *        extraTopo: html, lerExtraTopo: bg => obj, aoSalvar: async (itens, perfis, extra) => void, padrao: () => ({itens, perfis}) }
 */
export async function editarChecklist(opc) {
  let itens = opc.itens.map(i => ({ ...i, perfis: [...(i.perfis || [])] }));
  let perfis = opc.perfis.map(p => ({ ...p }));
  let aba = 'itens', salvo = false;
  const corpo = `${opc.extraTopo || ''}<div class="filtros" style="margin-bottom:12px"><button type="button" data-ab="itens" class="on">Itens do checklist</button><button type="button" data-ab="perfis">Perfis</button></div><div id="ce"></div><div id="ce-msg"></div>`;
  const r = await modal({ titulo: opc.titulo, larga: true, corpo,
    botoes: [...(opc.padrao ? [{ id: 'padrao', texto: 'Voltar ao padrão', cls: 'ghost' }] : []), { id: 'cancelar', texto: 'Cancelar' }, { id: 'ok', texto: 'Salvar', cls: 'prim' }],
    aoAbrir: bg => {
      bg.querySelector('.modal').style.maxWidth = '980px';
      const desenhar = () => {
        $$('[data-ab]', bg).forEach(b => b.classList.toggle('on', b.dataset.ab === aba));
        $('#ce', bg).innerHTML = aba === 'itens' ? telaItens() : telaPerfis();
        ligar();
      };
      const chip = (on, txt, attrs) => `<button type="button" class="ce-chip${on ? ' on' : ''}" ${attrs}>${on ? '<i class="ti ti-check"></i>' : ''}${esc(txt)}</button>`;
      const telaItens = () => opc.grupos.map(([g, gn]) => {
        const l = itens.filter(i => i.grupo === g);
        return `<div class="bloco" style="margin:0 0 14px"><h4 class="d">${esc(gn)} <span class="pill" style="margin-left:auto">${l.length} itens</span></h4>
          ${l.map(i => { const k = itens.indexOf(i); return `<div class="ce-item" data-k="${k}">
            <div class="ce-l1"><input class="inp" data-f="texto" value="${esc(i.texto)}" placeholder="Descreva o item">
              <div class="ce-acoes"><button type="button" class="ico-btn" data-mv="-1" title="Subir"><i class="ti ti-arrow-up"></i></button><button type="button" class="ico-btn" data-mv="1" title="Descer"><i class="ti ti-arrow-down"></i></button><button type="button" class="ico-btn" data-rm title="Remover" style="color:var(--verm)"><i class="ti ti-trash"></i></button></div></div>
            <div class="ce-l2"><span class="small muted">Vale para:</span>${chip(!i.perfis.length, 'Todos', 'data-todos')}${perfis.map(p => chip(i.perfis.includes(p.id), p.nome, `data-pf="${esc(p.id)}"`)).join('')}</div>
            <div class="ce-l3">${opc.grupos.length > 1 ? `<label class="small">${esc(opc.nomeGrupo || 'Seção')} <select class="inp" data-f="grupo" style="width:auto;padding:4px 8px">${opc.grupos.map(([gid, gnome]) => `<option value="${gid}"${gid === i.grupo ? ' selected' : ''}>${esc(gnome)}</option>`).join('')}</select></label>` : ''}
              ${opc.campos.opcional ? `<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="opcional"${i.opcional ? ' checked' : ''}> Opcional</label>` : ''}
              ${opc.campos.auto ? `<label class="small">Confirmar pelo FO1029 <select class="inp" data-f="auto" style="width:auto;padding:4px 8px"><option value="">Não</option>${opc.campos.auto.map(([a, an]) => `<option value="${a}"${a === i.auto ? ' selected' : ''}>${esc(an)}</option>`).join('')}</select></label>` : ''}
              ${opc.campos.it ? `<input class="inp" data-f="it" value="${esc(i.it || '')}" placeholder="Instrução / observação (opcional)" style="flex:1;min-width:200px;padding:5px 9px">` : ''}</div></div>`; }).join('')}
          <div style="padding:10px 16px"><button type="button" class="btn sm" data-add="${g}"><i class="ti ti-plus"></i>Adicionar item em ${esc(gn)}</button></div></div>`;
      }).join('');
      const telaPerfis = () => `<p class="small muted" style="margin:0 0 10px">O perfil é escolhido ao abrir cada processo e define quais itens aparecem. Itens marcados como "Todos" aparecem em qualquer perfil.</p>
        ${perfis.map((p, k) => { const n = itens.filter(i => !i.perfis.length || i.perfis.includes(p.id)).length; return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><input class="inp" data-pn="${k}" value="${esc(p.nome)}" style="flex:1"><span class="small muted" style="white-space:nowrap">${n} itens</span><button type="button" class="ico-btn" data-prm="${k}" title="Remover perfil" style="color:var(--verm)"><i class="ti ti-trash"></i></button></div>`; }).join('')}
        <button type="button" class="btn sm" id="ce-padd"><i class="ti ti-plus"></i>Novo perfil</button>`;
      const ligar = () => {
        $$('.ce-item', bg).forEach(row => {
          const i = itens[+row.dataset.k];
          $$('[data-f]', row).forEach(f => { const ev = f.type === 'checkbox' || f.tagName === 'SELECT' ? 'onchange' : 'oninput';
            f[ev] = () => { i[f.dataset.f] = f.type === 'checkbox' ? f.checked : f.value; if (f.dataset.f === 'grupo') desenhar(); }; });
          $('[data-todos]', row).onclick = () => { i.perfis = []; desenhar(); };
          $$('[data-pf]', row).forEach(b => b.onclick = () => { const id = b.dataset.pf; i.perfis = i.perfis.includes(id) ? i.perfis.filter(x => x !== id) : [...i.perfis, id]; if (i.perfis.length === perfis.length) i.perfis = []; desenhar(); });
          $$('[data-mv]', row).forEach(b => b.onclick = () => { const mesmo = itens.filter(x => x.grupo === i.grupo); const p = mesmo.indexOf(i), q = p + +b.dataset.mv; if (q < 0 || q >= mesmo.length) return; const a = itens.indexOf(mesmo[p]), c = itens.indexOf(mesmo[q]); [itens[a], itens[c]] = [itens[c], itens[a]]; desenhar(); });
          $('[data-rm]', row).onclick = async () => { if (!i.texto || await confirmar('Remover item', `Remover "${esc(i.texto)}"? Nos processos já abertos, o que foi marcado fica no histórico.`, 'Remover')) { itens = itens.filter(x => x !== i); desenhar(); } };
        });
        $$('[data-add]', bg).forEach(b => b.onclick = () => { itens.push({ id: novoId('i'), grupo: b.dataset.add, texto: '', it: '', perfis: [], auto: '', opcional: false }); desenhar(); const rows = $$('.ce-item', bg); const ult = [...rows].filter(r => itens[+r.dataset.k].grupo === b.dataset.add).pop(); if (ult) $('[data-f="texto"]', ult).focus(); });
        $$('[data-pn]', bg).forEach(f => f.oninput = () => { perfis[+f.dataset.pn].nome = f.value; });
        $$('[data-prm]', bg).forEach(b => b.onclick = async () => { const p = perfis[+b.dataset.prm]; if (!(await confirmar('Remover perfil', `Remover o perfil "${esc(p.nome)}"? Os processos abertos com ele continuam com os itens que já tinham.`, 'Remover'))) return; perfis = perfis.filter(x => x !== p); itens.forEach(i => { i.perfis = i.perfis.filter(x => x !== p.id); }); desenhar(); });
        if ($('#ce-padd', bg)) $('#ce-padd', bg).onclick = () => { perfis.push({ id: novoId('p'), nome: 'Novo perfil' }); desenhar(); const l = $$('[data-pn]', bg); l[l.length - 1].select(); };
      };
      $$('[data-ab]', bg).forEach(b => b.onclick = () => { aba = b.dataset.ab; desenhar(); });
      desenhar();
    },
    antesDeFechar: async (b, bg) => {
      try {
        if (b === 'padrao') { if (!(await confirmar('Voltar ao padrão', 'Trocar tudo pela lista original do sistema antigo?', 'Voltar ao padrão'))) return false; const p = opc.padrao(); await opc.aoSalvar(p.itens, p.perfis, opc.lerExtraTopo ? opc.lerExtraTopo(bg) : {}); salvo = true; return; }
        const limpos = itens.map(i => ({ ...i, texto: (i.texto || '').trim(), it: (i.it || '').trim() })).filter(i => i.texto);
        const pf = perfis.map(p => ({ ...p, nome: (p.nome || '').trim() })).filter(p => p.nome);
        if (!pf.length) { $('#ce-msg', bg).innerHTML = '<div class="erro-msg">Deixe pelo menos um perfil.</div>'; return false; }
        await opc.aoSalvar(limpos, pf, opc.lerExtraTopo ? opc.lerExtraTopo(bg) : {}); salvo = true;
      } catch (e) { $('#ce-msg', bg).innerHTML = `<div class="erro-msg">${esc(erroAmigavel(e))}</div>`; return false; }
    } });
  if (salvo) toast('Checklist salvo.');
  return salvo;
}
