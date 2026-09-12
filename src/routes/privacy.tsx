import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — MyCar" },
      { name: "description", content: "MyCar privacy policy and information practices." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Effective January 1, 2026 · My Car Business Services LLC
      </p>
      <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
        <p>At My Car Business Services LLC, we respect and value your privacy. This policy explains how we collect, use, and protect your information.</p>
        <section><h2 className="font-display text-2xl font-bold text-foreground">1. Information We Collect</h2><p className="mt-3">We collect personal identification information such as your name, email address, phone number, and similar contact data. We may also collect technical information, usage data, and transaction information when you use our website or services.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">2. How We Use Your Information</h2><p className="mt-3">We use information to provide and maintain our services, improve website functionality, process transactions, communicate with you about inquiries and services, and comply with legal obligations.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">3. Automated and AI-Assisted Communications</h2><p className="mt-3">My Car Business Services LLC may use automated dialing systems, prerecorded messages, conversational artificial intelligence, and AI-generated voices to contact leads and customers about inquiries, appointments, products, services, promotions, and account updates. These communications may use phone calls, SMS/text messages, or other messaging channels.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">4. Information Sharing and Disclosure</h2><p className="mt-3">We do not share mobile information with third parties or affiliates for marketing or promotional purposes. Information may be shared with subcontractors supporting services such as customer service. We may disclose information when required by law, subpoena, court order, or legal process.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">5. Data Security</h2><p className="mt-3">We use industry-standard security measures to safeguard your data from unauthorized access, alteration, or destruction. No internet transmission can be guaranteed to be completely secure.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">6. Cookies and Tracking Technologies</h2><p className="mt-3">We use cookies and similar technologies to remember preferences, improve performance, and analyze website use. Disabling cookies may affect certain functionality.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">7. Your Rights</h2><p className="mt-3">Depending on your location, you may have the right to access, correct, or delete your information; object to or restrict processing; and withdraw consent where consent is the legal basis.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">8. Access to and Control Over Information</h2><p className="mt-3">You may opt out of future contact at any time. You may also request to see, correct, or delete information we have about you by contacting us.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">9. Changes to This Policy</h2><p className="mt-3">We may update this policy from time to time. Changes will be posted on this page with an updated effective date.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">10. Contact Us</h2><p className="mt-3">Questions about this Privacy Policy can be sent to <a className="text-primary underline" href="mailto:info@mycarcorporation.com">info@mycarcorporation.com</a> or by calling <a className="text-primary underline" href="tel:5404263322">(540) 426-3322</a>.</p><p>4720 Harrison Rd, Fredericksburg, VA 22408</p></section>
      </div>
    </article>
  );
}
