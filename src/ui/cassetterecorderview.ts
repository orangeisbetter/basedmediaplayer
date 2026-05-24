import { CassetteRecorder, SplitMode } from "../cassetterecorder.ts";
import { convertTime } from "../time.ts";

export class CassetteRecorderView {
    private static dialog: HTMLDialogElement;
    private static tapeLengthSelect: HTMLSelectElement;
    private static singleSideCheckbox: HTMLInputElement;
    private static trackSplitSelect: HTMLSelectElement;
    private static flipReminderCheckbox: HTMLInputElement;
    private static gapLengthInput: HTMLInputElement;

    private static sideATracksDurationLabel: HTMLSpanElement;
    private static sideAGapLengthLabel: HTMLSpanElement;
    private static sideATotalDurationLabel: HTMLSpanElement;
    private static sideARemainingSpaceLabel: HTMLSpanElement;

    private static sideBTracksDurationLabel: HTMLSpanElement;
    private static sideBGapLengthLabel: HTMLSpanElement;
    private static sideBTotalDurationLabel: HTMLSpanElement;
    private static sideBRemainingSpaceLabel: HTMLSpanElement;

    private static calculateButton: HTMLButtonElement;
    private static startAButton: HTMLButtonElement;
    private static startBButton: HTMLButtonElement;
    private static stopButton: HTMLButtonElement;
    private static closeButton: HTMLButtonElement;

    static init() {
        this.dialog = document.querySelector("#cassette-recorder-dialog")!;
        this.tapeLengthSelect = this.dialog.querySelector("#tape-length-sel")!;
        this.singleSideCheckbox = this.dialog.querySelector("#single-side-cb")!;
        this.trackSplitSelect = this.dialog.querySelector("#split-sel")!;
        this.flipReminderCheckbox = this.dialog.querySelector("#flip-reminder-cb")!;
        this.gapLengthInput = this.dialog.querySelector("#gap-length-ip")!;

        this.sideATracksDurationLabel = this.dialog.querySelector("#sidea-track-duration")!;
        this.sideAGapLengthLabel = this.dialog.querySelector("#sidea-gap-length")!;
        this.sideATotalDurationLabel = this.dialog.querySelector("#sidea-total-duration")!;
        this.sideARemainingSpaceLabel = this.dialog.querySelector("#sidea-rem-space")!;

        this.sideBTracksDurationLabel = this.dialog.querySelector("#sideb-track-duration")!;
        this.sideBGapLengthLabel = this.dialog.querySelector("#sideb-gap-length")!;
        this.sideBTotalDurationLabel = this.dialog.querySelector("#sideb-total-duration")!;
        this.sideBRemainingSpaceLabel = this.dialog.querySelector("#sideb-rem-space")!;

        this.calculateButton = this.dialog.querySelector("#calculate-btn")!;
        this.startAButton = this.dialog.querySelector("#start-a-btn")!;
        this.startBButton = this.dialog.querySelector("#start-b-btn")!;
        this.stopButton = this.dialog.querySelector("#stop-btn")!;
        this.closeButton = this.dialog.querySelector("#close-btn")!;

        this.singleSideCheckbox.addEventListener("change", this.updateDisabledOptions);
        this.trackSplitSelect.addEventListener("change", this.updateDisabledOptions);

        this.tapeLengthSelect.addEventListener("change", () => {
            const rolloverOption = this.trackSplitSelect.options.namedItem("rollover")!;
            if (Number(this.tapeLengthSelect.value) === 0) {
                rolloverOption.disabled = true;
                rolloverOption.selected = false;
                this.updateDisabledOptions();
            } else {
                rolloverOption.disabled = false;
            }
        })

        this.calculateButton.addEventListener("click", () => {
            try {
                const tapeLength = Number(this.tapeLengthSelect.value) * 60;

                CassetteRecorder.calculate({
                    tapeLength,
                    singleSideOnly: this.singleSideCheckbox.checked,
                    gapLength: Number(this.gapLengthInput.value),
                    flipReminder: this.flipReminderCheckbox.checked,
                    splitMode: Number(this.trackSplitSelect.value)
                });
                
                this.updateInfo(tapeLength);

                this.enableStartButtons();
            } catch (e) {
                alert(e);
            }
        });

        this.startAButton.addEventListener("click", () => {
            this.calculateButton.disabled = true;
            this.startAButton.disabled = true;
            this.startBButton.disabled = true;
            this.stopButton.disabled = false;
            this.closeButton.disabled = true;

            CassetteRecorder.startSideA().then(() => {
                this.calculateButton.disabled = false;
                this.stopButton.disabled = true;
                this.closeButton.disabled = false;
                this.enableStartButtons();
            }).catch((err) => {
                console.error(err);
            });
        });

        this.startBButton.addEventListener("click", () => {
            this.calculateButton.disabled = true;
            this.startAButton.disabled = true;
            this.startBButton.disabled = true;
            this.stopButton.disabled = false;
            this.closeButton.disabled = true;

            CassetteRecorder.startSideB().then(() => {
                this.calculateButton.disabled = false;
                this.stopButton.disabled = true;
                this.closeButton.disabled = false;
                this.enableStartButtons();
            }).catch((err) => {
                console.error(err);
            });
        });

        this.stopButton.addEventListener("click", () => {
            this.calculateButton.disabled = false;
            this.stopButton.disabled = true;
            this.closeButton.disabled = false;
            this.enableStartButtons();

            CassetteRecorder.stop(true);
        });
    }

