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

  store(data: {
    primaryEmail: string
    firstName: string
    lastName: string
    cellPhone: string
    country: string
  }) {
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
        console.log(data)
        const username = process.env.ResultStorageSuccessFactorsCompanyUsername,
          password = process.env.ResultStorageSuccessFactorsCompanyPassword,
          companyId = process.env.ResultStorageSuccessFactorsCompanyId,
          combined = username + '@' + companyId + ':' + password
        console.log('Basic ' + Buffer.from(combined).toString('base64'))

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
              const errMessage = `
REQUEST FAILED WITH ${response.statusCode}: ${response.statusMessage}`
              reject(errMessage)
            } else {
              // successful request authentication
              parser.parseString(body, function(err: Error, result: any) {
                if (err) reject(err)
                else if (result && result.feed.entry) {
                  // successfully found candidate
                  const candidateId =
                    result.feed.entry[0].content[0]['m:properties'][0]['d:candidateId'][0]._
                  console.log(candidateId)
                  // try to update it
                  request(
                    {
                      url: 'https://' + combined + '@api2preview.sapsf.eu/odata/v2/upsert',
                      method: 'POST',
                      json: {
                        __metadata: {
                          type: 'SFOData.Candidate',
                          uri: 'Candidate(' + candidateId + ')'
                        },
                        firstName: data.firstName || '',
                        lastName: data.lastName || '',
                        country: data.country || '',
                        cellPhone: data.cellPhone || ''
                      }
                    },
                    (error: Error, response: any, body: any) => {
                      if (error) reject(error)
                      else if (response.body.d[0].status !== 'ERROR') {
                        console.log('Successfully updated', data.primaryEmail)
                        console.log(response.body)
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
                      else if (response.body) {
                        console.log('Successfully inserted', data.primaryEmail)
                        console.log(response.body)
                        resolve()
                      } else {
                        reject(response.body)
                      }
                    }
                  )
                }
              })
              // parse new candidateId
              // const newID = response.body.d[0].key.match(/(?<=\=).*/g)[0]
              // console.log(newID)
            }
          }
        )
      }
    })
  }
}
