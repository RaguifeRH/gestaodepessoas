// ============================================================================
// Camada de dados — todo acesso ao banco passa por aqui.
// Dois modos: Firebase (real) e demonstração (fictício, só neste navegador).
// ============================================================================
import { firebaseConfig, FB_VERSAO, DEMO, ADMIN_INICIAL } from './config.js?v=5';
import { itemResumo, montar } from './fo1029.js?v=5';

const agora = () => new Date().toISOString();
const LOTE = 400; // operações por lote de gravação (limite do Firestore é 500)

// ---------------------------------------------------------------------------
// FIREBASE
// ---------------------------------------------------------------------------
async function criarFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${FB_VERSAO}`;
  const [A, AU, F, S] = await Promise.all([
    import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`), import(`${base}/firebase-storage.js`),
  ]);
  const app = A.initializeApp(firebaseConfig);
  const auth = AU.getAuth(app);
  const db = F.getFirestore(app);
  const st = S.getStorage(app);
  const d = (...p) => F.doc(db, ...p);
  const c = (...p) => F.collection(db, ...p);
  const lerDoc = async (...p) => { const s = await F.getDoc(d(...p)); return s.exists() ? { id: s.id, ...s.data() } : null; };
  const lerCol = async (q) => (await F.getDocs(q)).docs.map(s => ({ id: s.id, ...s.data() }));
  let usuarioAuth = null;

  async function gravarEmLotes(ops, aoProgredir) {
    let feitos = 0;
    for (let i = 0; i < ops.length; i += LOTE) {
      const b = F.writeBatch(db);
      ops.slice(i, i + LOTE).forEach(o => b.set(o.ref, o.dados, o.merge ? { merge: true } : undefined));
      await b.commit();
      feitos += Math.min(LOTE, ops.length - i);
      aoProgredir && aoProgredir(feitos, ops.length);
    }
  }

  return {
    demo: false,
    // ---- login ----
    aoMudarLogin: cb => AU.onAuthStateChanged(auth, u => { usuarioAuth = u; cb(u ? { uid: u.uid, email: u.email, anonimo: u.isAnonymous } : null); }),
    entrarAnonimo: () => usuarioAuth ? Promise.resolve() : AU.signInAnonymously(auth),
    entrar: (email, senha) => AU.signInWithEmailAndPassword(auth, email, senha),
    criarMinhaConta: (email, senha) => AU.createUserWithEmailAndPassword(auth, email, senha),
    sair: () => AU.signOut(auth),
    redefinirSenha: email => AU.sendPasswordResetEmail(auth, email),
    uid: () => usuarioAuth && usuarioAuth.uid,

    // ---- sistema ----
    async sistemaConfigurado() { return !!(await lerDoc('config', 'sistema')); },
    async configurarPrimeiroAdmin(nome) {
      const u = usuarioAuth; if (!u) throw new Error('Entre primeiro.');
      if ((u.email || '').toLowerCase() !== ADMIN_INICIAL) throw new Error('Só ' + ADMIN_INICIAL + ' pode fazer o primeiro acesso.');
      const b = F.writeBatch(db);
      b.set(d('usuarios', u.uid), { nome, email: u.email, perfil: 'admin', modulos: [], ativo: true, criadoEm: agora(), criadoPor: u.uid });
      b.set(d('config', 'sistema'), { configuradoEm: agora(), configuradoPor: u.uid, versao: 1 });
      await b.commit();
    },

    lerConfig: id => lerDoc('config', id),
    salvarConfig: (id, dados) => F.setDoc(d('config', id), { ...dados, alteradoEm: agora() }, { merge: true }),

    // ---- usuários ----
    meuPerfil: () => usuarioAuth ? lerDoc('usuarios', usuarioAuth.uid) : null,
    listarUsuarios: () => lerCol(F.query(c('usuarios'), F.orderBy('nome'))),
    async criarUsuario({ nome, email, senha, perfil, modulos }) {
      // Segunda instância do app: cria a conta sem derrubar a sessão do administrador.
      const sec = A.initializeApp(firebaseConfig, 'sec-' + Date.now());
      try {
        const cred = await AU.createUserWithEmailAndPassword(AU.getAuth(sec), email, senha);
        await F.setDoc(d('usuarios', cred.user.uid), { nome, email: email.toLowerCase(), perfil, modulos, ativo: true, criadoEm: agora(), criadoPor: usuarioAuth.uid });
        await AU.signOut(AU.getAuth(sec));
        return cred.user.uid;
      } finally { try { await A.deleteApp(sec); } catch (e) {} }
    },
    salvarUsuario: (uid, dados) => F.updateDoc(d('usuarios', uid), { ...dados, alteradoEm: agora(), alteradoPor: usuarioAuth.uid }),

    // ---- pessoas ----
    resumo: () => lerDoc('resumos', 'pessoas'),
    pessoa: id => lerDoc('pessoas', id),
    privado: id => lerDoc('pessoas', id, 'privado', 'dados'),
    eventos: id => lerCol(F.query(c('pessoas', id, 'eventos'), F.orderBy('data', 'desc'))),
    novoEvento: (id, ev) => F.addDoc(c('pessoas', id, 'eventos'), { ...ev, porUid: usuarioAuth.uid, criadoEm: agora() }),
    anexos: id => lerCol(F.query(c('pessoas', id, 'anexos'), F.orderBy('criadoEm', 'desc'))),
    async enviarAnexo(id, arquivo, descricao, aoProgredir, porNome) {
      const caminho = `pessoas/${id}/${Date.now()}-${arquivo.name.replace(/[^\w.\-]+/g, '_')}`;
      const ref = S.ref(st, caminho);
      await new Promise((ok, erro) => {
        const t = S.uploadBytesResumable(ref, arquivo, { contentType: arquivo.type });
        t.on('state_changed', s => aoProgredir && aoProgredir(s.bytesTransferred / s.totalBytes), erro, ok);
      });
      await F.addDoc(c('pessoas', id, 'anexos'), { nome: arquivo.name, descricao, caminho, tamanho: arquivo.size, tipo: arquivo.type, porNome: porNome || '', porUid: usuarioAuth.uid, criadoEm: agora() });
    },
    urlAnexo: caminho => S.getDownloadURL(S.ref(st, caminho)),

    // ---- experiência ----
    async experiencias() { const l = await lerCol(c('experiencia')); return Object.fromEntries(l.map(x => [x.id, x])); },
    salvarExperiencia: (pid, dados) => F.setDoc(d('experiencia', pid), { ...dados, alteradoEm: agora() }, { merge: true }),

    // ---- importação do FO1029 ----
    async importar(pessoas, itensNovos, info, aoProgredir) {
      const atual = await lerDoc('resumos', 'pessoas');
      const mapa = new Map((atual?.itens || []).map(x => [x.i, x]));
      itensNovos.forEach(x => mapa.set(x.i, x));
      const itens = [...mapa.values()].sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));
      const ops = [];
      pessoas.forEach(p => {
        ops.push({ ref: d('pessoas', p.id), dados: { ...p.pub, atualizadoEm: agora() }, merge: true });
        ops.push({ ref: d('pessoas', p.id, 'privado', 'dados'), dados: { ...p.priv, atualizadoEm: agora() }, merge: true });
      });
      await gravarEmLotes(ops, aoProgredir);
      await F.setDoc(d('resumos', 'pessoas'), { itens, atualizadoEm: agora(), porUid: usuarioAuth.uid });
      await F.addDoc(c('importacoes'), { ...info, porUid: usuarioAuth.uid, criadoEm: agora() });
    },
    importacoes: () => lerCol(F.query(c('importacoes'), F.orderBy('criadoEm', 'desc'), F.limit(20))),

    // ---- coleções simples (vagas e seleção) ----
    listar: col => lerCol(c(col)),
    ler: (col, id) => lerDoc(col, id),
    lerSub: (col, id, sub, doc) => lerDoc(col, id, sub, doc),
    async criar(col, dados) { const r = await F.addDoc(c(col), { ...dados, criadoEm: agora(), porUid: usuarioAuth.uid }); return r.id; },
    definir: (col, id, dados) => F.setDoc(d(col, id), { ...dados, editadoEm: agora(), editadoPor: usuarioAuth.uid }, { merge: true }),
    definirSub: (col, id, sub, doc, dados) => F.setDoc(d(col, id, sub, doc), { ...dados, editadoEm: agora() }, { merge: true }),
    atualizar: (col, id, dados) => F.updateDoc(d(col, id), { ...dados, editadoEm: agora(), editadoPor: usuarioAuth.uid }),
    // Pedido público (gestor) e resposta do N2: sem login de usuário, com sessão anônima.
    async criarPublico(col, dados) { const r = await F.addDoc(c(col), dados); return r.id; },
    atualizarPublico: (col, id, dados) => F.updateDoc(d(col, id), dados),
    async proximoCodigo(chave) {
      return F.runTransaction(db, async t => {
        const r = d('config', 'contadores'); const sn = await t.get(r);
        const n = ((sn.exists() && sn.data()[chave]) || 0) + 1;
        t.set(r, { [chave]: n }, { merge: true }); return n;
      });
    },
    // Gravação em massa (migração dos sistemas antigos). ops: [{ caminho:[...], dados }]
    gravarLote: (ops, aoProgredir) => gravarEmLotes(ops.map(o => ({ ref: d(...o.caminho), dados: o.dados, merge: o.merge })), aoProgredir),
    anexosDe: (col, id) => lerCol(F.query(c(col, id, 'anexos'), F.orderBy('criadoEm', 'desc'))),
    async enviarAnexoEm(col, id, arquivo, descricao, aoProgredir, porNome) {
      const caminho = `${col}/${id}/${Date.now()}-${arquivo.name.replace(/[^\w.\-]+/g, '_')}`;
      const ref = S.ref(st, caminho);
      await new Promise((ok, erro) => { const t = S.uploadBytesResumable(ref, arquivo, { contentType: arquivo.type }); t.on('state_changed', s => aoProgredir && aoProgredir(s.bytesTransferred / s.totalBytes), erro, ok); });
      await F.addDoc(c(col, id, 'anexos'), { nome: arquivo.name, descricao, caminho, tamanho: arquivo.size, tipo: arquivo.type, porNome: porNome || '', porUid: usuarioAuth.uid, criadoEm: agora() });
    },

    // ---- registro de atividades ----
    log: (acao, detalhe) => F.addDoc(c('logs'), { acao, detalhe: detalhe || '', porUid: usuarioAuth.uid, criadoEm: agora() }).catch(() => {}),
  };
}

