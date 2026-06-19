import { Player, PlayerError } from "./player.ts";
import { Playlist, PlaylistTrackChangeEventData } from "./playlist.ts";

export class PlaybackController {
    private static autoplayEnabled: boolean;
	private static consecutiveErrors: number = 0;

    static init() {
        Playlist.events.trackChange.addListener(this.onTrackChange);
		Player.events.error.addListener(this.onError);
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

	private static readonly onError = (error: PlayerError) => {
		console.dir(error);
		// Try the next track
		Promise.resolve().then(() => {
			if (Playlist.autoNext() !== null) {
				Player.play();
			}
		});
	}

	// Player always follows playlist's current track
	private static readonly onTrackChange = ({ id }: PlaylistTrackChangeEventData) => {
        Player.changeTrack(id);
    }

	private static readonly onTrackFinished = () => {
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