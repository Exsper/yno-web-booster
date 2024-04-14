// part of the code in this file is copied from https://github.com/joaovitorbf/ynodesktop
// under MIT license https://github.com/joaovitorbf/ynodesktop/raw/main/LICENSE

const { app, BrowserWindow, net, protocol, session, Menu, dialog, shell, nativeImage } = require("electron");
const Store = require("electron-store");
const utils = require("./utils");
const url = require("url");
const path = require("path");
const I18n = require("./i18n");

const store = new Store();
const i18n = new I18n(app.getPreferredSystemLanguages());

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        resizable: true,
    });

    // copy from https://github.com/joaovitorbf/ynodesktop
    win.on("close", () => {
        saveSession();
        win.destroy();
    });

    win.setMenu(getGameMenu());
    win.loadURL("https://ynoproject.net/");
    win.show();
    return win;
}

function getGameMenu() {
    const template = [
        ...(process.platform === 'darwin'
            ? [{
                label: app.name,
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideOthers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            }]
            : []),
        {
            label: i18n.text("menu_file"),
            role: 'services',
            submenu: [
                {
                    label: i18n.text("menu_file_close"),
                    accelerator: 'Alt+F4',
                    click: (item, window) => {
                        window.close()
                    }
                }
            ]
        },
        {
            label: i18n.text("window"),
            role: 'window',
            submenu: [
                {
                    label: i18n.text("language"),
                    submenu: i18n.getMenuList().map((menuItem) => {
                        return {
                            label: menuItem.name,
                            click: (item, window) => {
                                i18n.init([menuItem.code]);
                                window.setMenu(getGameMenu());
                            }
                        }
                    })
                }, 
                {
                    label: i18n.text("window_new"),
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: (item, window) => {
                        createWindow();
                    }
                },
                {
                    label: i18n.text("window_onTop"),
                    accelerator: 'CmdOrCtrl+T',
                    type: 'checkbox',
                    click: (item, window) => {
                        window.setAlwaysOnTop(!window.isAlwaysOnTop())
                    }
                },
                ...['F11', 'F5'].map((acc, index) => {
                    return {
                        label: i18n.text("window_fullScreen"),
                        accelerator: acc,
                        type: 'checkbox',
                        enabled: BrowserWindow.getAllWindows().length === 1,
                        visible: index === 0,
                        click: (item, window) => {
                            window.setFullScreen(!window.isFullScreen())
                        }
                    }
                })
            ]
        },
        {
            label: i18n.text("game"),
            submenu: [
                {
                    label: i18n.text("game_forceLang"),
                    submenu:
                        [
                            { lang: "en", name: "English" },
                            { lang: "ja", name: "日本語" },
                            { lang: "zh", name: "中文" },
                            { lang: "ko", name: "한국어" },
                            { lang: "es", name: "Español" },
                            { lang: "pt", name: "Português" },
                            { lang: "fr", name: "Français" },
                            { lang: "de", name: "Deutsch" },
                            { lang: "it", name: "Italiano" },
                            { lang: "pl", name: "Polski" },
                            { lang: "ro", name: "Română" },
                            { lang: "tr", name: "Türkçe" },
                            { lang: "ru", name: "Русский" },
                            { lang: "vi", name: "Tiếng Việt" },
                            { lang: "ar", name: "العربية" },
                        ].map((langInfo, index) => {
                            return {
                                label: langInfo.name,
                                click: (item, window) => {
                                    window.webContents.executeJavaScript(`
                                    lsc = JSON.parse(localStorage.getItem("config"));
                                    lsc.lang = "${langInfo.lang}";
                                    localStorage.setItem("config", JSON.stringify(lsc));
                                    `);
                                    window.reload();
                                }
                            }
                        })
                },
                {
                    label: i18n.text("game_forceReconnect"),
                    click: (item, window) => {
                        window.webContents.executeJavaScript("initSessionWs();");
                    }
                },
                {
                    label: i18n.text("game_openCacheFolder"),
                    click: (item, window) => {
                        shell.openPath(path.join(process.cwd(), "cache"));
                    }
                },
                {
                    // TODO FIX
                    label: i18n.text("game_removeData"),
                    click: (item, window) => {
                        dialog
                            .showMessageBox({
                                type: "question",
                                buttons: [i18n.text("button_yes"), i18n.text("button_no")],
                                title: i18n.text("game_removeData"),
                                message: i18n.text("game_removeDataConfirm"),
                            })
                            .then((result) => {
                                if (result.response == 0) {
                                    session.defaultSession
                                        .clearStorageData({
                                            storages: ["indexdb", "cache", "localstorage"],
                                        })
                                        .then(() => {
                                            window.webContents.reloadIgnoringCache();
                                        });
                                }
                            });
                    }
                }
            ]
        },
        {
            label: i18n.text("dev"),
            submenu: [
                {
                    label: i18n.text("dev_reload"),
                    accelerator: 'CmdOrCtrl+R',
                    click: (item, window) => {
                        window.reload();
                    }
                },
                {
                    label: i18n.text("dev_devTools"),
                    accelerator: 'F12',
                    click: (item, window) => {
                        window.webContents.openDevTools({ mode: 'detach' })
                    }
                }
            ]
        }
    ]

    return Menu.buildFromTemplate(template);
}

