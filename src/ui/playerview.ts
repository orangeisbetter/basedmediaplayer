import { Album } from "../album.ts";
import { Artist } from "../artist.ts";
import { MusicBrowser } from "../musicbrowser.ts";
import { PlaybackController } from "../playbackcontroller.ts";
import { Player } from "../player.ts";
import { LoopMode, Playlist, PlaylistShuffleEventData, PlaylistTrackChangeEventData } from "../playlist.ts";
import { convertTime } from "../time.ts";
import { Track } from "../track.ts";
import { PlaylistView } from "./playlistview.ts";

export class PlayerView {
    private static rootElement: HTMLElement;

    private static albumCoverImage: HTMLImageElement;
    private static albumNameLabel: HTMLElement;
    private static albumArtistLabel: HTMLElement;

    private static skipPreviousButton: HTMLButtonElement;
    private static skipNextButton: HTMLButtonElement;
    private static playPauseButton: HTMLButtonElement;
    private static playPauseIcon: HTMLElement;

    private static trackTitleLabel: HTMLElement;
    private static trackTimeLabel: HTMLElement;
    private static trackProgressBar: HTMLElement;

    private static volumeControlButton: HTMLButtonElement;
    private static volumeLabel: HTMLElement;
    private static playlistToggleButton: HTMLButtonElement;
    private static lyricsViewButton: HTMLButtonElement;
    private static loopButton: HTMLButtonElement;
    private static loopIcon: HTMLElement;

    private static lyricsPanel: HTMLElement;

    private static trackId: number | null = null;

    constructor() {
        throw Error("This static class cannot be instantiated.");
    }

    static init(root: HTMLElement) {
        this.rootElement = root;

        this.albumCoverImage = this.rootElement.querySelector(":scope > .album-info > .cover")!;
        this.albumNameLabel = this.rootElement.querySelector(":scope > .album-info > .album-name")!;
        this.albumArtistLabel = this.rootElement.querySelector(":scope > .album-info > .album-artist")!;

        this.skipPreviousButton = this.rootElement.querySelector(":scope > .media > .controls > .skip-previous")!;
        this.skipNextButton = this.rootElement.querySelector(":scope > .media > .controls > .skip-next")!;
        this.playPauseButton = this.rootElement.querySelector(":scope > .media > .controls > .play-pause")!;
        this.playPauseIcon = this.playPauseButton.querySelector("iconify-icon")!;

        this.trackTitleLabel = this.rootElement.querySelector(":scope > .media > .current-media > .track-title")!;
        this.trackTimeLabel = this.rootElement.querySelector(":scope > .media > .current-media > .track-time")!;
        this.trackProgressBar = this.rootElement.querySelector(":scope > .media > .current-media > .progress-bar")!;

        this.volumeControlButton = this.rootElement.querySelector(":scope > .additional-controls > .volume-control")!;
        this.volumeLabel = this.volumeControlButton.querySelector(":scope > .volume-label")!;
        this.playlistToggleButton = this.rootElement.querySelector(":scope > .additional-controls > .playlist-toggle")!;
        this.lyricsViewButton = this.rootElement.querySelector(":scope > .additional-controls > .lyrics-view")!;
        this.loopButton = this.rootElement.querySelector(":scope > .additional-controls > .loop")!;
        this.loopIcon = this.loopButton.querySelector("iconify-icon")!;

        this.lyricsPanel = document.querySelector(".lyrics-panel")!;

        this.playPauseButton.addEventListener("click", this.playPauseButtonHandler);
        this.skipPreviousButton.addEventListener("click", () => PlaybackController.skipPreviousAndPlay());
        this.skipNextButton.addEventListener("click", () => PlaybackController.skipNextAndPlay());

        const albumClick = function () {
            const track = Player.getCurrentTrack();
            if (track === null) return;
            MusicBrowser.navigate({
                albumId: track.albumId
            });
        }

        this.albumCoverImage.addEventListener("click", albumClick);
        this.albumNameLabel.addEventListener("click", albumClick);

        const albumArtistClick = function () {
            const track = Player.getCurrentTrack();
            if (track === null) return;
            const album = Album.byID(track.albumId)!;
            if (album.artist === undefined) return;
            MusicBrowser.navigate({
                artistId: album.artist
            });
        }

        this.albumArtistLabel.addEventListener("click", albumArtistClick);

        this.playlistToggleButton.addEventListener("click", PlaylistView.toggleVisibility);
        this.lyricsViewButton.addEventListener("click", () => {
            if (this.lyricsPanel.style.display === "none") {
                this.lyricsPanel.textContent = Player.getCurrentTrack()?.lyrics?.[0] ?? "";
                this.lyricsPanel.style.display = "";
            } else {
                this.lyricsPanel.style.display = "none";
            }
        });

        this.loopButton.addEventListener("click", () => this.loopButtonClick());

        switch (Playlist.loopMode) {
            case LoopMode.Playlist:
                this.loopButton.classList.add("active");
                break;
            case LoopMode.Track:
                this.loopButton.classList.add("active");
                this.loopIcon.setAttribute("icon", "mdi:repeat-once");
                break;
            default:
                break;
        }

        // Volume control
        this.setupVolumeControl();

        // Progress bar / slider
        this.setupProgressSlider();

        // Event listener attaching
        Playlist.events.numTracksChange.addListener(this.skipButtonCheck.bind(this));
        Playlist.events.trackChange.addListener(this.skipButtonCheck.bind(this));
        Playlist.events.reorder.addListener(this.skipButtonCheck.bind(this));
        Playlist.events.shuffle.addListener(this.shuffleHandler.bind(this));
        Playlist.events.trackChange.addListener(this.trackChangeHandler.bind(this));
        Player.events.timeChange.addListener(this.timeChangeHandler.bind(this));
        Player.events.play.addListener(this.playHandler.bind(this));
        Player.events.pause.addListener(this.pauseHandler.bind(this));

        MusicBrowser.attachObserver(() => this.observerHandler());
    }

