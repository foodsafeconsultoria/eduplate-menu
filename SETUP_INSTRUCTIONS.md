# 📋 Instruções de Setup - Sistema PNAE

## ✅ Passo 1: Preparar o Ambiente Local

### Windows/Mac/Linux

```bash
# 1. Instalar Node.js 18+
# Baixe em: https://nodejs.org/

# 2. Verificar instalação
node --version
npm --version

# 3. Clonar/Abrir o projeto
cd sistema-pnae

# 4. Instalar dependências
npm install
```

## 🔐 Passo 2: Configurar Firebase

### 2.1 Criar Projeto no Firebase

1. Acesse: https://console.firebase.google.com
2. Clique em "Criar Projeto"
3. Nome: "PNAE" (ou seu nome)
4. Desabilite Google Analytics
5. Clique em "Criar Projeto"

### 2.2 Configurar Firestore

1. No Firebase Console, vá para "Firestore Database"
2. Clique em "Criar banco de dados"
3. Selecione "Modo de teste" (para desenvolvimento)
4. Escolha a região mais próxima
5. Clique em "Criar"

### 2.3 Copiar Credenciais

1. Vá para "Configurações do Projeto" (engrenagem)
2. Clique em "Seu aplicativo"
3. Selecione "Web" (ícone de </> )
4. Copie o objeto `firebaseConfig`
5. Cole em `client/src/lib/firebase.ts`

### Exemplo de firebase.ts:

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD_xxxxxxxxxxxxxxxxxxx",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxxxxxxxxxxxxx"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
```

## 🚀 Passo 3: Testar Localmente

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Abra no navegador: http://localhost:3000
```

## 🌐 Passo 4: Deploy no Netlify

### Opção A: Deploy via GitHub (Recomendado)

```bash
# 1. Criar repositório no GitHub
# https://github.com/new

# 2. Fazer push do código
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/seu-usuario/sistema-pnae.git
git push -u origin main

# 3. Conectar no Netlify
# https://app.netlify.com/
# Clique em "New site from Git"
# Selecione GitHub
# Escolha seu repositório
# Configure as variáveis de ambiente
# Deploy automático!
```

### Opção B: Deploy via CLI

```bash
# 1. Instalar Netlify CLI
npm install -g netlify-cli

# 2. Build do projeto
npm run build

# 3. Deploy
netlify deploy --prod --dir=dist
```

## 🔧 Variáveis de Ambiente (Netlify)

No Netlify, vá para: **Site Settings > Build & Deploy > Environment**

Adicione as variáveis:

```
VITE_FIREBASE_API_KEY=AIzaSyD_xxxxxxxxxxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:xxxxxxxxxxxxxxxx
```

## 📦 Build para Produção

```bash
# Build otimizado
npm run build

# Visualizar build localmente
npm run preview
```

## 🎯 Checklist de Deploy

- [ ] Node.js 18+ instalado
- [ ] Projeto Firebase criado
- [ ] Firestore configurado
- [ ] Credenciais copiadas em firebase.ts
- [ ] npm install executado
- [ ] npm run dev testado localmente
- [ ] Repositório GitHub criado
- [ ] Netlify conectado ao GitHub
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy realizado com sucesso

## 📞 Próximos Passos

1. **Testar no navegador**: Acesse sua URL do Netlify
2. **Adicionar dados**: Use o Dashboard para testar
3. **Configurar Firestore**: Ajuste as regras de segurança
4. **Monitorar**: Use Firebase Console para acompanhar

## 🆘 Problemas Comuns

**Erro: "Cannot find module 'firebase'"**
```bash
npm install firebase
```

**Erro: "Firestore is not initialized"**
- Verifique as credenciais em firebase.ts
- Certifique-se de que o Firestore está habilitado

**PDFs não geram**
```bash
npm install jspdf jspdf-autotable
```

---

**Sucesso! Sistema PNAE pronto para uso! 🎉**
