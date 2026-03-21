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

    private static testSupported(): void {
        if ((window as unknown as Window).showDirectoryPicker) {
            return;
        }

        const unsupportedDialog = document.createElement("dialog");
        unsupportedDialog.style.width = "400px"
        unsupportedDialog.innerHTML = `
            <div class="content">
                <h2>Error: Unsupported Browser or context</h2>
                <p>It appears your browser does not support the <code>Window.showDirectoryPicker()</code> function, which is needed by this application, or you are accessing the page via an insecure context.</p>
                <p>For now, you'll need to use a chromium-based browser (such as Google Chrome, Microsoft Edge, Brave, Chromium, and others) and use a secure context to run this app.</p>
            </div>
            <div class="button-bar">
                <div class="glue"></div>
                <button>Close</button>
            </div>
        `;

        const okButton = unsupportedDialog.querySelector("button")!;
        okButton.addEventListener("click", () => {
            unsupportedDialog.close();
            unsupportedDialog.remove();
        });

        document.body.appendChild(unsupportedDialog);
        unsupportedDialog.showModal();

        throw new Error("Directory picker unsupported");
    }

    private static async showSelectLibraryDialog(): Promise<FileSystemDirectoryHandle> {
        const chooseLibraryDialog = document.createElement("dialog");
        chooseLibraryDialog.style.width = "400px";
        chooseLibraryDialog.innerHTML = `
            <div class="content">
                <h2>Welcome!</h2>
                <p>It appears this is your first time here. To begin, please select the location of your music library.</p>
            </div>
            <div class="button-bar">
                <div class="glue"></div>
                <button>Select Library</button>
            </div>
        `;

        const button = chooseLibraryDialog.querySelector("button")!;

        document.body.appendChild(chooseLibraryDialog);

        return await new Promise(resolve => {
            button.addEventListener("click", async () => {
                const dirHandle = await (window as unknown as Window).showDirectoryPicker();
                const hasPermission = await ensureReadPermission(dirHandle);
                if (!hasPermission) throw new Error("Unable to get read permission for root handle!");
                chooseLibraryDialog.close();
                chooseLibraryDialog.remove();
                resolve(dirHandle);
            });
            chooseLibraryDialog.showModal();
        });
    }

    private static showLibraryLoadSuccessDialog(): void {
        const loadSuccessDialog = document.createElement("dialog");
        loadSuccessDialog.style.width = "500px";
        loadSuccessDialog.innerHTML = `
            <div class="content">
                <h2>Library loaded successfully</h2>
                <p>The music library you selected has been loaded. Here is what was discovered:</p>
                <ul>
                    <li>${Track.tracks.size} tracks</li>
                    <li>${Album.albums.size} albums</li>
                    <li>${Artist.artists.size} artists</li>
                </ul>
                <p>Please note that this program is in its early stages and that bugs are bound to exist. If you find a bug, feel free to report it
                to <a href="mailto:feedback@orangeisbetter.net" class="nohover">feedback@orangeisbetter.net</a> or create an issue on
                <a href="https://github.com/orangeisbetter/basedmediaplayer" target="_blank" class="nohover">the GitHub page</a>.</p>
                <p>Enjoy!</p>
            </div>
            <div class="button-bar">
                <div class="glue"></div>
                <button>Get started</button>
            </div>
        `;

        const okButton = loadSuccessDialog.querySelector("button")!;
        okButton.addEventListener("click", () => {
            loadSuccessDialog.close();
            loadSuccessDialog.remove();
        })

        document.body.appendChild(loadSuccessDialog);
        loadSuccessDialog.showModal();
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

        let dirHandle = await this.loadRootHandle(db);
        if (!dirHandle || !await ensureReadPermission(dirHandle)) {
            this.testSupported();
            dirHandle = await this.showSelectLibraryDialog();
            await this.saveRootHandle(db, dirHandle);
        }

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

        this.showLibraryLoadSuccessDialog();
    }

    static async rescanLibrary(_db: IDBPDatabase) {

    }
}