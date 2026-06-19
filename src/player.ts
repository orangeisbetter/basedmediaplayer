import { IDBPDatabase } from "idb";
import { Emitter } from "./emitter.ts";
import { Track } from "./track.ts";
import { FileSystem } from "./filesystem.ts";

export enum PlayerErrorCode {
	FILE_NOT_FOUND,
	PERMISSION_DENIED,
	HANDLE_INACCESSIBLE,
	UNSUPPORTED_FORMAT,
	PLAYBACK_ABORTED,
	DECODE,
	UNKNOWN,
};

export class PlayerError extends Error {
	constructor(public readonly code: PlayerErrorCode, message: string, public readonly originalError?: unknown) {
		super(message);
		this.name = "PlayerError";
	}
}

export class Player {
    private static db: IDBPDatabase;

	private static currentTrackId: number | null = null;
    private static currentTrack: Track | null = null;
    private static file: Blob | null = null;
    private static url: string;
    private static playing: boolean = false;
    private static _volume: number;

    private static audioContext: AudioContext;
    private static gainNode: GainNode;
    public static audio: HTMLAudioElement;
    private static track: MediaElementAudioSourceNode;

    private static loadPromise: Promise<void> = Promise.resolve();

    static events = {
        play: new Emitter<number>(),
        pause: new Emitter<number>(),
        finish: new Emitter<number>(),
        clear: new Emitter<void>(),
        timeChange: new Emitter<number>(),
		error: new Emitter<PlayerError>(),
    };

    constructor() {
        throw Error("This static class cannot be instantiated.");
    }

    static async init(db: IDBPDatabase) {
        Player.audioContext = new AudioContext();
        Player.gainNode = Player.audioContext.createGain();
        Player.gainNode.connect(Player.audioContext.destination);
        Player.audio = new Audio();
        Player.track = Player.audioContext.createMediaElementSource(Player.audio);
        Player.track.connect(Player.gainNode);

        Player.audio.addEventListener("ended", Player.endedHandler);
        Player.audio.addEventListener("timeupdate", Player.timeUpdateHandler);

        Player.db = db;
        Player.volumeDB = await Player.db.get("config", "volume");
    }

    static changeTrack(trackId: number | null): void {
		// Prevent changing tracks if the track id is the same as current (nothing to do)
		if (trackId === Player.currentTrackId) {
			return;
		}
		Player.currentTrackId = trackId;
		
		Player.playing = false;
		Player.audio.pause();
		Player.audio.removeAttribute("src");
		
        if (trackId === null) {
			Player.currentTrack = null;
			Player.audio.load();
            Player.events.clear.emit();
		} else {
			const track = Track.byID(trackId)!;
			Player.currentTrack = track;
			Player.loadPromise = Player.loadTrackAudio(FileSystem.getFileByID(Player.currentTrack.fileId)!.handle);
			Player.loadPromise.catch(() => {});
		}
    }

    private static async loadTrackAudio(fileHandle: FileSystemFileHandle): Promise<void> {
        const opts = { mode: "read" };

		try {
			if (
				(await fileHandle.queryPermission(opts)) !== "granted" &&
				(await fileHandle.requestPermission(opts)) !== "granted"
			) {
				throw new PlayerError(PlayerErrorCode.PERMISSION_DENIED, "Permission to access file was denied.");
			}
		} catch (e: unknown) {
			if (e instanceof PlayerError) throw e;
			if ((e as Error).name === "NotAllowedError") {
				throw new PlayerError(PlayerErrorCode.PERMISSION_DENIED, "Permission to access file was denied.", e);
			}
			throw new PlayerError(PlayerErrorCode.UNKNOWN, "Unexpected error while requesting file permission.", e);
		}

		try {
			Player.file = await fileHandle.getFile();
		} catch (e: unknown) {
			if ((e as Error).name === "NotFoundError") {
				throw new PlayerError(PlayerErrorCode.FILE_NOT_FOUND, "File no longer exists or has been moved.", e);
			}
			throw new PlayerError(PlayerErrorCode.UNKNOWN, "Unexpected error while accessing file.", e);
		}

		if (Player.url) URL.revokeObjectURL(Player.url);
		Player.url = URL.createObjectURL(Player.file);

		await new Promise<void>((resolve, reject) => {
			const loadHandler = () => {
				removeHandlers();
				resolve();
			}
			
			const errorHandler = () => {
				removeHandlers();
				reject(Player.toPlayerError(Player.audio.error));
			}
	
			const removeHandlers = () => {
				Player.audio.removeEventListener("canplay", loadHandler);
				Player.audio.removeEventListener("error", errorHandler);
			}
	
			Player.audio.addEventListener("canplay", loadHandler);
			Player.audio.addEventListener("error", errorHandler);
			
			Player.audio.src = Player.url;
		});
    }

