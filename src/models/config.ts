import Adapter from './adapter'

export default class Config {
  adapters: Adapter[] = []

  public addAdapter(adapter: Adapter) {
    this.adapters.push(adapter)
  }
}
