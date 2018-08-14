export default abstract class Adapter {
  adapterId: string
  documentId: string
  sheet: any
  tableService: any
  config: {
    credentials: {}
  }

  constructor(
    documentId: string,
    config: {
      credentials: {}
    }
  ) {
    this.documentId = documentId
    this.config = config
  }

  abstract login(config: {}): boolean
  abstract init(header: string[]): Promise<{}>
  abstract store(data: {}, keys: string[], documentId: string): Promise<{}>
}
