import fs from "node:fs";
import { createRequire } from "node:module";
import { build as bundle } from "esbuild";
import { build as viteBuild } from "vite";
import tailwindcss from "@tailwindcss/vite";
const require = createRequire(import.meta.url);
const path = require("node:path");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright"
);
const project = process.cwd(),
  dir = path.resolve("tmp/menu-editor-qa"),
  fixtures = path.resolve("tests/menu-editor");
fs.mkdirSync(dir, { recursive: true });
await bundle({
  entryPoints: [path.join(fixtures, "entry.tsx")],
  bundle: true,
  format: "esm",
  outfile: path.join(dir, "app.js"),
  jsx: "automatic",
  define: { "import.meta.env.DEV": "true", "import.meta.env.PROD": "false" },
  plugins: [
    {
      name: "isolated-fixtures",
      setup(build) {
        build.onResolve(
          {
            filter:
              /^(?:@\/contexts\/AuthContext|@\/hooks\/(?:useFoods|useFirestore|useRecipes|useSpecialDiets|useOrgSettings|useOrgId)|@\/lib\/firebase|firebase\/firestore)$/,
          },
          () => ({ path: path.join(fixtures, "mocks.ts") })
        );
      },
    },
  ],
  alias: { "@": path.join(project, "client/src") },
  loader: { ".css": "empty" },
});
await viteBuild({
  configFile: false,
  root: project,
  plugins: [tailwindcss()],
  build: {
    outDir: path.join(dir, "style"),
    rollupOptions: { input: path.resolve("client/src/index.css") },
  },
});
const css = fs
  .readdirSync(path.join(dir, "style/assets"))
  .find(file => file.endsWith(".css"));
