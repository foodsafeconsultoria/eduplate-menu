import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['client/src/lib/menuPdf.test.ts', 'client/src/lib/menuDistribution.test.ts', 'server/menu-mail.test.ts'], environment: 'node' } });
