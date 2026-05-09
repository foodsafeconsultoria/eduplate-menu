# 🚀 Guia de Deploy - Sistema PNAE

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm ou pnpm
- Conta no Firebase (para banco de dados em nuvem)
- Conta no Netlify (para hospedagem)
- Git instalado

## 🔧 Configuração Local (VSCode)

### 1. Clonar ou Abrir o Projeto

```bash
# Se já tem o projeto localmente
cd sistema-pnae

# Instalar dependências
npm install
# ou
pnpm install
```

### 2. Configurar Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Crie um novo projeto
3. Copie as credenciais do projeto
4. Atualize `client/src/lib/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "SEU_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "seu-id",
  appId: "seu-app-id"
};
```

### 3. Testar Localmente

```bash
npm run dev
# Acesse http://localhost:3000
```

## 🌐 Deploy no Netlify

### Opção 1: Deploy via CLI

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Build do projeto
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

### Opção 2: Deploy via GitHub

1. Faça push do código para GitHub
2. Conecte seu repositório no Netlify
3. Configure as variáveis de ambiente
4. Deploy automático em cada push

### Variáveis de Ambiente (Netlify)

Adicione no Netlify > Site Settings > Build & Deploy > Environment:

```
VITE_FIREBASE_API_KEY=seu_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_auth_domain
VITE_FIREBASE_PROJECT_ID=seu_project_id
VITE_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

## 📦 Estrutura do Projeto

```
sistema-pnae/
├── client/
│   ├── src/
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── lib/           # Utilitários (Firebase, PDF)
│   │   ├── hooks/         # Custom hooks
│   │   ├── types/         # Tipos TypeScript
│   │   └── App.tsx        # Arquivo principal
│   ├── index.html         # HTML principal
│   └── package.json
├── server/                 # Backend (não usado em modo static)
└── package.json           # Dependências do projeto
```

## 🔐 Segurança

### Regras do Firestore

Configure as regras no Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Regras de Storage

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 📱 Funcionalidades Implementadas

✅ Dashboard com gráficos em tempo real
✅ Fiscalização com checklist completo
✅ Gestão de EPIs com assinatura digital
✅ Cronograma com calendário
✅ Relatórios gráficos interativos
✅ Resto/Ingesta com análise
✅ Teste de Aceitabilidade
✅ Módulo de Manutenção com tickets
✅ Certificados de Qualidade automáticos
✅ Upload de fotos com geração de PDF
✅ Histórico de PDFs com filtros
✅ Notificações por email (simuladas)

## 🐛 Troubleshooting

### Erro: "Firebase is not initialized"
- Verifique as credenciais em `client/src/lib/firebase.ts`
- Certifique-se de que o Firestore está habilitado

### Erro: "Cannot find module"
- Execute `npm install` novamente
- Limpe o cache: `npm cache clean --force`

### PDFs não geram
- Verifique se jsPDF está instalado: `npm install jspdf jspdf-autotable`
- Reinicie o servidor: `npm run dev`

## 📞 Suporte

Para dúvidas sobre Firebase: https://firebase.google.com/docs
Para dúvidas sobre Netlify: https://docs.netlify.com
Para dúvidas sobre React: https://react.dev

---

**Sistema PNAE v1.0** - Gestão de Nutrição Escolar
