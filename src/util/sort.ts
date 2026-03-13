export type CompareFunction<T> = (a: T, b: T) => number;

function stripLeading(str: string): string {
    str = str.trim();
    str = str.replace(/^(the|a|an)\s+/i, "");
    return str;
}

export function compareSmartAlpha(a: string, b: string) {
    a = stripLeading(a);
    b = stripLeading(b);

    return a.localeCompare(b, undefined, {
        sensitivity: "base",
        numeric: true
    });
}

export function compareUndefinedLast<T>(base: CompareFunction<T>): CompareFunction<T | undefined> {
    return (a: T | undefined, b: T | undefined) => {
        if (a !== b) {
            if (a === undefined) return 1;
            if (b === undefined) return -1;
            return base(a, b);
        }

        return 0;
    }
}

export function numberCompare(a: number, b: number): number {
    return a - b;
}

export interface CompareStackEntry<T> {
    compare: CompareFunction<T>
};

export class CompareEntry<T, U> implements CompareStackEntry<T> {
    constructor(
        private key: (obj: T) => U,
        private compareFn: CompareFunction<U>
    ) { }

    compare(a: T, b: T): number {
        return this.compareFn(this.key(a), this.key(b));
    }
}

export function compareStack<T>(compareStack: CompareStackEntry<T>[]): CompareFunction<T> {
    return function (a: T, b: T) {
        for (const entry of compareStack) {
            const res = entry.compare(a, b);
            if (res !== 0) return res;
        }

        return 0;
    }
}