    private static setupVolumeControl() {
        let locked = false;
        let valid = false;

        this.volumeControlButton.addEventListener("mousedown", () => {
            this.volumeControlButton.requestPointerLock();

            this.volumeLabel.textContent = Player.volumeDB.toFixed(1) + " dB";
        });
        this.volumeControlButton.addEventListener("mouseup", () => {
            document.exitPointerLock();
            Player.saveVolume();
        });
        this.volumeControlButton.addEventListener("wheel", event => {
            const deltaY = -event.deltaY;
            let scale;
            switch (event.deltaMode) {
                case WheelEvent.DOM_DELTA_PIXEL:
                    scale = 1.5 / 120;
                    break;
                case WheelEvent.DOM_DELTA_LINE:
                    scale = 1.5 / 5;
                    break;
                case WheelEvent.DOM_DELTA_PAGE:
                    scale = 1.5 / 10;
                    break;
                default:
                    scale = 0.2;
            }
            const deltaDb = deltaY * scale;
            Player.volumeDB = Math.max(-40, Math.min(Player.volumeDB + deltaDb, 0));
            this.volumeLabel.textContent = Player.volumeDB.toFixed(1) + " dB";
            this.volumeLabel.style.display = "";
        }, { passive: false });
        this.volumeControlButton.addEventListener("mouseout", () => {
            if (document.pointerLockElement !== this.volumeControlButton) {
                this.volumeLabel.style.display = "none";
                Player.saveVolume();
            }
        });

        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === this.volumeControlButton) {
                this.volumeLabel.style.display = "";
                locked = true;
                valid = false;
            } else {
                this.volumeLabel.style.display = "none";
                locked = false;
            }
        });

        this.volumeControlButton.addEventListener("mousemove", event => {
            if (!locked) return;

            if (!valid) {
                valid = true;
                return;
            }

            const deltaDb = -event.movementY * 0.2;
            Player.volumeDB = Math.max(-40, Math.min(Player.volumeDB + deltaDb, 0));

            this.volumeLabel.textContent = Player.volumeDB.toFixed(1) + " dB";
        });
    }

    private static setupProgressSlider() {
        const thumb: HTMLDivElement = this.trackProgressBar.querySelector(":scope > .thumb")!;
        const hoverCatch: HTMLDivElement = this.trackProgressBar.querySelector(":scope > .hovercatch")!;

        let dragging = false;

        const setProgressFromEvent = (event: PointerEvent) => {
            const rect = this.trackProgressBar.getBoundingClientRect();
            let x = event.clientX - rect.left;
            x = Math.max(0, Math.min(x, rect.width));

            const ratio = (x / rect.width);
            const percent = ratio * 100;
            this.trackProgressBar.style.setProperty("--progress", `${percent}%`);

            Player.seekTo(Player.getCurrentTrackDuration()! * ratio);
        }

        thumb.addEventListener("pointerdown", (event: PointerEvent) => {
            if (Player.getCurrentTrack()) {
                dragging = true;
                thumb.setPointerCapture(event.pointerId);
                setProgressFromEvent(event);
            }
        });

        hoverCatch.addEventListener("pointerdown", (event: PointerEvent) => {
            if (Player.getCurrentTrack()) {
                dragging = true;
                thumb.setPointerCapture(event.pointerId);
                setProgressFromEvent(event);
            }
        })

        globalThis.addEventListener("pointermove", event => {
            if (!dragging) return;
            setProgressFromEvent(event);
        });

        globalThis.addEventListener("pointerup", () => {
            dragging = false;
        });
    }

    private static observerHandler() {
        // this is here because the title updates properly but the browser doesn't think it changed, so
        // we need to do an explicit change manually om lol lmao rofl
        document.title = "Based Media Player";
        setTimeout(() => this.updateTitle(), 0);
    }

    private static updateTitle() {
        if (this.trackId) {
            const track = Track.byID(this.trackId)!;

            const artistString = Artist.getArtistString(track.artists);
            document.title = track.title + `${artistString ? " - " + artistString : ""}`;
        } else {
            document.title = "Nothing is playing";
        }
    }

    private static skipButtonCheck() {
        this.skipPreviousButton.disabled = !Playlist.hasPrevious();
        this.skipNextButton.disabled = !Playlist.hasNext();
    }

    private static playPauseButtonHandler() {
        if (Player.isPlaying()) {
            Player.pause();
        } else {
            Player.play();
        }
    }

    private static playHandler() {
        this.playPauseIcon.setAttribute("icon", "mdi:pause");
        navigator.mediaSession.playbackState = "playing";
    }

    private static pauseHandler() {
        this.playPauseIcon.setAttribute("icon", "mdi:play");
        navigator.mediaSession.playbackState = "paused";
    }

    private static loopButtonClick() {
        switch (Playlist.loopMode) {
            case LoopMode.None:
                Playlist.loopMode = LoopMode.Playlist;
                this.loopButton.classList.add("active");
                break;
            case LoopMode.Playlist:
                Playlist.loopMode = LoopMode.Track;
                this.loopIcon.setAttribute("icon", "mdi:repeat-once");
                break;
            case LoopMode.Track:
                Playlist.loopMode = LoopMode.None;
                this.loopButton.classList.remove("active");
                this.loopIcon.setAttribute("icon", "mdi:repeat");
                break;
        }
    }

    private static trackChangeHandler({ id }: PlaylistTrackChangeEventData) {
        if (this.trackId === null && id !== null) {
            navigator.mediaSession.setActionHandler("play", () => Player.play());
            navigator.mediaSession.setActionHandler("pause", () => Player.pause());
            navigator.mediaSession.setActionHandler("previoustrack", () => PlaybackController.skipPreviousAndPlay());
            navigator.mediaSession.setActionHandler("nexttrack", () => PlaybackController.skipNextAndPlay());
            navigator.mediaSession.setActionHandler("stop", () => Playlist.clear());
        } else if (id === null) {
            navigator.mediaSession.playbackState = "none";
            navigator.mediaSession.metadata = null;

            navigator.mediaSession.setActionHandler("play", null);
            navigator.mediaSession.setActionHandler("pause", null);
            navigator.mediaSession.setActionHandler("previoustrack", null);
            navigator.mediaSession.setActionHandler("nexttrack", null);
            navigator.mediaSession.setActionHandler("stop", null);
        }

        this.trackId = id;

        this.playPauseIcon.setAttribute("icon", "mdi:play");
        this.trackProgressBar.style.setProperty('--progress', `0%`);

        if (id === null) {
            this.trackProgressBar.classList.add("disabled");

            this.playPauseButton.disabled = true;
            this.trackTitleLabel.textContent = "Nothing is playing";
            this.trackTimeLabel.textContent = "";

            this.albumNameLabel.textContent = "";
            this.albumArtistLabel.textContent = "";
            this.albumCoverImage.src = "";
            this.albumCoverImage.style.display = "none";

            this.lyricsViewButton.disabled = true;

            document.title = `Nothing is playing`;
            return;
        }

        const track = Track.byID(id);
        if (!track) return;

        this.trackProgressBar.classList.remove("disabled");

        this.playPauseButton.disabled = false;
        this.trackTitleLabel.textContent = track.title;
        this.trackTimeLabel.textContent = `${convertTime(0)} / ${convertTime(track.duration)}`;

        const album = Album.byID(track.albumId)!;
        this.albumNameLabel.textContent = album.name ?? "Unknown Album";
        this.albumArtistLabel.textContent = album.getArtistName() ?? "Unknown Artist";
        this.albumCoverImage.src = album.getCoverURL(track.coverIndex);
        this.albumCoverImage.style.display = "";

        if (track.lyrics && track.lyrics?.length > 0) {
            this.lyricsPanel.textContent = track.lyrics[0]!;
            this.lyricsViewButton.disabled = false;
        } else {
            this.lyricsPanel.style.display = "none";
            this.lyricsViewButton.disabled = true;
        }

        this.updateTitle();

        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: Artist.getArtistString(track.artists),
            album: album.name,
            artwork: [{ src: album.getCoverURL(track.coverIndex) }]
        });
    }

    private static shuffleHandler({ }: PlaylistShuffleEventData) {
        this.skipButtonCheck();
    }

    private static timeChangeHandler(time: number) {
        const track = Player.getCurrentTrack();
        if (track === null) return;
        const duration = track.duration ?? 0;
        this.trackTimeLabel.textContent = `${convertTime(time)} / ${convertTime(duration)}`;
        this.trackProgressBar.style.setProperty('--progress', `${time * 100 / (duration)}%`);
    }
}