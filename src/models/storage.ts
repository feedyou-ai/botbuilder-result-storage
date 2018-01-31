import Adapter from "./adapter";
import Google from "./adapters/google";
import Office from "./adapters/office";

export default class Storage {
  storageId: string;
  documentId: string;
  adapter: Adapter;
  config: {};

  constructor(storageId: string, adapterId: string, documentId: string, config: {} = {}) {
    this.storageId = storageId;
    this.documentId = documentId;
    this.config = config;
    this.adapter = this.createAdapterById(adapterId, documentId, config);
  }

  protected createAdapterById(adapterId: string, documentId: string, config: any = {}) {
    switch (adapterId) {
      case "google":
        return new Google(documentId, config);
      case "office":
        return new Office(documentId, config);
    }
  }

  public storeRow(data: {}, keys: {}, userData: {}) {
    return new Promise(resolve => {
      this.adapter.storeRow(data, keys, userData).then(userData =>
        resolve({
          storageId: this.storageId,
          userData
        })
      );
    });
  }

  public static create(from: Storage) {
    if (!from.storageId) {
      throw new Error("Cannot find 'storageId' field.");
    }
    if (!from.adapter || !from.adapter.adapterId) {
      throw new Error("Cannot find 'adapter.adapterId' field.");
    }
    if (!from.adapter || !from.adapter.documentId) {
      throw new Error("Cannot find 'documentId' field.");
    }

    return new Storage(
      from.storageId,
      from.adapter.adapterId,
      from.adapter.documentId,
      from.adapter.config || {}
    );
  }
}
