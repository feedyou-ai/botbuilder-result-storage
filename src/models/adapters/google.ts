const GoogleSpreadsheet = require('google-spreadsheet')
const async = require('async')
const _ = require('lodash')
const md5 = require('md5')
const azure = require('azure-storage')
import Adapter from '../adapter'
import { ADDRGETNETWORKPARAMS } from 'dns'

const TABLENAME = 'GoogleSheetRows'
const SHEET_INDEX = 1

type Config = { credentials: string }
type Row = {}
type Document = {
  useServiceAccountAuth: (credentials: any, cb: (err: Error) => void) => void
  getInfo: (cb: (err: Error) => void) => { worksheets: Sheet[] }
  getRows: (index: number, cb: (err: Error, rows: Row[]) => void) => void
}
type Sheet = {
  getCells: (config: {}, cb: (err: Error, cells: Cell[]) => void) => void
  bulkUpdateCells: (cells: Cell[], cb: (err: Error) => void) => void
}
type Cell = { value: string; col: number }

export default class Google extends Adapter {
  document: Document
  sheet: Sheet
  header: string[]

  config: Config

  constructor(documentId: string, config: Config) {
    super(documentId, config)
    this.adapterId = 'google'

    if (!config.credentials) {
      throw new Error('Storage field "credentials" not found.')
    }
  }

  login(config: {}) {
    return false
  }

  init(header: {}) {
    return new Promise((resolve, reject) => {
      // TODO checkConnection
      resolve()
    })
  }

  // data = { "name": "Jan", "id": "a1b2c3", ...}
  // keys = [ "name", "id" ]
  store(data: any, keys: string[], documentId: string) {
    const adapter = this
    let tableService: any = {}

    return new Promise((resolve, reject) => {
      this.checkConnection(Object.keys(data))
        .then(() => {
          async.waterfall(
            [
              function createTableStorage(callback: any) {
                tableService = getTableService()
                tableService.createTableIfNotExists(
                  TABLENAME,
                  (error: Error, result: any, response: any) => {
                    error && console.error(error) && callback(error)
                  }
                )

                const rowKey = md5(keys.map((key: string) => data[key] || '').join(''))
                // documentId = process.env['StorageDocumentId']
                const partitionKey = documentId

                callback(undefined, partitionKey, rowKey)
              },

              function getSheetRowIndex(partitionKey: string, rowKey: string, callback: any) {
                // try to get an existing entity
                tableService.retrieveEntity(
                  TABLENAME,
                  partitionKey,
                  rowKey,
                  (error: Error, result: any, response: any) => {
                    if (!error || (result && result.SheetRowIndex._)) {
                      console.log('Entity at row', result.SheetRowIndex._, 'already exists')
                      callback(undefined, result.SheetRowIndex._)

                      // @ts-ignore
                    } else if (error.code && error.code === 'ResourceNotFound') {
                      // entity doesn't exist - create one
                      adapter.document.getRows(SHEET_INDEX, (err: Error, rows: Row[]) => {
                        // console.log('ROWS:', rows)
                        const rowIndex = rows.length + 2
                        const entityGenerator = azure.TableUtilities.entityGenerator
                        const entity = {
                          PartitionKey: entityGenerator.String(partitionKey),
                          RowKey: entityGenerator.String(rowKey),
                          SheetRowIndex: entityGenerator.String(rowIndex)
                        }
                        console.log('INSERTING NEW ENTITY:'.toLowerCase(), entity)
                        tableService.insertEntity(
                          TABLENAME,
                          entity,
                          (error: Error, result: any, response: any) => {
                            if (!error) {
                              if (result) {
                                callback(undefined, rowIndex)
                              }
                            } else error && console.error(error) && callback(error)
                          }
                        )
                      })
                    } else {
                      error && console.error(error) && callback(error)
                    }
                  }
                )
              },

              function getUpdatedRowCells(rowAtIndex: string, callback: any) {
                adapter.sheet.getCells(
                  {
                    'min-row': rowAtIndex,
                    'max-row': rowAtIndex,
                    'min-col': 1,
                    'max-col': adapter.header.length,
                    'return-empty': true
                  },
                  (err: Error, cells: Cell[]) => callback(err, cells, rowAtIndex)
                )
              },

              function setUpdateValues(updateRowCells: Cell[], rowAtIndex: string, callback: any) {
                const columnPositions = Object.keys(data).map(
                  column => adapter.header.indexOf(column) + 1
                )

                console.log(
                  'Set data ' +
                    JSON.stringify(data) +
                    ' to column positions ' +
                    columnPositions +
                    ' on row ' +
                    rowAtIndex
                )

                updateRowCells.map(cell => {
                  const dataIndex = columnPositions.indexOf(cell.col)
                  if (dataIndex >= 0) {
                    cell.value = _.values(data)[dataIndex]
                  }
                })

                adapter.sheet.bulkUpdateCells(updateRowCells, callback(rowAtIndex))
              }
            ],
            (rowAtIndex: string) => {
              resolve({ rowAtIndex })
            }
          )
        })
        .catch(reject)
    })
  }

  checkConnection(header: string[]) {
    const adapter = this
    return new Promise((resolve, reject) => {
      if (!adapter.document || !adapter.sheet || adapter.checkIfMissing(header)) {
        adapter.document = new GoogleSpreadsheet(this.documentId)

        async.waterfall(
          [
            function auth(callback: any) {
              adapter.document.useServiceAccountAuth(
                JSON.parse(adapter.config.credentials),
                callback
              )
            },

            function getInfoAndWorksheets(callback: any) {
              adapter.document.getInfo(callback)
            },

            function getHeader(info: any, callback: any) {
              adapter.sheet = info.worksheets.find((ws: any) => ws.title === 'List 1')
              adapter.sheet.getCells(
                {
                  'min-row': 1,
                  'max-row': 1,
                  'min-col': 1,
                  'return-empty': true
                },
                callback
              )
            },

            function appendMissingHeaderColumns(headerCells: Cell[], callback: any) {
              adapter.header = headerCells.map(c => c.value).filter(v => v)
              const missing = header.filter(i => adapter.header.indexOf(i) < 0)

              if (missing.length > 0) {
                for (
                  let i = adapter.header.length;
                  i < adapter.header.length + missing.length;
                  i++
                ) {
                  if (!headerCells[i]) {
                    reject(
                      new Error(
                        'HEADER COLUMN ON POSITION ' +
                          i +
                          ' NOT FOUND - TRY TO ADD IT USING GDOCS GUI'
                      )
                    )
                  }
                  headerCells[i].value = missing[i - adapter.header.length]
                }
                adapter.header = headerCells.map(c => c.value).filter(v => v)
                adapter.sheet.bulkUpdateCells(headerCells, callback)
              } else {
                callback()
              }
            }
          ],
          (err: any) => {
            err ? reject(err) : resolve()
          }
        )
      } else {
        resolve()
      }
    })
  }

  checkIfMissing(header: string[]) {
    return _.difference(header, this.header).length > 0
  }
}

function getTableService() {
  return azure.createTableService(process.env['AzureWebJobsStorage'])
}
