import { describe, expect, it, vi } from "vitest";

const rest = vi.fn();
vi.mock("./purchases.server", () => ({ rest, requireUser: vi.fn(), requireStaffUser: vi.fn() }));
vi.mock("./app-admin.server", () => ({
  appAdminCreds: () => ({ url: "https://example.test", key: "k" }),
}));

const { leaseRest } = await import("./lease-to-own.server");
const { LEASE_SETUP_PENDING } = await import("./lease-to-own");

describe("leaseRest error handling", () => {
  it("never passes database error text (which can echo applicant data) to callers or logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    rest.mockRejectedValueOnce(
      new Error(
        'Request failed (400): {"code":"23502","details":"Failing row contains (1, Pat Example, 1990-05-01, v1:abc, T12345678)"}',
      ),
    );
    const error = await leaseRest("mc_lease_applications", { method: "POST", body: {} }).catch(
      (e: Error) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toMatch(/Pat|1990|T12345678|v1:/);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("23502");
    expect(logged).not.toMatch(/Pat|1990|T12345678|v1:/);
    log.mockRestore();
  });

  it("reports missing tables or columns as setup pending", async () => {
    rest.mockRejectedValueOnce(new Error("PURCHASE_SETUP_PENDING"));
    await expect(leaseRest("x")).rejects.toThrow(LEASE_SETUP_PENDING);
    rest.mockRejectedValueOnce(
      new Error(
        `Request failed (400): {"code":"PGRST204","message":"Could not find the 'dl_verification_status' column"}`,
      ),
    );
    await expect(leaseRest("x")).rejects.toThrow(LEASE_SETUP_PENDING);
  });
});
