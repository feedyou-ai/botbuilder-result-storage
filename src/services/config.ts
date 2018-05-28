import Config from "../models/config";
import Adapter from "../models/bot";

export default abstract class ConfigService {
  config: Config;

  constructor() {
    // this.load().then(config => (this.config = config));
  }

  get(): Promise<Config> {
    if (this.config) {
      return new Promise(resolve => resolve(this.config));
    } else {
      return this.load();
    }
  }

  load(): Promise<Config>;
  save(config: Config): void;
}
