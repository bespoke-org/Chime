declare module "bun:test" {
  type Matcher = {
    toContain: (value: unknown) => void;
    toBe: (value: unknown) => void;
    toEqual: (value: unknown) => void;
    not: {
      toContain: (value: unknown) => void;
      toBe: (value: unknown) => void;
      toEqual: (value: unknown) => void;
    };
  };

  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void): void;
  export function expect(value: unknown): Matcher;
}
