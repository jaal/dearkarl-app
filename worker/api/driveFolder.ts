import GoogleDrive from "../google/drive";
import GoogleToken from "../google/token";
import UsersDB from "../db";
import { getSid, getValidToken } from "./utils";

/** Where to land when the folder itself can't be found: Drive's home. */
export const DRIVE_HOME = "https://drive.google.com/";

export function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
}

function redirect(to: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: to, "Cache-Control": "no-store" },
  });
}

/**
 * `GET /api/drive/folder`: sends the signed-in user straight to their
 * `dearkarl` folder in Google Drive. The folder id is looked up on click,
 * not on every account-page load, so the page costs no Drive call.
 *
 * Anything that goes wrong (no session, no Drive access, Drive down) still
 * lands on Drive's home page rather than an error: the link is a
 * convenience, the folder is there either way.
 */
export async function driveFolderHandler(
  request: Request,
  secret: string,
  db: Env["DB"],
): Promise<Response> {
  if (request.method !== "GET") return redirect(DRIVE_HOME);
  const sid = getSid(request);
  if (!sid) return redirect(DRIVE_HOME);
  try {
    const usersDb = new UsersDB(db);
    const user = await usersDb.getUserBySid(sid);
    if (!user) return redirect(DRIVE_HOME);
    const accessToken = await getValidToken(user, new GoogleToken(secret), usersDb);
    if (!accessToken) return redirect(DRIVE_HOME);
    const folderId = await new GoogleDrive(accessToken).getRootFolderId();
    return redirect(typeof folderId === "string" && folderId ? folderUrl(folderId) : DRIVE_HOME);
  } catch {
    return redirect(DRIVE_HOME);
  }
}
