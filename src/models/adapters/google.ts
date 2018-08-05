const GoogleSpreadsheet = require('google-spreadsheet')
const async = require('async')
const _ = require('lodash')
import Adapter from '../adapter'

const SHEET_INDEX = 1

type Config = { credentials: {} }
type Row = {}
type Document = {
  useServiceAccountAuth: (credentials: {}, cb: (err: Error) => void) => void
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

  init(header: {}, keys: {}) {
    return new Promise((resolve, reject) => {
      resolve()
    })
  }

  store(data: {}, keys: {}, userData: { rowAtIndex?: number } = {}) {
    const adapter = this

    return new Promise((resolve, reject) => {
      this.checkConnection(Object.keys(data))
        .then(() => {
          async.waterfall(
            [
              function getUpdateRowIndexIfEmpty(callback: any) {
                // if no preset updateRow, find first empty one
                if (!userData.rowAtIndex) {
                  adapter.document.getRows(SHEET_INDEX, (err: Error, rows: Row[]) => {
                    if (err) {
                      reject(err)
                    }
                    // console.log("adding new row on index " + (rows.length + 2));
                    callback(undefined, rows.length + 2)
                  })
                } else {
                  // console.log("updating row with pre-set index " + rowAtIndex);
                  callback(undefined, userData.rowAtIndex)
                }
              },

              function getUpdatedRowCells(rowAtIndex: number, callback: any) {
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

              function setUpdateValues(updateRowCells: Cell[], rowAtIndex: number, callback: any) {
                const columnPositions = Object.keys(data).map(
                  column => adapter.header.indexOf(column) + 1
                )

                // console.log("set data " + JSON.stringify(data) + " to column positions " + columnPositions);

                updateRowCells.map(cell => {
                  const dataIndex = columnPositions.indexOf(cell.col)
                  if (dataIndex >= 0) {
                    cell.value = _.values(data)[dataIndex]
                  }
                })

                adapter.sheet.bulkUpdateCells(updateRowCells, (err: Error) => {
                  callback(rowAtIndex)
                })
              }
            ],
            (rowAtIndex: number) => {
              console.log('STORING ROW TO GOOGLE', rowAtIndex, data, this.header)
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
      if (!this.document || !this.sheet || this.checkIfMissing(header)) {
        adapter.document = new GoogleSpreadsheet(this.documentId)

        async.waterfall(
          [
            function auth(callback: any) {
              adapter.document.useServiceAccountAuth(adapter.config.credentials, callback)
            },

            function getInfoAndWorksheets(callback: any) {
              adapter.document.getInfo(callback)
            },

            function getHeader(info: any, callback: any) {
              adapter.sheet = info.worksheets[SHEET_INDEX - 1]
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
          resolve
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
