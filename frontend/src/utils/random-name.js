/**
 * Lazily load faker (English locale only) and generate a random
 * email local-part candidate. Kept as a dynamic import so faker
 * stays in its own chunk and out of the main bundle.
 *
 * Must remain a local import: remote module imports (e.g. esm.sh)
 * are blocked by the strict Content-Security-Policy.
 */
export async function randomEmailLocalPart() {
    const { faker } = await import('@faker-js/faker/locale/en');
    return faker.internet.email().split('@')[0];
}
