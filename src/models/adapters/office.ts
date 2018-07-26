import Adapter from "../adapter";
import * as GraphTypes from "@microsoft/microsoft-graph-types";
import * as Graph from "@microsoft/microsoft-graph-client";
import * as request from "superagent";
import * as xl from "excel4node";
import * as md5 from "md5";
import { Error } from "mongoose";
import { resolve } from "url";
import { Bool } from "../../../node_modules/aws-sdk/clients/inspector";
import { MaxKey } from "../../../node_modules/@types/bson";

export default class Office extends Adapter {
  client: Graph.Client;
  accessToken: string;
  sheetUrl: string;

  // default first row in the table is row index 4
  public static DEFAULT_ROW_INDEX = 4;

  constructor(
    documentId: string,
    config: {
      SheetName: string;
      ClientId: string;
      ClientSecret: string;
      RefreshToken: string;
      MaxColumns?: number;
    }
  ) {
    super(documentId, config);
    if (typeof config.MaxColumns === "undefined") config.MaxColumns = 64;
    this.config = config;
    this.adapterId = "office";

    console.log(
      "Sheet Name: " +
        this.config.SheetName +
        ", Client ID: " +
        this.config.ClientId +
        ", Client Secret: " +
        this.config.ClientSecret
    );

    this.client = Graph.Client.init({
      authProvider: done => {
        if (this.accessToken) {
          done(undefined, this.accessToken);
        } else {
          console.log("requesting access_token from refresh_token");
          request
            .post("https://login.microsoftonline.com/common/oauth2/v2.0/token")
            .type("form")
            .send({
              client_id: this.config.ClientId,
              client_secret: this.config.ClientSecret,
              grant_type: "refresh_token",
              refresh_token: this.config.RefreshToken,
              scope: "Files.ReadWrite.All offline_access"
            })
            .then(res => {
              if (res.body && res.body.access_token) {
                console.log("Latest access token: ", res.body.access_token);
                console.log("It expires in: ", res.body.expires_in);
                this.accessToken = res.body.access_token;
                done(undefined, res.body.access_token);
              } else {
                done(new Error("access_token not found in token response body"), "");
              }
            })
            .catch(err => done(err, ""));
        }
      }
    });
  }

  getTableName() {
    return "FeedbotData_" + this.config.SheetName;
  }

  getSheetUrl() {
    return "/me/drive/items/" + this.documentId + "/workbook/worksheets/" + this.config.SheetName;
  }

  login(config: {}): boolean {
    // TODO implement something like https://github.com/microsoftgraph/nodejs-connect-sample
    return false;
  }

  checkForExpectedErrors(err: any = {}, printErr: boolean = true) {
    if (err.code && err.code === "UnknownError") {
      // this error occurs completely randomly and is successfully solved by restarting the same process
      console.error("UnknownError exception caught. Restarting last process.");
      return true;
    } else if (err.code && err.code === "InvalidAuthenticationToken") {
      // this error exception means that access token needs to be refreshed.
      console.error("Authentication token has expired. Refreshing the token...");
      // setting this to falsy value will trigger refresh_token request in authProvider
      this.accessToken = undefined;
      return true;
    } else {
      // no expected errors found.
      if (printErr) console.error(err);
      return false;
    }
  }

  areArraysEqual(baseArray: string[], array: string[]) {
    if (baseArray.length !== array.length) return false;
    const length = Math.max(baseArray.length, array.length);
    for (let i = 0; i < length; i++) {
      if (baseArray[i] != array[i]) return false;
    }
    return true;
  }

