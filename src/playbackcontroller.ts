import { Player } from "./player.ts";
import { Playlist, PlaylistTrackChangeEventData } from "./playlist.ts";

export class PlaybackController {
    private static autoplayEnabled: boolean;

    static init() {
        Playlist.events.trackChange.addListener(this.onTrackChange);
        this.autoplayOn();
    }

    static autoplayOff() {
        if (!this.autoplayEnabled) return;
        Player.events.finish.removeListener(this.onTrackFinished);
        this.autoplayEnabled = false;
    }

    static autoplayOn() {
        if (this.autoplayEnabled) return;
        Player.events.finish.addListener(this.onTrackFinished);
        this.autoplayEnabled = true;
    }

    static onTrackChange = ({ id }: PlaylistTrackChangeEventData) => {
        Player.changeTrack(id);
    }

    static onTrackFinished = () => {
        if (Playlist.autoNext() !== null) {
            Player.play();
        }
    }

    static skipPreviousAndPlay() {
        Playlist.previous() !== null && Player.play();
    }

    static skipNextAndPlay() {
        Playlist.next() !== null && Player.play();
    }
}