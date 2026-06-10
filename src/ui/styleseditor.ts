interface Preset {
	title: string;
	file: string;
};

export class StylesEditor {
	private static readonly localStorageName = "custom-css";

	private static stylesStyle: HTMLStyleElement;

	private static stylesDialog: HTMLDialogElement;

	private static presetSelect: HTMLSelectElement;
	private static textarea: HTMLTextAreaElement;
	private static closeButton: HTMLButtonElement;
	private static testButton: HTMLButtonElement;
	private static applyButton: HTMLButtonElement;

	private static presets: Preset[];
	
	constructor() {
		throw Error("This static class cannot be instantiated.");
	}

	static init() {
		this.stylesStyle = document.querySelector("#inserted-styles")!;

		this.stylesDialog = document.querySelector("#change-styles-dialog")!;

		this.presetSelect = this.stylesDialog.querySelector("#preset-select")!;
		this.textarea = this.stylesDialog.querySelector("textarea")!;
		this.closeButton = this.stylesDialog.querySelector("#close-btn")!;
		this.testButton = this.stylesDialog.querySelector("#test-btn")!;
		this.applyButton = this.stylesDialog.querySelector("#apply-btn")!;

		this.closeButton.addEventListener("click", this.closeHandler);
		this.testButton.addEventListener("click", this.testHandler);
		this.applyButton.addEventListener("click", this.applyHandler);

		this.presetSelect.addEventListener("change", this.presetSelectHandler);
		this.textarea.addEventListener("input", this.textInputHandler);
	}

	private static readonly closeHandler = () => {
		const styles = this.loadCurrentStyles() ?? "";
		this.applyStyles(styles);
		this.stylesDialog.close();
	}

	private static readonly testHandler = () => {
		this.applyStyles(this.textarea.value);
	}

	private static readonly applyHandler = () => {
		const styles = this.textarea.value;
		this.saveStyles(styles);
		this.applyStyles(styles);
	}

	private static readonly textInputHandler = () => {
		this.presetSelect.value = "__custom";
	}

	private static readonly presetSelectHandler = async () => {
		const file = this.presetSelect.value;
		if (file === "__custom") return; // don't do anything for custom
		const css = await fetch(`/themes/${file}`).then(response => response.text());
		this.textarea.value = css;
	}

	private static async loadPresets() {
		this.presets = await fetch("/themes/themes.json")
			.then(response => response.json());
		this.presetSelect.innerHTML = "";
		const customOption = document.createElement("option");
		customOption.label = "Custom";
		customOption.value = "__custom";
		this.presetSelect.appendChild(customOption);
		for (const preset of this.presets) {
			const option = document.createElement("option");
			option.value = preset.file;
			option.label = preset.title;
			this.presetSelect.appendChild(option);
		}
	}

	static openDialog() {
		this.textarea.value = this.loadCurrentStyles() ?? "";
		this.stylesDialog.showModal();
		this.loadPresets();
	}

	static loadCurrentStyles(): string | null {
		return localStorage.getItem(this.localStorageName);
	}

	static saveStyles(styles: string) {
		localStorage.setItem(this.localStorageName, styles);
	}

	static applyStyles(styles: string) {
		this.stylesStyle.textContent = styles;
	}
}