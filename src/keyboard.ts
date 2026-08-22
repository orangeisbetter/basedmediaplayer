export class Keyboard {
	static handlers = new Map<string, (e: KeyboardEvent) => boolean | void>();

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

	static register(combo: string, handler: (e: KeyboardEvent) => boolean | void) {
		this.handlers.set(combo.toLowerCase(), handler);
	}

	static unregister(combo: string) {
		this.handlers.delete(combo);
	}

	static getKeyCode(e: KeyboardEvent) {
		const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'];
		if (modifierKeys.includes(e.key)) {
			return null;
		}

		const isPrintable = e.key.length === 1;
		const hasNonShiftMod = e.ctrlKey || e.metaKey || e.altKey;

		if (isPrintable && !hasNonShiftMod) {
			return e.key;
		}

		const mods = [];
		if (e.ctrlKey || e.metaKey) mods.push('ctrl');
		if (e.shiftKey) mods.push('shift');
		if (e.altKey) mods.push('alt');

		const key = e.key.toLowerCase();
		return mods.length ? `${mods.join('+')}+${key}` : key;
	}

	static init() {
		document.addEventListener("keydown", (e) => {
			if ((e.target as Element | null)?.matches("input, textarea, [contenteditable]")) return;

			const keyCode = this.getKeyCode(e);
			if (keyCode === null) return;
			console.log(keyCode);

			const isPrintable = keyCode.length === 1;
			const handler = this.handlers.get(keyCode) ?? (isPrintable ? this.handlers.get("printable") : undefined);

			if (handler) {
				if (handler(e) !== false) {
					e.preventDefault();
				}
			}
		});
	}
}