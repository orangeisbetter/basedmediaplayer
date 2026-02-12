import { IDBPDatabase } from "idb";
import { Album } from "../album.ts";
import { Collection } from "../collection.ts";
import { Player } from "../player.ts";
import { Playlist } from "../playlist.ts";
import { convertTime } from "../time.ts";
import { Track } from "../track.ts";
import { AlbumDisplay } from "./albumdisplay.ts";

declare const template_album: HTMLTemplateElement;
declare const template_track_list_item: HTMLTemplateElement;

type AlbumClickHandler = (albumId: number, collection: Collection) => void;
type BrowserMode = "artists" | "albums" | "tracks";
type AlbumSortingMode = "album_name" | "album_artist";
type TrackSortingMode = string;

const DEFAULT_ALBUM_NAME = "Unknown album";
const DEFAULT_ARTIST_NAME = "Unknown artist";

export class MusicBrowserView {
    private static db: IDBPDatabase;

    private static rootElement: HTMLDivElement;

    private static albumsList: HTMLDivElement;
    private static artistsList: HTMLDivElement;
    private static tracksList: HTMLDivElement;

    // private static breadcrumbs: HTMLDivElement;

    private static modeContainer: HTMLElement;
    private static modeSelect: HTMLSelectElement;

    private static sortContainer: HTMLElement;
    private static sortSelect: HTMLSelectElement;

    private static browserMode: BrowserMode;
    private static albumSortMode: AlbumSortingMode;
    private static trackSortMode: TrackSortingMode;
    private static collection: Collection | null = null;

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    static init(db: IDBPDatabase, element: HTMLDivElement) {
        this.db = db;

        this.rootElement = element;

        this.albumsList = this.rootElement.querySelector(".albums-list")!;
        this.artistsList = this.rootElement.querySelector(".artists-list")!;
        this.tracksList = this.rootElement.querySelector(".tracks-list")!;

        // this.breadcrumbs = document.querySelector("header > .breadcrumbs");
        this.modeContainer = document.querySelector("header #main_view_select")!;
        this.modeSelect = this.modeContainer.querySelector("select, :scope:where(select)")!;

        this.modeSelect.addEventListener("change", () => {
            const browserMode = this.modeSelect.value as BrowserMode;
            this.browserMode = browserMode;
            this.rootElement.dataset.mode = this.browserMode;
            this.db.put("config", this.browserMode, "browser_mode");
            this.update();
        });

        this.sortContainer = document.querySelector("header #main_view_sort")!;
        this.sortSelect = this.sortContainer.querySelector("select, :scope:where(select)")!;

        this.sortSelect.addEventListener("change", () => {
            switch (this.browserMode) {
                case "artists":
                    break;
                case "albums":
                    this.albumSortMode = this.sortSelect.value as AlbumSortingMode;
                    this.db.put("config", this.albumSortMode, "browser_album_sort_mode");
                    break;
                case "tracks":
                    this.trackSortMode = this.sortSelect.value as TrackSortingMode;
                    this.db.put("config", this.albumSortMode, "browser_track_sort_mode");
                    break;
            }
            this.update();
        });

        const albumSort = db.get("config", "browser_album_sort_mode").then(albumSortMode => this.albumSortMode = albumSortMode);
        const trackSort = db.get("config", "browser_track_sort_mode").then(trackSortMode => this.trackSortMode = trackSortMode);

        db.get("config", "browser_mode").then((browserMode: BrowserMode) => {
            this.browserMode = browserMode;
            this.modeSelect.value = this.browserMode;
            this.modeContainer.style.display = "";
            this.rootElement.dataset.mode = this.browserMode;

            switch (browserMode) {
                case "artists":
                    // ???
                    break;
                case "albums":
                    albumSort.then(() => this.update());
                    break;
                case "tracks":
                    trackSort.then(() => this.update());
                    break;
            }
        });
    }

    static setCollection(collection: Collection | null) {
        if (this.collection != collection) {
            this.collection = collection;
            // this.breadcrumbs.textContent = `> ${this.collection ? "Collections" : "Local library"} > ${this.getCollectionPath(this.collection)}`;
            this.update();
        }
    }

