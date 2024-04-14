// part of the code in this file is copied from https://github.com/joaovitorbf/ynodesktop
// under MIT license https://github.com/joaovitorbf/ynodesktop/raw/main/LICENSE

const { app, BrowserWindow, net, protocol, session } = require("electron");
const Store = require("electron-store");
const promptInjection = require("./promptinjection");
const utils = require("./utils");
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


    win.webContents.session.protocol.handle("ywbf", async (request) => {
        const urlPath = request.url.slice("ywbf://".length);
        let realurl = "https://" + urlPath;
        let requrl = new url.URL(request.url);
        let filePath = requrl.hostname + requrl.pathname;
        const fileurl = url.pathToFileURL(path.join(process.cwd(), "cache", filePath));
        filePath = fileurl.pathname.substring(1);
        const ses = session.fromPartition("ywbfses");
        try {
            let localFileRequest = await ses.fetch(fileurl);
            console.log("尝试读取本地: " + fileurl);
            let localFileLastModified = localFileRequest.headers.get("last-modified");
            let localFileDate = new Date(localFileLastModified);
            console.log(fileurl + " 本地时间: " + localFileDate.getFullYear() + "-" + (localFileDate.getMonth() + 1) + "-" + localFileDate.getDate());

            let response = await ses.fetch(realurl, {
                method: 'HEAD'
            });
            let mds = response.headers.get("Last-Modified");
            if (!mds) throw realurl + " 远端文件无Last-Modified";
            let webFileDate = new Date(mds);
            console.log(fileurl + " 网络时间: " + webFileDate.getFullYear() + "-" + (webFileDate.getMonth() + 1) + "-" + webFileDate.getDate());
            let span = localFileDate.getTime() - webFileDate.getTime();
            if (span < 0) throw fileurl + "本地文件过期";
            console.log("使用本地文件:" + fileurl);
            return localFileRequest;
        }
        catch (ex) {
            console.log(ex.name + ":" + fileurl);
            let webResponse = await ses.fetch(realurl);
            let webFile = await webResponse.clone().arrayBuffer();
            await utils.writeFile(filePath, webFile);
            return webResponse;
        }
    });


    win.webContents.session.webRequest.onBeforeRequest(async (details, callback) => {
        let durl = details.url;
        if (!utils.isCacheSource(durl)) {
            callback({ cancel: false });
            return;
        }

        let ywbfurl = "ywbf://" + new url.URL(durl).href.replace(/^([a-z]+:)(\/){2,}/i, '');
        callback({ redirectURL: ywbfurl });
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
