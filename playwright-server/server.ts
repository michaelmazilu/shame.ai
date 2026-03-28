import express from "express";
import { chromium, type Browser } from "playwright";

const app = express();
app.use(express.json());

const API_SECRET = process.env.API_SECRET;

// Auth middleware
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (!API_SECRET || req.headers.authorization !== `Bearer ${API_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.post("/login", async (req, res) => {
  let browser: Browser | null = null;
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password required" });
    }

    browser = await chromium.launch({
      headless: false,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 420, height: 760 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle",
    });

    // Fill login form
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page
      .waitForURL((url) => !url.pathname.includes("/accounts/login"), {
        timeout: 30000,
      })
      .catch(() => {});

    // Check for checkpoint/challenge
    const currentUrl = page.url();
    if (currentUrl.includes("challenge") || currentUrl.includes("checkpoint")) {
      await browser.close();
      return res.status(403).json({
        error: "checkpoint",
        message:
          "Instagram requires verification — checkpoint challenge triggered",
        url: currentUrl,
      });
    }

    // Wait for session cookie
    const cookies = await context.cookies("https://www.instagram.com");
    const sessionId = cookies.find((c) => c.name === "sessionid");
    const dsUserId = cookies.find((c) => c.name === "ds_user_id");
    const csrfToken = cookies.find((c) => c.name === "csrftoken");

    if (!sessionId?.value || !dsUserId?.value) {
      await browser.close();
      return res
        .status(401)
        .json({ error: "Login failed — no session cookie" });
    }

    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Grab GraphQL tokens
    let fbDtsg: string | undefined;
    let lsd: string | undefined;
    try {
      const html = await page.content();
      const dtsgMatch = html.match(/"DTSGInitialData".*?"token":"([^"]+)"/);
      if (dtsgMatch) fbDtsg = dtsgMatch[1];
      const lsdMatch = html.match(/"LSD".*?"token":"([^"]+)"/);
      if (lsdMatch) lsd = lsdMatch[1];
    } catch {}

    await browser.close();

    res.json({
      success: true,
      session: {
        cookies: cookieStr,
        csrfToken: csrfToken?.value || "",
        userId: dsUserId.value,
        username,
        fbDtsg,
        lsd,
      },
    });
  } catch (e) {
    await browser?.close().catch(() => {});
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Playwright server listening on :${PORT}`));