    static updateSortComponent() {
        switch (this.browserMode) {
            case "artists":
                break;
            case "albums":
                this.sortContainer.style.display = "";
                this.sortSelect.options.length = 0;
                this.sortSelect.options.add(new Option("Album artist", "album_artist"));
                this.sortSelect.options.add(new Option("Album name", "album_name"));
                this.sortSelect.value = this.albumSortMode;
                break;
            case "tracks":
                this.sortContainer.style.display = "none";
                break;
        }
    }

    static show() {
        this.rootElement.style.display = "";
        this.modeContainer.style.display = "";
        this.updateSortComponent();
    }

    static hide() {
        this.rootElement.style.display = "none";
        this.modeContainer.style.display = "none";
        this.sortContainer.style.display = "none";
    }

    static update() {
        this.updateSortComponent();

        switch (this.browserMode) {
            case "albums":
                this.showAlbums();
                break;
            case "artists":
                this.showArtists();
                break;
            case "tracks":
                this.showTracks();
                break;
        }
    }

    static showAlbums() {
        const albumIds = this.collection ? Array.from(this.collection.getAlbumIds()) : Album.getAllIds();

        const albums = albumIds.map(albumId => Album.byID(albumId)!);
        switch (this.albumSortMode) {
            case "album_name":
                albums.sort((a, b) => {
                    if (a.name !== b.name) {
                        if (a.name === undefined) return 1;
                        if (b.name === undefined) return -1;
                        return a.name.localeCompare(b.name);
                    }

                    return a.id - b.id;
                });
                break;
            case "album_artist":
                albums.sort((a, b) => {
                    if (a.artist !== b.artist) {
                        if (a.artist === undefined) return 1;
                        if (b.artist === undefined) return -1;
                        return a.artist.localeCompare(b.artist);
                    }

                    if (a.name !== b.name) {
                        if (a.name === undefined) return 1;
                        if (b.name === undefined) return -1;
                        return a.name.localeCompare(b.name);
                    }

                    return a.id - b.id;
                });
                break;
        }

        this.albumsList.innerHTML = "";

        for (const album of albums) {
            this.albumsList.appendChild(this.getAlbumElement(album));
        }
    }

    static showArtists() {
        throw new Error("Not implemented");
    }

    static showTracks() {
        const allTracks = Array.from(Track.getAllIds());
        const collectionTracks = this.collection?.trackIds;
        const tracks = this.collection ? allTracks.filter(x => collectionTracks!.has(x)) : allTracks;

        const tbody = this.tracksList.querySelector("tbody")!;

        tbody.innerHTML = "";

        for (const trackId of tracks) {
            const track = Track.byID(trackId)!;
            const album = Album.byID(track.albumId)!;
            tbody.appendChild(this.getTrackElement(album, track));
        }
    }

    private static getAlbumElement(album: Album): DocumentFragment {
        const clone = document.importNode(template_album.content, true);

        const cover: HTMLImageElement = clone.querySelector(".cover")!;
        cover.src = album.getCoverURL();
        cover.addEventListener("click", () => AlbumDisplay.displayAlbum(album.id, this.collection));

        const albumName: HTMLElement = clone.querySelector(".album-name")!;
        albumName.textContent = album.name ?? DEFAULT_ALBUM_NAME;
        albumName.title = album.name ?? DEFAULT_ALBUM_NAME;
        albumName.addEventListener("click", () => AlbumDisplay.displayAlbum(album.id, this.collection));

        const albumArtist: HTMLElement = clone.querySelector(".album-artist")!;
        albumArtist.textContent = album.artist ?? DEFAULT_ARTIST_NAME;
        albumArtist.title = album.artist ?? DEFAULT_ARTIST_NAME;

        return clone;
    }

    private static getTrackElement(album: Album, track: Track): DocumentFragment {
        const clone = document.importNode(template_track_list_item.content, true);

        const cells = clone.querySelectorAll("td");
        cells[0].title = cells[0].textContent = album.name ?? DEFAULT_ALBUM_NAME;
        cells[1].title = cells[1].textContent = album.artist ?? DEFAULT_ARTIST_NAME;
        cells[2].title = cells[2].textContent = track.disc ? `${track.disc}-${track.no}` : `${track.no ?? ""}`;
        cells[3].title = cells[3].textContent = track.title;
        cells[4].title = cells[4].textContent = convertTime(track.duration);
        cells[5].title = cells[5].textContent = track.artist ?? "";

        clone.firstElementChild!.addEventListener("dblclick", () => {
            Playlist.add(track.id);
            Playlist.skipToEnd();
            Player.play();
        });

        return clone;
    }
}