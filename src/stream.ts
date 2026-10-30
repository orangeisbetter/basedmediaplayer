/**
 * An HTTP audio stream
 */
export class Stream {
	url: string;
	title?: string;

	constructor(url: string, title?: string) {
		this.url = url;
		this.title = title;
	}

	getTitle() {
		return this.title ?? this.url;
	}
}