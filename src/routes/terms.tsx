import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions — MyCar" },
      { name: "description", content: "MyCar terms and conditions for using our website and services." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Terms and Conditions</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Effective January 1, 2026 · My Car Business Services LLC
      </p>
      <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
        <p>Please read these terms carefully before using our website or services. By using MyCar, you agree to be bound by these terms.</p>
        <section><h2 className="font-display text-2xl font-bold text-foreground">SMS Notifications &amp; Marketing Communications</h2><ol className="mt-3 list-decimal space-y-2 pl-5"><li>This campaign sends SMS notifications, alerts, and occasional marketing communications to customers who have opted in.</li><li>You can cancel at any time by texting STOP to the shortcode. We will confirm your unsubscribe status by SMS.</li><li>For help, reply HELP or contact <a className="text-primary underline" href="mailto:info@mycarcorporation.com">info@mycarcorporation.com</a>.</li><li>Carriers are not liable for delayed or undelivered messages.</li><li>Message and data rates may apply. Message frequency varies. Contact your wireless provider with questions about your plan.</li><li>For privacy-related inquiries, review our <Link className="text-primary underline" to="/privacy">Privacy Policy</Link>.</li></ol></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">General Terms of Use</h2><p className="mt-3">By accessing and using the MyCar website, you accept and agree to these Terms and Conditions. If you do not agree, please do not use our website or services.</p><p>All content on this website, including text, images, logos, and graphics, is the property of My Car Business Services LLC and is protected by applicable copyright and trademark laws.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">Vehicle Information &amp; Pricing</h2><p className="mt-3">Vehicle pricing, specifications, and availability are subject to change without notice. We make every effort to ensure accuracy, but are not responsible for typographical errors. Contact us to confirm current pricing and availability before making purchasing decisions.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">Financing</h2><p className="mt-3">Financing is subject to credit approval. Rates and terms vary based on creditworthiness and other factors. Pre-qualification does not guarantee final loan approval. Financing arrangements are subject to lender requirements and applicable law.</p></section>
        <section><h2 className="font-display text-2xl font-bold text-foreground">Contact Us</h2><p className="mt-3">For questions about these Terms and Conditions, contact My Car Business Services LLC at <a className="text-primary underline" href="mailto:info@mycarcorporation.com">info@mycarcorporation.com</a> or <a className="text-primary underline" href="tel:5404263322">(540) 426-3322</a>.</p><p>4720 Harrison Rd, Fredericksburg, VA 22408</p></section>
      </div>
    </article>
  );
}
