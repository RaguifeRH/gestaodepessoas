// ============================================================================
// Configuração do sistema Gestão de Pessoas — Raguife
// ============================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyBOMp11sdry5ElIXGsuPUvlv2vM7XWEtCI",
  authDomain: "raguife-pessoas.firebaseapp.com",
  projectId: "raguife-pessoas",
  storageBucket: "raguife-pessoas.firebasestorage.app",
  messagingSenderId: "296817953401",
  appId: "1:296817953401:web:100205e7bb031958a0e2a8"
};

// Único e-mail que pode fazer o primeiro acesso e virar administrador.
export const ADMIN_INICIAL = 'rh@raguife.com.br';

// Versão do SDK do Firebase (módulos via CDN oficial).
export const FB_VERSAO = '10.12.2';

// Modo demonstração: abra o sistema com ?demo no endereço.
// Usa dados fictícios guardados só neste navegador. Nada vai para o Firebase.
export const DEMO = /[?&]demo\b/.test(location.search);

// Módulos que existem nesta etapa. A chave é o que se libera por usuário.
export const MODULOS = [
  { id:'solicitacoes', perm:'selecao', nome:'Pedidos de vaga',   grupo:'Jornada do colaborador', ic:'ti-file-plus',    acc:'verde' },
  { id:'vagas',        perm:'selecao', nome:'Vagas e seleção',   grupo:'Jornada do colaborador', ic:'ti-user-search',  acc:'verde' },
  { id:'curriculos',   perm:'selecao', nome:'Banco de currículos', grupo:'Jornada do colaborador', ic:'ti-id-badge-2', acc:'verde' },
  { id:'agenda',       perm:'selecao', nome:'Agenda do R&S',     grupo:'Jornada do colaborador', ic:'ti-calendar',     acc:'verde' },
  { id:'selecao',     nome:'Vagas e seleção (R&S)', grupo:null, ic:'ti-user-search', acc:'verde', desc:'Pedidos de vaga, aprovação do N2, vagas, candidatos, banco de currículos e agenda.' },
  { id:'pessoas',     nome:'Pessoas e dossiê',      grupo:'Jornada do colaborador', ic:'ti-folder-open',  acc:'verde', desc:'Busca, ficha, vínculos, linha do tempo e documentos.' },
  { id:'experiencia', nome:'Experiência',           grupo:'Jornada do colaborador', ic:'ti-hourglass',    acc:'verde', desc:'Marcos de 10, 30, 45, 60 e 90 dias.' },
  { id:'painel_rh',   nome:'Painel de RH',          grupo:'Indicadores',            ic:'ti-chart-bar',    acc:'verde', desc:'Headcount, admissões, desligamentos e turnover.' },
  { id:'importar',    nome:'Importar FO1029',       grupo:'Administração',          ic:'ti-file-import',  acc:'verde', desc:'Atualiza o cadastro único pelo relatório da folha.' },
  { id:'sensiveis',   nome:'Dados sensíveis',       grupo:null,                     ic:'ti-lock',         acc:'verde', desc:'Ver CPF completo, salário, documentos pessoais, filiação e contato.' },
];
// Telas só do administrador.
export const MODULOS_ADMIN = [
  { id:'usuarios', nome:'Usuários e acessos', grupo:'Administração', ic:'ti-shield-lock', acc:'verde' },
  { id:'migracao', nome:'Dados dos sistemas antigos', grupo:'Administração', ic:'ti-database-import', acc:'verde' },
];

// Tipos de registro do dossiê (vindos do novaRH).
export const TIPOS_EVENTO = [
  'Admissão','Integração','Avaliação período de experiência','Feedback','Elogio / reconhecimento','Advertência','Suspensão',
  'Orientação corretiva','Acidente de trabalho','Atestado médico','Afastamento','Treinamento','DDS - Diálogo de Segurança',
  'DDQ - Diálogo de Qualidade','DSP - Diálogo de Segurança Psicológica','Ginástica laboral','CIPA — entrada','CIPA — saída',
  'Brigadista — entrada','Brigadista — saída','Multiplicador — entrada','Multiplicador — saída','Promoção / movimentação',
  'Avaliação de desempenho','Pesquisa de desligamento','Desligamento','Outro'
];

