
// deno-lint-ignore no-explicit-any
export function arraysEqual(a?: any[] | Uint8Array, b?: any[] | Uint8Array) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }

    return true;
}