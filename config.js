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
  { id:'pessoas',     nome:'Pessoas e dossiê',      grupo:'Jornada do colaborador', ic:'ti-folder-open',  acc:'verde', desc:'Busca, ficha, vínculos, linha do tempo e documentos.' },
  { id:'experiencia', nome:'Experiência',           grupo:'Jornada do colaborador', ic:'ti-hourglass',    acc:'verde', desc:'Marcos de 10, 30, 45, 60 e 90 dias.' },
  { id:'painel_rh',   nome:'Painel de RH',          grupo:'Indicadores',            ic:'ti-chart-bar',    acc:'verde', desc:'Headcount, admissões, desligamentos e turnover.' },
  { id:'importar',    nome:'Importar FO1029',       grupo:'Administração',          ic:'ti-file-import',  acc:'verde', desc:'Atualiza o cadastro único pelo relatório da folha.' },
  { id:'sensiveis',   nome:'Dados sensíveis',       grupo:null,                     ic:'ti-lock',         acc:'verde', desc:'Ver CPF completo, salário, documentos pessoais, filiação e contato.' },
];
// Telas só do administrador.
export const MODULOS_ADMIN = [
  { id:'usuarios', nome:'Usuários e acessos', grupo:'Administração', ic:'ti-shield-lock', acc:'verde' },
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
