/** The one Drive scope Karl needs: files it creates, nothing else. */
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** Google's consent shows Drive as a separate checkbox the user can leave
    empty; a grant without it is a sign-in Karl cannot save anything with. */
export function hasDriveScope(scope: string | undefined): boolean {
  return (scope ?? "").split(/\s+/).includes(DRIVE_FILE_SCOPE);
}
