import { CdpSession } from "./cdp/client"
import { verificationReportSchema, type MappingConfig, type VerificationReport } from "./schema"
import { z } from "zod"

export const STYLE_ELEMENT_ID = "telemost-theme-override"

/**
 * The in-page agent.
 *
 * Runs on every document (via Page.addScriptToEvaluateOnNewDocument) and also
 * once against the live document. It is deliberately defensive:
 *  - idempotent (keyed by element id)
 *  - re-attaches if the SPA wipes <head>
 *  - always appended last so it wins the cascade at equal specificity
 */
export function buildAgentSource(css: string): string {
  const payload = JSON.stringify(css)
  const id = JSON.stringify(STYLE_ELEMENT_ID)

  return `(() => {
  const STYLE_ID = ${id};
  const CSS = ${payload};

  const mount = () => {
    const root = document.head || document.documentElement;
    if (!root) return;
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      el.setAttribute("data-source", "telemost-theme-override");
    }
    if (el.textContent !== CSS) el.textContent = CSS;
    // Keep it last: Orb ships its own <style> tags and order decides ties.
    if (el.parentNode !== root || root.lastChild !== el) root.appendChild(el);
  };

  mount();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  }

  // The SPA re-renders aggressively; re-assert if our node is dropped.
  const observer = new MutationObserver(() => {
    const el = document.getElementById(STYLE_ID);
    const root = document.head || document.documentElement;
    if (!el || (root && root.lastChild !== el)) mount();
  });

  const startObserver = () => {
    const target = document.documentElement;
    if (target) observer.observe(target, { childList: true, subtree: true });
  };

  if (document.documentElement) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });
})();`
}

/** Applies the stylesheet to the currently loaded document. */
export async function applyToLiveDocument(session: CdpSession, css: string): Promise<void> {
  await session.evaluate(`${buildAgentSource(css)} true;`, z.boolean())
}

/**
 * Waits until Telemost's own stylesheets are live.
 *
 * On a cold start the CDP page target appears well before the app has parsed
 * any CSS — measured on this machine: target at +1.5s with `readyState=loading`
 * and zero stylesheets, Orb's tokens only resolvable at +2.8s.
 *
 * Verifying inside that window reports every token as missing even though the
 * injection worked, so we wait for the app to actually be styled first. Keyed
 * on a real Orb token rather than `readyState`, because the token is the thing
 * we are about to assert on.
 */
export async function waitForAppStyles(session: CdpSession, mapping: MappingConfig, timeoutMs: number): Promise<boolean> {
  const probeToken = mapping.canaryTokens[0] ?? "--orb-surface-brand"
  const expression = `(() => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(probeToken)}).trim();
    return value.length > 0;
  })()`

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await session.evaluate(expression, z.boolean())) return true
    } catch {
      // Page is still navigating; the execution context can vanish mid-flight.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

/**
 * Reads back what the browser actually computed.
 *
 * This is the guard against silent breakage: if a Telemost update renames a
 * token, the canary shows up in `missing` and the CLI reports it loudly.
 */
export type CdpEvaluator = Pick<CdpSession, "evaluate">

export async function verify(session: CdpEvaluator, mapping: MappingConfig): Promise<VerificationReport> {
  const allTokens = [...new Set([...mapping.canaryTokens, ...mapping.semanticCanaries])].sort()
  const tokens = JSON.stringify(allTokens)
  const id = JSON.stringify(STYLE_ELEMENT_ID)

  const expression = `(() => {
    const tokens = ${tokens};
    const styles = getComputedStyle(document.documentElement);
    const resolved = {};
    const missing = [];
    for (const token of tokens) {
      const value = styles.getPropertyValue(token).trim();
      if (value) resolved[token] = value;
      else missing.push(token);
    }
    return {
      rootClasses: document.documentElement.className,
      styleTagPresent: !!document.getElementById(${id}),
      resolved,
      missing,
    };
  })()`

  return session.evaluate(expression, verificationReportSchema)
}
