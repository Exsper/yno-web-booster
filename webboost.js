const fs = require("fs");
const path = require("path");

async function exfetch(url) {
    let stat = 0;
    let TIMEOUT = 60000;
    let controller = new AbortController();
    let response = await fetch(url, {signal: controller.signal});
    let timer = setTimeout(() => {
        if (stat === 1) return;
        console.log("超时，检查缓存");
        let mds = response.headers.get("Last-Modified");
        let fileDate = new Date(mds);
        let cache = getCache(url, fileDate);
        if (!cache) {
            console.log("使用缓存替代");
            stat = 1;
            controller.abort();
            return cache;
        }
        else {
            console.log("无缓存，继续下载");
            stat = 0;
        }
    }, TIMEOUT);
    let content = await response.text();
    stat = 1;
    clearTimeout(timer);
    timer = null;
    return content;
}

/**
 * 是否为可缓存资源
 * @param {string} url
 * @returns {boolean}
 */
function isCacheSource(url) {
    if (!url) return false;
    if (!(url.startsWith("http://") || url.startsWith("https://"))) return false;
    if (url.indexOf("?") >= 0) url = url.substring(0, url.indexOf("?"));
    if (url.indexOf("#") >= 0) url = url.substring(0, url.indexOf("#"));
    if (url.endsWith(".html")) return false;

    if (url.endsWith(".js")) return true;
    if (url.endsWith(".json")) return true;
    if (url.endsWith(".css")) return true;
    if (url.endsWith(".jpg")) return true;
    if (url.endsWith(".png")) return true;
    if (url.endsWith(".bmp")) return true;
    if (url.endsWith(".webp")) return true;
    if (url.endsWith(".gif")) return true;
    if (url.endsWith(".ico")) return true;
    if (url.endsWith(".ini")) return true;
    if (url.endsWith(".ldb")) return true;
    if (url.endsWith(".lmt")) return true;
    if (url.endsWith(".fon")) return true;
    if (url.endsWith(".ttf")) return true;
    if (url.endsWith(".wav")) return true;
    if (url.endsWith(".soundfont")) return true;
    if (url.endsWith(".wasm")) return true;
    if (url.endsWith(".opus")) return true;
    if (url.endsWith(".po")) return true;
    if (url.endsWith(".lmu")) return true;
    if (url.endsWith(".xyz")) return true;
    // TODO

    return false;
}


// fs.mkdir 的 Promise 形式
function mkdirPromise(dirname) {
    return new Promise((resolve, reject) => {
        fs.mkdir(dirname, err => {
            if (err) {
                reject(err);
            }
            resolve();
        })
    })
}

// fs.stst 的 Promise 形式
function statPromise(dirname) {
    return new Promise((resolve, reject) => {
        fs.stat(dirname, (err, stats) => {
            if (err) {
                reject(err);
            }
            resolve(stats);
        })
    })
}

// 递归创建目录，异步方法
async function mkdirs(dirname) {
    try {
        await statPromise(dirname);
    } catch (e) {
        await mkdirs(path.dirname(dirname));
        await mkdirPromise(dirname).catch(() => { });
    }
}

// 写入本地文件
async function writeFile(to, data, encoding = 'binary') {
    await mkdirs(path.dirname(to));
    return new Promise((resolve, reject) => {
        fs.writeFile(to, data, { encoding: encoding }, err => {
            if (err) {
                reject(err);
            }
            resolve();
        });
    });
}

function encodeData(data, encoding = 'binary') {
    if (typeof data === 'string') {
        return Buffer.from(data, encoding);
    } else {
        return Buffer.from(data);
    }
}

module.exports.isCacheSource = isCacheSource;
module.exports.writeFile = writeFile;
module.exports.exfetch = exfetch;