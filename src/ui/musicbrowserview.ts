import { IDBPDatabase } from "idb";
import { Album } from "../album.ts";
import { Collection } from "../collection.ts";
import { Player } from "../player.ts";
import { Playlist } from "../playlist.ts";
import { convertTime } from "../time.ts";
import { Track } from "../track.ts";
import { CompareEntry, CompareFunction, compareSmartAlpha, compareStack, compareUndefinedLast, numberCompare } from "../util/sort.ts";
import { Artist } from "../artist.ts";
import { SelectableList } from "./selectablelist.ts";
import { BrowserState, MusicBrowser } from "../musicbrowser.ts";

declare const template_album: HTMLTemplateElement;
declare const template_track_list_item: HTMLTemplateElement;
declare const template_artist_list_item: HTMLTemplateElement;

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
    private static artistsSelList: SelectableList;

    private static tracksList: HTMLDivElement;
    private static tracksSelList: SelectableList;

    // private static breadcrumbs: HTMLDivElement;

    private static modeContainer: HTMLElement;
    private static modeSelect: HTMLSelectElement;

    private static sortContainer: HTMLElement;
    private static sortSelect: HTMLSelectElement;

    private static breadcrumbs: HTMLDivElement;

    private static browserMode: BrowserMode;
    private static albumSortMode: AlbumSortingMode;
    private static trackSortMode: TrackSortingMode;

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    static init(db: IDBPDatabase, element: HTMLDivElement) {
        this.db = db;

        this.rootElement = element;

        this.albumsList = this.rootElement.querySelector(".albums-list")!;

        this.artistsList = this.rootElement.querySelector(".artists-list")!;
        const artistTableBody = this.artistsList.querySelector("tbody")!;
        this.artistsSelList = SelectableList.register(artistTableBody);

        this.tracksList = this.rootElement.querySelector(".tracks-list")!;
        const trackTableBody = this.tracksList.querySelector("tbody")!;
        this.tracksSelList = SelectableList.register(trackTableBody);

        // this.breadcrumbs = document.querySelector("header > .breadcrumbs");
        this.modeContainer = document.querySelector("header #main_view_select")!;
        this.modeSelect = this.modeContainer.querySelector("select, :scope:where(select)")!;

        this.sortContainer = document.querySelector("header #main_view_sort")!;
        this.sortSelect = this.sortContainer.querySelector("select, :scope:where(select)")!;

        this.modeSelect.addEventListener("change", () => {
            const browserMode = this.modeSelect.value as BrowserMode;
            this.browserMode = browserMode;
            this.rootElement.dataset.mode = this.browserMode;
            this.db.put("config", this.browserMode, "browser_mode");
            this.update();
        });

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
                    Promise.resolve().then(() => this.update());
                    break;
                case "albums":
                    albumSort.then(() => this.update());
                    break;
                case "tracks":
                    trackSort.then(() => this.update());
                    break;
            }
        });

        MusicBrowser.attachObserver(this.browserObserver.bind(this));
    }

    private static browserObserver(state: BrowserState) {
        if (state.albumId !== null || state.artistId !== null) {
            this.hide();
            return;
        }

        this.show();
        this.update();
    }

    static updateSortComponent() {
        switch (this.browserMode) {
            case "artists":
                this.sortContainer.style.display = "none";
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
        const albumIds = MusicBrowser.collection ? Array.from(MusicBrowser.collection.getAlbumIds()) : Album.getAllIds();

        const albums = albumIds.map(albumId => Album.byID(albumId)!);

        let compareFn: CompareFunction<Album>;
        switch (this.albumSortMode) {
            case "album_name":
                compareFn = compareStack([
                    new CompareEntry(album => album.name, compareUndefinedLast(compareSmartAlpha)),
                    new CompareEntry(album => album.id, numberCompare)
                ]);
                break;
            case "album_artist":
                compareFn = compareStack([
                    new CompareEntry(album => album.getArtistName(), compareUndefinedLast(compareSmartAlpha)),
                    new CompareEntry(album => album.name, compareUndefinedLast(compareSmartAlpha)),
                    new CompareEntry(album => album.id, numberCompare)
                ]);
                break;
        }
        albums.sort(compareFn);

        this.albumsList.innerHTML = "";

        for (const album of albums) {
            this.albumsList.appendChild(this.getAlbumElement(album));
        }
    }

    static showArtists() {
        let artistIds;

        if (MusicBrowser.collection) {
            const artistSet = new Set<number>();

            const albumIds = Array.from(MusicBrowser.collection.getAlbumIds());
            for (const albumId of albumIds) {
                const album = Album.byID(albumId)!;
                if (album.artist) artistSet.add(album.artist);
            }

            const trackIds = Array.from(MusicBrowser.collection.getTrackIds());
            for (const trackId of trackIds) {
                const track = Track.byID(trackId)!;
                track.artists.forEach(artist => artistSet.add(artist));
            }

            artistIds = Array.from(artistSet);
        } else {
            artistIds = Array.from(Artist.artists.keys());
        }

        const artists = artistIds.map(artistId => Artist.byID(artistId)!);
        const compareFn: CompareFunction<Artist> = compareStack([
            new CompareEntry(artist => artist.name, compareUndefinedLast(compareSmartAlpha)),
            new CompareEntry(artist => artist.id, numberCompare)
        ]);
        artists.sort(compareFn);

        const tbody = this.artistsList.querySelector("tbody")!;
        tbody.innerHTML = "";

        for (const artist of artists) {
            tbody.appendChild(this.getArtistElement(artist));
        }
    }

    static showTracks() {
        const allTracks = Array.from(Track.getAllIds());
        console.log(allTracks);
        const collectionTracks = MusicBrowser.collection?.getTrackIds();
        console.log(collectionTracks);
        const trackIds = collectionTracks ? allTracks.filter(x => collectionTracks.has(x)) : allTracks;
        console.log(trackIds);

        const tracks = trackIds.map(trackId => Track.byID(trackId)!);
        const compareFn: CompareFunction<Track> = compareStack([
            new CompareEntry(track => Album.byID(track.albumId)!.getArtistName(), compareUndefinedLast(compareSmartAlpha)),
            new CompareEntry(track => Album.byID(track.albumId)!.name, compareUndefinedLast(compareSmartAlpha)),
            new CompareEntry(track => track.disc, (a, b) => (a ?? 0) - (b ?? 0)),
            new CompareEntry(track => track.no, (a, b) => (a ?? 0) - (b ?? 0)),
        ]);
        tracks.sort(compareFn);

        const tbody = this.tracksList.querySelector("tbody")!;
        tbody.innerHTML = "";

        for (const track of tracks) {
            const album = Album.byID(track.albumId)!;
            tbody.appendChild(this.getTrackElement(album, track));
        }
    }

    private static getAlbumElement(album: Album): DocumentFragment {
        const clone = document.importNode(template_album.content, true);

        const albumClick = function () {
            MusicBrowser.modify(state => state.albumId = album.id);
        }

        const cover: HTMLImageElement = clone.querySelector(".cover")!;
        cover.src = album.getCoverURL();
        cover.addEventListener("click", albumClick);

        const albumName: HTMLElement = clone.querySelector(".album-name")!;
        albumName.textContent = album.name ?? DEFAULT_ALBUM_NAME;
        albumName.title = album.name ?? DEFAULT_ALBUM_NAME;
        albumName.addEventListener("click", albumClick);

        const albumArtist: HTMLElement = clone.querySelector(".album-artist")!;
        const albumArtistName = album.getArtistName() ?? DEFAULT_ARTIST_NAME;
        albumArtist.textContent = albumArtistName;
        albumArtist.title = albumArtistName;

        albumArtist.addEventListener("click", () => MusicBrowser.navigate({
            collection: MusicBrowser.collection,
            artistId: album.artist
        }));

        return clone;
    }

    private static getTrackElement(album: Album, track: Track): DocumentFragment {
        const clone = document.importNode(template_track_list_item.content, true);

        const cells = clone.querySelectorAll("td");
        cells[0].title = cells[0].textContent = album.name ?? DEFAULT_ALBUM_NAME;
        cells[1].title = cells[1].textContent = album.getArtistName() ?? DEFAULT_ARTIST_NAME;
        cells[2].title = cells[2].textContent = track.disc ? `${track.disc}-${track.no}` : `${track.no ?? ""}`;
        cells[3].title = cells[3].textContent = track.title;
        cells[4].title = cells[4].textContent = convertTime(track.duration);
        cells[5].title = cells[5].textContent = Artist.getArtistString(track.artists) ?? "";

        clone.firstElementChild!.addEventListener("dblclick", () => {
            Playlist.add(track.id);
            Playlist.skipToEnd();
            Player.play();
        });

        return clone;
    }

    private static getArtistElement(artist: Artist): DocumentFragment {
        const clone = document.importNode(template_artist_list_item.content, true);

        const cells = clone.querySelectorAll("td");
        cells[0].title = cells[0].textContent = artist.name;
        cells[1].textContent = String(artist.albumIds.length);
        cells[2].textContent = String(artist.trackIds.length);

        clone.firstElementChild!.addEventListener("click", () => MusicBrowser.navigate({
            collection: MusicBrowser.collection,
            artistId: artist.id
        }));

        return clone;
    }
}