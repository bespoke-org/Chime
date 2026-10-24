import { describe, expect, test } from "bun:test";

import {
  isSignInAllowed,
  parseAllowedSignInIdentifiers,
} from "@/lib/sign-in-allowlist";

describe("parseAllowedSignInIdentifiers", () => {
  test("splits, trims and lowercases the list", () => {
    expect(
      JSON.stringify(
        parseAllowedSignInIdentifiers({
          ALLOWED_SIGNIN_IDENTIFIERS:
            " Ada@Example.com, example.org ,, did:plc:ABC ",
        }),
      ),
    ).toBe(JSON.stringify(["ada@example.com", "example.org", "did:plc:abc"]));
    expect(parseAllowedSignInIdentifiers({}).length).toBe(0);
  });
});

describe("isSignInAllowed", () => {
  const allowed = ["ada@example.com", "example.org", "did:plc:abc"];

  test("allows everyone when the list is empty", () => {
    expect(isSignInAllowed({ email: "x@y.z" }, [])).toBe(true);
    expect(isSignInAllowed({}, [])).toBe(true);
  });

  test("matches an email exactly, ignoring case", () => {
    expect(isSignInAllowed({ email: "Ada@Example.com" }, allowed)).toBe(true);
    expect(isSignInAllowed({ email: "bob@example.com" }, allowed)).toBe(false);
  });

  test("matches an email domain", () => {
    expect(isSignInAllowed({ email: "bob@example.org" }, allowed)).toBe(true);
    expect(isSignInAllowed({ email: "bob@notexample.org" }, allowed)).toBe(
      false,
    );
    expect(isSignInAllowed({ email: "bob@sub.example.org" }, allowed)).toBe(
      false,
    );
  });

  test("matches a DID exactly and a handle by domain", () => {
    expect(isSignInAllowed({ did: "did:plc:abc" }, allowed)).toBe(true);
    expect(isSignInAllowed({ did: "did:plc:other" }, allowed)).toBe(false);
    expect(isSignInAllowed({ handle: "example.org" }, allowed)).toBe(true);
    expect(isSignInAllowed({ handle: "ada.example.org" }, allowed)).toBe(true);
    expect(isSignInAllowed({ handle: "ada.example.com" }, allowed)).toBe(false);
  });

  test("rejects an identity with nothing to match", () => {
    expect(isSignInAllowed({}, allowed)).toBe(false);
    expect(isSignInAllowed({ email: null, did: null }, allowed)).toBe(false);
  });
});