  init(header: string[]): Promise<{}> {
    console.log("\nInitializing...");
    return new Promise((resolve, reject) => {
      console.log("initDocument", this.documentId, header);

      // using excel4node npm package to find desired range (output example: A1:F1)
      const inputRange = xl.getExcelCellRef(1, 1) + ":" + xl.getExcelCellRef(1, header.length);

      const sheetUrl = this.getSheetUrl();

      const patchTable = (table: any = {}) => {
        // patch table settings: rename it and add first row
        const request = () => {
          // update table name
          console.log("updating table name from %s to %s", table.name, this.getTableName());
          this.client
            .api(sheetUrl + "/tables/" + table.id)
            .patch({
              // forcing the name of the table to be static, because each language
              // makes default table name
              name: this.getTableName()
            })
            .then(() => {
              const request = () => {
                // getting table rows
                this.client
                  .api(sheetUrl + "/tables/" + this.getTableName() + "/rows")
                  .get()
                  .then(rows => {
                    //  checking if there already are first two rows
                    if (rows.value[1]) {
                      resolve();
                    } else {
                      console.log(
                        "adding first row to solve unintended expansion of first named item"
                      );
                      const request = () => {
                        // add empty first row
                        this.client
                          .api(sheetUrl + "/tables/" + this.getTableName() + "/rows")
                          .post({})
                          .then((row: GraphTypes.WorkbookTableRow) => {
                            console.log("initialization finished. Ready for storage");
                            resolve();
                          })
                          .catch(err => {
                            this.checkForExpectedErrors(err) ? request() : reject(err);
                          });
                      };
                      request();
                    }
                  })
                  .catch(err => {
                    // For some reason, after manually deleting the document and creating a new one with the same name, and then
                    // immediately (sooner than in 30s) initializing a new table, a typical exception handling method will throw
                    // a "ItemNowFound" in this exact promise, while trying to get data about the table. This seems like a
                    // server-side error. Thats why scanning for the exact error code eliminates the problem, it gets into a loop
                    // until (usually in about 20s) the server would finally handle itself and behave correctly.
                    // poor user input isn't handled here, so it shouldn't trigger an infinite loop.
                    this.checkForExpectedErrors(err, false) || err.code === "ItemNotFound"
                      ? request()
                      : reject(err);
                  });
              };
              request();
            })
            .catch(err => {
              this.checkForExpectedErrors(err) ? request() : reject(err);
            });
        };
        request();
      };
      const request = () => {
        // check existence of document and sheet
        console.log("checking if document exists...");
        this.client
          .api(sheetUrl)
          .get()
          .then((worksheet: GraphTypes.WorkbookWorksheet) => {
            const request = () => {
              // check existence of document table
              this.client
                .api(sheetUrl + "/tables")
                .get()
                .then((tables: { value: GraphTypes.WorkbookTable[] }) => {
                  // checking table existence
                  if (tables.value.length > 0) {
                    // checking table health, because sometimes after UnknownError occurs during init, table stays unfinished
                    console.log("table already exists:\n", tables.value.map((a: any) => a.name));
                    console.log("checking table health...");
                    // checking table header length, in case user wants to use init to extend the table
                    this.getSheetHeader().then((sheetHeader: any) => {
                      if (!this.areArraysEqual(sheetHeader, header)) {
                        console.log("Updating header...");
                        this.updateHeaders(sheetUrl, header);
                      }
                    });
                    if (tables.value[0].name != this.getTableName()) {
                      // checking table name
                      console.log(
                        "...and it seems that something is not right with it's name... Applying table update..."
                      );
                      patchTable(tables.value[0]);
                    } else {
                      const request = () => {
                        // perform a GET request to get rows array to check if there is the first row inserted
                        this.client
                          .api(sheetUrl + "/tables/" + this.getTableName() + "/rows")
                          .get()
                          .then(rows => {
                            // checking if there is a first row added to the table. if not, then patch the table
                            if (rows.value[1]) {
                              console.log(
                                "...and everything seems to be correct with the table format. Safe to use."
                              );
                              resolve({});
                            } else {
                              console.log(
                                "...and it seems that something is not right with it's rows... Applying table update..."
                              );
                              patchTable(tables.value[0]);
                            }
                          })
                          .catch(err => {
                            // request to get table rows failed, it means something is wrong, patching...
                            this.checkForExpectedErrors(err, false)
                              ? request()
                              : console.log(
                                  "...and it seems that something is not right with it's rows... Applying table update..."
                                ) && patchTable(tables.value[0]);
                          });
                      };
                      request();
                    }
                  } else {
                    console.log("table does not exist, creating header first:", header);
                    // insert header range
                    this.updateHeaders(sheetUrl, header)
                      .then(res => {
                        console.log("now creating table");
                        const request = () => {
                          // create table
                          this.client
                            .api(sheetUrl + "/tables/add")
                            .post({
                              address: inputRange,
                              hasHeaders: true
                            })
                            .then(table => {
                              // table has been created. Now apply the necessary modifications
                              patchTable(table);
                            })
                            .catch(err => {
                              this.checkForExpectedErrors(err) ? request() : reject(err);
                            });
                        };
                        request();
                      })
                      .catch(err => {
                        this.checkForExpectedErrors(err) ? request() : reject(err);
                      });
                  }
                })
                .catch(err => {
                  this.checkForExpectedErrors(err) ? request() : reject(err);
                });
            };
            request();
          })
          .catch(err => {
            this.checkForExpectedErrors(err)
              ? request()
              : console.log("\nERROR: Document doesn't exist.\n") || reject(err);
          });
      };
      request();
    });
  }

