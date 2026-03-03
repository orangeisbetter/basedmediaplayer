# Based Media Player

This is the repository for the source code for a project I've been working on that I call *Based Media Player*. The purpose of this app is to be a
local media player (i.e. it plays files on your device) for music using web technologies. My goal is to have it be as fully-featured as is reasonable
for a web app.

This app is currently usable online at the linked site on this repo: [media.orangeisbetter.net](https://media.orangeisbetter.net).

I hope you enjoy the app!

## Building

This app is a **statically-built and served** app and does not require a particular server or backend framework. To build this app, I would reccommend
using [Deno](https://deno.com/).

To build the app into a `main.js` file, run:

```sh
deno task build
```

To automatically rebuild when changes are detected, run:

```sh
deno task dev
```

## Serving

This app is statically-served. The app uses features that require a secure context to work in accordance with the W3 standards.

The way I'm serving it is using [Apache](https://httpd.apache.org/).

## Bugs & Issues

Please note that there are bound to be bugs with a project like this. If you encounter any, feel free to submit an issue to this repo. I want to make sure
that people have a good experience when using this app.

## Feedback

If you have any feedback about this app, feel free to let me know at [feedback@orangeisbetter.net](mailto:feedback@orangeisbetter.net).

## FAQ

I've received a handful of questions about why I'm doing (or not doing) certain things with this app. I want to answer a few of them to make it clear
what my intentions are with this project.

### Q: Why can I not use Firefox for this app?

Firefox is a resisting allowing the `window.showDirectoryPicker` function (and others) of the
[File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API). This function is used to select your media library's root location.

There are alternative solutions I could use, such as copying all the files in said folder into the browser's "protected" area before working with the
files. However, with large music libraries, this is a very wasteful solution.

### Q: Is mobile support planned?

No, mobile support is not planned. This is designed as a desktop-only app and functionality on mobile is not guaranteed or recommended. This is because
I don't imagine it would be very useful or user-friendly.

I'm not ruling out mobile support entirely for the future, but it is not on my immediate agenda. There are much more important things to get working
first before that comes into the picture.

### Q: Is there going to be an Electron app (or similar) for this project?

No. I don't agree with the concept of bundling an entire web browser with a program that is functionally less than 100 kB in size.

However, if you want a
feeling similar to a standalone app, you can install this app as a PWA. In your browser, there should be a prompt in or near the address bar to "install"
it. This will simply allow the app to open in its own window and register it with your OS's list of installed programs.

On a related note, if this app works well as a web app and if there is enough demand, there is a non-zero chance that I will adapt it to a native app
so it can run natively on your device. I wouldn't count on it though.
