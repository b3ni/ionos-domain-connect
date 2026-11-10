/**
 * Output of domain-connect-dyndns 0.0.9, reconstructed from its source
 * (command_line.py, domain_update.py): a banner, then per domain an empty
 * line, "Read <domain> config.", indented progress lines, and the returned
 * status line. Domains rejected before reading their config print only the
 * status line (no "Read" marker).
 */
export const BANNER = "*** domain-connect-dyndns 0.0.9 ***\n\n";

export const upToDate = (domain: string) =>
  `\nRead ${domain} config.\n` +
  "  Recently used IPv4 address: 203.0.113.7\n" +
  "  Public IPv4 address: 203.0.113.7\n" +
  "  IPv4 record up to date.\n" +
  "All records up to date. No update required.\n";

export const updated = (domain: string) =>
  `\nRead ${domain} config.\n` +
  "  IP 203.0.113.7 found in A record\n" +
  "  Public IPv4 address: 198.51.100.9\n" +
  "DNS records successfully updated.\n";

export const failed = (domain: string, error: string) =>
  `\nRead ${domain} config.\n` +
  "  IP 203.0.113.7 found in A record\n" +
  "  Public IPv4 address: 198.51.100.9\n" +
  `${error}\n` +
  "Could not update DNS records.\n";

export const configuredIncorrectly = (domain: string) =>
  `Domain ${domain} configured incorrectly. Rerun setup.\n`;

export const NOTFOUND_SESSION =
  'Failed to get async token: 400 Bad Request {"error":"invalid_grant","error_description":"NOTFOUND_SESSION"}';
