import { IDBPDatabase } from "idb";
import { Album } from "./album.ts";
import { ProtoTrack, Track } from "./track.ts";
import { asyncPool, ensureReadPermission, FileInfo, getHandlesRecursively } from "./filesystem.ts";
import { Artist } from "./artist.ts";
import { arraysEqual } from "./util/arrays.ts";

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

    static async loadLibrary(db: IDBPDatabase, rescan: boolean) {
        if (await db.count("tracks") > 0 && await db.count("albums") > 0 && !rescan) {
            await Track.loadAll(db);
            await Album.loadAll(db);
            await Artist.loadAll(db);

            Track.linkToArtists();
            Album.linkToArtists();
            return;
        }

        db.clear("tracks");
        db.clear("albums");
        db.clear("artists");

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

        const covers: Map<FileSystemDirectoryHandle, Uint8Array> = new Map();

        let countDone = 0;
        const protos: ProtoTrack[] = [];
        await asyncPool(4, items, async ({ path, handle, dir }) => {
            const file = await handle.getFile();
            if (file.type.startsWith("audio")) {
                const proto = await Track.getTrackMetadata(file, handle, dir, path);
                if (proto) {
                    protos.push(proto);
                }
            } else if (file.type.startsWith("image") && /^(folder|cover)\..*/i.test(handle.name)) {
                covers.set(dir, new Uint8Array(await file.arrayBuffer()));
            }
            countDone++;
            progress_bar.value = countDone;
            loading_lbl.textContent = `${countDone} / ${items.length} files scanned`;
        });

        loading_lbl.textContent = `Constructing albums from ${protos.length} discovered tracks`;

        // Build albums from tracks
        for (const proto of protos) {
            const albumName = proto.tag.album;
            const albumLower = albumName?.toLowerCase();

            const newAlbumArtist = proto.tag.albumartist ? Artist.getOrCreate(proto.tag.albumartist) : undefined;

            let album = albums.find(album => album.name?.toLowerCase() === albumLower && album.artist === newAlbumArtist);
            if (!album) {
                album = new Album();
                album.name = albumName;
                album.artist = newAlbumArtist;
                albums.push(album);
            }

            const track = Track.createFromProtoTrack(proto, album.id);
            album.trackIds.push(track.id);

            const tryNewCover = function (album: Album, track: Track | null, imageData: Uint8Array) {
                // Check to see if cover is already included
                let found = false;
                for (let i = 0; i < album.covers.length; i++) {
                    const cover = album.covers[i];
                    if (arraysEqual(imageData, cover)) {
                        if (track !== null) track.coverIndex ??= i;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    album.covers.push(imageData);
                    if (track !== null) track.coverIndex ??= album.covers.length - 1;
                }
            }

            // Add covers
            if (proto.tag.picture && proto.tag.picture.length > 0) {
                // For each embedded cover (could be multiple)
                for (const picture of proto.tag.picture) {
                    tryNewCover(album, track, picture.data);
                }
            }

            const dirCover = covers.get(proto.dir);
            if (dirCover !== undefined) {
                tryNewCover(album, null, dirCover);
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
        progress_bar.removeAttribute("max");
        progress_bar.removeAttribute("value");

        await Promise.all([
            Track.saveAll(db),
            Album.saveAll(db),
            Artist.saveAll(db),
        ]);

        Track.linkToArtists();
        Album.linkToArtists();

        load_dialog.close();
    }

    static async rescanLibrary(_db: IDBPDatabase) {

    }
}