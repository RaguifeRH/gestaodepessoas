# Gestão de Pessoas — Raguife · Etapas 1 a 3

Sistema único de Gestão de Pessoas do Grupo Raguife, ligado ao Firebase **raguife-pessoas**.

## O que já funciona nesta etapa

- **Login**, primeiro acesso do administrador (rh@raguife.com.br) e "Esqueci minha senha".
- **Usuários e acessos**: criar usuários, liberar módulos, desativar acesso.
- **Importar FO1029**: lê a planilha da folha, mostra um resumo, deixa escolher as filiais e grava. Uma pessoa por CPF, com todos os vínculos (recontratações). Dados bancários não são importados.
- **Pessoas e dossiê**: busca por nome, matrícula ou parte do CPF; filtros; lista para baixar; pasta da pessoa com jornada, linha do tempo, registros do dossiê, documentos anexados (PDF/foto), vínculos e dados pessoais.
- **Dados sensíveis** (CPF completo, salário, documentos, filiação, contato) só aparecem para quem tem essa permissão.
- **Experiência**: marcos de 10, 30, 45, 60 e 90 dias calculados pela admissão; registro com nome e data; avaliação e efetivação entram no dossiê.
- **Painel de RH**: pessoas na folha, admissões, desligamentos, turnover, tempo de casa, por filial, setor e tipo de contrato.
- **Início**: pendências do dia, aniversariantes e a trilha da jornada com números reais.

## Etapa 2 — Vagas e seleção
- **Pedidos de vaga**: o gestor pede por `pedido.html` (sem login) e acompanha pelo link que recebe; o RH encaminha ao N2, que aprova ou reprova por `n2.html?s=…` (sem login); o RH abre a vaga com os dados do pedido.
- **Vagas e seleção**: lista com prazo (SLA do perfil) e funil; kanban por vaga (Triagem → Integração agendada), com os mesmos campos do R&S antigo em cada etapa; CPF pedido na entrevista e obrigatório na integração, conferido com o FO1029 (mostra se a pessoa já trabalhou aqui).
- **Banco de currículos**: cadastrados, reprovados e desistentes, com área, histórico de vagas, retorno dado (quem e quando) e "Levar para uma vaga".
- **Agenda do R&S**: entrevistas, testes, exames e integrações; histórico da agenda antiga.
- **Dados dos sistemas antigos** (administrador): importa o backup do novaRH. Pode repetir; não sobrescreve o que foi alterado aqui.
- Libere o módulo **Vagas e seleção (R&S)** para a equipe em Usuários e acessos.
- Requer o login **Anônimo** ativo no Firebase (Authentication → Método de login) para as páginas do gestor e do N2.

## Etapa 3 — Admissão
- **Para iniciar**: candidatos do R&S com integração marcada ou admitidos, e admitidos novos do FO1029 sem processo.
- **Checklist por perfil** (os 38 itens do novaRH, editáveis em "Configurar checklist"), cada item com quem marcou e quando, "não se aplica" e histórico.
- **Cruzamento com o FO1029 pelo CPF**: mostra a matrícula e confirma sozinho os documentos que já estão na folha (precisa da permissão Dados sensíveis).
- **Impressões**: checklist para o dossiê, lista de documentos para o candidato, termos de adesão ao plano de saúde e odontológico (modelo provisório).
- **Sindicato dos motoristas**: escolha cesta básica ou ticket grava na lista de motoristas.
- **Concluir**: registra "Admissão" na linha do tempo da pessoa e marca o candidato como admitido.
- A pasta da pessoa mostra a vaga e o pedido de origem e o link da admissão.
- Libere o módulo **Admissão** para a equipe.

## Como publicar (uma vez)

### 1. Publicar os arquivos no GitHub Pages
1. No GitHub, crie um repositório (por exemplo `gestao-de-pessoas`).
2. **Add file → Upload files** e arraste **todo o conteúdo desta pasta** (index.html, as pastas css, js, img e os arquivos .rules).
3. **Settings → Pages → Branch: main / (root) → Save**. Em 1 ou 2 minutos o endereço aparece no topo da página (algo como `https://SEU-USUARIO.github.io/gestao-de-pessoas/`).

### 2. Liberar o endereço no Firebase
Console do Firebase → **Authentication → Configurações → Domínios autorizados → Adicionar domínio** → coloque `SEU-USUARIO.github.io` (sem https e sem barra).

### 3. Publicar as regras de segurança
- **Firestore Database → Regras**: apague o conteúdo, cole o arquivo `firestore.rules` e clique em **Publicar**.
- **Storage → Regras**: cole o arquivo `storage.rules` e **Publicar**. Se o console pedir permissão para o Storage consultar o Firestore, clique em **Permitir**.

### 4. Primeiro acesso
1. Abra o endereço do sistema.
2. Clique em **Primeiro acesso do administrador**, informe seu nome completo e crie a senha de **rh@raguife.com.br**.
3. Pronto: você entra como administrador. Esse botão some depois do primeiro uso.

### 5. Carregar as pessoas
**Administração → Importar FO1029** → arraste a planilha → confira o resumo → **Gravar**.
Repita sempre que quiser atualizar (as importações não apagam o dossiê, os anexos nem a experiência).

### 6. Criar os usuários da equipe
**Administração → Usuários e acessos → Novo usuário**: nome completo, e-mail, senha inicial e módulos.
O nome completo aparece em tudo o que a pessoa registrar.

## Modo demonstração
Acrescente `?demo` ao endereço (ex.: `.../gestao-de-pessoas/?demo`) para testar com pessoas fictícias, sem tocar no banco. Se importar um FO1029 de verdade nesse modo, os dados ficam só na memória da página e somem ao fechá-la.

## Estrutura
- `index.html` — página única do sistema.
- `css/raguife.css` — identidade visual.
- `js/config.js` — configuração do Firebase, módulos e listas.
- `js/dados.js` — todo acesso ao banco (Firebase e modo demonstração).
- `js/fo1029.js` — leitura do FO1029 e montagem do cadastro único.
- `js/app.js` — login, menu, rotas, busca rápida (Ctrl+K) e pendências.
- `js/modulos/` — uma tela por arquivo.
- `firestore.rules` e `storage.rules` — regras de segurança.

## Próximas etapas
Vagas e seleção (pedido do gestor, aprovação do N2, kanban, banco de currículos), Admissão (checklist por perfil, documentos gerados, cruzamento com a requisição), Rescisão, Movimentações e tabela salarial, Portal do funcionário (benefícios, agenda médica, jornal), avisos por e-mail, Indicadores das áreas, Avaliação de desempenho e Auditoria — cada uma com a importação dos dados antigos.