  async store(data: any, keys: string[]): Promise<{}> {
    console.log("\nStoring data...");
    return new Promise(async (resolve, reject) => {
      // get named item ID from keys values using md5
      const rowKeyColumns = keys;
      const inputKeys = Object.keys(data).filter(dataKey => rowKeyColumns.includes(dataKey));
      const rowKeyValues = inputKeys.map(dataKey => data[dataKey]);
      if (this.areArraysEqual(keys, inputKeys)) {
      } else {
        resolve(
          '\nBad request. Some key values missing. Storing process aborted. Have you forgotten to define or provide the "keys" array? Check these values: [' +
            keys +
            "]"
        );
        throw new Error("\nBad request. Some key values missing. Storing process aborted.");
      }
      const rowKey = rowKeyValues.join("#");
      const namedItemId = "row" + md5("row-" + rowKey).substr(0, 8);

      console.log("\nstore row", data);
      let dataHeader = Object.keys(data);
      let sheetHeader: any = await this.getSheetHeader();
      console.log("sheet vs data header", sheetHeader, dataHeader);

      const sheetUrl = this.getSheetUrl();

      // update headers
      // fix spreadsheet header first
      const missingHeaders = dataHeader.filter(col => !sheetHeader.includes(col) && col != "");
      if (missingHeaders[0]) {
        sheetHeader = [...sheetHeader, ...missingHeaders];
        console.log("adding missing headers: " + missingHeaders);
      }

      // fix dataHeader
      if (sheetHeader.length === dataHeader.length) {
      } else if (sheetHeader.length > dataHeader.length) {
        // if incoming dataHeader is too short - extend it
        dataHeader = sheetHeader.filter((col: any) => dataHeader.includes(col));
      }

      this.updateHeaders(sheetUrl, sheetHeader);

      // rearrange item values
      const values = sheetHeader.map((key: any) => data[key] || undefined);

      console.log("rowKey", rowKey, namedItemId, values);

      // try to update named item - if fails then insert
      const updateItem = (reAddIfFailed: boolean = true) => {
        const request = () => {
          this.client
            .api(sheetUrl + "/names/" + namedItemId + "/range")
            .patch({ values: [values] })
            .then((range: GraphTypes.WorkbookRange) => {
              console.log("named item range update successful at", range.address);
              resolve({ rowIndex: range.rowIndex });
            })
            .catch(err => {
              // UnknownError is very harmful. If detected - restart the request.
              if (this.checkForExpectedErrors(err, false)) request();
              else {
                // if true, then after failing updating an item, it will try to delete and readd the item back
                // if false, then after failing updating an item, it will just throw an error
                if (reAddIfFailed) {
                  console.error("cannot update range ->", err.code);

                  if (err.code === "InvalidArgument") {
                    // if err.code ===  'InvalidArgument', it probably means that an item with namedItemId exists,
                    // but cannot be updated, because request and current item do not match (ex. header too large)
                    console.log(err.code + " exception found. Trying to delete previous item...");
                    const request = () => {
                      this.reAddItem(namedItemId, values)
                        .then((res: any) => {
                          // if promise successful, reAddItem should resolve a boolean value equal to false
                          // pass it to updateItem in order to update row values without triggering item re-adding loop.
                          updateItem(res);
                          // TODO in case of UnknownError happening somewhere, this could be set to True to
                          // retry continuously until everything works
                        })
                        .catch(err => {
                          this.checkForExpectedErrors(err) ? request() : reject(err);
                        });
                    };
                    request();
                  } else {
                    // attempt to add new row if err.code === "ItemAlreadyExists" or "ItemNotFound" or any other one
                    const request = () => {
                      this.addNewRow(namedItemId, values)
                        .then(res => {
                          resolve(res);
                        })
                        .catch(err => {
                          this.checkForExpectedErrors(err) ? request() : reject(err);
                        });
                    };
                    request();
                  }
                } else {
                  console.log("Failed to update the values after re-adding them:", err) ||
                    reject(err);
                }
              }
            });
        };
        request();
      };
      updateItem(true);
    });
  }

