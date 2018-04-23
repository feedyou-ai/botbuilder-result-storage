export default abstract class Adapter {
  adapterId: string;
  documentId: string;
  config: {};

  constructor(documentId: string, config: {} = {}) {
    this.documentId = documentId;
    this.config = config;
  }

  abstract login(config: {}): boolean;
  abstract initDocument(header: string[], keys: string[]): Promise<{}>;
  abstract storeRow(data: {}, keys: {}, userData?: {}): Promise<{}>;
}
