import { Player } from "./player.ts";
import { Playlist } from "./playlist.ts";
import { Track } from "./track.ts";
import { convertTime } from "./time.ts";
import { PlaybackController } from "./playbackcontroller.ts";
import { PlayerView } from "./ui/playerview.ts";

export enum SplitMode {
    SPLIT_MODE_ROLLOVER = 0,
    SPLIT_MODE_EVEN = 1,
    SPLIT_MODE_OPTIMAL = 2,
};

type CassetteRecorderOptions = {
    tapeLength: number;
    singleSideOnly: boolean;
    splitMode: SplitMode;
    flipReminder: boolean;
    gapLength: number;
};

export type SideData = {
    tracks: number[];
    tracksDuration: number;
    numGaps: number;
    gapLength: number;
};

type DurationTrack = {
    id: number;
    duration: number;
};

export class CassetteRecorder {
    private static sideA: SideData | null = null;
    private static sideB: SideData | null = null;

    private static flipSignal: boolean = false;

    static get sideAInfo(): SideData | null {
        return this.sideA ? { ...this.sideA } : null;
    }

    static get sideBInfo(): SideData | null {
        return this.sideB ? { ...this.sideB } : null;
    }

    static calculate(options: CassetteRecorderOptions) {
        const allTracks: DurationTrack[] = Array.from({ length: Playlist.getNumTracks() }, (_, index) => {
            const trackId = Playlist.getTrackByIndex(index)!;
            return {
                id: trackId,
                duration: Track.byID(trackId)!.duration
            };
        });

        if (!options.singleSideOnly) {
            switch (options.splitMode) {
                case SplitMode.SPLIT_MODE_ROLLOVER:
                    this.splitRollover(allTracks, options.tapeLength / 2, options.gapLength, options.gapLength);
                    break;
                case SplitMode.SPLIT_MODE_EVEN:
                    this.splitEven(allTracks, options.tapeLength / 2, options.gapLength, options.gapLength);
                    break;
                case SplitMode.SPLIT_MODE_OPTIMAL:
                    this.splitOptimal(allTracks, options.tapeLength / 2, options.gapLength, options.gapLength);
                    break;
            }

            this.flipSignal = options.flipReminder;
        } else {
            this.sideA = {
                tracks: allTracks.map(track => track.id),
                tracksDuration: allTracks.reduce((prevValue, current) => prevValue + current.duration, 0),
                numGaps: this.getNumGaps(allTracks.length),
                gapLength: options.gapLength,
            };
            if (this.sideA.tracksDuration + this.sideA.gapLength * this.sideA.numGaps > options.tapeLength / 2) {
                throw new Error(`Tracks do not fit on single side of tape; duration of tracks: ${convertTime(this.sideA.tracksDuration)}, duration of side: ${convertTime(options.tapeLength / 2)}`);
            }
            this.sideB = null;

            this.flipSignal = false;
        }
    }

    static clearCalculation() {
        this.sideA = null;
        this.sideB = null;
    }

    static async startSideA(): Promise<void> {
        if (this.sideA === null) return Promise.reject();

        PlaybackController.autoplayOff();
        PlayerView.disableMediaControls();

        Player.pause();
        Playlist.changeTrack(0);

        await this.play(this.sideA.tracks.length, this.sideA.gapLength, !this.flipSignal);
        
        if (!this.flipSignal) return;
        
        await new Promise(resolve => setTimeout(resolve, this.sideA!.gapLength * 1000));
        await Player.playAudioDirect("/flip_signal.mp3");

        PlaybackController.autoplayOn();
        PlayerView.enableMediaControls();
    }

    static startSideB(): Promise<void> {
        if (this.sideB === null) return Promise.reject();

        PlaybackController.autoplayOff();
        PlayerView.disableMediaControls();

        Player.pause();
        Playlist.changeTrack(this.sideA?.tracks.length ?? 0);

        return this.play(this.sideB.tracks.length, this.sideB.gapLength, true);
    }

    private static splitRollover(allTracks: DurationTrack[], singleSideLength: number, minGapA: number, minGapB: number) {
        let side: SideData = this.sideA = {
            tracks: [],
            tracksDuration: 0,
            gapLength: minGapA,
            numGaps: 0
        };
        this.sideB = {
            tracks: [],
            tracksDuration: 0,
            gapLength: minGapB,
            numGaps: 0
        };

        for (const track of allTracks) {
            if (side === this.sideA) {
                const additionalTime = track.duration + (side.tracks.length > 0 ? side.gapLength : 0);
                if (side.tracksDuration + additionalTime >= singleSideLength) {
                    side = this.sideB;
                }
            }

            const additionalTime = track.duration + (side.tracks.length > 0 ? side.gapLength : 0);
            if (side.tracksDuration + additionalTime >= singleSideLength) {
                throw new Error(`Tracks do not fit on the tape using rollover split mode.`);
            }

            side.tracks.push(track.id);
            side.tracksDuration += additionalTime;
        }

        this.sideA.numGaps = this.getNumGaps(this.sideA.tracks.length);
        this.sideA.tracksDuration -= this.sideA.numGaps * this.sideA.gapLength;
        if (this.sideB) {
            this.sideB.numGaps = this.getNumGaps(this.sideB.tracks.length);
            this.sideB.tracksDuration -= this.sideB.numGaps * this.sideB.gapLength;
        }
    }

