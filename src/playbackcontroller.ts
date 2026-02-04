import { Player } from "./player";
import { Playlist } from "./playlist";

export class PlaybackController {
    static init() {
        Playlist.events.trackChange.addListener(this.onTrackChange);
        Player.events.finish.addListener(this.onTrackFinished);
    }

    private static onTrackChange({ id }: { id: number | null }) {
        Player.changeTrack(id);
    }

    private static onTrackFinished() {
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