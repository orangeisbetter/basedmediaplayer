import { IDBPDatabase } from "idb";
import { RadioStation } from "../radiostation.ts";
import { LibraryTreeView } from "./librarytreeview.ts";
import { CompareEntry, compareSmartAlpha, compareStack } from "../util/sort.ts";

declare const radio_station_row: HTMLTemplateElement;

export class RadioStationsEditor {
	private static dialog: HTMLDialogElement;
	private static grid: HTMLDivElement;
	private static addButton: HTMLButtonElement;

	private static addEditDialog: HTMLDialogElement;
	private static addEditTitle: HTMLHeadingElement;
	private static addEditTitleInput: HTMLInputElement;
	private static addEditUrlInput: HTMLInputElement;
	private static addEditSaveButton: HTMLButtonElement;
	private static editingStation: RadioStation | null = null;

	private static db: IDBPDatabase;

	static init(db: IDBPDatabase) {
		this.dialog = document.querySelector("#radio-stations-dialog")!;
		this.grid = this.dialog.querySelector("#stations-grid")!;
		this.addButton = this.dialog.querySelector("#add-btn")!;

		this.addEditDialog = document.querySelector("#radio-station-add-edit-dialog")!;
		this.addEditTitle = this.addEditDialog.querySelector("#add-edit-dialog-title")!;
		this.addEditTitleInput = this.addEditDialog.querySelector("#radio-station-title")!;
		this.addEditUrlInput = this.addEditDialog.querySelector("#radio-station-url")!;
		this.addEditSaveButton = this.addEditDialog.querySelector("#save-btn")!;

		this.db = db;

		this.addButton.addEventListener("click", () => this.openAddEditDialog(null));

		this.addEditSaveButton.addEventListener("click", () => this.addEditSave());
	}

	static showDialog() {
		this.populateRows();

		this.dialog.showModal();
	}

	private static addEditSave() {
		const titleValue = this.addEditTitleInput.value;
		const urlValue = this.addEditUrlInput.value;

		// Validate title
		if (titleValue.trim().length == 0) {
			alert("Error: Please enter a title");
			return;
		}

		// Validate URL
		try {
			new URL(urlValue);
		} catch (_) {
			alert("Error: Please enter a valid URL");
			return;
		}

		if (this.editingStation === null) {
			this.editingStation = RadioStation.create(titleValue, urlValue);
		} else {
			this.editingStation.title = titleValue;
			this.editingStation.url = urlValue;
		}

		const transaction = this.db.transaction([RadioStation.STORE_NAME], "readwrite");
		const objectStore = transaction.objectStore(RadioStation.STORE_NAME);
		this.editingStation.save(objectStore);

		LibraryTreeView.updateRadioStations(Array.from(RadioStation.stations.values()));
		this.populateRows();

		this.addEditDialog.close();
	}

	private static openAddEditDialog(station: RadioStation | null): void {
		this.editingStation = station;

		if (station === null) {
			this.addEditTitle.textContent = "Add Radio Station";
			this.addEditTitleInput.value = "";
			this.addEditUrlInput.value = "";
		} else {
			this.addEditTitle.textContent = "Edit Radio Station";
			this.addEditTitleInput.value = station.title;
			this.addEditUrlInput.value = station.url;
		}

		this.addEditDialog.showModal();
	}

	private static delete(station: RadioStation) {
		const transaction = this.db.transaction([RadioStation.STORE_NAME], "readwrite");
		station.delete(transaction);
		
		LibraryTreeView.updateRadioStations(Array.from(RadioStation.stations.values()));
		this.populateRows();
	}

	static populateRows() {
		this.grid.innerHTML = "";

		const stations = Array.from(RadioStation.stations.values())
			.sort(compareStack([
				new CompareEntry(station => station.title, compareSmartAlpha)
			]));

		for (const station of stations) {
			const clone = document.importNode(radio_station_row.content, true);

			const label = clone.querySelector("#title")! as HTMLSpanElement;
			label.textContent = station.title;

			const editButton = clone.querySelector("#edit-btn")! as HTMLButtonElement;
			editButton.addEventListener("click", () => this.openAddEditDialog(station));

			const deleteButton = clone.querySelector("#delete-btn")! as HTMLButtonElement;
			deleteButton.addEventListener("click", () => this.delete(station));

			this.grid.appendChild(clone);
		}
	}
}