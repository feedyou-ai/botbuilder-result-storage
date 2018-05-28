import Config from "../../models/config";
import ConfigService from "../config";

export default class TableStorageConfigService extends ConfigService {
  load(): Promise<Config> {
    throw new Error("Method not implemented.");
  }

  save(config: Config): void {
    throw new Error("Method not implemented.");
  }
}
