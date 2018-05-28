import Config from "../../models/config";
import ConfigService from "../config";
import * as NodePersist from "node-persist";

export default class FilesystemConfigService extends ConfigService {
  config: Config;

  constructor() {
    NodePersist.initSync();
    super();
  }

  load(): Promise<Config> {
    return new Promise((resolve, reject) =>
      NodePersist.getItem("config")
        .then(config => resolve(config as Config))
        .catch(error => reject(error))
    );
  }

  save(config: Config): void {
    NodePersist.setItem("config", config);
  }
}
