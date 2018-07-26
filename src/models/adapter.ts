export default abstract class Adapter {
  adapterId: string;
  documentId: string;
  config: {
    SheetName: string;
    ClientId: string;
    ClientSecret: string;
    RefreshToken: string;
    MaxColumns?: number;
  };

  constructor(
    documentId: string,
    config: {
      SheetName: string;
      ClientId: string;
      ClientSecret: string;
      RefreshToken: string;
      MaxColumns?: number;
    }
  ) {
    this.documentId = documentId;
    this.config = config;
  }

  abstract login(config: {}): boolean;
  abstract init(header: string[], keys: string[]): Promise<{}>;
  abstract store(data: {}, keys: string[], userData?: {}): Promise<{}>;
}