protocol.registerSchemesAsPrivileged([{
    scheme: "ywbf",
    privileges: {
        standard: true
    }
}]);

app.whenReady().then(() => {
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

    let win = createWindow();

    app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) win = createWindow();
    });


    protocol.handle("ywbf", async (request) => {
        const urlPath = request.url.slice("ywbf://".length);
        let realurl = "https://" + urlPath;
        let requrl = new url.URL(request.url);
        let filePath = requrl.hostname + requrl.pathname;
        const fileurl = url.pathToFileURL(path.join(process.cwd(), "cache", filePath));
        filePath = fileurl.pathname.substring(1);
        const ses = session.fromPartition("ywbfses");
        try {
            let localFileRequest = await ses.fetch(fileurl);
            let statusCode = localFileRequest.status;
            if (statusCode < 200 || statusCode >= 400) {
                console.log("读取本地 " + filePath + " 失败, statusCode: " + statusCode);
            }
            let localFileLastModified = localFileRequest.headers.get("last-modified");
            let localFileDate = new Date(localFileLastModified);
            // console.log(filePath + " 本地时间: " + localFileDate.getFullYear() + "-" + (localFileDate.getMonth() + 1) + "-" + localFileDate.getDate());

            let response = await ses.fetch(realurl, {
                method: 'HEAD'
            });
            let mds = response.headers.get("Last-Modified");
            if (!mds) throw realurl + " 远端文件无Last-Modified";
            let webFileDate = new Date(mds);
            // console.log(realurl + " 网络时间: " + webFileDate.getFullYear() + "-" + (webFileDate.getMonth() + 1) + "-" + webFileDate.getDate());
            let span = localFileDate.getTime() - webFileDate.getTime();
            if (span < 0) throw "本地文件过期";
            console.log(realurl + " 本地时间: " + localFileDate.getFullYear() + "-" + (localFileDate.getMonth() + 1) + "-" + localFileDate.getDate() + " > " + "网络时间: " + webFileDate.getFullYear() + "-" + (webFileDate.getMonth() + 1) + "-" + webFileDate.getDate());
            console.log("使用本地文件: " + filePath);
            return localFileRequest;
        }
        catch (ex) {
            console.log(ex.name + ":" + fileurl);
            console.log("从网络获取 " + realurl);
            let webResponse = await ses.fetch(realurl);
            let statusCode = webResponse.status;
            let webFile = await webResponse.clone().arrayBuffer();
            if (statusCode < 200 || statusCode >= 400) {
                console.log("获取 " + realurl + " 失败, statusCode: " + statusCode);
            }
            else {
                await utils.writeFile(filePath, webFile);
            }
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
