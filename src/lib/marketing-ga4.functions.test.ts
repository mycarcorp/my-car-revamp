import { describe, expect, it, vi } from "vitest";
import { runGa4ReportForStaff } from "./marketing.functions";

describe("GA4 Marketing Hub endpoint authorization", () => {
	it("requires marketing staff before loading the GA4 report", async () => {
		const order: string[] = [];
		const authorize = vi.fn(async () => { order.push("authorize"); });
		const loadReport = vi.fn(async (input) => { order.push("report"); return input; });
		await expect(runGa4ReportForStaff({ preset: 30 }, authorize, loadReport)).resolves.toEqual({ preset: 30 });
		expect(order).toEqual(["authorize", "report"]);
	});

	it("does not query GA4 when the staff authorization guard rejects", async () => {
		const authorize = vi.fn(async () => { throw new Error("Not signed in."); });
		const loadReport = vi.fn();
		await expect(runGa4ReportForStaff({ preset: 30 }, authorize, loadReport)).rejects.toThrow("Not signed in.");
		expect(loadReport).not.toHaveBeenCalled();
	});

	it("does not inspect credentials or attempt diagnostics when staff authorization rejects", async () => {
		const authorize = vi.fn(async () => { throw new Error("Not signed in."); });
		const inspectCredentials = vi.fn();
		await expect(runGa4ReportForStaff(undefined, authorize, inspectCredentials)).rejects.toThrow("Not signed in.");
		expect(authorize).toHaveBeenCalledOnce();
		expect(inspectCredentials).not.toHaveBeenCalled();
	});
});