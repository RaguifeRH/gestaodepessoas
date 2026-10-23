// ============================================================================
// Leitura do FO1029 (Planilha de Dados Cadastrais de Funcionários)
// Monta o cadastro único: uma pessoa por CPF, com todos os vínculos.
// Dados bancários NÃO são importados.
// ============================================================================

export const SO_DIGITOS = s => String(s ?? '').replace(/\D/g, '');

// Mesmo cálculo do Portal de Benefícios: SHA-256 de 'rgf:' + CPF (só dígitos).
export async function hashCpf(cpf) {
  const d = SO_DIGITOS(cpf).padStart(11, '0');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('rgf:' + d));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function mascararCpf(cpf) {
  const d = SO_DIGITOS(cpf).padStart(11, '0');
  return '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**';
}
export function formatarCpf(cpf) {
  const d = SO_DIGITOS(cpf).padStart(11, '0');
  return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
}

// dd/mm/aaaa (ou número de data do Excel) -> aaaa-mm-dd
export function dataISO(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && window.XLSX) {
    const p = XLSX.SSF.parse_date_code(v); if (!p) return '';
    return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const iso = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : '';
}
const SIGLAS = /\b(Rh|Dp|Ti|Ltda|Cnh|Pcd|Sesmt|Epp|Mb)\b/g;
const capitalizar = n => String(n || '').toLowerCase().replace(/(^|\s|-|\()([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase()).replace(/ (De|Da|Do|Das|Dos|E)(?= )/g, m => m.toLowerCase()).replace(SIGLAS, m => m.toUpperCase());
const txt = v => (v === null || v === undefined) ? '' : String(v).trim();
const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; };

// Grupo de situação a partir do Status da folha.
export function grupoSituacao(status) {
  const s = (status || '').toLowerCase();
  if (s.startsWith('demitido')) return 'desligado';
  if (s.includes('rescisão') || s.includes('rescisao') || s.includes('aguardando cálculo') || s.includes('aguardando calculo')) return 'desligando';
  if (s.includes('afastado') || s.includes('aposentado')) return 'afastado';
  return 'ativo';
}
export const NOME_GRUPO = { ativo:'Ativo', afastado:'Afastado', desligando:'Em desligamento', desligado:'Desligado' };

// Colunas esperadas (cabeçalho na linha 2 do relatório).
const OBRIGATORIAS = ['CPF', 'Nome', 'Matrícula', 'Status', 'Dt. Admissão', 'Filial', 'Cargo'];

// Lê o arquivo e devolve as linhas como objetos { 'Coluna': valor }.
export async function lerArquivo(file) {
  if (!window.XLSX) throw new Error('Leitor de planilhas não carregou. Verifique a internet e tente de novo.');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  const iCab = matriz.findIndex(l => l.some(c => txt(c) === 'CPF') && l.some(c => txt(c) === 'Nome'));
  if (iCab < 0) throw new Error('Não encontrei o cabeçalho do FO1029 (colunas CPF e Nome). Confira se é a "Planilha de Dados Cadastrais de Funcionários".');
  const cab = matriz[iCab].map(txt);
  const falta = OBRIGATORIAS.filter(c => !cab.includes(c));
  if (falta.length) throw new Error('Faltam colunas no arquivo: ' + falta.join(', ') + '.');
  return matriz.slice(iCab + 1).filter(l => l.some(c => txt(c))).map(l => Object.fromEntries(cab.map((c, i) => [c, l[i]])));
}

// Monta pessoas a partir das linhas. Devolve { pessoas:[{id,pub,priv}], itens:[resumo], stats }.
export async function montar(linhas, filiaisPermitidas) {
  const porCpf = new Map(); let ignoradas = 0;
  for (const l of linhas) {
    const cpf = SO_DIGITOS(l['CPF']);
    if (cpf.length < 9) { ignoradas++; continue; }
    if (filiaisPermitidas && !filiaisPermitidas.includes(txt(l['Filial']))) continue; // nomes originais do arquivo
    if (!porCpf.has(cpf)) porCpf.set(cpf, []);
    porCpf.get(cpf).push(l);
  }
  // O FO1029 repete a mesma matrícula quando muda salário, setor ou cargo; a última linha é a mais recente.
  for (const [cpf, ls] of porCpf) {
    const porMat = new Map(); ls.forEach(l => porMat.set(txt(l['Matrícula']) || Symbol(), l));
    porCpf.set(cpf, [...porMat.values()]);
  }
  const pessoas = [], itens = [];
  const stats = { linhas: linhas.length, ignoradas, pessoas: 0, recontratados: 0, porGrupo: {}, porFilial: {} };
  for (const [cpf, ls] of porCpf) {
    const vinc = ls.map(l => ({
      matricula: txt(l['Matrícula']), chapa: txt(l['Chapa']), codPessoa: txt(l['Cód. Pessoa']),
      empresa: capitalizar(txt(l['Empresa'])), filial: capitalizar(txt(l['Filial'])), codEstrutura: txt(l['Cód. Estrutura']), setor: capitalizar(txt(l['Estrutura'])),
      cargo: capitalizar(txt(l['Cargo'])), funcao: capitalizar(txt(l['Função'])), cbo: txt(l['CBO']), tipo: txt(l['Tipo']), status: txt(l['Status']),
      grupo: grupoSituacao(txt(l['Status'])), admissao: dataISO(l['Dt. Admissão']), demissao: dataISO(l['Dt. Demissão']),
      tipoDemissao: txt(l['Tipo Demissão']), sindicato: txt(l['Sindicato']), _salario: num(l['Salário']),
    })).sort((a, b) => (a.admissao || '').localeCompare(b.admissao || ''));
    const atual = [...vinc].reverse().find(v => v.grupo !== 'desligado') || vinc[vinc.length - 1];
    const l0 = ls.find(x => txt(x['Matrícula']) === atual.matricula) || ls[ls.length - 1];
    const id = await hashCpf(cpf);
    const nasc = dataISO(l0['Dt. Nascimento']);
    const salarios = Object.fromEntries(vinc.map(v => [v.matricula, v._salario]));
    vinc.forEach(v => delete v._salario);
    const pub = {
      nome: capitalizar(txt(l0['Nome'])), cpfMasc: mascararCpf(cpf), nascMMDD: nasc ? nasc.slice(5) : '',
      sexo: txt(l0['Sexo']), estCivil: txt(l0['Est. Civil']), naturalidade: txt(l0['Naturalidade']),
      nacionalidade: txt(l0['Nacionalidade']), escolaridade: txt(l0['Grau Instrução']),
      vinculos: vinc, atual, grupo: atual.grupo, fonte: 'FO1029',
    };
    const priv = {
      cpf: SO_DIGITOS(cpf).padStart(11, '0'), nascimento: nasc,
      rg: txt(l0['Identidade']), rgEmissor: txt(l0['Emissor Identidade']), rgData: dataISO(l0['Dt Emiss. Identidade']),
      ctps: txt(l0['Nro CTPS']), ctpsSerie: txt(l0['Série CTPS']), ctpsData: dataISO(l0['Data CTPS']), ctpsUf: txt(l0['UF CTPS']),
      titulo: txt(l0['Título Eleitor']), zona: txt(l0['Zona']), secao: txt(l0['Seção']),
      pis: txt(l0['PIS-PASEP']), pisData: dataISO(l0['Data PIS-PASEP']), reservista: txt(l0['Reservista']),
      pai: capitalizar(txt(l0['Nome Pai'])), mae: capitalizar(txt(l0['Nome Mãe'])), endereco: txt(l0['Endereço']),
      celular: txt(l0['Tel. Celular']), telefone: txt(l0['Tel. Residencial']), email: txt(l0['E-mail']),
      salarioAtual: salarios[atual.matricula] ?? null, salarios,
    };
    pessoas.push({ id, pub, priv });
    itens.push(itemResumo(id, pub));
    stats.pessoas++; if (vinc.length > 1) stats.recontratados++;
    stats.porGrupo[atual.grupo] = (stats.porGrupo[atual.grupo] || 0) + 1;
    if (atual.grupo !== 'desligado') stats.porFilial[atual.filial] = (stats.porFilial[atual.filial] || 0) + 1;
  }
  itens.sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));
  return { pessoas, itens, stats };
}

// Linha compacta usada nas listas, painéis e busca (um único documento para todos).
export function itemResumo(id, pub) {
  const a = pub.atual || {};
  return { i: id, n: pub.nome, cm: pub.cpfMasc, m: a.matricula || '', e: a.empresa || '', f: a.filial || '', s: a.setor || '', c: a.cargo || '',
    t: a.tipo || '', st: a.status || '', g: pub.grupo || a.grupo || '', a: a.admissao || '', d: a.demissao || '', b: pub.nascMMDD || '', x: pub.sexo || '',
    v: (pub.vinculos || []).map(v => (v.admissao || '') + '|' + (v.demissao || '')) }; // texto 'adm|dem' (o Firestore não aceita lista dentro de lista)
}

// Filiais presentes no arquivo (para escolher o que importar).
export function filiaisDasLinhas(linhas) {
  const c = {}; linhas.forEach(l => { const f = txt(l['Filial']); if (f) c[f] = (c[f] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
