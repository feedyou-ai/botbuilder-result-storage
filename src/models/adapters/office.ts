import Adapter from "../adapter";
export default class Office extends Adapter {
  constructor(documentId: string, config: {} = {}) {
    super(documentId, config);
    this.adapterId = "office";
  }

  login(config: {}): boolean {
    return false;
  }

  initDocument(header: {}, keys: {}): boolean {
    return false;
  }

  storeRow(data: {}): Promise<{}> {
    return new Promise(resolve => resolve());
  }
}
