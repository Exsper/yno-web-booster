const LANG_EN_US = require("./lang/en-US.json");
const LANG_ZH_CN = require("./lang/zh-CN.json");

class I18n {
    constructor(preferLangs) {
        this.selectLang = LANG_EN_US;
        this.langs = {
            "en-US": LANG_EN_US,
            "zh-Hans-CN": LANG_ZH_CN,
        };
        this.init(preferLangs);
    }

    init(preferLangs) {
        let langNames = Object.keys(this.langs);
        let lang = preferLangs.find((val) => langNames.indexOf(val) >= 0);
        if (!lang) this.selectLang = LANG_EN_US;
        else this.selectLang = this.langs[lang];
    }

    getMenuList() {
        return Object.keys(this.langs).map((langCode) => {
            return {code: langCode, name: this.langs[langCode].name};
        });
    }

    text(name) {
        return this.selectLang[name] || name;
    }
}

module.exports = I18n;