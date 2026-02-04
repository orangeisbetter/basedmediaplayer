export function convertTime(time: number) {
    const seconds = Math.floor(time) % 60;
    const minutes = Math.floor(time / 60) % 60;
    const hours = Math.floor(time / 60 / 60) % 24;
    const days = Math.floor(time / 60 / 60 / 24);

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    } else {
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
}