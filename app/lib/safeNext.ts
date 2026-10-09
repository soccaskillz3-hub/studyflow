// Where to send someone after logging in or opening an email link: a path on this site, or the
// dashboard. Parsing it the way a browser would (against a placeholder origin) catches every way
// of sneaking in another site: "//evil.example", "/\evil.example", hidden tabs and line breaks,
// full URLs. Anything that would leave the site becomes "/".
const BASE = "https://studyflow.invalid";

export function safeNext(next: string | null | undefined) {
  if (!next) return "/";
  try {
    const url = new URL(next, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
