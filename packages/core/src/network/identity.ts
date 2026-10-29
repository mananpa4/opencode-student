/**
 * Outbound network identity, adapted from the Scrap-Crawl tunnel and anti-bot layer.
 *
 * OpenCode Student talks to the open web the way a desktop browser does: each web request picks
 * one ordinary browser profile and sends the headers that profile would send. The pool mirrors
 * Scrap-Crawl's `UA_POOL`; the client hints are the ones a matching Chromium build sends, so the
 * fingerprint stays internally consistent instead of mixing a Chrome UA with Firefox headers.
 *
 * Nothing in this module reads or derives machine identity. There is no hostname, MAC address,
 * serial number, RAM size or hardware ID: a profile is chosen at random per request and carries
 * no information about the machine that sent it.
 */

type BrowserProfile = {
  readonly userAgent: string
  readonly platform?: string
  readonly brands?: string
}

const profiles: readonly BrowserProfile[] = [
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    platform: '"Windows"',
    brands: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  },
  {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
  },
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  },
  {
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    platform: '"Linux"',
    brands: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  },
]

/** Pick a browser profile for one request. */
export function browserProfile() {
  return profiles[Math.floor(Math.random() * profiles.length)]!
}

/**
 * Headers a browser sends when navigating to a document. `accept` stays caller-owned because the
 * web tools negotiate markdown, text or HTML.
 */
export function browserHeaders(accept: string, profile = browserProfile()) {
  const headers: Record<string, string> = {
    "User-Agent": profile.userAgent,
    Accept: accept,
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  }

  if (profile.brands) {
    headers["sec-ch-ua"] = profile.brands
    headers["sec-ch-ua-mobile"] = "?0"
    headers["sec-ch-ua-platform"] = profile.platform!
  }

  return headers
}
