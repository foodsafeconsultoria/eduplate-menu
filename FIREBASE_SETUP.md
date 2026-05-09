# Configuração do Firebase - Sistema PNAE

## Pré-requisitos

1. Criar uma conta no [Firebase Console](https://console.firebase.google.com)
2. Criar um novo projeto Firebase

## Passo 1: Obter Credenciais do Firebase

1. No Firebase Console, acesse seu projeto
2. Clique em "Configurações do Projeto" (ícone de engrenagem)
3. Na aba "Geral", role para baixo até "Seus aplicativos"
4. Clique em "Adicionar app" e selecione "Web"
5. Copie as credenciais fornecidas

## Passo 2: Configurar arquivo Firebase

1. Abra o arquivo `client/src/lib/firebase.ts`
2. Substitua os valores de `firebaseConfig` pelas suas credenciais:

```typescript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

## Passo 3: Configurar Firestore Database

1. No Firebase Console, acesse "Firestore Database"
2. Clique em "Criar banco de dados"
3. Escolha "Iniciar no modo de teste" (para desenvolvimento)
4. Selecione a região mais próxima
5. Clique em "Criar"

## Passo 4: Configurar Authentication

1. No Firebase Console, acesse "Authentication"
2. Clique na aba "Provedores de login"
3. Ative "Email/Senha"
4. Clique em "Salvar"

## Passo 5: Configurar Regras de Segurança (Firestore)

1. No Firestore, acesse a aba "Regras"
2. Substitua o conteúdo pelas seguintes regras:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir leitura/escrita para usuários autenticados
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Permitir criação de documentos de usuário
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

3. Clique em "Publicar"

## Passo 6: Configurar Storage (opcional, para fotos)

1. No Firebase Console, acesse "Storage"
2. Clique em "Começar"
3. Escolha "Iniciar no modo de teste"
4. Selecione a região mais próxima
5. Clique em "Criar"

## Estrutura do Banco de Dados

O sistema criará automaticamente as seguintes coleções:

### `users`
- Armazena dados dos usuários autenticados
- Campos: email, displayName, role, createdAt

### `schools`
- Lista de escolas
- Campos: name, createdAt, updatedAt

### `inspections`
- Registros de fiscalização
- Campos: schoolId, schoolName, inspectionDate, nutritionist, checklist, overallScore, etc.

### `epis`
- Registros de entrega de EPIs
- Campos: schoolId, employeeName, deliveryDate, items, signature, createdAt

### `schedules`
- Cronograma de visitas
- Campos: schoolId, scheduledDate, nutritionist, status, createdAt

## Testando a Configuração

1. Inicie o servidor de desenvolvimento:
```bash
pnpm dev
```

2. Acesse a aplicação em `http://localhost:3000`

3. Crie uma nova conta ou use as credenciais de teste

4. Teste a funcionalidade de cadastro de escolas

## Troubleshooting

### Erro: "Firebase is not initialized"
- Verifique se as credenciais foram inseridas corretamente no arquivo `firebase.ts`
- Certifique-se de que o Firestore Database foi criado

### Erro: "Permission denied"
- Verifique as regras de segurança do Firestore
- Certifique-se de que o usuário está autenticado

### Dados não aparecem
- Verifique se o Firestore Database está ativo
- Verifique se as coleções foram criadas corretamente
- Abra o DevTools do navegador e verifique o console para mensagens de erro

## Próximos Passos

1. Configurar um domínio personalizado
2. Configurar backups automáticos
3. Implementar autenticação com Google/GitHub
4. Configurar notificações por email
5. Implementar relatórios mais avançados
