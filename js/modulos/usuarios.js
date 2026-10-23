// Usuários e acessos (só administrador).
import { MODULOS, RESC_SETORES } from '../config.js?v=10';
import { $, $$, esc, tit, card, pes, pill, modal, toast, erroAmigavel, fmtDataHora } from '../ui.js?v=10';

export async function render(el, ctx) {
  const lista = await ctx.D.listarUsuarios();
  const nomeMod = id => (MODULOS.find(m => m.id === id) || {}).nome || id;
  el.innerHTML = tit('ti-shield-lock', 'Usuários e acessos', `${lista.length} usuário${lista.length === 1 ? '' : 's'} · cada pessoa vê só os módulos liberados`, '<button class="btn prim" id="novo"><i class="ti ti-user-plus"></i>Novo usuário</button>')
    + card('Usuários', `<div class="tw"><table class="tb"><thead><tr><th>Pessoa</th><th>Perfil</th><th>Módulos</th><th>Situação</th><th></th></tr></thead><tbody>${lista.map(u => `<tr><td>${pes(u.nome, u.email)}</td><td>${u.perfil === 'admin' ? pill('Administrador', 'lim') : pill('Usuário')}</td><td class="small">${u.perfil === 'admin' ? 'Todos' : (u.modulos || []).map(nomeMod).map(esc).join(', ') || '<span class="muted">Nenhum</span>'}</td><td>${u.ativo === false ? pill('Desativado', 'ver') : pill('Ativo', 'ok')}</td><td><button class="btn sm" data-ed="${esc(u.id)}"><i class="ti ti-pencil"></i>Editar</button></td></tr>`).join('')}</tbody></table></div>`);
  $('#novo').onclick = () => editar(null);
  $$('[data-ed]').forEach(b => b.onclick = () => editar(lista.find(u => u.id === b.dataset.ed)));

  async function editar(u) {
    const novo = !u; u = u || { nome: '', email: '', perfil: 'usuario', modulos: ['pessoas'], ativo: true };
    const eu = u.id === ctx.uid;
    const corpo = `
      ${novo ? '' : `<div class="ajuda">Criado em ${fmtDataHora(u.criadoEm)}${u.alteradoEm ? ' · alterado em ' + fmtDataHora(u.alteradoEm) : ''}</div>`}
      <div class="linha2"><div class="campo"><label for="u-nome">Nome completo</label><input class="inp" id="u-nome" value="${esc(u.nome)}" required><span class="ajuda">Aparece em tudo o que a pessoa registrar.</span></div>
      <div class="campo"><label for="u-email">E-mail</label><input class="inp" id="u-email" type="email" value="${esc(u.email)}" ${novo ? '' : 'readonly'}></div></div>
      ${novo ? '<div class="campo"><label for="u-senha">Senha inicial</label><input class="inp" id="u-senha" type="text" minlength="8" placeholder="Mínimo de 8 caracteres"><span class="ajuda">Passe para a pessoa; ela pode trocar depois em "Esqueci minha senha".</span></div>' : ''}
      <div class="campo"><label for="u-perfil">Perfil</label><select class="inp" id="u-perfil" ${eu ? 'disabled' : ''}><option value="usuario"${u.perfil !== 'admin' ? ' selected' : ''}>Usuário (só os módulos marcados)</option><option value="admin"${u.perfil === 'admin' ? ' selected' : ''}>Administrador (tudo, inclusive usuários)</option></select></div>
      <div class="campo"><label for="u-setor">Setor na rescisão</label><select class="inp" id="u-setor"><option value="">Nenhum</option>${Object.entries(RESC_SETORES).map(([k, n]) => `<option value="${k}"${u.setorRescisao === k ? ' selected' : ''}>${n}</option>`).join('')}</select><span class="ajuda">Destaca para a pessoa os itens do desligamento que são do setor dela.</span></div>
      <div class="campo" id="u-mods-c"><label>Módulos liberados</label><div class="chk-grade">${MODULOS.filter(m => !m.perm).map(m => `<label title="${esc(m.desc)}"><input type="checkbox" value="${m.id}"${(u.modulos || []).includes(m.id) ? ' checked' : ''}> ${esc(m.nome)}</label>`).join('')}</div><span class="ajuda">"Dados sensíveis" libera CPF completo, salário, documentos pessoais, filiação e contato.</span></div>
      ${novo || eu ? '' : `<label class="chk-grade" style="grid-template-columns:1fr"><label><input type="checkbox" id="u-ativo"${u.ativo !== false ? ' checked' : ''}> Acesso ativo</label></label>`}
      <div id="u-msg"></div>`;
    const res = await modal({ titulo: novo ? 'Novo usuário' : 'Editar ' + u.nome, corpo, larga: true,
      botoes: [...(novo ? [] : [{ id: 'senha', texto: '<i class="ti ti-mail"></i>Enviar link de nova senha' }]), { id: 'cancelar', texto: 'Cancelar' }, { id: 'salvar', texto: novo ? 'Criar usuário' : 'Salvar', cls: 'prim' }],
      aoAbrir: bg => { const sync = () => { $('#u-mods-c', bg).style.opacity = $('#u-perfil', bg).value === 'admin' ? .45 : 1; }; $('#u-perfil', bg).onchange = sync; sync(); },
      antesDeFechar: async (id, bg) => {
        const msg = t => { $('#u-msg', bg).innerHTML = `<div class="erro-msg">${esc(t)}</div>`; return false; };
        if (id === 'senha') { try { await ctx.D.redefinirSenha(u.email); toast('Link enviado para ' + u.email); } catch (e) { return msg(erroAmigavel(e)); } return true; }
        const nome = $('#u-nome', bg).value.trim(), email = $('#u-email', bg).value.trim().toLowerCase(), perfil = eu ? 'admin' : $('#u-perfil', bg).value;
        const modulos = $$('#u-mods-c input:checked', bg).map(i => i.value);
        if (!nome) return msg('Preencha o nome completo.');
        if (novo) {
          const senha = $('#u-senha', bg).value;
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg('E-mail inválido.');
          if (senha.length < 8) return msg('A senha inicial precisa ter pelo menos 8 caracteres.');
          if (perfil !== 'admin' && !modulos.length) return msg('Marque pelo menos um módulo.');
          try { await ctx.D.criarUsuario({ nome, email, senha, perfil, modulos, setorRescisao: $('#u-setor', bg).value }); ctx.D.log('usuario_criado', email); toast('Usuário criado.'); }
          catch (e) { return msg(erroAmigavel(e)); }
        } else {
          const dados = { nome, perfil, modulos, setorRescisao: $('#u-setor', bg).value };
          const at = $('#u-ativo', bg); if (at) dados.ativo = at.checked;
          try { await ctx.D.salvarUsuario(u.id, dados); ctx.D.log('usuario_alterado', u.email); toast('Acessos salvos.'); }
          catch (e) { return msg(erroAmigavel(e)); }
        }
        return true;
      } });
    if (res === 'salvar') render(el, ctx);
  }
}
