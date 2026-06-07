import { IDBPDatabase, IDBPTransaction } from "idb";
import { Album } from "./album.ts";
import { ProtoTrack, Track } from "./track.ts";
import { ensureReadPermission, FileSystem, FileSystemFile, ScanResult } from "./filesystem.ts";
import { Artist } from "./artist.ts";

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

    static processDeletedFiles(tx: IDBPTransaction<unknown, string[], "readwrite">, deleted: FileSystemFile[], changedAlbums: Set<number>, progressBar: HTMLProgressElement, loadingLabel: HTMLElement) {
		progressBar.max = deleted.length;

		for (let i = 0; i < deleted.length; i++) {
			const info = deleted[i];
            const trackId = Track.fileIdToTrackId.get(info.id);
            if (trackId !== undefined) {
                // Delete corresponding track (if exists)
                const track = Track.byID(trackId)!;
                const album = Album.byID(track.albumId)!;
                album.removeCover(info.id);

                // Find any other tracks in this directory from this album
                const dirFiles = FileSystem.getFilesInDirectory(FileSystem.getDirectoryPath(info.path));
                let other = false;
                const coverIds = [];
                for (const fileId of dirFiles) {
                    const otherTrackId = Track.fileIdToTrackId.get(fileId);
                    if (otherTrackId !== undefined) {
                        if (otherTrackId !== trackId && album.trackIds.includes(otherTrackId)) {
                            // We know there's another track from this album in this directory, so any cover in this directory is also
                            // "used" by the other track. We can break out, as there is not going to be anything to do.
                            other = true;
                            break;
                        }
                        continue;
                    }
                    const fileInfo = FileSystem.getFileByID(fileId)!;
                    if (!this.isCoverImage(fileInfo.mimeType, FileSystem.getFileName(fileInfo.path))) {
                        continue;
                    }
                    coverIds.push(fileId);
                }

                if (!other) {
                    for (const coverId of coverIds) {
                        album.removeCover(coverId);
                    }
                }

                track.delete(tx);
				changedAlbums.add(track.albumId);
            } else {
                // delete cover image
                const dirFiles = FileSystem.getFilesInDirectory(FileSystem.getDirectoryPath(info.path));
                for (const fileId of dirFiles) {
                    const trackId = Track.fileIdToTrackId.get(fileId);
                    if (trackId === undefined) continue;
                    const track = Track.byID(trackId)!;
                    const album = Album.byID(track.albumId)!;
                    album.removeCover(info.id);
                }
            }

            // Update progress bar
            progressBar.value = i + 1;
            loadingLabel.textContent = `Removed file ${i + 1} / ${deleted.length}`;
        }
    }

    // static async processChangedFiles(tx: IDBPTransaction<unknown, string[], "readwrite">, changed: ScannedFile[], progressBar: HTMLProgressElement) {

    // }

    private static isCoverImage(mimeType: string, filename: string) {
        return mimeType.startsWith("image") && /^(folder|cover)\..*/i.test(filename);
    }

    private static getOrCreateAlbum(albums: Album[], albumName: string | undefined, albumArtist: number | undefined): Album {
        const albumNameLower = albumName?.toLowerCase();
        let album = albums.find(album => album.name?.toLowerCase() === albumNameLower && album.artist === albumArtist);
        if (!album) {
            album = new Album();
            album.name = albumName;
            album.artist = albumArtist;
            albums.push(album);
        }
        return album;
    }

    static async updateLibrary(db: IDBPDatabase, dirHandle: FileSystemDirectoryHandle): Promise<ScanResult> {
        load_dialog.showModal();

        loading_lbl.textContent = "Scanning for library changes...";

        const changes = await FileSystem.scan(db, dirHandle, file => (
            file.type.startsWith("audio") ||
            this.isCoverImage(file.type, file.name)
        ));
        console.log(changes);

        const deleted = [...changes.removedFiles];
        deleted.push(...changes.changedFiles);

        const added = [...changes.newFiles];
        added.push(...changes.changedFiles);

        const progress_bar = document.getElementById("progress_bar")! as HTMLProgressElement;

        const changedTracks = new Set<number>();
        const changedAlbums = new Set<number>();
        const changedArtists = new Set<number>();

        const deleteTransaction = db.transaction([Track.STORE_NAME, Album.STORE_NAME, Artist.STORE_NAME, "collections"], "readwrite");
        this.processDeletedFiles(deleteTransaction, deleted, changedAlbums, progress_bar, loading_lbl);
        deleteTransaction.commit();

		// Remove any deleted albums from changed albums set, so as to not actually update
		for (const albumId of [...changedAlbums]) {
			const album = Album.byID(albumId);
			if (album === undefined) {
				changedAlbums.delete(albumId);
			}
		}

        let countDone = 0;
        progress_bar.max = added.length;

        const protos: ProtoTrack[] = [];
		for (const { id, handle, path, mimeType } of added) {
            const file = await handle.getFile();
            if (this.isCoverImage(mimeType, file.name)) {
                const dirPath = FileSystem.getDirectoryPath(path);
                const data = new Uint8Array(await file.arrayBuffer());
                const dirFiles = FileSystem.getFilesInDirectory(dirPath);
                for (const fileId of dirFiles) {
                    const trackId = Track.fileIdToTrackId.get(fileId);
                    if (trackId === undefined) continue;
                    const track = Track.byID(trackId)!;
                    const album = Album.byID(track.albumId)!;
                    album.addCover(id, data);
                    changedAlbums.add(album.id);
                }
            } else {
                // is audio, by scan filter above
                const proto = await Track.getTrackMetadata(file, id, path);
                if (proto) {
                    protos.push(proto);
                }
            }
            countDone++;
            progress_bar.value = countDone;
            loading_lbl.textContent = `Added new file ${countDone} / ${added.length}`;
		}

        loading_lbl.textContent = `Constructing albums from ${protos.length} discovered tracks`;
        progress_bar.removeAttribute("max");
        progress_bar.removeAttribute("value");

        // Preload with existing albums
        const albums = [...Album.albums.values()];

        // Add tracks to album or create one if the album does not exist
        for (const proto of protos) {
            const albumName = proto.tag.album;

            const newAlbumArtist = proto.tag.albumartist ? Artist.getOrCreate(proto.tag.albumartist, changedArtists) : undefined;

            const album = this.getOrCreateAlbum(albums, albumName, newAlbumArtist);

            const track = Track.createFromProtoTrack(proto, album.id, changedArtists);
            album.trackIds.push(track.id);

            // Try each embedded cover (there could be multiple)
            if (proto.tag.picture && proto.tag.picture.length > 0) {
                for (const picture of proto.tag.picture) {
                    const coverIndex = album.addCover(proto.fileId, picture.data);
					if (coverIndex === null) continue;
					track.coverIndices.push(coverIndex);
                }
            }

            // Search for neighboring cover images, and add them to the album of the track
            const dirPath = FileSystem.getDirectoryPath(proto.path);
            const dirFiles = FileSystem.getFilesInDirectory(dirPath);
            for (const fileId of dirFiles) {
                const fileInfo = FileSystem.getFileByID(fileId)!;
                if (!this.isCoverImage(fileInfo.mimeType, FileSystem.getFileName(fileInfo.path))) continue;
                if (album.hasCover(fileId)) continue;

                // Proceed only if the file is an image and is not already part of the album
                const coverFile = await fileInfo.handle.getFile();
                const data = new Uint8Array(await coverFile.arrayBuffer());
                album.addCover(fileId, data);
            }

            changedTracks.add(track.id);
            changedAlbums.add(album.id);
        }

        for (const albumId of changedAlbums) {
            const album = Album.byID(albumId)!;
            album.sortTracks();
        }

        loading_lbl.textContent = "Synchronizing library to database...";
        progress_bar.removeAttribute("max");
        progress_bar.removeAttribute("value");

        // Make sure deletion is done
        await deleteTransaction.done;

        console.log({ changedTracks, changedAlbums, changedArtists });

        if (changedTracks.size > 0 || changedAlbums.size > 0 || changedArtists.size > 0) {
            const updateTransaction = db.transaction([Track.STORE_NAME, Album.STORE_NAME, Artist.STORE_NAME], "readwrite");
    
            const tracksStore = updateTransaction.objectStore(Track.STORE_NAME);
            for (const trackId of changedTracks) {
                const track = Track.byID(trackId)!;
                track.save(tracksStore);
            }
    
            const albumsStore = updateTransaction.objectStore(Album.STORE_NAME);
            for (const albumId of changedAlbums) {
                const album = Album.byID(albumId)!;
                album.save(albumsStore);
            }
    
            const artistsStore = updateTransaction.objectStore(Artist.STORE_NAME);
            for (const artistId of changedArtists) {
                const artist = Artist.byID(artistId)!;
                artist.save(artistsStore);
            }
    
            // Catch up to everything
            updateTransaction.commit();
            await updateTransaction.done;
        }

        load_dialog.close();

        loading_lbl.textContent = "Linking artists...";
        progress_bar.removeAttribute("max");
        progress_bar.removeAttribute("value");

        // affects in-memory only
        Track.linkToArtists();
        Album.linkToArtists();

        return changes;
    }

    static async loadLibrary(db: IDBPDatabase, _forceRescan: boolean) {
        await Promise.all([
            Track.loadAll(db),
            Album.loadAll(db),
            Artist.loadAll(db),
        ]);

        Track.linkToArtists();
        Album.linkToArtists();

        let newLibrary = false;
        let dirHandle = await this.loadRootHandle(db);
        if (!dirHandle || !await ensureReadPermission(dirHandle)) {
            this.testSupported();
            dirHandle = await this.showSelectLibraryDialog();
            await this.saveRootHandle(db, dirHandle);
            newLibrary = true;
        } /* else if (!forceRescan) {
            return;
        } */

        const changes = await this.updateLibrary(db, dirHandle);

        if (newLibrary) {
            this.showLibraryLoadSuccessDialog();
        }

        if (changes.newFiles.length > 0 || changes.changedFiles.length > 0 || changes.removedFiles.length > 0) {
            // TODO changes dialog
        }
    }
}