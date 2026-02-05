import { IDBPDatabase } from "idb";
import { Emitter } from "./emitter.ts";
import { Track } from "./track.ts";

export class Player {
    private static db: IDBPDatabase;

    private static currentTrack: Track | null = null;
    private static file: Blob | null = null;
    private static url: string;
    private static playing: boolean = false;
    private static _volume: number;

    private static audioContext: AudioContext;
    private static gainNode: GainNode;
    private static audio: HTMLAudioElement;
    private static track: MediaElementAudioSourceNode;

    private static loadPromise: Promise<void> = Promise.resolve();

    static events = {
        play: new Emitter<number>(),
        pause: new Emitter<number>(),
        finish: new Emitter<number>(),
        clear: new Emitter<void>(),
        timeChange: new Emitter<number>(),
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

    static changeTrack(trackId: number): void {
        if (trackId === null) {
            Player.currentTrack = null;
            Player.audio.pause();
            Player.events.clear.emit();
            return;
        }
        const track = Track.byID(trackId);
        if (!track) {
            Player.loadPromise = Promise.reject();
            return;
        }
        Player.playing = false;
        URL.revokeObjectURL(Player.url);
        Player.currentTrack = track;
        Player.loadPromise = Player.loadTrackAudio(Player.currentTrack.handle);
    }

    private static async loadTrackAudio(fileHandle: FileSystemFileHandle): Promise<void> {
        const opts = { mode: "read" };
        if ((await fileHandle.queryPermission(opts)) !== "granted") {
            if ((await fileHandle.requestPermission(opts)) !== "granted") {
                throw Error("Unable to access file handle.");
            }
        }
        this.file = await fileHandle.getFile();
        this.url = URL.createObjectURL(this.file);
        Player.audio.src = this.url;
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

    static play() {
        if (Player.playing) return;
        Player.audioContext.resume();
        this.loadPromise.then(async () => {
            Player.playing = true;
            await Player.audio.play();
            Player.events.play.emit(Player.currentTrack!.id);
        });
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
}