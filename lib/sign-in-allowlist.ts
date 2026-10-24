// Optional restriction of who may sign in. ALLOWED_SIGNIN_IDENTIFIERS is a
// comma-separated list of emails, DIDs and domains; an empty list keeps
// registration open. Every sign-in is checked, not only the first one.

export type SignInIdentity = {
  email?: string | null;
  did?: string | null;
  handle?: string | null;
};

export class SignInNotAllowedError extends Error {
  constructor() {
    super("This account is not allowed to sign in.");
    this.name = "SignInNotAllowedError";
  }
}

export function parseAllowedSignInIdentifiers(
  env: Record<string, string | undefined> = process.env,
) {
  return (env.ALLOWED_SIGNIN_IDENTIFIERS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

// An entry with "@" matches that email, a "did:" entry matches that DID and
// anything else is a domain: the email's domain or the ATProto handle itself
// or one of its subdomains.
export function isSignInAllowed(identity: SignInIdentity, allowed: string[]) {
  if (!allowed.length) {
    return true;
  }

  const email = identity.email?.trim().toLowerCase() || null;
  const did = identity.did?.trim().toLowerCase() || null;
  const handle = identity.handle?.trim().toLowerCase() || null;

  return allowed.some((entry) => {
    if (entry.includes("@")) {
      return email === entry;
    }

    if (entry.startsWith("did:")) {
      return did === entry;
    }

    return (
      (email !== null && email.endsWith(`@${entry}`)) ||
      handle === entry ||
      (handle !== null && handle.endsWith(`.${entry}`))
    );
  });
}
