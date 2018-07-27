import Config from "../models/config";

export default abstract class ConfigService {
  config: Config;

  constructor() {
    // this.load().then(config => (this.config = config));
  }

  get(): Promise<Config> {
    if (this.config) {
      return new Promise(resolve => resolve(this.config));
    } else {
      return new Promise(resolve =>
        this.load().then((res: any) => {
          this.config = res;
          resolve(res);
        })
      );
    }
  }

  abstract load(): Promise<Config>;
  abstract save(config: Config): void;
}
