import { chromium } from "playwright";

const baseUrl = process.env.LOGIN_TEST_URL || "http://127.0.0.1:5175";
const email = process.env.LOGIN_TEST_EMAIL || "gabrielmendespromove@gmail.com";
const password = process.env.LOGIN_TEST_PASSWORD || "wrong-password-test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  const openLogin = page.getByRole("button", { name: /já sou cliente premium|entrar/i }).first();
  await openLogin.click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /entrar no painel/i }).click();

  const submitButton = page.getByRole("button", { name: /entrar no painel/i });
  await page.waitForTimeout(1_500);

  const loading = await submitButton.locator("svg.animate-spin").count();
  const notice = (await page.locator("text=/Senha|nao foi possivel|demorou|cadastrado|admin|Sessao/i").first().textContent().catch(() => "")) || "";
  const currentUrl = page.url();

  console.log(
    JSON.stringify(
      {
        baseUrl,
        email,
        currentUrl,
        buttonStillLoading: loading > 0,
        notice: notice.trim(),
        passed: loading === 0 && notice.trim().length > 0,
      },
      null,
      2,
    ),
  );

  if (loading > 0) {
    await page.waitForTimeout(22_000);
    const stillLoading = await submitButton.locator("svg.animate-spin").count();
    console.log(
      JSON.stringify(
        {
          afterTimeoutMs: 22_000,
          buttonStillLoading: stillLoading > 0,
          noticeAfterTimeout:
            (await page.locator("text=/Senha|nao foi possivel|demorou|cadastrado|admin|Sessao/i").first().textContent().catch(() => "")) || "",
        },
        null,
        2,
      ),
    );
    process.exit(stillLoading > 0 ? 1 : 0);
  }

  process.exit(notice.trim() ? 0 : 1);
} finally {
  await browser.close();
}
