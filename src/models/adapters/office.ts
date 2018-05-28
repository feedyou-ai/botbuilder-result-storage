import Adapter from "../adapter";
import * as GraphTypes from "@microsoft/microsoft-graph-types";
import * as Graph from "@microsoft/microsoft-graph-client";
import * as request from "superagent";
import * as md5 from "md5";
import { Error } from "mongoose";

export default class Office extends Adapter {
  client: Graph.Client;
  accessToken: string;
  sheetUrl: string;
  keys: string[];

  constructor(documentId: string, config: {} = {}) {
    super(documentId, config);
    this.adapterId = "office";
    this.sheetUrl = "/me/drive/items/" + this.documentId + "/workbook/worksheets/List1";

    this.client = Graph.Client.init({
      authProvider: done => {
        // TODO persist accessToken between requests and introduce auto refresh logic when any Graph request faiks
        if (this.accessToken) {
          done(undefined, this.accessToken);
        } else {
          console.log("requesting access_token from refresh_token");
          request
            .post("https://login.microsoftonline.com/common/oauth2/v2.0/token")
            .type("form")
            .send({
              client_id: "ea8b84fb-1cd1-477c-b103-a09ecbd7b166",
              client_secret: "rvoiAQVK9<ecdIRX7074+<:",
              grant_type: "refresh_token",
              refresh_token:
                "MCduHOhTUrRdKlxo4d9D5XczprHuyl112sK5S3hvGK7ceyEzc0tKa7JzzQUOEinRSOMPhawN6ADKpLjbRB!z61WI8CnOq6NG2YRmtaxpmK2MBA6k5RuYfIP1XHxsPtfBi3e4doGnnXmUkS3tPQCcytipyrfZ2QTzAx0xivjUAmSZsM6vye*G1yi2cReq4ICzLYgyzTbUVpF0fOL12XCUqmjdJ4QtWKUSmUyJ0Ep1TcQCFdBJe2DsTPISLyVSWfi0owKa4rLysq8W0wxOGjjdVn471mLlYPXjBAPVWD0zegmTv9hQciuJEM2419kddsyiwKQfns6M9Mc*RWZ*BpOwZE4oNz30UisJgmyRc30BxGVWt4hry6EvqziJlGueLB!XNlg$$",
              scope: "Files.ReadWrite.All offline_access"
            })
            .then(res => {
              if (res.body && res.body.access_token) {
                console.log(res.body.access_token);
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

  login(config: {}): boolean {
    // TODO implement something like https://github.com/microsoftgraph/nodejs-connect-sample
    return false;
  }

  init(header: string[], keys: string[]): Promise<{}> {
    return new Promise((resolve, reject) => {
      console.log("initDocument", this.documentId, header, keys);

      // persist keys
      this.keys = keys;

      // check existence of document and sheet
      const sheetUrl = "/me/drive/items/" + this.documentId + "/workbook/worksheets/List1";
      this.client
        .api(sheetUrl)
        .get()
        .then((worksheet: GraphTypes.WorkbookWorksheet) => {
          // check existence of document table
          this.client
            .api(sheetUrl + "/tables")
            .get()
            .then((tables: { value: GraphTypes.WorkbookTable[] }) => {
              if (tables.value.length > 0) {
                // table exists
                // TODO continue
                resolve({});
                console.log("table exists", tables.value);
              } else {
                console.log("table does not exists, creating header first:", header);
                // table does not exist - insert header range
                this.client
                  .api(sheetUrl + "/range(address='A1:D1')")
                  .patch({ values: [header] })
                  .then(res => {
                    console.log("header created, now create table");
                    this.client
                      .api(sheetUrl + "/tables/add")
                      .post({
                        address: "A1:D1",
                        hasHeaders: true
                      })
                      .then(table => {
                        // update table name
                        console.log("updating table name from %s to %s", table.name, "FeedbotData");
                        this.client
                          .api(sheetUrl + "/tables/" + table.id)
                          .patch({
                            name: "FeedbotData"
                          })
                          .then(() => {
                            console.log(
                              "adding first row to solve unintended expansion of first named item"
                            );
                            this.client
                              .api(sheetUrl + "/tables/FeedbotData/rows")
                              .post({})
                              .then((row: GraphTypes.WorkbookTableRow) => resolve());
                          })
                          .catch(err => console.error("rename table", err) || reject(err));
                      })
                      .catch(err => console.error(err) || reject(err));
                  })
                  .catch(err => reject(err));
              }
            });
        })
        .catch(err => reject(err));
    });
  }

  async store(data: {}): Promise<{}> {
    return new Promise(async (resolve, reject) => {
      console.log("store row", data);
      const sheetHeader = await this.getSheetHeader();
      const dataHeader = Object.keys(data);
      console.log("sheet vs data header", sheetHeader, dataHeader);
      // TODO add columns if some missing

      const values = sheetHeader.map(key => data[key] || null);

      // get named item name from keys values
      const rowKeyColumns = ["name", "id"];
      const rowKeyValues = Object.keys(data)
        .filter(dataKey => rowKeyColumns.includes(dataKey))
        .map(dataKey => data[dataKey]);
      const rowKey = rowKeyValues.join("#");
      const namedItemId = "row" + md5("row-" + rowKey).substr(0, 8);

      console.log("rowKey", rowKey, namedItemId, values);

      const sheetUrl = "/me/drive/items/" + this.documentId + "/workbook/worksheets/List1";

      // try to update named item - if fails then insert
      this.client
        .api(sheetUrl + "/names/" + namedItemId + "/range")
        .patch({ values: [values] })
        .then((range: GraphTypes.WorkbookRange) => {
          console.log("named item range update successful");
          resolve({ rowIndex: range.rowIndex });
        })
        .catch(err => {
          console.error("cannot update range -> inserting new row", err.code);

          this.client
            .api(sheetUrl + "/tables/FeedbotData/rows")
            .post({ values: [values] })
            .then((row: GraphTypes.WorkbookTableRow) => {
              const createRowNamedItem = (retryWhenFail: boolean) => {
                console.log("try to add named item for new row with id %s", namedItemId);
                this.client
                  .api(sheetUrl + "/names/add")
                  .post({
                    name: namedItemId,
                    reference: "=List1!$A$" + (row.index + 2) + ":$D$" + (row.index + 2)
                  })
                  .then((namedItem: GraphTypes.WorkbookNamedItem) => {
                    console.log("named item added");
                    resolve({ rowIndex: row.index });
                  })
                  .catch(err => {
                    // named item probably already exists (row was manually deleted and named item remained with #REF! value)
                    if (retryWhenFail) {
                      console.log("named item failed to add, try to delete it first", err.code);
                      this.client
                        .api(this.sheetUrl + "/names/" + namedItemId)
                        .delete()
                        .then((namedItem: GraphTypes.WorkbookNamedItem) => {
                          console.log("named item deleted, retrying to add it");
                          createRowNamedItem(false);
                        })
                        .catch(
                          err =>
                            console.error("failed to delete already existing named item") ||
                            reject(err)
                        );
                    } else {
                      reject(err);
                    }
                  });
              };
              createRowNamedItem(true);
            })
            .catch(err => console.error("add row", err) || reject(err));
        });
    });
  }

  private async getSheetHeader() {
    return new Promise((resolve, reject) => {
      this.client
        .api(this.sheetUrl + "/range(address='A1:D1')")
        .get()
        .then((range: GraphTypes.WorkbookRange) => {
          resolve(range.values[0]);
        })
        .catch(reject);
    });
  }
}
