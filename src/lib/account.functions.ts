import { createServerFn } from "@tanstack/react-start";

export type RegisterResult =
  | { status: "created" }
  | { status: "exists" }
  | { status: "weak_password"; message: string }
  | { status: "error"; message: string };

/**
 * Creates the account server-side on the live project.
 *
 * The project's transactional email is not sending, so the normal
 * signUp() confirmation flow fails with "Error sending confirmation email".
 * Creating the user with the service role (already confirmed) lets people
 * register and sign in immediately. The client then signs in normally.
 */
export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string; fullName?: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    const password = String(input?.password ?? "");
    const fullName = String(input?.fullName ?? "").trim().slice(0, 120);
    if (!email.includes("@")) throw new Error("Enter a valid email address.");
    if (password.length < 8) throw new Error("Use a password of at least 8 characters.");
    return { email, password, fullName };
  })
  .handler(async ({ data }): Promise<RegisterResult> => {
    const { appAdmin } = await import("./app-admin.server");
    const { data: created, error } = await appAdmin().auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
        return { status: "exists" };
      }
      if (m.includes("password") || m.includes("pwned") || m.includes("weak")) {
        return { status: "weak_password", message: error.message };
      }
      return { status: "error", message: error.message };
    }
    if (!created.user) return { status: "error", message: "Account could not be created." };
    return { status: "created" };
  });