    private static splitEven(allTracks: DurationTrack[], singleSideLength: number, minGapA: number, minGapB: number) {
        const totalDuration = allTracks.reduce((sum, track) => sum + track.duration, 0);
        const halfDuration = totalDuration / 2;

        let splitIndex = 0;
        let tracksDuration = 0;
        for (let i = 0; i < allTracks.length; i++) {
            const gap = i > 0 ? minGapA : 0;
            const track = allTracks[i];
            // for if we don't care if side B is longer than A
            // if (tracksDuration + track.duration + gap > halfDuration) {
            //     const deltaWithoutAdd = halfDuration - tracksDuration;
            //     const deltaWithAdd = -(halfDuration - (tracksDuration + track.duration + gap));
            //     splitIndex = deltaWithoutAdd <= deltaWithAdd ? i : i + 1;
            //     break;
            // }
            tracksDuration += track.duration + gap;
            if (tracksDuration > halfDuration + i * gap) {
                splitIndex = i + 1;
                break;
            }
        }

        this.sideA = {
            tracks: [],
            tracksDuration: 0,
            gapLength: minGapA,
            numGaps: this.getNumGaps(splitIndex)
        };

        this.sideB = {
            tracks: [],
            tracksDuration: 0,
            gapLength: minGapB,
            numGaps: this.getNumGaps(allTracks.length - splitIndex)
        };

        for (let i = 0; i < allTracks.length; i++) {
            const track = allTracks[i];
            const side = i < splitIndex ? this.sideA : this.sideB;

            if (singleSideLength !== 0 && side!.tracksDuration + side!.numGaps * side!.gapLength + track.duration >= singleSideLength) {
                throw new Error(`Tracks do not fit on the tape using even split mode`);
            }

            side!.tracks.push(track.id);
            side!.tracksDuration += track.duration;
        }
    }

    private static splitOptimal(allTracks: DurationTrack[], singleSideLength: number, minGapA: number, minGapB: number) {
        const sorted = [...allTracks].sort((a, b) => b.duration - a.duration);

        this.sideA = {
            tracks: [],
            tracksDuration: 0,
            gapLength: minGapA,
            numGaps: 0
        };

        this.sideB = {
            tracks: [],
            tracksDuration: 0,
            gapLength: minGapB,
            numGaps: 0
        };
        
        for (const track of sorted) {
            if (this.sideA.tracksDuration + this.sideA.numGaps * this.sideA.gapLength <= this.sideB.tracksDuration + this.sideB.numGaps * this.sideB.gapLength) {
                this.sideA.tracks.push(track.id);
                this.sideA.tracksDuration += track.duration;

                if (this.sideA.tracks.length > 1) {
                    this.sideA.numGaps++;
                }
            } else {
                this.sideB.tracks.push(track.id);
                this.sideB.tracksDuration += track.duration;

                if (this.sideB.tracks.length > 1) {
                    this.sideB.numGaps++;
                }
            }
        }

        if (singleSideLength !== 0 && (this.sideA.tracksDuration + this.sideA.numGaps * this.sideA.gapLength > singleSideLength || this.sideB.tracksDuration + this.sideB.numGaps * this.sideB.gapLength > singleSideLength)) {
            throw new Error(`Tracks do not fit on the tape using optimal split mode.`);
        }
        
        this.sideA.numGaps = this.getNumGaps(this.sideA.tracks.length);
        this.sideB.numGaps = this.getNumGaps(this.sideB.tracks.length);

        // Swap sides if side B is longer, side A should be longer than side B
        if (this.sideA.tracksDuration < this.sideB.tracksDuration) {
            [this.sideA, this.sideB] = [this.sideB, this.sideA];
        }

        const setA = new Set(this.sideA.tracks);
        const setB = new Set(this.sideB.tracks);

        const newPlaylist = [];

        for (const track of allTracks) {
            if (setA.has(track.id)) {
                newPlaylist.push(track.id);
            }
        }

        for (const track of allTracks) {
            if (setB.has(track.id)) {
                newPlaylist.push(track.id);
            }
        }

        Playlist.clear();
        Playlist.add(...newPlaylist);
    }

    private static getNumGaps(numTracks: number) {
        if (numTracks == 0) return 0;
        return numTracks - 1;
    }

    // private static calculateGap(numTracks: number, trackDuration: number, sideTapeLength: number, maxGap: number): number | null {
    //     if (numTracks == 0 || numTracks == 1) {
    //         return null;
    //     } else {
    //         const gap = (sideTapeLength - trackDuration) / (numTracks - 1);
    //         if (gap > maxGap) {
    //             return maxGap;
    //         } else if (gap >= 0) {
    //             return gap;
    //         } else {
    //             return 0;
    //         }
    //     }
    // }

    private static playData: {
        playing: true;
        numTracksRemaining: number;
        timeoutHandle?: number;
        trackEndedHandler: () => void;
        playResolve: () => void;
    } | {
        playing: false;
    } = {
        playing: false
    };

    private static play(numTracks: number, gapLength: number | null, restoreWhenDone: boolean): Promise<void> {
        if (numTracks == 0) {
            return Promise.resolve();
        }

        const trackEndedHandler = () => {
            if (!this.playData.playing || this.playData.numTracksRemaining === 0 || gapLength === null) {
                this.stop(restoreWhenDone);
                return;
            }
            this.playData.numTracksRemaining--;
            Playlist.next();
            this.playData.timeoutHandle = setTimeout(() => Player.play(), gapLength * 1000);
        }

        Player.events.finish.addListener(trackEndedHandler);

        Player.play();

        return new Promise(resolve => {
            this.playData = {
                playing: true,
                numTracksRemaining: numTracks - 1,
                trackEndedHandler,
                playResolve: resolve
            };
        });
    }

    static stop(restore: boolean) {
        if (!this.playData.playing) return;

        Player.pause();

        clearTimeout(this.playData.timeoutHandle);
        Player.events.finish.removeListener(this.playData.trackEndedHandler);

        if (restore) {
            PlaybackController.autoplayOn();
            PlayerView.enableMediaControls();
        }

        this.playData.playResolve();
    }
}