export default abstract class Adapter {
  adapterId: string;
  documentId: string;
  config: {};

  constructor(documentId: string, config: {} = {}) {
    this.documentId = documentId;
    this.config = config;
  }

  abstract login(config: {}): boolean;
  abstract init(header: string[], keys: string[]): Promise<{}>;
  abstract store(data: {}, keys: {}, userData?: {}): Promise<{}>;
}
