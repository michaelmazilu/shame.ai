import type { IGSession } from "./types";

const LOGIN_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes to complete login

export async function launchInstagramLogin(): Promise<{ success: boolean; session?: IGSession; error?: string }> {
  let chromium;
  try {
    chromium = (await import("playwright")).chromium;
  } catch {
    return { success: false, error: "Browser login is only available when running locally" };
  }

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 420, height: 760 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();
    await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle" });

    // Wait for the user to log in — we detect success when sessionid cookie appears
    const session = await new Promise<IGSession | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), LOGIN_TIMEOUT_MS);

      const poll = setInterval(async () => {
        try {
          const cookies = await context.cookies("https://www.instagram.com");
          const sessionId = cookies.find((c) => c.name === "sessionid");
          const dsUserId = cookies.find((c) => c.name === "ds_user_id");
          const csrfToken = cookies.find((c) => c.name === "csrftoken");

          if (sessionId?.value && dsUserId?.value) {
            clearInterval(poll);
            clearTimeout(timeout);

            const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

            // Try to grab GraphQL tokens from the page
            let fbDtsg: string | undefined;
            let lsd: string | undefined;
            try {
              const html = await page.content();
              const dtsgMatch = html.match(/"DTSGInitialData".*?"token":"([^"]+)"/);
              if (dtsgMatch) fbDtsg = dtsgMatch[1];
              const lsdMatch = html.match(/"LSD".*?"token":"([^"]+)"/);
              if (lsdMatch) lsd = lsdMatch[1];
            } catch {
              // not critical
            }

            resolve({
              cookies: cookieStr,
              csrfToken: csrfToken?.value || "",
              userId: dsUserId.value,
              username: "",
              fbDtsg,
              lsd,
            });
          }
        } catch {
          // page might be navigating, ignore
        }
      }, 1000);
    });

    // Try to get the username from the logged-in page
    if (session) {
      try {
        await page.goto("https://www.instagram.com/accounts/edit/", { waitUntil: "networkidle", timeout: 10000 });
        const usernameInput = await page.$('input[name="username"]');
        if (usernameInput) {
          session.username = (await usernameInput.inputValue()) || "";
        }
      } catch {
        // fallback: extract from cookie or page
        try {
          const profileLink = await page.$('a[href*="/accounts/"]');
          if (profileLink) {
            const href = await profileLink.getAttribute("href");
            if (href) session.username = href.replace(/\//g, "");
          }
        } catch {
          // username will be empty, not critical
        }
      }
    }

    await browser.close();

    if (!session) {
      return { success: false, error: "Login timed out — try again" };
    }

    return { success: true, session };
  } catch (e) {
    await browser.close().catch(() => {});
    return { success: false, error: (e as Error).message };
  }
}