// ---------------------------------------------------------------------------
// DEMONSTRAÇÃO (dados fictícios no navegador)
// ---------------------------------------------------------------------------
async function criarDemo() {
  const CHAVE = 'gp-demo-v3';
  let B = null;
  try { B = JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) {}
  let soMemoria = false; // depois de importar um arquivo de verdade, nada mais é gravado no navegador
  const salvar = () => { if (soMemoria) return; try { localStorage.setItem(CHAVE, JSON.stringify(B)); } catch (e) { /* cheio ou bloqueado: segue em memória */ } };
  if (!B) { B = await semente(); salvar(); }
  const urls = {};
  let logado = null; try { logado = JSON.parse(sessionStorage.getItem('gp-demo-login') || 'null'); } catch (e) {}
  let ouvinte = null;
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));
  B.cols = B.cols || {}; B.subs = B.subs || {}; B.contadores = B.contadores || {};

  return {
    demo: true,
    aoMudarLogin: cb => { ouvinte = cb; setTimeout(() => cb(logado), 0); return () => {}; },
    async entrar(email) { await espera(200); logado = { uid: 'demo-admin', email: email || 'demo@raguife.com.br' }; try { sessionStorage.setItem('gp-demo-login', JSON.stringify(logado)); } catch (e) {} ouvinte && ouvinte(logado); },
    async criarMinhaConta(email) { return this.entrar(email); },
    async sair() { logado = null; try { sessionStorage.removeItem('gp-demo-login'); } catch (e) {} ouvinte && ouvinte(null); },
    async redefinirSenha() { await espera(200); },
    uid: () => logado && logado.uid,
    async sistemaConfigurado() { return true; },
    async configurarPrimeiroAdmin() {},
    async lerConfig(id) { return (B.config || {})[id] || null; },
    async salvarConfig(id, dados) { B.config = B.config || {}; B.config[id] = { ...(B.config[id] || {}), ...dados }; salvar(); },
    async meuPerfil() { return logado ? B.usuarios[logado.uid] : null; },
    async listarUsuarios() { return Object.entries(B.usuarios).map(([id, u]) => ({ id, ...u })).sort((a, b) => a.nome.localeCompare(b.nome)); },
    async criarUsuario(u) { const id = 'demo-' + Date.now(); B.usuarios[id] = { nome: u.nome, email: u.email, perfil: u.perfil, modulos: u.modulos, ativo: true, criadoEm: agora() }; salvar(); return id; },
    async salvarUsuario(uid, dados) { Object.assign(B.usuarios[uid], dados, { alteradoEm: agora() }); salvar(); },
    async resumo() { return B.resumo; },
    async pessoa(id) { return B.pessoas[id] ? { id, ...B.pessoas[id] } : null; },
    async privado(id) { return B.privado[id] || null; },
    async eventos(id) { return (B.eventos[id] || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')); },
    async novoEvento(id, ev) { (B.eventos[id] = B.eventos[id] || []).push({ id: 'e' + Date.now(), ...ev, porUid: logado.uid, criadoEm: agora() }); salvar(); },
    async anexos(id) { return (B.anexos[id] || []).slice().reverse(); },
    async enviarAnexo(id, arquivo, descricao, aoProgredir, porNome) {
      for (let p = 0; p <= 1; p += .25) { aoProgredir && aoProgredir(p); await espera(80); }
      const caminho = `demo/${id}/${Date.now()}-${arquivo.name}`; urls[caminho] = URL.createObjectURL(arquivo);
      (B.anexos[id] = B.anexos[id] || []).push({ id: 'a' + Date.now(), nome: arquivo.name, descricao, caminho, tamanho: arquivo.size, tipo: arquivo.type, porNome: porNome || '', porUid: logado.uid, criadoEm: agora() }); salvar();
    },
    async urlAnexo(caminho) { if (!urls[caminho]) throw new Error('No modo demonstração, o arquivo só fica disponível até fechar a página.'); return urls[caminho]; },
    async experiencias() { return JSON.parse(JSON.stringify(B.experiencia)); },
    async salvarExperiencia(pid, dados) { B.experiencia[pid] = Object.assign(B.experiencia[pid] || {}, JSON.parse(JSON.stringify(dados)), { alteradoEm: agora() }); salvar(); },
    async importar(pessoas, itensNovos, info, aoProgredir) {
      soMemoria = true; // dados reais no modo demonstração ficam só até fechar a página
      const mapa = new Map((B.resumo?.itens || []).map(x => [x.i, x])); itensNovos.forEach(x => mapa.set(x.i, x));
      let n = 0;
      for (const p of pessoas) { B.pessoas[p.id] = { ...(B.pessoas[p.id] || {}), ...p.pub, atualizadoEm: agora() }; B.privado[p.id] = { ...p.priv }; if (++n % 200 === 0) { aoProgredir && aoProgredir(n * 2, pessoas.length * 2); await espera(10); } }
      aoProgredir && aoProgredir(pessoas.length * 2, pessoas.length * 2);
      B.resumo = { itens: [...mapa.values()].sort((a, b) => a.n.localeCompare(b.n, 'pt-BR')), atualizadoEm: agora() };
      B.importacoes.unshift({ id: 'i' + Date.now(), ...info, porUid: logado.uid, criadoEm: agora() }); salvar();
    },
    async importacoes() { return B.importacoes.slice(0, 20); },
    async entrarAnonimo() {},
    async listar(col) { return Object.entries(B.cols[col] || {}).map(([id, x]) => ({ id, ...clone(x) })); },
    async ler(col, id) { const x = (B.cols[col] || {})[id]; return x ? { id, ...clone(x) } : null; },
    async lerSub(col, id, sub, doc) { return clone((B.subs[col + '/' + id + '/' + sub] || {})[doc] || null); },
    async criar(col, dados) { const id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); (B.cols[col] = B.cols[col] || {})[id] = { ...clone(dados), criadoEm: agora(), porUid: logado?.uid || 'anon' }; salvar(); return id; },
    async definir(col, id, dados) { const m = (B.cols[col] = B.cols[col] || {}); m[id] = { ...(m[id] || {}), ...clone(dados), editadoEm: agora() }; salvar(); },
    async definirSub(col, id, sub, doc, dados) { const k = col + '/' + id + '/' + sub; const m = (B.subs[k] = B.subs[k] || {}); m[doc] = { ...(m[doc] || {}), ...clone(dados) }; salvar(); },
    async atualizar(col, id, dados) { const m = B.cols[col] || {}; if (!m[id]) throw new Error('Registro não encontrado.'); Object.assign(m[id], clone(dados), { editadoEm: agora() }); salvar(); },
    async criarPublico(col, dados) { return this.criar(col, dados); },
    async atualizarPublico(col, id, dados) { const m = B.cols[col] || {}; Object.assign(m[id], clone(dados)); salvar(); },
    async proximoCodigo(chave) { B.contadores[chave] = (B.contadores[chave] || 0) + 1; salvar(); return B.contadores[chave]; },
    async gravarLote(ops, aoProgredir) {
      soMemoria = true; let n = 0;
      for (const o of ops) {
        const [col, id, sub, doc] = o.caminho;
        if (sub) { const k = col + '/' + id + '/' + sub; (B.subs[k] = B.subs[k] || {})[doc] = clone(o.dados); }
        else if (col === 'config') B.config[id] = { ...(o.merge ? B.config[id] || {} : {}), ...clone(o.dados) };
        else { const m = (B.cols[col] = B.cols[col] || {}); m[id] = { ...(o.merge ? m[id] || {} : {}), ...clone(o.dados) }; }
        if (++n % 300 === 0) { aoProgredir && aoProgredir(n, ops.length); await espera(5); }
      }
      aoProgredir && aoProgredir(ops.length, ops.length);
    },
    async anexosDe(col, id) { return (B.anexos[col + '/' + id] || []).slice().reverse(); },
    async enviarAnexoEm(col, id, arquivo, descricao, aoProgredir, porNome) {
      for (let p = 0; p <= 1; p += .25) { aoProgredir && aoProgredir(p); await espera(60); }
      const caminho = `demo/${col}/${id}/${Date.now()}-${arquivo.name}`; urls[caminho] = URL.createObjectURL(arquivo);
      (B.anexos[col + '/' + id] = B.anexos[col + '/' + id] || []).push({ id: 'a' + Date.now(), nome: arquivo.name, descricao, caminho, tamanho: arquivo.size, tipo: arquivo.type, porNome: porNome || '', criadoEm: agora() }); salvar();
    },
    async log() {},
    async zerarDemo() { try { localStorage.removeItem(CHAVE); } catch (e) {} B = await semente(); salvar(); },
  };
}

