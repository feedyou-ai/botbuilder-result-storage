import Adapter from "../storage/adapter";
import Google from "../storage/adapters/google";
import Office from "../storage/adapters/google";

export default class Storage {
  storagesCache: [Storage];

  static getBotStorages(botId: string): [Storage] {}

  getAdapter(botId: string, adapterId: string): Adapter {
    const cachedAdapter = this.findInCache(botId, adapterId);
    if (cachedAdapter) {
      return cachedAdapter;
    } else {
      const adapter = this.create(botId, adapterId);
      this.saveToCache(adapter);
      return adapter;
    }
  }

  protected findInCache(botId: string, adapterId: string): Adapter {
    return this.adaptersCache.find(a => a.adapterId === adapterId && a.botId === botId);
  }

  protected saveToCache(adapter: Adapter) {
    this.adaptersCache.push(adapter);
  }

  protected create(botId: string, adapterId: string) {
    switch (adapterId) {
      case "google":
        return new Google(botId);
      case "office":
        return new Office(botId);
    }
  }
}
