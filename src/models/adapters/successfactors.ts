import Adapter from '../adapter'
import * as xml2js from 'xml2js'
import * as util from 'util'
import * as request from 'request'

type Config = { credentials: {} }

export default class SuccessFactors extends Adapter {
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

  store(data: any) {
    return new Promise((resolve, reject) => {
      if (
        !data.primaryEmail ||
        !data.firstName ||
        !data.lastName ||
        !data.cellPhone ||
        !data.country
      ) {
        resolve(
          'Request body format is incorrect. Please set request body to { "data": { "primaryEmail": "...", "firstName": "...", "lastName": "...", "country": "...", "cellPhone": "..." } }'
        )
      } else {
        const parser = new xml2js.Parser()
        console.log('Candidate upsert request:\n', data)
        const username = process.env.ResultStorageSuccessFactorsCompanyUsername,
          password = process.env.ResultStorageSuccessFactorsCompanyPassword,
          companyId = process.env.ResultStorageSuccessFactorsCompanyId,
          combined = username + '@' + companyId + ':' + password

        // request to filter Candidates for contactEmail
        // URL also includes authentication credentials
        request(
          {
            url:
              'https://' +
              combined +
              "@api2preview.sapsf.eu/odata/v2/Candidate?$filter=primaryEmail eq '" +
              data.primaryEmail +
              "'"
          },
          (error: Error, response: any, body: string) => {
            if (error) reject(error)
            else if (response.statusCode !== 200 || !body) {
              // incorrect authentication credentials
              const errMessage =
                'REQUEST FAILED WITH ' +
                response.statusCode +
                ': ' +
                response.statusMessage +
                '\nCheck authorization credentials or request URL'
              reject(errMessage)
            } else {
              // successful request authentication
              parser.parseString(body, function(err: Error, result: any) {
                if (err) reject(err)
                else if (result && result.feed.entry) {
                  // successfully found candidate
                  const candidateId =
                    result.feed.entry[0].content[0]['m:properties'][0]['d:candidateId'][0]._
                  // try to update it
                  delete data.primaryEmail
                  data.__metadata = {
                    type: 'SFOData.Candidate',
                    uri: 'Candidate(' + candidateId + ')'
                  }
                  request(
                    {
                      url: 'https://' + combined + '@api2preview.sapsf.eu/odata/v2/upsert',
                      method: 'POST',
                      json: data
                    },
                    (error: Error, response: any, body: any) => {
                      if (error) reject(error)
                      else if (response.body.d[0].status !== 'ERROR') {
                        console.log(data.firstName, response.body.d[0].message)
                        resolve()
                      } else {
                        reject(response.body)
                      }
                    }
                  )
                } else {
                  // couldn't find candidate
                  console.log('Candidate ' + data.primaryEmail + ' not found')
                  // try to insert new candidate entry
                  request(
                    {
                      url: 'https://' + combined + '@api2preview.sapsf.eu/odata/v2/Candidate',
                      method: 'POST',
                      json: data
                    },
                    (error: Error, response: any, body: any) => {
                      if (error) reject(error)
                      else if (response.body.d) {
                        console.log('Successfully inserted', data.primaryEmail)
                        console.log(response.body.d)
                        resolve()
                      } else {
                        reject(response.body)
                      }
                    }
                  )
                }
              })
            }
          }
        )
      }
    })
  }
}