// Marcos da experiência (dias após a admissão).
export const MARCOS = [
  { id:'d10', dia:10, nome:'Contato dos 10 dias', tipo:'contato' },
  { id:'d30', dia:30, nome:'Contato dos 30 dias', tipo:'contato' },
  { id:'d45', dia:45, nome:'Avaliação do gestor e pesquisa dos 45 dias', tipo:'avaliacao' },
  { id:'d60', dia:60, nome:'Contato dos 60 dias', tipo:'contato' },
  { id:'d90', dia:90, nome:'Pesquisa dos 90 dias e efetivação', tipo:'efetivacao' },
];

// ---------------------------------------------------------------------------
// Vagas e seleção
// ---------------------------------------------------------------------------
// Etapas do kanban (mesma ordem do R&S antigo; 'leg' é o número da etapa no sistema antigo).
export const ETAPAS = [
  { id:'triagem',    nome:'Triagem',              cor:'#e3eedb', leg:0, ic:'ti-inbox' },
  { id:'ent_ag',     nome:'Entrevista agendada',  cor:'#d6ebb4', leg:1, ic:'ti-calendar-event' },
  { id:'ent_re',     nome:'Entrevista realizada', cor:'#b9db7f', leg:2, ic:'ti-clipboard-check' },
  { id:'teste_ag',   nome:'Teste agendado',       cor:'#9dcd46', leg:3, ic:'ti-calendar-event' },
  { id:'teste_re',   nome:'Teste realizado',      cor:'#7fae2c', leg:4, ic:'ti-clipboard-list' },
  { id:'docs',       nome:'Docs / exame',         cor:'#5c9a3e', leg:5, ic:'ti-file-text' },
  { id:'exame',      nome:'Exame recebido',       cor:'#3f8f5a', leg:6, ic:'ti-circle-check' },
  { id:'integracao', nome:'Integração agendada',  cor:'#024f2b', leg:7, ic:'ti-users' },
];
export const MOTIVOS_REPROVA = ['Requisitos técnicos','Requisitos comportamentais','Faltou à entrevista / teste','Background check','Pretensão salarial','Outra proposta','Disponibilidade de horário','Problemas de saúde','Motivos pessoais','Outro'];
export const ORIGENS = ['WhatsApp','Indicação','Indeed','LinkedIn','InHire','Currículo espontâneo','Feirão de vagas','Hunter','Banco de currículos','Site','Outro'];
export const MOTIVOS_VAGA = ['Substituição','Reposição','Aumento de quadro','Outro'];
export const EMPRESAS_PADRAO = ['RAGUIFE INDUSTRIA E COMERCIO DE RACOES LTDA','NEVES QUEIROZ ASSESSORIA E CONSULTORIA EMPRESARIAL LTDA','DISTRIBUIDORA AMBAR AMARAL LTDA','AMBAR AMARAL ADMINISTRADORA DE BENS PROPRIOS LTDA','M B PRONI DO AMARAL CONSTRUCOES E ACABAMENTOS'];
export const PERFIS_PADRAO = [{ nome:'Operacional', sla:10 },{ nome:'Administrativo', sla:15 },{ nome:'Ajudante de motorista', sla:15 },{ nome:'Motorista', sla:30 },{ nome:'Manutenção', sla:25 },{ nome:'Gestão', sla:30 },{ nome:'PCD', sla:45 }];
export const STATUS_SOL = {
  pendente:     ['Nova', 'hoje'],
  com_n2:       ['Com o N2', 'pend'],
  aprovado_n2:  ['N2 aprovou', 'ok'],
  reprovado_n2: ['N2 reprovou', 'atr'],
  aprovado:     ['Vaga aberta', 'ok'],
  reprovado:    ['Reprovada pelo RH', 'atr'],
};
export const STATUS_VAGA = { aberta:['Aberta','ok'], pausada:['Pausada','hoje'], encerrada:['Encerrada',''], cancelada:['Cancelada','atr'] };
