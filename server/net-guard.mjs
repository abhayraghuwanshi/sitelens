// Hosted, users hand the server URLs to fetch (sitemaps, webhooks, custom
// metric endpoints). This keeps every outgoing fetch on the public internet:
// no loopback, private ranges, link-local metadata or Fly's private network.
// The check runs at connect time on the resolved address, so a redirect or a
// DNS answer that changes between check and use can't slip past it.

import { lookup as dnsLookup } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { Agent, buildConnector, setGlobalDispatcher } from 'undici';

const blocked = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32],
]) blocked.addSubnet(net, bits, 'ipv6');

export function isPrivateAddress(address) {
  const ip = String(address).replace(/^\[|\]$/g, '');
  // ::ffff:10.0.0.1 is 10.0.0.1.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateAddress(mapped[1]);
  const family = isIP(ip);
  if (!family) return true;
  return blocked.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

export class BlockedAddressError extends Error {
  constructor(host) {
    super(`Refusing to connect to ${host}: it is a private or internal address.`);
    this.code = 'EBLOCKED';
  }
}

function lookup(hostname, options, callback) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const bad = addresses.find((a) => isPrivateAddress(a.address));
    if (bad) return callback(new BlockedAddressError(hostname));
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

export function guardedAgent() {
  const base = buildConnector({ lookup });
  // Literal IPs never reach lookup(); check them here.
  const connect = (opts, cb) => {
    if (isIP(String(opts.hostname).replace(/^\[|\]$/g, '')) && isPrivateAddress(opts.hostname)) return cb(new BlockedAddressError(opts.hostname));
    return base(opts, cb);
  };
  return new Agent({ connect });
}

// Every fetch() in this process from now on, Node's built-in one included.
export function guardOutgoingFetch() {
  setGlobalDispatcher(guardedAgent());
}
