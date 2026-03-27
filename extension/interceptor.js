// Injected into Instagram's page context to intercept API responses
// This runs in the MAIN world (not isolated), so it can see IG's fetch calls

(function () {
  const origFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await origFetch.apply(this, args);
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";

    try {
      // Intercept profile info responses
      if (url.includes("/api/v1/users/web_profile_info")) {
        const clone = response.clone();
        const data = await clone.json();
        window.postMessage({ type: "ST_PROFILE_DATA", payload: data }, "*");
      }

      // Intercept following list responses
      if (url.includes("/friendships/") && url.includes("/following")) {
        const clone = response.clone();
        const data = await clone.json();
        window.postMessage({ type: "ST_FOLLOWING_DATA", payload: data }, "*");
      }

      // Intercept suggested users
      if (
        url.includes("/discover/ayml/") ||
        url.includes("/discover/topical_explore/")
      ) {
        const clone = response.clone();
        const data = await clone.json();
        window.postMessage({ type: "ST_SUGGESTED_DATA", payload: data }, "*");
      }
    } catch (e) {
      // silently ignore parse errors on non-JSON responses
    }

    return response;
  };

  window.postMessage({ type: "ST_INTERCEPTOR_READY" }, "*");
})();
