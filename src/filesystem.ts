import { IDBPDatabase, IDBPTransaction } from "idb";

export type FileInfo = {
    path: string;
    handle: FileSystemFileHandle,
    dir: FileSystemDirectoryHandle
};

async function* getHandlesRecursively(entry: FileSystemHandle, dir: FileSystemDirectoryHandle | null = null, path: string = ""): AsyncGenerator<FileInfo, void, unknown> {
    if (entry.kind === "file") {
        yield { path, handle: entry as FileSystemFileHandle, dir: dir! };
        return;
    }

    // entry.kind === "directory"
    // deno-lint-ignore no-explicit-any
    for await (const handle of (entry as any).values()) {
        const nextPath = path ? `${path}/${handle.name}` : handle.name;
        yield* getHandlesRecursively(handle, entry as FileSystemDirectoryHandle, nextPath);
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

export interface FileSystemFile {
    id: number;
    path: string;
    handle: FileSystemFileHandle;
    lastModified: number;
    size: number;
    mimeType: string;
}

interface FileSystemFileNotStored {
    id?: number;
    path: string;
    handle: FileSystemFileHandle;
    lastModified: number;
    size: number;
    mimeType: string;
}

export interface ScanResult {
    newFiles: FileSystemFile[];
    changedFiles: FileSystemFile[];
    removedFiles: FileSystemFile[];
}

export class FileSystem {
    private static files = new Map<number, FileSystemFile>();
    private static dirIndex = new Map<string, Set<number>>();

    static getFileByID(fileId: number): FileSystemFile | undefined {
        return this.files.get(fileId);
    }

    static getDirectoryPath(filePath: string): string {
        return filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";
    }

    static getFileName(filePath: string): string {
        return filePath.includes("/") ? filePath.slice(filePath.lastIndexOf("/") + 1) : filePath;
    }

    static getFilesInDirectory(dirPath: string): ReadonlySet<number> {
        return this.dirIndex.get(dirPath) ?? new Set();
    }

    private static dirIndexAdd(path: string, fileId: number) {
        this.dirIndex.get(path)?.add(fileId) ?? this.dirIndex.set(path, new Set([fileId]));
    }

    private static dirIndexRemove(path: string, fileId: number) {
        const dir = this.dirIndex.get(path);
        if (dir) {
            dir.delete(fileId);
            if (dir.size === 0) {
                this.dirIndex.delete(path);
            }
        }
    }

    private static async loadStoredState(db: IDBPDatabase): Promise<Map<string, FileSystemFile>> {
        const allFiles: FileSystemFile[] = await db.getAll("files");

        const map = new Map<string, FileSystemFile>();

        for (const file of allFiles) {
            map.set(file.path, file);
        }

        return map;
    }

    private static async getCurrentState(dirHandle: FileSystemDirectoryHandle, fileFilter: (file: globalThis.File) => boolean): Promise<Map<string, FileSystemFileNotStored>> {
        const map = new Map<string, FileSystemFileNotStored>();

        for await (const info of getHandlesRecursively(dirHandle as FileSystemHandle)) {
            const file = await info.handle.getFile();
            if (fileFilter(file)) {
                map.set(info.path, {
                    path: info.path,
                    handle: info.handle,
                    lastModified: file.lastModified,
                    size: file.size,
                    mimeType: file.type,
                });
            }
        }

        return map;
    }

    private static commitDeleted(tx: IDBPTransaction<unknown, ["files"], "readwrite">, removedFiles: FileSystemFile[]): void {
        const objectStore = tx.objectStore("files");
        for (const file of removedFiles) {
            objectStore.delete(file.id);
        }
    }

    private static async commitAdded(tx: IDBPTransaction<unknown, ["files"], "readwrite">, newFiles: FileSystemFileNotStored[]): Promise<FileSystemFile[]> {
        const objectStore = tx.objectStore("files");
        for (const file of newFiles) {
            const key = await objectStore.add(file);
            file.id = key as number;
        }
        return newFiles as FileSystemFile[];
    }

    private static commitChanged(tx: IDBPTransaction<unknown, ["files"], "readwrite">, changedFiles: FileSystemFile[]): void {
        const objectStore = tx.objectStore("files");
        for (const file of changedFiles) {
            objectStore.put(file);
        }
    }

    static async scan(db: IDBPDatabase, dirHandle: FileSystemDirectoryHandle, fileFilter: (file: globalThis.File) => boolean): Promise<ScanResult> {
        const [currentState, storedState] = await Promise.all([
            this.getCurrentState(dirHandle, fileFilter),
            this.loadStoredState(db)
        ]);

        for (const [, entry] of storedState) {
            this.files.set(entry.id, entry);
            this.dirIndexAdd(this.getDirectoryPath(entry.path), entry.id);
        }

        const tempNewFiles: FileSystemFileNotStored[] = [];
        const changedFiles: FileSystemFile[] = [];
        const removedFiles: FileSystemFile[] = [];

        for (const [path, current] of currentState) {
            const stored = storedState.get(path);

            if (!stored) {
                tempNewFiles.push(current);
            } else if (current.lastModified !== stored.lastModified || current.size !== stored.size) {
				current.id = stored.id;
                changedFiles.push(current as FileSystemFile);
            }
            // else unchanged
        }

        for (const [path, stored] of storedState) {
            if (!currentState.has(path)) {
                removedFiles.push(stored);
            }
        }

        for (const f of removedFiles) {
            this.files.delete(f.id);
            this.dirIndexRemove(this.getDirectoryPath(f.path), f.id);
        }
        for (const f of changedFiles) {
            this.files.delete(f.id);
            this.dirIndexRemove(this.getDirectoryPath(f.path), f.id);
        }

        for (const file of changedFiles) {
            this.files.set(file.id, file);
            this.dirIndexAdd(this.getDirectoryPath(file.path), file.id);
        }

        const tx = db.transaction("files", "readwrite");
        this.commitDeleted(tx, removedFiles);
        this.commitChanged(tx, changedFiles);
        const newFiles = await this.commitAdded(tx, tempNewFiles);
        tx.commit();
        await tx.done;

        for (const entry of newFiles) {
            if (entry.id) {
                this.files.set(entry.id, entry);
                this.dirIndexAdd(this.getDirectoryPath(entry.path), entry.id);
            }
        }

        return {
            newFiles,
            changedFiles,
            removedFiles
        };
    }
}