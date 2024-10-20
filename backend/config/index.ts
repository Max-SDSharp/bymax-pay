import ConfigBase from "commons/configBase";

export default class Config extends ConfigBase {
    static PORT: number = parseInt(`${process.env.PORT || 3001}`);
}