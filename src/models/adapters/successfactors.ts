import Adapter from '../adapter'
import * as request from 'request'

type Config = { credentials: {} }

export default class SuccessFactors extends Adapter {
  basicAuth: string

  constructor(documentId: string, config: Config) {
    super(documentId, config)
    // basic authorization format: username@companyId:password
    this.basicAuth =
      process.env.ResultStorageSuccessFactorsCompanyUsername +
      '@' +
      process.env.ResultStorageSuccessFactorsCompanyId +
      ':' +
      process.env.ResultStorageSuccessFactorsCompanyPassword

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

  init(header: {}) {
    return new Promise((resolve, reject) => {
      resolve()
    })
  }

  store(data: any, keys?: any, documentId?: any) {
    if (typeof data === 'string') data = JSON.parse(data)
    return new Promise((resolve, reject) => {
      if (!data.contactEmail || !data.jobReqId) {
        reject(
          'Request body format is incorrect. Please set request body to { "data": { "contactEmail": "...", "firstName": "...", "lastName": "...", "country": "...", "cellPhone": "...", "jobReqId": "..." } }'
        )
      } else {
        console.log('Candidate upsert request:\n', data)

        this.manageCandidate(data, (err: Error) => {
          err ? reject(err) : resolve()
        })
      }
    })
  }
  manageCandidate(data: any, callback: Function) {
    const that = this
    // request to filter Candidates for contactEmail
    // URL also includes authentication credentials
    request(
      {
        url:
          'https://' +
          that.basicAuth +
          "@api2preview.sapsf.eu/odata/v2/Candidate?$filter=contactEmail eq '" +
          data.contactEmail +
          "'&$format=json"
      },
      (error: Error, response: any, body: any) => {
        body = JSON.parse(body)
        if (error) callback(error)
        else if (response.statusCode !== 200 || !body) {
          // incorrect authentication credentials
          const errMessage =
            'Candidate REQUEST FAILED WITH ' +
            response.statusCode +
            ': ' +
            response.statusMessage +
            '\nCheck authorization credentials or request URL'
          callback(errMessage)
        } else {
          // successful request authentication
          if (body && body.d.results[0]) {
            body = body.d.results[0]
            // successfully found candidate
            const candidateId = body.candidateId
            console.log('Candidate with ID', candidateId, 'already exists. Updating...')
            // try to update it
            delete data.primaryEmail // primaryEmail is not upsertable and also it is not used in manageJobApplication()
            const { jobReqId, jobApplicationQuestionResponse, ...dataBody } = data // jobReqId
            dataBody.__metadata = {
              type: 'SFOData.Candidate',
              uri: 'Candidate(' + candidateId + ')'
            }
            request(
              {
                url: 'https://' + that.basicAuth + '@api2preview.sapsf.eu/odata/v2/upsert',
                method: 'POST',
                json: dataBody
              },
              (error: Error, response: any, body: any) => {
                if (error) callback(error)
                else if (response.body.d[0].status !== 'ERROR') {
                  // successfully upserted
                  console.log(data.firstName, response.body.d[0].message, 'with ID', candidateId)
                  // now manage application entity
                  that.manageJobApplication(
                    data,
                    candidateId,
                    (err: Error) => (err ? callback(err) : callback())
                  )
                } else {
                  callback(response.body)
                }
              }
            )
          } else {
            // couldn't find candidate
            !data.primaryEmail && (data.primaryEmail = data.contactEmail)
            console.log('Candidate ' + data.primaryEmail + ' not found. Creating new candidate...')
            // try to insert new candidate entry
            const { jobReqId, source, candidateId, ...dataBody } = data
            request(
              {
                url: 'https://' + that.basicAuth + '@api2preview.sapsf.eu/odata/v2/Candidate',
                method: 'POST',
                json: dataBody
              },
              (error: Error, response: any, body: any) => {
                if (error) console.log(error) && callback(error)
                else if (response.body.d) {
                  // successful authorization for Candidate inserting
                  const candidateId = response.body.d.candidateId
                    ? response.body.d.candidateId
                    : undefined
                  console.log(
                    'Successfully created',
                    !!response.body.d.primaryEmail && response.body.d.primaryEmail,
                    'candidate with ID',
                    candidateId
                  )
                  // now manage job application
                  this.manageJobApplication(data, candidateId, (err: Error) => {
                    callback(err)
                  })
                } else {
                  callback(response.body)
                }
              }
            )
          }
        }
      }
    )
  }
  manageJobApplication(data: any, candidateId: string, callback: Function) {
    const that = this
    // request to filter JobApplication for candidateId and jobReqId
    if (!data.jobReqId || !candidateId)
      callback(
        'ERROR: CandidateId: ' +
          candidateId +
          ', jobReqId: ' +
          data.jobReqId +
          '. Make sure both values are set.'
      )
    request(
      {
        url:
          'https://' +
          // URL also includes authentication credentials
          that.basicAuth +
          '@api2preview.sapsf.eu/odata/v2/JobApplication?$filter=jobReqId eq ' +
          data.jobReqId +
          ' and candidateId eq ' +
          candidateId +
          '&$format=json'
      },
      (error: Error, response: any, body: any) => {
        if (error) callback(error)
        else if (response.statusCode !== 200 || !body) {
          // NOT FOUND EXCEPTION
          console.log(
            'JobApplication REQUEST FAILED WITH ' +
              response.statusCode +
              ': ' +
              response.statusMessage
          )
        } else {
          // successful request authentication
          body = JSON.parse(body)
          console.log(
            'Job Application with jobReqId',
            data.jobReqId,
            'and candidateId',
            candidateId,
            'has',
            (body.d.results[0] && Object.keys(body.d.results[0]).length) || body.d.results.length,
            'parameters.'
          )
          const jobApplication = body.d.results
          data.candidateId = candidateId
          delete data.primaryEmail
          // these hard-coded values are mandatory for jobReqId 1664
          const dataBody = {
            minAnnualSal: '0',
            coverLetter: {
              module: 'RECRUITING',
              fileName: '0.txt',
              fileContent: 'XXXXXXXXXXXXXXXXXXXX'
            },
            resume: {
              module: 'RECRUITING',
              fileName: '0.txt',
              fileContent: 'XXXXXXXXXXXXXXXXXXXX'
            },
            candidateSource: 'Feedyou',
            dateOfAvail: '/Date(1517439600000+0000)/',
            custTravel: {
              status: 'No'
            },
            ...data
          }
          if (jobApplication.length === 0) {
            // if job application does not exist
            // insert new jobApplication
            console.log('Job Application does not exist. Creating new one...')
            request(
              {
                url: 'https://' + that.basicAuth + '@api2preview.sapsf.eu/odata/v2/JobApplication',
                method: 'POST',
                json: dataBody
              },
              (err: Error, response: any, body: string) => {
                if (err) callback(err)
                else if (response.statusCode !== 201 || !body) {
                  // NOT FOUND EXCEPTION
                  console.log(
                    'JobApplication REQUEST FAILED WITH ' +
                      response.statusCode +
                      ': ' +
                      response.statusMessage
                  )
                  callback(body)
                } else {
                  console.log(
                    response.statusMessage,
                    response.statusCode,
                    'New Job Application created with jobReqId',
                    data.jobReqId
                  )
                  callback()
                }
              }
            )
          } else {
            // if job application exists
            // update job application
            console.log('Job Application already exists. Updating...')
            request(
              {
                url:
                  'https://' +
                  that.basicAuth +
                  '@api2preview.sapsf.eu/odata/v2/upsert?$format=json',
                method: 'POST',
                json: dataBody
              },
              (err: Error, response: any, body: string) => {
                if (err) callback(err)
                console.log(
                  'Job Application with jobReqId',
                  data.jobReqId,
                  'and candidateId',
                  candidateId,
                  'has been updated.'
                )
                callback()
              }
            )
            callback()
          }
        }
      }
    )
  }
}