    static showDialog() {
        this.dialog.showModal();
        CassetteRecorder.clearCalculation();
        this.updateInfo(0);

        this.enableStartButtons();
    }

    private static updateDisabledOptions = () => {
        const singleSide = this.singleSideCheckbox.checked;
        const isRollover = Number(this.trackSplitSelect.value) === SplitMode.SPLIT_MODE_ROLLOVER;

        this.trackSplitSelect.disabled = singleSide;
        this.flipReminderCheckbox.disabled = singleSide || isRollover;
    }

    private static updateInfo(tapeLength: number) {
        if (CassetteRecorder.sideAInfo) {
            const tracksDuration = CassetteRecorder.sideAInfo.tracksDuration;
            const gapLength = CassetteRecorder.sideAInfo.gapLength;
            const gapDuration = gapLength * CassetteRecorder.sideAInfo.numGaps;
            const totalDuration = tracksDuration + (gapDuration ?? 0);

            this.sideATracksDurationLabel.textContent = convertTime(tracksDuration);
            this.sideAGapLengthLabel.textContent = gapLength?.toFixed(2) ?? "-";
            this.sideATotalDurationLabel.textContent = totalDuration !== null ? convertTime(totalDuration) : "-";
            this.sideARemainingSpaceLabel.textContent = totalDuration !== null && tapeLength !== 0 ? convertTime(tapeLength / 2 - totalDuration) : "-";
        } else {
            this.sideATracksDurationLabel.textContent = "-";
            this.sideAGapLengthLabel.textContent = "-";
            this.sideATotalDurationLabel.textContent = "-";
            this.sideARemainingSpaceLabel.textContent = "-";
        }

        if (CassetteRecorder.sideBInfo) {
            const tracksDuration = CassetteRecorder.sideBInfo.tracksDuration;
            const gapLength = CassetteRecorder.sideBInfo.gapLength;
            const gapDuration = gapLength * CassetteRecorder.sideBInfo.numGaps;
            const totalDuration = tracksDuration + (gapDuration ?? 0);

            this.sideBTracksDurationLabel.textContent = convertTime(tracksDuration);
            this.sideBGapLengthLabel.textContent = gapLength?.toFixed(2) ?? "-";
            this.sideBTotalDurationLabel.textContent = totalDuration !== null ? convertTime(totalDuration) : "-";
            this.sideBRemainingSpaceLabel.textContent = totalDuration !== null && tapeLength !== 0 ? convertTime(tapeLength / 2 - totalDuration) : "-";
        } else {
            this.sideBTracksDurationLabel.textContent = "-";
            this.sideBGapLengthLabel.textContent = "-";
            this.sideBTotalDurationLabel.textContent = "-";
            this.sideBRemainingSpaceLabel.textContent = "-";
        }
    }

    private static enableStartButtons() {
        if (CassetteRecorder.sideAInfo !== null && CassetteRecorder.sideAInfo.tracks.length > 0) this.startAButton.disabled = false;
        else this.startAButton.disabled = true;
        if (CassetteRecorder.sideBInfo !== null && CassetteRecorder.sideBInfo.tracks.length > 0) this.startBButton.disabled = false;
        else this.startBButton.disabled = true;
    }
}