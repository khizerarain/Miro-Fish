import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { LIMITS } from "./schemas";

export type UrlExtractResult =
  | { ok: true; url: string; title: string; text: string }
  | {
      ok: false;
      reason: "invalid_url" | "blocked" | "unreachable" | "http_error" | "not_html" | "too_little_text";
      message: string;
    };

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MIN_TEXT = 200;

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) throw new Error("blocked");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new Error("blocked");
}

export function normalizeUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    // Single-label hosts other than localhost are typos; localhost and IPs pass through to the SSRF check.
    const plausible = host.includes(".") || host === "localhost" || isIP(host) !== 0;
    if (!["http:", "https:"].includes(url.protocol) || !plausible) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export function htmlToText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  const title = $("meta[property='og:title']").attr("content") || $("title").first().text() || "";
  const description =
    $("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content") || "";
  $("script, style, noscript, svg, iframe, template, nav, footer, form, [aria-hidden='true']").remove();

  const blocks: string[] = [];
  const seen = new Set<string>();
  $("h1, h2, h3, h4, p, li, blockquote, td, dt, dd, figcaption").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 3 || seen.has(text)) return;
    seen.add(text);
    const tag = el.tagName.toLowerCase();
    blocks.push(/^h[1-4]$/.test(tag) ? `\n${text}` : tag === "li" ? `• ${text}` : text);
  });
  if (blocks.join(" ").length < MIN_TEXT) {
    blocks.push($("body").text().replace(/\s+/g, " ").trim());
  }

  const text = [description, ...blocks]
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title: title.replace(/\s+/g, " ").trim().slice(0, 200), text: text.slice(0, LIMITS.urlExtract) };
}

export async function fetchAndExtract(rawUrl: string): Promise<UrlExtractResult> {
  let url = normalizeUrl(rawUrl);
  if (!url)
    return {
      ok: false,
      reason: "invalid_url",
      message: "That doesn't look like a web address. Try something like example.com.",
    };

  try {
    let res: Response | undefined;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHost(url);
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; MiroFishBot/1.0; +https://mirofish.app)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, url);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("blocked");
        continue;
      }
      break;
    }
    if (!res || (res.status >= 300 && res.status < 400)) {
      return { ok: false, reason: "unreachable", message: "That page redirects too many times." };
    }
    if (!res.ok) {
      return { ok: false, reason: "http_error", message: `The site responded with an error (${res.status}).` };
    }
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml|text\/plain/.test(type)) {
      return { ok: false, reason: "not_html", message: "That link isn't a web page we can read." };
    }

    const body = await readCapped(res);
    const { title, text } = type.includes("text/plain")
      ? { title: "", text: body.slice(0, LIMITS.urlExtract) }
      : htmlToText(body);
    if (text.length < MIN_TEXT) {
      return {
        ok: false,
        reason: "too_little_text",
        message: "We could only find a little text on that page. It may load its content with JavaScript.",
      };
    }
    return { ok: true, url: url.toString(), title, text };
  } catch (err) {
    if ((err as Error).message === "blocked") {
      return { ok: false, reason: "blocked", message: "We can only read public websites." };
    }
    const timedOut = (err as Error).name === "TimeoutError";
    return {
      ok: false,
      reason: "unreachable",
      message: timedOut ? "The site took too long to respond." : "We couldn't reach that site.",
    };
  }
}
