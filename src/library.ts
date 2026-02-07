import { IDBPDatabase } from "idb";
import { Album } from "./album.ts";
import { ProtoTrack, Track } from "./track.ts";
import { asyncPool, ensureReadPermission, FileInfo, getHandlesRecursively } from "./filesystem.ts";

interface Window {
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>
}

declare const load_dialog: HTMLDialogElement;
declare const loading_lbl: HTMLDivElement;

export class Library {

    static saveRootHandle(db: IDBPDatabase, dirHandle: FileSystemDirectoryHandle) {
        return db.put("config", dirHandle, "root");
    }

    static loadRootHandle(db: IDBPDatabase): Promise<FileSystemDirectoryHandle> {
        return db.get("config", "root");
    }

    static async getLibraryHandle(db: IDBPDatabase) {
        const root = await this.loadRootHandle(db);
        if (root && await ensureReadPermission(root)) {
            return root;
        }

        // Ensure supported browser
        if (!(window as unknown as Window).showDirectoryPicker) {
            const unsupportedDialog = document.createElement("dialog");
            unsupportedDialog.style.width = "400px"
            unsupportedDialog.innerHTML = `
                <div class="content">
                    <h2>Error: Unsupported Browser or context</h2>
                    <p>It appears your browser does not support the <code>Window.showDirectoryPicker()</code> function, which is needed by this application, or you are accessing the page via an insecure context.</p>
                    <p>For now, you'll need to use a chromium-based browser (such as Google Chrome, Microsoft Edge, Brave, Chromium, and others) and use a secure context to run this app.</p>
                </div>
            `;

            const buttonBar = document.createElement("div");
            buttonBar.className = "button-bar";

            const glue = document.createElement("div");
            glue.className = "glue";

            const okButton = document.createElement("button");
            okButton.style.float = "right";
            okButton.textContent = "Close";
            okButton.addEventListener("click", () => {
                unsupportedDialog.close();
                unsupportedDialog.remove();
            });

            buttonBar.appendChild(glue);
            buttonBar.appendChild(okButton);

            unsupportedDialog.appendChild(buttonBar);

            document.body.appendChild(unsupportedDialog);
            unsupportedDialog.showModal();

            throw new Error("Directory picker unsupported");
        }

        // Prompt the user with a button to select library (naive but ok)

        const button = document.createElement("button");
        button.textContent = "Select Library";

        return await new Promise(resolve => {
            button.addEventListener("click", async () => {
                const dirHandle = await (window as unknown as Window).showDirectoryPicker();
                const hasPermission = await ensureReadPermission(dirHandle);
                if (!hasPermission) throw new Error("Unable to get read permission for root handle!");
                await this.saveRootHandle(db, dirHandle);
                button.remove();
                resolve(dirHandle);
            });
            document.querySelector(".main-view")!.appendChild(button);
        });
    }

    static async loadLibrary(db: IDBPDatabase) {
        if (await db.count("tracks") > 0 && await db.count("albums") > 0) {
            await Track.loadAll(db);
            await Album.loadAll(db);
            return;
        }

        const albums: Album[] = [];

        const dirHandle = await this.getLibraryHandle(db);

        load_dialog.showModal();

        loading_lbl.textContent = "Scanning library files...";

        const items: FileInfo[] = [];
        for await (const file of getHandlesRecursively(dirHandle as FileSystemHandle)) {
            items.push(file);
        }

        const progress_bar = document.getElementById("progress_bar")! as HTMLProgressElement;
        progress_bar.max = items.length;

        let countDone = 0;
        const protos: (ProtoTrack | null)[] = await asyncPool(256, items, async ({ path, handle }) => {
            const proto = await Track.loadFile(handle, path);
            countDone++;
            progress_bar.value = countDone;
            loading_lbl.textContent = `${countDone} / ${items.length} files scanned`;
            return proto;
        });

        loading_lbl.textContent = `Construcing albums from ${protos.length} discovered tracks`;

        // Build albums from tracks
        for (const proto of protos) {
            if (!proto) continue;

            const albumName = proto.tag.album;
            const albumLower = albumName?.toLowerCase();

            let album = albums.find(album => album.name?.toLowerCase() === albumLower && album.artist === (proto.tag.albumartist ?? proto.tag.artist));
            if (!album) {
                album = new Album();
                album.name = albumName;
                album.artist = proto.tag.albumartist ?? proto.tag.artist;
                albums.push(album);
            }

            const track = Track.createFromProtoTrack(proto, album.id);
            album.trackIds.push(track.id);

            if (proto.tag.picture && !album.coverData) {
                const coverData = proto.tag.picture[0];
                album.coverData = coverData;
            }
        }

        for (const album of albums) {
            album.trackIds.sort((a, b) => {
                const trackA = Track.byID(a)!;
                const trackB = Track.byID(b)!;

                if (trackA.disc !== trackB.disc) {
                    return (trackA.disc ?? 0) - (trackB.disc ?? 0);
                }

                if (trackA.no !== trackB.no) {
                    return (trackA.no ?? 0) - (trackB.no ?? 0);
                }

                return (trackA.title ?? "").localeCompare(trackB.title ?? "");
            });
        }

        loading_lbl.textContent = "Writing library to indexedDB...";

        await Track.saveAll(db);
        await Album.saveAll(db);

        load_dialog.close();
    }
}