	private static toPlayerError(e: unknown): PlayerError {
		if (e instanceof PlayerError) return e;
		if (e instanceof DOMException) {
			switch (e.name) {
				case 'NotFoundError':
					return new PlayerError(PlayerErrorCode.FILE_NOT_FOUND, e.message, e);
				case 'NotSupportedError':
					return new PlayerError(PlayerErrorCode.UNSUPPORTED_FORMAT, e.message, e);
				case 'AbortError':
					return new PlayerError(PlayerErrorCode.PLAYBACK_ABORTED, e.message, e);
			}
		}
		if (e instanceof MediaError) {
			switch (e.code) {
				case MediaError.MEDIA_ERR_ABORTED:
					return new PlayerError(PlayerErrorCode.PLAYBACK_ABORTED, e.message, e);
				case MediaError.MEDIA_ERR_DECODE:
					return new PlayerError(PlayerErrorCode.DECODE, e.message, e);
				case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
					return new PlayerError(PlayerErrorCode.UNSUPPORTED_FORMAT, "File is not a supported audio file format.", e);
				// case MediaError.MEDIA_ERR_NETWORK: // should never happen, this is all local files
			}
		}
		return new PlayerError(PlayerErrorCode.UNKNOWN, e instanceof Error ? e.message : "An unknown error occurred.", e);
	}

    private static endedHandler() {
        Player.playing = false;
        Player.events.pause.emit(Player.currentTrack!.id);
        Player.events.finish.emit(Player.currentTrack!.id);
    }

    private static timeUpdateHandler() {
        Player.events.timeChange.emit(Player.audio.currentTime);
    }

    private static dbToAmplitude(db: number) {
        return Math.pow(10, db / 20);
    }

    static get volumeDB() {
        return Player._volume;
    }

    static set volumeDB(volume: number) {
        Player._volume = volume;
        Player.gainNode.gain.value = Player.dbToAmplitude(volume);
    }

    static saveVolume() {
        return Player.db.put("config", Player._volume, "volume");
    }

    static async play(): Promise<void> {
		if (Player.playing) return;

		try {
			Player.audioContext.resume();
			await Player.loadPromise;
		} catch (e) {
			Player.events.error.emit(Player.toPlayerError(e));
			return;
		}

		try {
			await Player.audio.play();
			Player.playing = true;
			Player.events.play.emit(Player.currentTrack!.id);
		} catch (e) {
			Player.events.error.emit(Player.toPlayerError(e));
		}
    }

    static pause() {
        if (!Player.playing) return;
        Player.playing = false;
        Player.audio.pause();
        Player.events.pause.emit(Player.currentTrack!.id);
    }

    static seekTo(time: number) {
        Player.audio.currentTime = time;
    }

    static isPlaying() {
        return Player.playing;
    }

    static getCurrentTrackDuration(): number | null {
        return Player.currentTrack?.duration ?? null;
    }

    static getCurrentTrack(): Track | null {
        return Player.currentTrack;
    }

    static playAudioDirect(path: string): Promise<void> {
        Player.audioContext.resume();

        Player.audio.pause();
        Player.playing = false;

        return new Promise<void>((resolve, reject) => {
            const endedHandler = () => {
                cleanup();

                Player.audio.pause();
                Player.audio.currentTime = 0;
                Player.playing = false;

                resolve();
            };

            const errorHandler = () => {
                cleanup();
                reject(new Error(`Failed to play signal: ${path}`));
            };

            const cleanup = () => {
                Player.audio.removeEventListener("ended", endedHandler);
                Player.audio.removeEventListener("error", errorHandler);
            };

            Player.audio.addEventListener("ended", endedHandler);
            Player.audio.addEventListener("error", errorHandler);

            Player.audio.src = path;
            Player.audio.currentTime = 0;

            const promise = Player.audio.play();

            if (promise) {
                promise.catch(error => {
                    cleanup();
                    reject(error);
                });
            }
        });
    }
}