fs.copyFileSync(path.join(dir, "style/assets", css), path.join(dir, "app.css"));
fs.writeFileSync(
  path.join(dir, "index.html"),
  '<html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app.css"><div id="root"></div><script type="module" src="app.js"></script></html>'
);
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
    args: ["--allow-file-access-from-files"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.route(/^https?:/, route => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("dialog", dialog => dialog.accept());
    await page.goto(
      pathToFileURL(path.resolve("tmp/menu-editor-qa/index.html")).href
    );
    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "Novo cardápio", exact: true })
      .click();
    await page
      .getByLabel("Título *", { exact: true })
      .fill("Semana de demonstração");
    await page
      .getByLabel("Alunos atendidos por este cardápio", { exact: true })
      .fill("120");
    await page
      .getByLabel("Semana (segunda-feira)", { exact: true })
      .fill("2026-10-19");
    await page.screenshot({
      path: "tmp/menu-editor-qa/setup-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "2. Montar semana", exact: true })
      .click();
    await page.getByPlaceholder("Digite para buscar…").fill("Arroz");
    await page.getByRole("button", { name: /Arroz com legumes.*kcal/ }).click();
    await page
      .getByPlaceholder("Nome do prato no PDF")
      .first()
      .fill("Arroz com legumes");
    await page.waitForTimeout(250);
    const portion = page.getByRole("spinbutton", {
      name: /Per capita de Arroz/,
    });
    await portion.fill("200");
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    assert.equal(await portion.inputValue(), "100");
    await page.getByRole("button", { name: "Refazer", exact: true }).click();
    assert.equal(await portion.inputValue(), "200");
    assert.ok(
      (await page.locator("body").innerText()).includes("24 kg (120 refeições)")
    );
    await page.screenshot({
      path: "tmp/menu-editor-qa/compose-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Sair do editor", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Guardar e sair", exact: true })
      .click();
    assert.equal(
      await page.getByRole("button", { name: "Recuperar rascunho" }).count(),
      1
    );
    await page.reload();
    await page.getByRole("button", { name: "Recuperar rascunho" }).click();
    assert.equal(
      await page.getByLabel("Título *", { exact: true }).inputValue(),
      "Semana de demonstração"
    );
    await page
      .getByRole("button", { name: "2. Montar semana", exact: true })
      .click();
    assert.equal(await portion.inputValue(), "200");
    await page.evaluate(() => (window.__qaFailWrite = true));
    await page
      .getByRole("button", { name: "Salvar cardápio", exact: true })
      .first()
      .click();
    await page.waitForTimeout(550);
    assert.ok(
      (await page.locator("header").innerText()).includes(
        "aguardando sincronização"
      )
    );
    await page
      .getByRole("button", { name: "3. Revisar e exportar", exact: true })
      .click();
    await page.screenshot({
      path: "tmp/menu-editor-qa/review-desktop.png",
      fullPage: true,
    });
    await page.evaluate(() => (window.__qaFailWrite = false));
    await page
      .getByRole("button", { name: "Tentar sincronizar", exact: true })
      .click();
    await page.waitForTimeout(550);
    assert.ok(
      (await page.locator("header").innerText()).includes("Salvo na nuvem")
    );
    await page
      .getByRole("button", { name: "1. Atendimento", exact: true })
      .click();
    // Save twice before the first cloud acknowledgement. The newest edit must win.
    await page.getByLabel("Título *", { exact: true }).fill("Versão intermediária");
    await page.getByRole("button", { name: "Salvar cardápio", exact: true }).first().click();
    await page.getByLabel("Título *", { exact: true }).fill("Semana de demonstração");
    await page.getByLabel("Alunos atendidos por este cardápio", { exact: true }).fill("");
    await page.getByLabel("Semana (segunda-feira)", { exact: true }).fill("");
    await page.getByRole("button", { name: "Salvar cardápio", exact: true }).first().click();
    await page.waitForTimeout(850);
    const cloud = await page.evaluate(() => {
      const items = Object.values(window.__qaCloudDocs);
      const item = items[0];
      return { count: items.length, title: item.title, studentCount: item.studentCount, week: item.weekStartDate,
        dates: item.createdAt instanceof Date && item.updatedAt instanceof Date };
    });
    assert.equal(cloud.count, 1); assert.equal(cloud.title, "Semana de demonstração");
    assert.equal(cloud.studentCount, undefined); assert.equal(cloud.week, undefined); assert.ok(cloud.dates);
    assert.ok((await page.locator('[data-qa-sync-observer]').textContent()).includes('synced'));
    await page.getByLabel("Título *", { exact: true }).fill("Título alterado");
    await page
      .getByRole("button", { name: "Sair do editor", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Descartar alterações", exact: true })
      .click();
    assert.ok(
      (await page.locator("body").innerText()).includes(
        "Semana de demonstração"
      )
    );
    assert.equal(
      await page.getByRole("button", { name: "Recuperar rascunho" }).count(),
      0
    );
    const deleteButton = page.getByTitle(/^Excluir( cardápio)?$/).first();
    await deleteButton.click();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.ok(
      (await page.locator("body").innerText()).includes(
        "Semana de demonstração"
      )
    );
    await deleteButton.click();
    await page.evaluate(() => { window.__qaFailDelete = true; });
    await page.getByRole("button", { name: "Excluir cardápio", exact: true }).click();
    await page.waitForTimeout(200);
    assert.equal(await page.getByRole('alertdialog').count(), 1);
    await page.evaluate(() => { window.__qaFailDelete = false; });
    await page
      .getByRole("button", { name: "Excluir cardápio", exact: true })
      .click();
    await page.waitForTimeout(500);
    assert.ok(
      (await page.locator("body").innerText()).includes("Nenhum cardápio salvo")
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Novo cardápio", exact: true })
      .click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "tmp/menu-editor-qa/setup-mobile.png",
      fullPage: true,
    });
    const sizes = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    assert.ok(
      sizes.scroll <= sizes.viewport,
      "Mobile overflow " + JSON.stringify(sizes)
    );
    await page.evaluate(() => {
      window.__qaOriginalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new DOMException('Quota simulada', 'QuotaExceededError'); };
    });
    await page.getByLabel("Título *", { exact: true }).fill("Teste de proteção");
    assert.ok((await page.locator('header').innerText()).includes('Não foi possível proteger'));
    await page.getByRole('button', { name: 'Sair do editor', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'Guardar e sair', exact: true }).isDisabled());
    await page.getByRole('button', { name: 'Continuar editando', exact: true }).click();
    await page.evaluate(() => { Storage.prototype.setItem = window.__qaOriginalSetItem; });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: edição, quantidades, desfazer/refazer, recuperação após reload, falha e reenvio à nuvem, descarte, confirmação/cancelamento/exclusão, mobile sem overflow; zero erros JS."
    );
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
