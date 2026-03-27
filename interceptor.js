// interceptor.js — Injected into Instagram's page context (not isolated world)
// Monkey-patches window.fetch to capture IG API responses and relay them to content script

(function () {
  const origFetch = window.fetch;

  window.fetch = async function (...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    const options = args[1] || {};

    // Extract fb_dtsg and lsd tokens from outgoing GraphQL requests
    if (url.includes("/api/graphql") || url.includes("/graphql/query")) {
      try {
        const body =
          typeof options.body === "string"
            ? options.body
            : options.body instanceof URLSearchParams
              ? options.body.toString()
              : "";
        if (body) {
          const params = new URLSearchParams(body);
          const fbDtsg = params.get("fb_dtsg");
          const lsd = params.get("lsd");
          if (fbDtsg && lsd) {
            window.postMessage(
              {
                type: "ST_TOKENS",
                payload: { fb_dtsg: fbDtsg, lsd: lsd },
              },
              "*",
            );
          }
        }
      } catch (e) {}
    }

    const response = await origFetch.apply(this, args);

    // Capture profile info responses
    if (url.includes("/api/v1/users/web_profile_info")) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        window.postMessage(
          { type: "ST_DATA", subtype: "profile_info", payload: data },
          "*",
        );
      } catch (e) {}
    }

    // Capture following/followers list responses
    if (url.includes("/api/v1/friendships/") && url.includes("/following")) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        window.postMessage(
          { type: "ST_DATA", subtype: "following_list", payload: data },
          "*",
        );
      } catch (e) {}
    }

    // Capture suggested users
    if (url.includes("/api/v1/discover/ayml")) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        window.postMessage(
          { type: "ST_DATA", subtype: "suggested_users", payload: data },
          "*",
        );
      } catch (e) {}
    }

    // Capture explore page
    if (url.includes("/api/v1/discover/topical_explore")) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        window.postMessage(
          { type: "ST_DATA", subtype: "explore", payload: data },
          "*",
        );
      } catch (e) {}
    }

    // Capture GraphQL responses (profiles, user data)
    if (url.includes("/graphql/query")) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        window.postMessage(
          { type: "ST_DATA", subtype: "graphql", payload: data },
          "*",
        );
      } catch (e) {}
    }

    return response;
  };

  console.log("[ShotTaker] Interceptor loaded — monitoring IG API calls");
})();
