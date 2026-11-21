import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
import App, { resetExchangedCodes } from "../src/App";
import * as server from "../src/server";

vi.mock("../src/server", () => ({
  getActiveSession: vi.fn(),
  getLoginUrl: vi.fn(),
  logout: vi.fn(),
  requestToken: vi.fn(),
  deleteAccount: vi.fn(),
  // The account page lists personal access tokens on mount.
  listApiTokens: vi.fn().mockResolvedValue([]),
}));

const mocked = vi.mocked(server);
const session = { userEmail: "ann@example.com", karlEmail: "abc123@dearkarl.com" };

// jsdom cannot navigate; record where the app sends the browser instead.
let location: { href: string };
beforeEach(() => {
  sessionStorage.clear();
  resetExchangedCodes();
  vi.clearAllMocks();
  location = { href: "http://localhost/app" };
  Object.defineProperty(window, "location", { value: location, configurable: true });
  vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
});
afterEach(cleanup);

describe("OAuth callback", () => {
  it("shows an error on the sign-in page when the code exchange fails", async () => {
    mocked.requestToken.mockResolvedValue(null);
    render(<MemoryRouter><App code="bad" /></MemoryRouter>);
    await waitFor(() => expect(location.href).toBe("/app"));
    cleanup();

    mocked.getActiveSession.mockResolvedValue(null);
    render(<MemoryRouter><App code={null} /></MemoryRouter>);
    expect((await screen.findByRole("alert")).textContent).toMatch(/didn't go through/);
  });

  it("returns a failed reconnect to the reconnect page with the error", async () => {
    sessionStorage.setItem("dk_reconnecting", String(Date.now()));
    mocked.requestToken.mockResolvedValue(null);
    render(<MemoryRouter><App code="bad" /></MemoryRouter>);
    await waitFor(() => expect(location.href).toBe("/app/reconnect"));
    cleanup();

    mocked.getActiveSession.mockResolvedValue(null);
    render(<MemoryRouter><App code={null} reconnect /></MemoryRouter>);
    expect((await screen.findByRole("alert")).textContent).toMatch(/didn't go through/);
  });

  it("confirms a reconnect on the account page", async () => {
    sessionStorage.setItem("dk_reconnecting", String(Date.now()));
    mocked.requestToken.mockResolvedValue({ isNewUser: false } as never);
    render(<MemoryRouter><App code="ok" /></MemoryRouter>);
    await waitFor(() => expect(location.href).toBe("/app"));
    cleanup();

    mocked.getActiveSession.mockResolvedValue(session as never);
    render(<MemoryRouter><App code={null} /></MemoryRouter>);
    expect(await screen.findByText(/Drive access renewed/i)).toBeTruthy();
  });

  it("ignores a reconnect that was abandoned long ago", async () => {
    sessionStorage.setItem("dk_reconnecting", String(Date.now() - 60 * 60 * 1000));
    mocked.requestToken.mockResolvedValue({ isNewUser: false } as never);
    render(<MemoryRouter><App code="ok" /></MemoryRouter>);
    await waitFor(() => expect(location.href).toBe("/app"));
    cleanup();

    mocked.getActiveSession.mockResolvedValue(session as never);
    render(<MemoryRouter><App code={null} /></MemoryRouter>);
    await screen.findAllByText(/Sign out|Log out/i);
    expect(screen.queryByText(/Drive access renewed/i)).toBeNull();
  });
});

describe("/app/reconnect", () => {
  it("keeps the button usable while the session check is pending", async () => {
    mocked.getActiveSession.mockReturnValue(new Promise(() => {}));
    mocked.getLoginUrl.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><App code={null} reconnect /></MemoryRouter>);
    const button = screen.getByRole("button", { name: "Reconnect Google Drive" });
    expect((button as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(button);
    const busy = await screen.findByRole("button", { name: "Opening Google…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("deleting the account", () => {
  it("asks once more, deletes, and says so on the sign-in page", async () => {
    mocked.getActiveSession.mockResolvedValue(session as never);
    mocked.deleteAccount.mockResolvedValue(true);
    render(<MemoryRouter><App code={null} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Delete account" }));
    expect(mocked.deleteAccount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete my account/i }));
    await waitFor(() => expect(location.href).toBe("/app"));
    expect(mocked.deleteAccount).toHaveBeenCalledOnce();
    cleanup();

    mocked.getActiveSession.mockResolvedValue(null as never);
    render(<MemoryRouter><App code={null} /></MemoryRouter>);
    expect(await screen.findByText(/Your account is deleted/i)).toBeTruthy();
  });

  it("stays on the account page with an error when deletion fails", async () => {
    mocked.getActiveSession.mockResolvedValue(session as never);
    mocked.deleteAccount.mockResolvedValue(false);
    render(<MemoryRouter><App code={null} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Delete account" }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete my account/i }));
    expect(await screen.findByText(/Could not delete your account/i)).toBeTruthy();
    expect(location.href).toBe("http://localhost/app");
  });
});

describe("OAuth code exchange", () => {
  it("exchanges a code once, even when StrictMode runs effects twice", async () => {
    mocked.requestToken.mockResolvedValue({ isNewUser: true } as never);
    render(
      <StrictMode>
        <MemoryRouter>
          <App code="single-use" />
        </MemoryRouter>
      </StrictMode>,
    );
    await waitFor(() => expect(location.href).toBe("/app"));
    expect(mocked.requestToken).toHaveBeenCalledTimes(1);
  });
});

describe("one-shot notices under StrictMode (effects run twice in dev)", () => {
  it("still shows 'Your account is deleted'", async () => {
    sessionStorage.setItem("dk_account_deleted", "1");
    mocked.getActiveSession.mockResolvedValue(null as never);
    render(
      <StrictMode>
        <MemoryRouter>
          <App code={null} />
        </MemoryRouter>
      </StrictMode>,
    );
    expect(await screen.findByText(/Your account is deleted/i)).toBeTruthy();
  });

  it("still shows 'Drive access renewed'", async () => {
    sessionStorage.setItem("dk_reconnected", "1");
    mocked.getActiveSession.mockResolvedValue(session as never);
    render(
      <StrictMode>
        <MemoryRouter>
          <App code={null} />
        </MemoryRouter>
      </StrictMode>,
    );
    expect(await screen.findByText(/Drive access renewed/i)).toBeTruthy();
  });
});
