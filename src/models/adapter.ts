export default abstract class Adapter {
  adapterId: string;
  documentId: string;
  config: {};

  constructor(documentId: string, config: {} = {}) {
    this.documentId = documentId;
    this.config = config;
  }

  abstract login(config: {}): boolean;
  abstract initDocument(header: {}): Promise<{}>;
  abstract storeRow(data: {}, keys: {}, userData?: {}): Promise<{}>;
}