// Pessoas fictícias no formato do FO1029, montadas pelo mesmo código da importação real.
async function semente() {
  const nomes = ['Ana Paula Ribeiro','Bruno Teixeira','Camila Rocha','Diego Fontes','Elaine Martins','Fábio Lopes','Gabriela Souza','Henrique Alves','Isabela Nunes','João Pedro Lima','Karina Duarte','Lucas Pereira','Mariana Castro','Nelson Prado','Olívia Mendes','Paulo Henrique Dias','Renata Lima','Sérgio Moraes','Tatiane Gomes','Vinícius Rocha','Wesley Carvalho','Yasmin Torres','André Siqueira','Beatriz Costa','Carlos Menezes','Daniela Reis','Eduardo Faria','Fernanda Castro','Gustavo Neves','Helena Prado','Igor Batista','Juliana Prado','Kleber Antunes','Larissa Monteiro','Marcos Vieira','Natália Freitas','Otávio Brandão','Patrícia Lemos','Rafael Duarte','Simone Araújo'];
  const filiais = [['RAGUIFE - MATRIZ', 'RAGUIFE INDUSTRIA E COMERCIO DE RACOES'], ['FILIAL BOM DESPACHO', 'RAGUIFE INDUSTRIA E COMERCIO DE RACOES'], ['NOVA ASSESSORIA', 'NOVA ASSESSORIA E CONSULTORIA EMPRESARIAL LTDA']];
  const setores = [['TRANSPORTE', 'MOTORISTA DE CAMINHAO', '3 - Sind dos Motoristas'], ['TRANSPORTE', 'AJUDANTE DE MOTORISTA', '3 - Sind dos Motoristas'], ['PRODUCAO', 'OPERADOR DE PRODUCAO', '4 - Sind Alimentação'], ['HIGIENIZACAO', 'FAXINEIRO(A) INDUSTRIAL', '4 - Sind Alimentação'], ['RECURSOS HUMANOS', 'ANALISTA DE RH', '1 - Sindicato Base'], ['FATURAMENTO', 'ASSISTENTE DE FATURAMENTO', '1 - Sindicato Base']];
  const hoje = new Date(); const dt = dias => { const x = new Date(hoje); x.setDate(x.getDate() - dias); return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`; };
  const linhas = []; let mat = 7000;
  nomes.forEach((n, i) => {
    const f = filiais[i % 7 === 0 ? 1 : i % 11 === 0 ? 2 : 0], s = setores[i % setores.length];
    const cpf = String(10000000000 + i * 7919337).slice(0, 11);
    const base = { 'Empresa': f[1], 'Filial': f[0], 'Estrutura': s[0], 'Cargo': s[1], 'Função': s[1], 'CBO': '', 'Sindicato': s[2], 'CPF': cpf, 'Nome': n.toUpperCase(), 'Tipo': i % 13 === 0 ? 'Menor Aprendiz' : 'Normal', 'Sexo': i % 2 ? 'Masculino' : 'Feminino', 'Est. Civil': 'Solteiro', 'Naturalidade': 'Jales/SP', 'Nacionalidade': 'Brasileira', 'Grau Instrução': 'Ensino Médio completo', 'Dt. Nascimento': dt(9000 + i * 97), 'Identidade': '00.000.000-0', 'Nome Mãe': 'Nome fictício', 'Nome Pai': 'Nome fictício', 'Endereço': 'Rua Fictícia, nº ' + (100 + i), 'Tel. Celular': '(17) 90000-0000', 'E-mail': '' };
    const admDias = [3, 9, 31, 44, 46, 58, 61, 88, 90, 95][i] ?? (120 + i * 41);
    if (i === 5) linhas.push({ ...base, 'Matrícula': String(mat++), 'Status': 'Demitido', 'Dt. Admissão': dt(1500), 'Dt. Demissão': dt(1100), 'Tipo Demissão': 'Iniciativa do Empregado sem Justa Causa', 'Salário': 1900 });
    const deslig = i > 33;
    linhas.push({ ...base, 'Matrícula': String(mat++), 'Status': deslig ? 'Demitido' : (i === 20 ? 'Férias' : i === 27 ? 'Afastado pela Previdência' : 'Ativo'), 'Dt. Admissão': dt(admDias), 'Dt. Demissão': deslig ? dt(10 + i) : '', 'Tipo Demissão': deslig ? 'Término de Contrato de Trabalho' : '', 'Salário': 1800 + (i % 6) * 650 });
  });
  const { pessoas, itens } = await montar(linhas);
  const B = { usuarios: { 'demo-admin': { nome: 'Usuário de demonstração', email: 'demo@raguife.com.br', perfil: 'admin', modulos: [], ativo: true }, 'demo-rh': { nome: 'Renata Lima Duarte', email: 'renata@raguife.com.br', perfil: 'usuario', modulos: ['pessoas', 'experiencia', 'painel_rh'], ativo: true } },
    pessoas: {}, privado: {}, eventos: {}, anexos: {}, experiencia: {}, resumo: { itens, atualizadoEm: agora() }, importacoes: [], logs: [],
    config: { experiencia: { inicio: (() => { const x = new Date(); x.setDate(x.getDate() - 40); return x.toISOString().slice(0, 10); })() } } };
  pessoas.forEach(p => { B.pessoas[p.id] = p.pub; B.privado[p.id] = p.priv; });
  sementeSelecao(B);
  return B;
}

// Pedidos, vagas e candidatos fictícios para o modo demonstração.
function sementeSelecao(B) {
  B.cols = {}; B.subs = {};
  const ag = (dias, h = 9) => { const x = new Date(); x.setDate(x.getDate() + dias); x.setHours(h, 0, 0, 0); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  const dia = d => ag(d).slice(0, 10);
  const quem = 'Renata Lima Duarte';
  B.config.selecao = { setores: ['Transporte', 'Produção', 'Manutenção', 'Expedição', 'Administrativo', 'Recursos Humanos'], escalas: ['6x1 · 07h às 15h20', '6x1 · 15h20 às 23h40', 'Segunda a sexta · comercial', '12x36'], perfis: [{ nome: 'Operacional', sla: 10 }, { nome: 'Administrativo', sla: 15 }, { nome: 'Motorista', sla: 30 }, { nome: 'Manutenção', sla: 25 }] };
  B.config.selecao_n2 = { lista: [{ nome: 'Carlos Menezes', email: 'carlos.menezes@raguife.com.br', setor: 'Transporte' }, { nome: 'Helena Prado', email: 'helena.prado@raguife.com.br', setor: 'Produção' }] };
  B.contadores = { vaga_2026: 3, sol_2026: 4 };
  B.cols.solicitacoes = {
    s1: { codigo: 'SOL-2026-004', gestor: 'Marcos Vieira', email: 'marcos.vieira@raguife.com.br', empresa: 'RAGUIFE INDUSTRIA E COMERCIO DE RACOES LTDA', setor: 'Expedição', cargo: 'Auxiliar de expedição', motivo: 'Aumento de quadro', qtd: 2, escala: '6x1 · 07h às 15h20', substituido: '', requisitos: 'Ensino fundamental, disponibilidade de horário.', obs: 'Aumento da produção no fim do ano.', status: 'pendente', historico: [{ dt: new Date().toISOString(), acao: 'Pedido enviado pelo gestor', por: 'Marcos Vieira' }], criadoEm: new Date().toISOString() },
    s2: { codigo: 'SOL-2026-003', gestor: 'Igor Batista', email: 'igor.batista@raguife.com.br', empresa: 'RAGUIFE INDUSTRIA E COMERCIO DE RACOES LTDA', setor: 'Transporte', cargo: 'Motorista de truck', motivo: 'Substituição', qtd: 1, escala: '6x1 · 07h às 15h20', substituido: 'Kleber Antunes', requisitos: 'CNH D, curso MOPP.', obs: '', status: 'com_n2', n2Nome: 'Carlos Menezes', n2Email: 'carlos.menezes@raguife.com.br', historico: [{ dt: ag(-3), acao: 'Pedido enviado pelo gestor', por: 'Igor Batista' }, { dt: ag(-3, 11), acao: 'Encaminhado ao N2 Carlos Menezes', por: quem }], criadoEm: ag(-3) },
    s3: { codigo: 'SOL-2026-002', gestor: 'Helena Prado', email: 'helena.prado@raguife.com.br', empresa: 'RAGUIFE INDUSTRIA E COMERCIO DE RACOES LTDA', setor: 'Produção', cargo: 'Operador de produção', motivo: 'Reposição', qtd: 1, escala: '6x1 · 15h20 às 23h40', substituido: '', requisitos: '', obs: '', status: 'aprovado_n2', n2Nome: 'Helena Prado', n2Resposta: { decisao: 'aprovado', em: ag(-1), obs: '' }, historico: [{ dt: ag(-2), acao: 'Pedido enviado pelo gestor', por: 'Helena Prado' }, { dt: ag(-1), acao: 'N2 aprovou', por: 'Helena Prado' }], criadoEm: ag(-2) },
  };
  B.cols.vagas = {
    v1: { codigo: 'RH-2026-003', cargo: 'Ajudante de motorista', setor: 'Transporte', empresa: 'RAGUIFE INDUSTRIA E COMERCIO DE RACOES LTDA', perfil: 'Operacional', motivo: 'Aumento de quadro', qtd: 2, escala: '6x1 · 07h às 15h20', gestor: 'Carlos Menezes', abertura: dia(-6), sla: 10, status: 'aberta', requisitos: 'Ensino fundamental.', criadoEm: ag(-6) },
    v2: { codigo: 'RH-2026-002', cargo: 'Assistente de faturamento', setor: 'Administrativo', empresa: 'RAGUIFE INDUSTRIA E COMERCIO DE RACOES LTDA', perfil: 'Administrativo', motivo: 'Substituição', qtd: 1, escala: 'Segunda a sexta · comercial', gestor: 'Daniela Reis', abertura: dia(-20), sla: 15, status: 'aberta', criadoEm: ag(-20) },
    v3: { codigo: 'RH-2026-001', cargo: 'Mecânico industrial', setor: 'Manutenção', empresa: 'RAGUIFE INDUSTRIA E COMERCIO DE RACOES LTDA', perfil: 'Manutenção', motivo: 'Reposição', qtd: 1, escala: '6x1 · 07h às 15h20', gestor: 'Gustavo Neves', abertura: dia(-40), sla: 25, status: 'encerrada', criadoEm: ag(-40) },
  };
  const C = (nome, vaga, etapa, extra = {}) => ({ nome, tel: '(17) 9' + String(Math.abs(nome.length * 7919) % 10000).padStart(4, '0') + '-0000', cidade: 'Jales/SP', area: extra.area || '', origem: extra.origem || 'WhatsApp', vagaId: vaga, etapa, situacao: 'andamento', datas: {}, checks: {}, historico: [{ etapa, em: ag(-2), porNome: quem }], porNome: quem, criadoEm: ag(-5), ...extra });
  B.cols.candidatos = {
    c1: C('Bruno Teixeira', 'v1', 'ent_ag', { origem: 'Indicação', indicadoPor: 'Wesley Carvalho', datas: { entrevista: ag(0, 14) } }),
    c2: C('Larissa Monteiro', 'v1', 'ent_ag', { datas: { entrevista: ag(1, 9) } }),
    c3: C('Patrícia Lemos', 'v1', 'ent_re', { cpfMasc: '***.481.226-**', resultadoEntrevista: 'apto', checks: { ficha: 'recebida' }, datas: { entrevista: ag(-1, 10) } }),
    c4: C('Juliana Prado', 'v1', 'teste_ag', { datas: { teste: ag(2, 8) }, checks: { ficha: 'recebida' } }),
    c5: C('Marcos Ribeiro', 'v2', 'docs', { cpfMasc: '***.318.507-**', checks: { ficha: 'recebida', termo: 'assinado', avaliacaoGestor: 'aprovado', interesse: 'sim', checklistDocs: 'enviado' }, datas: { exame: dia(1) } }),
    c6: C('Camila Rocha', 'v2', 'integracao', { cpfMasc: '***.902.114-**', datas: { integracao: ag(4, 7) } }),
    c7: C('Felipe Nunes', 'v1', 'ent_re', { situacao: 'reprovado', motivo: 'Requisitos técnicos', area: 'Logística', datas: { entrevista: ag(-4, 9) } }),
    c8: C('Sandra Matos', 'v2', 'teste_re', { situacao: 'desistiu', motivo: 'Outra proposta', area: 'Administrativo', retorno: { em: ag(-1), porNome: quem } }),
    c9: C('Diego Fontes', null, 'triagem', { situacao: 'banco', area: 'Logística', origem: 'Currículo espontâneo', obs: 'CNH E, experiência com empilhadeira.' }),
    c10: C('Aline Moraes', null, 'triagem', { situacao: 'banco', area: 'Administrativo', origem: 'Indicação', cidade: 'Fernandópolis/SP' }),
  };
  Object.values(B.cols.candidatos).forEach(c => { const v = B.cols.vagas[c.vagaId]; if (v) { c.vagaCodigo = v.codigo; c.vagaCargo = v.cargo; } });
}

export const D = DEMO ? await criarDemo() : await criarFirebase();
export { itemResumo };
