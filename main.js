// part of the code in this file is copied from https://github.com/joaovitorbf/ynodesktop
// under MIT license https://github.com/joaovitorbf/ynodesktop/raw/main/LICENSE

const { app, BrowserWindow, net, protocol, session } = require("electron");
const Store = require("electron-store");
const promptInjection = require("./promptinjection");
const webBoost = require("./webboost");
const url = require("url");
const path = require("path");

const store = new Store();

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        resizable: true,
    });

    win.loadURL("https://ynoproject.net/");
    win.show();
    // win.setMenu(null);
    return win;
}

protocol.registerSchemesAsPrivileged([{
    scheme: "ywbf",
    privileges: {
        standard: true
    }
}]);

app.whenReady().then(() => {
    let win = createWindow();

    // copy from https://github.com/joaovitorbf/ynodesktop
    win.webContents.on("did-finish-load", () => {
        promptInjection(win); // Custom prompt hack
        win.webContents
            .executeJavaScript(`if (document.title != "Yume Nikki Online Project") {
          document.getElementById('content').style.overflow = 'hidden'
          document.querySelector('#content')?.scrollTo(0,0)}`); // Disable scroll ingame
    });

    // copy from https://github.com/joaovitorbf/ynodesktop
    win.on("close", () => {
        saveSession();
        win.destroy();
    });

    // copy from https://github.com/joaovitorbf/ynodesktop
    // Load login session from disk
    if (store.has("ynoproject_sessionId")) {
        session.defaultSession.cookies.set({
            url: "https://ynoproject.net",
            name: "ynoproject_sessionId",
            value: store.get("ynoproject_sessionId"),
            sameSite: "strict",
        });
    }

    app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) win = createWindow();
    });

    win.webContents.session.protocol.handle("ywbf", (request) => {
        const filePath = request.url.slice("ywbf://".length);
        // return net.fetch(url.pathToFileURL(path.join(app.getAppPath(), "cache", filePath)));
        return net.fetch(url.pathToFileURL(path.join(process.cwd(), "cache", filePath)));
    });

    win.webContents.session.webRequest.onHeadersReceived(async (details, callback) => {
        let durl = details.url;
        if (!webBoost.isCacheSource(durl)) {
            callback(details);
            return;
        }

        let headers = details.responseHeaders;
        let lastModified = headers["last-modified"];
        if (!lastModified) {
            callback(details);
            return;
        }
        let webFileDate = new Date(lastModified[0]);

        let filePath = new url.URL(durl).pathname;
        // const fileurl = url.pathToFileURL(path.join(app.getAppPath(), "cache", filePath));
        const fileurl = url.pathToFileURL(path.join(process.cwd(), "cache", filePath));
        filePath = fileurl.pathname.substring(1);

        try {
            let localFileRequest = await net.fetch(fileurl);
            let localFileLastModified = localFileRequest.headers.get("last-modified");
            let localFileDate = new Date(localFileLastModified);
            let span = localFileDate.getTime() - webFileDate.getTime();
            if (span >= 0) callback({ cancel: false, redirectURL: fileurl.href });
            else throw "本地文件过期";
        }
        catch (ex) {
            //console.log(ex)
            let webFile = await webBoost.exfetch(durl);
            await webBoost.writeFile(filePath, webFile);
            callback({ cancel: false, redirectURL: fileurl.href });
        }
        return;
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

// copy from https://github.com/joaovitorbf/ynodesktop
function saveSession() {
    session.defaultSession.cookies
        .get({ url: "https://ynoproject.net" })
        .then((cookies) => {
            const sess = cookies.find(
                (cookie) => cookie.name == "ynoproject_sessionId"
            );
            if (sess) store.set("ynoproject_sessionId", sess.value);
        });
}