  private async updateHeaders(sheetUrl: string, header: string[]) {
    const inputRange =
      "'" + xl.getExcelCellRef(1, 1) + ":" + xl.getExcelCellRef(1, header.length) + "'";
    return this.client
      .api(sheetUrl + "/range(address=" + inputRange + ")")
      .patch({ values: [header] })
      .then(res => {
        console.log("Header updated: [" + header + "] (" + inputRange + ")");
      })
      .catch(err => {
        this.checkForExpectedErrors(err)
          ? this.updateHeaders(sheetUrl, header)
          : console.error("Failed updating headers", err);
      });
  }

  private async getSheetHeader() {
    // trying first process.env.ResultStorageMaximumColumns number of columns to get headers.
    const inputRange =
      "'" + xl.getExcelCellRef(1, 1) + ":" + xl.getExcelCellRef(1, this.config.MaxColumns) + "'";
    return new Promise((resolve, reject) => {
      const request = () => {
        this.client
          .api(this.getSheetUrl() + "/range(address=" + inputRange + ")")
          .get()
          .then((range: GraphTypes.WorkbookRange) => {
            range.values[0] = range.values[0].filter((h: any) => h != "");
            resolve(range.values[0]);
          })
          .catch(err => {
            this.checkForExpectedErrors(err) ? request() : reject(err);
          });
      };
      request();
    });
  }

