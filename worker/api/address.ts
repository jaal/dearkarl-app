import {
  type ChangeAddressResponse,
  isChangeAddressRequest,
} from "../../shared/api";
import {
  DEFAULT_PREFIX,
  type RandomInt,
  buildLocalPart,
  cryptoRandomInt,
  parseLocalPart,
  randomHash,
  validateName,
} from "../../shared/address";
import UsersDB from "../db";
import ErrorResponse, { ApiErrors } from "./errors";
import { getPayload, getSid } from "./utils";

/**
 * `POST /api/address` with `{ name }`: changes the readable part of the
 * signed-in user's Karl address. The prefix and the hash stay as they are.
 * A user whose login predates the `prefix-name-hash` format gets a fresh hash.
 *
 * The old address stops working at once: mail to it gets the
 * "wrong address" reply, which names the new one.
 */
export async function addressHandler(
  request: Request,
  db: Env["DB"],
  randomInt: RandomInt = cryptoRandomInt,
): Promise<Response> {
  if (request.method !== "POST")
    return new ErrorResponse(ApiErrors.InvalidRequest);

  const sid = getSid(request);
  if (!sid) return new ErrorResponse(ApiErrors.NoSid);

  const usersDb = new UsersDB(db);
  const user = await usersDb.getUserBySid(sid);
  if (!user) return new ErrorResponse(ApiErrors.NoUser);

  const payload = await getPayload(request);
  if (!isChangeAddressRequest(payload))
    return new ErrorResponse(ApiErrors.AddressInvalid);

  const check = validateName(payload.name);
  if (!check.ok)
    return new ErrorResponse({ ...ApiErrors.AddressInvalid, msg: check.error });

  const current = parseLocalPart(user.login ?? "");
  const prefix = current?.prefix ?? DEFAULT_PREFIX;
  const hash = current?.hash ?? randomHash(randomInt);
  const login = buildLocalPart(prefix, check.name, hash);

  if (login !== user.login) {
    if (await usersDb.addressNameTaken(`${prefix}-${check.name}`, user.email))
      return new ErrorResponse(ApiErrors.AddressTaken);
    try {
      await usersDb.updateLogin(user.email, login);
    } catch {
      // UNIQUE(login) lost a race with another user.
      return new ErrorResponse(ApiErrors.AddressTaken);
    }
  }

  const body: ChangeAddressResponse = { karlEmail: login };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
