import { formatAddress } from "../shared/address";

/** Karl addresses live on in.dearkarl.com (see shared/address.ts). The worker
    returns only the local part (`user.login`); the frontend appends the
    domain. Both the connect step and the account page show this address. */
export { INBOUND_DOMAIN as KARL_ADDRESS_DOMAIN } from "../shared/address";

export function formatKarlAddress(karlEmail: string): string {
  return formatAddress(karlEmail);
}
