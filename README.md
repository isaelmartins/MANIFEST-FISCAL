# Gerenciador de Notas Fiscais (Nuvem Fiscal)

Aplicação web em Next.js para gerenciar notas fiscais eletrônicas via API da Nuvem Fiscal.

## Funcionalidades

- **Sincronização Automática**: Autenticação, busca de notas, ciência da operação e confirmação.
- **Extração de Dados**: Lê o número da nota e o nome do fornecedor diretamente do XML.
- **Download Inteligente**: Salva o XML renomeado como `[Número] - [Fornecedor].xml`.

## Configuração

O aplicativo utiliza as credenciais da Nuvem Fiscal para autenticação. Você pode configurá-las de três formas:

1.  **Interface do Usuário (BYOK)**: Clique no botão "Configurações" no topo do aplicativo e insira seu Client ID e Client Secret. Eles serão salvos localmente no seu navegador.
2.  **Variáveis de Ambiente**: Se preferir, configure `NUVEM_FISCAL_CLIENT_ID` e `NUVEM_FISCAL_CLIENT_SECRET` no seu ambiente de deploy (ex: Netlify).
3.  **Fallback**: O aplicativo já possui credenciais padrão configuradas para facilitar o uso imediato.

### Variáveis de Ambiente (Opcional)

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```env
NUVEM_FISCAL_CLIENT_ID="seu_client_id"
NUVEM_FISCAL_CLIENT_SECRET="seu_client_secret"
```

### Instalação

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Acesse `http://localhost:3000`.

## Deploy na Netlify

1. Conecte seu repositório do GitHub à Netlify.
2. Configure as variáveis de ambiente `NUVEM_FISCAL_CLIENT_ID` e `NUVEM_FISCAL_CLIENT_SECRET` no painel da Netlify (Site settings > Environment variables).
3. O deploy será realizado automaticamente.
