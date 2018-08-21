import Adapter from '../adapter'
import * as request from 'request'

type Config = { credentials: {} }

export default class SuccessFactor extends Adapter {
  constructor(documentId: string, config: Config) {
    super(documentId, config)
    this.adapterId = 'successfactor'

    if (!config.credentials) {
      throw new Error(
        'Storage field "credentials" not found. Check environment variable declaration for SuccessFactor authentication'
      )
    }
  }

  login(config: {}) {
    return false
  }

  init(header: {}, keys: {}) {
    return new Promise((resolve, reject) => {
      resolve()
    })
  }

  store(data: {}) {
    return new Promise((resolve, reject) => {
      const authHeader =
        'Basic ' +
        Buffer.from(
          process.env.ResultStorageSuccessFactorsCompanyUsername +
            '@' +
            process.env.ResultStorageSuccessFactorsCompanyId +
            ':' +
            process.env.ResultStorageSuccessFactorsCompanyPassword
        ).toString('base64')
      console.log(authHeader)
      resolve()
    })
  }
}
