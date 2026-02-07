export type FileInfo = {
    path: string;
    handle: FileSystemFileHandle
};

export async function* getHandlesRecursively(entry: FileSystemHandle, path: string = ""): AsyncGenerator<FileInfo, void, unknown> {
    if (entry.kind === "file") {
        yield { path, handle: entry as FileSystemFileHandle };
        return;
    }

    // entry.kind === "directory"
    // deno-lint-ignore no-explicit-any
    for await (const handle of (entry as any).values()) {
        const nextPath = path ? `${path}/${handle.name}` : handle.name;
        yield* getHandlesRecursively(handle, nextPath);
    }
}

export async function ensureReadPermission(handle: FileSystemHandle) {
    const opts = { mode: "read" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    return await handle.requestPermission(opts) === "granted";
}

export async function asyncPool<T, R>(poolSize: number, items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: Promise<R>[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
        const p = fn(item);
        results.push(p);

        const e = p.then(() => {
            executing.splice(executing.indexOf(e), 1);
        });
        executing.push(e);

        if (executing.length >= poolSize) {
            await Promise.race(executing);
        }
    }

    return Promise.all(results);
}