  private async reAddItem(namedItemId: string, values: any[]) {
    const sheetUrl = this.getSheetUrl();
    let namedItemRowIndex = Office.DEFAULT_ROW_INDEX;
    // get row number from existing named item
    return new Promise((resolve, reject) => {
      // TODO in case UnknownError comes up, use resolve(true). it will re-add an item continuously until the error is no longer present
      // define tryReAdding reference to execute later
      const tryReAdding = (RowIndex: number) => {
        const request = () => {
          this.client
            .api(sheetUrl + "/names/" + namedItemId)
            .delete()
            .then((row: GraphTypes.WorkbookTableRow) => {
              console.log(namedItemId + " named item deleted, trying to add new range...");
              // adding new range of an item, which is longer than the old one
              const request = () => {
                this.client
                  .api(sheetUrl + "/names/add")
                  .post({
                    name: namedItemId,
                    // building reference. format: '=List1!$A$5:$F$5'
                    reference: `=${this.config.SheetName}!$A$${RowIndex}:$${xl.getExcelAlpha(
                      values.length
                    )}$${RowIndex}`
                  })
                  .then((namedItem: GraphTypes.WorkbookNamedItem) => {
                    console.log(
                      "named item range added at row index " +
                        RowIndex +
                        ". now trying to update its values..."
                    );
                    // send 'false' to pass it into updateItem(bool) function later in the 'store' function.
                    resolve(false);
                  })
                  .catch(err => {
                    this.checkForExpectedErrors(err) ? request() : reject(err);
                  });
              };
              request();
            })
            .catch(err => {
              this.checkForExpectedErrors(err) ? request() : reject(err);
            });
        };
        request();
      };
      // try getting namedItemRowIndex
      const request = () => {
        this.client
          .api(sheetUrl + "/names/" + namedItemId)
          .get()
          .then(namedItem => {
            // parsing last symbol from named item value (it looks like this: List1!$A$7:$H$7)
            const regmatch = namedItem.value.match(/\$.$/);
            namedItemRowIndex = parseInt(regmatch[0].substring(1));
            // setting default value if parsing was unsuccessful
            if (isNaN(namedItemRowIndex)) namedItemRowIndex = Office.DEFAULT_ROW_INDEX;
            // deleting old named item
            tryReAdding(namedItemRowIndex);
          })
          .catch(err => {
            if (this.checkForExpectedErrors(err, false)) request();
            else {
              // if retreiving row index was unsuccessful, just set it to a default value and continue.
              namedItemRowIndex = Office.DEFAULT_ROW_INDEX;
              console.log(
                "couldn't retrieve row index, because of exception: ",
                err.code,
                ". Setting default row index value to ",
                namedItemRowIndex
              );
              tryReAdding(namedItemRowIndex);
            }
          });
      };
      request();
    });
  }

  private async addNewRow(namedItemId: string, values: any[]) {
    const sheetUrl = this.getSheetUrl();
    return new Promise((resolve, reject) => {
      const request = () => {
        this.client
          .api(sheetUrl + "/tables/" + this.getTableName() + "/rows")
          .post({ values: [values] })
          .then((row: GraphTypes.WorkbookTableRow) => {
            // make a function reference to execute later
            const createRowNamedItem = (retryWhenFail: boolean) => {
              console.log("try to add named item for new row with id %s", namedItemId);
              const request = () => {
                this.client
                  .api(sheetUrl + "/names/add")
                  .post({
                    name: namedItemId,
                    // building reference. format: '=List1!$A$5:$F$5'
                    reference: `=${this.config.SheetName}!$A$${row.index + 2}:$${xl.getExcelAlpha(
                      values.length
                    )}$${row.index + 2}`
                  })
                  .then((namedItem: GraphTypes.WorkbookNamedItem) => {
                    console.log("named item added");
                    resolve({ rowIndex: row.index });
                  })
                  .catch(err => {
                    if (this.checkForExpectedErrors(err, false)) request();
                    else {
                      // named item probably already exists (row was manually deleted and named item remained with #REF! value)
                      if (retryWhenFail) {
                        console.log("named item failed to add, try to delete it first", err.code);
                        const request = () => {
                          this.client
                            .api(sheetUrl + "/names/" + namedItemId)
                            .delete()
                            .then((namedItem: GraphTypes.WorkbookNamedItem) => {
                              console.log("named item deleted, retrying to add it");
                              createRowNamedItem(false);
                            })
                            .catch(err => {
                              this.checkForExpectedErrors(err) ? request() : reject(err);
                            });
                        };
                        request();
                      } else {
                        reject(err);
                      }
                    }
                  });
              };
              request();
            };
            createRowNamedItem(true);
          })
          .catch(err => {
            this.checkForExpectedErrors(err) ? request() : reject(err);
          });
      };
      request();
    });
  }
}
