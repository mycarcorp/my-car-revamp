import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, Settings2 } from "lucide-react";
import {
	getTrackingConsentPreferences,
	setTrackingConsentPreferences,
	type TrackingConsentPreferences,
} from "@/lib/analytics";

export function AnalyticsConsentManager({ pathname }: { pathname: string }) {
	const [preferences, setPreferences] = useState<TrackingConsentPreferences>({ analytics: "unknown", meta: "unknown" });
	const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
	const [metaEnabled, setMetaEnabled] = useState(false);
	const [ready, setReady] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const hasSavedChoices = preferences.analytics !== "unknown" && preferences.meta !== "unknown";
	const panelOpen = ready && (!hasSavedChoices || settingsOpen);

	useEffect(() => {
		const sync = () => {
			const current = getTrackingConsentPreferences();
			setPreferences(current);
			setAnalyticsEnabled(current.analytics === "granted");
			setMetaEnabled(current.meta === "granted");
			setReady(true);
		};
		sync();
		window.addEventListener("storage", sync);
		return () => window.removeEventListener("storage", sync);
	}, []);

	function saveChoices(analytics: boolean, meta: boolean) {
		const next = {
			analytics: analytics ? "granted" as const : "denied" as const,
			meta: meta ? "granted" as const : "denied" as const,
		};
		setTrackingConsentPreferences(next, pathname);
		setPreferences(next);
		setAnalyticsEnabled(analytics);
		setMetaEnabled(meta);
		setSettingsOpen(false);
	}

	return (
		<>
			{ready && (
				<section
					id="tracking-consent-panel"
					hidden={!panelOpen}
					aria-label="Privacy and cookie choices"
					aria-describedby="tracking-consent-description"
					className="fixed bottom-[4.5rem] left-4 z-[100] w-[min(26rem,calc(100vw-2rem))] border border-border bg-background p-4 shadow-xl sm:p-5"
				>
					<div className="flex items-center gap-2">
						<Cookie className="size-4 text-primary" aria-hidden="true" />
						<h2 className="font-display text-base font-semibold">Privacy choices</h2>
					</div>
					<p id="tracking-consent-description" className="mt-2 text-sm leading-5 text-muted-foreground">
						Optional analytics and marketing technologies are off unless you choose to allow them. You can change or withdraw either choice at any time.
					</p>
					<p className="mt-2 text-sm">
						<Link to="/privacy" className="text-primary underline underline-offset-2">Read the Privacy Policy</Link>
					</p>
					<fieldset className="mt-4 space-y-3 border-y border-border py-3">
						<legend className="sr-only">Optional tracking choices</legend>
						<label className="flex cursor-pointer items-start gap-3 text-sm">
							<input type="checkbox" checked={analyticsEnabled} onChange={(event) => setAnalyticsEnabled(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
							<span><span className="font-medium text-foreground">Google Analytics 4</span><span className="block text-xs text-muted-foreground">Website usage measurement.</span></span>
						</label>
						<label className="flex cursor-pointer items-start gap-3 text-sm">
							<input type="checkbox" checked={metaEnabled} onChange={(event) => setMetaEnabled(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
							<span><span className="font-medium text-foreground">Meta Pixel</span><span className="block text-xs text-muted-foreground">Marketing measurement on Meta platforms.</span></span>
						</label>
					</fieldset>
					<div className="mt-4 flex flex-wrap gap-2">
						<button type="button" onClick={() => saveChoices(analyticsEnabled, metaEnabled)} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Save choices</button>
						<button type="button" onClick={() => saveChoices(false, false)} className="rounded-md border border-border px-3 py-2 text-sm font-medium">Reject optional</button>
						<button type="button" onClick={() => saveChoices(true, true)} className="rounded-md border border-border px-3 py-2 text-sm font-medium">Accept all optional</button>
					</div>
					{hasSavedChoices && settingsOpen && (
						<button type="button" onClick={() => setSettingsOpen(false)} className="mt-3 text-xs text-muted-foreground underline underline-offset-2">Close settings</button>
					)}
				</section>
			)}
			<button
				type="button"
				onClick={() => setSettingsOpen((open) => !open)}
				aria-expanded={panelOpen}
				aria-controls="tracking-consent-panel"
				className="fixed bottom-4 left-4 z-[101] inline-flex min-h-10 items-center gap-2 border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<Settings2 className="size-4" aria-hidden="true" />
				Privacy / Cookie Settings
			</button>
		</>
	);
}