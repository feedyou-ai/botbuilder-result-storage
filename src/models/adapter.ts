export default abstract class Adapter {
  adapterId: string;
  documentId: string;
  config: {
    credentials: {};
  };

  constructor(
    documentId: string,
    config: {
      credentials: {};
    }
  ) {
    this.documentId = documentId;
    this.config = config;
  }

  abstract login(config: {}): boolean;
  abstract init(header: string[], keys: string[]): Promise<{}>;
  abstract store(data: {}, keys: string[], userData?: {}): Promise<{}>;
}
