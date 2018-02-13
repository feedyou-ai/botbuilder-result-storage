import Storage from "./storage";

export default class Bot {
  public id: string;
  public storages: Storage[];

  constructor(id: string, storages: Storage[]) {
    this.id = id;
    this.storages = storages;
  }

  storeRow(data: {}, keys: {}, config: {}) {
    return new Promise((resolve, reject) => {
      Promise
        .all(this.storages.map(storage => storage.storeRow(data, keys, config)))
        .then(row => resolve(row))
        .catch(err => reject(err));
    });
  }

  initDocument(data: {}) {
    return new Promise((resolve, reject) => {
      Promise
        .all(this.storages.map(storage => storage.initDocument(data)))
        .then(row => resolve(row))
        .catch(err => reject(err));
    });
  }

  static create(from: Bot) {
    if (!from.id) {
      throw new Error("Cannot find 'id' field.");
    }

    return new Bot(from.id, (from.storages || []).map(
      storage => Storage.create(storage)
    );
  }
}
