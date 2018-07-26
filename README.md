# BotBuilder result storage

This library could be used for saving key-value based results (for example answers to the most important questions) of Bot Framework based chatbot conversation into some 3rd party service such as *Office 365 Excel* sheet.

This repo is based on [TypeScript-Node-Starter](https://github.com/Microsoft/TypeScript-Node-Starter).

# How it works

The main goal of this library is to abstract various data storage services so chatbot won't need to know which of them is currently used. This abstraction consists of two parts:

- `INIT` method should be called during startup of chatbot and it accepts list of all keys which are expected to be stored by bot. This method could be triggered only using REST call from bot to `botbuilder-result-storage` instance or using [REST API tools](#usage) for testing.
- `STORE` method is called whenever new value or values are needed to be stored by bot and it accepts array of key-value pairs. This method could be triggered both using REST call from bot or using Azure Storage Queue or using [REST API tools](#usage) for testing.

# Getting started

- Clone the repository

```
git clone https://github.com/wearefeedyou/botbuilder-result-storage
```

- Install dependencies

```
cd <project_name>
npm install
```

- For Windows you need updated Python version. It comes with [Visual Studio Build Tools](https://www.npmjs.com/package/windows-build-tools) if you don't have it yet:

```
npm install --global --production windows-build-tools
```

- Build and run the project

```
npm run build
npm start
```

- Debug the project

```
npm run watch
```

# Linking with a spreadsheet

Open `.env` file and insert your spreadsheet authorization values as environment variables:

```
ResultStorageExcelSpreadsheetId=YOUR_SPREADSHEET_ID
ResultStorageExcelSheetName=SPREADSHEET_LIST_NAME
ResultStorageClientId=OFFICE_365_CLIENT_ID
ResultStorageClientSecret=OFFICE_365_CLIENT_SECRET_KEY
ResultStorageRefreshToken=OFFICE_365_REFRESH_TOKEN
```

*Access Token* is automatically updated using the *Refresh Token* during the launch and after it expires.

# Usage

>*botbuilder-results-storage* is used through REST calls. For testing purposes REST API programs, such as [Insomnia](https://insomnia.rest/) or a web-based option [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer), are sufficient.

### Compose following requests while *botbuilder-result-storage* is running

- Create a `POST` request with URL `http://localhost:3000/api/init` and body:

```JSON
{
	"header": [
		"name",
		"id"
	]
}
```

This will trigger the **init** method, which will initialize a table with defined header names. 

The size of the *"header"* array defines table column count. The method checks if the table already exists and if it does, it will automatically update the table, increasing the header array size and correcting any mistakes if they exist.

If request is successful, it will return nothing as response body with `200` status code.

- Create a `POST` request with URL `http://localhost:3000/api/store` and body:

```JSON
{
	"data": {
		"name": "Jan",
		"id": "1",
		"nationality": "Czech"
	},
	"keys": ["name", "id"]
}
```

This will trigger the **store** method, which will try to store a new item with defined cell values. If `key` values match with an existing item key values in the table, it will update that item's values.

The size of the *"data"* array defines table column count to be put into the table. Their values will fill corresponding cells. The method checks if any new headers are present (in this example - `nationality`) and if it does, it updates the header and the *named item*  size and adds the values to corresponding cells. If request body does not contain headers, which are present in the table, it will leave them untouched, with the exception of `keys` values - those are mandatory to provide.

*"keys"* array define which objects (in this example - `name` and `id`) compose a **Named Item ID**. These values are necessary to add due to correlation with defining item's row index.

If request is successful, it will return `[{"rowIndex"}]` object as response body with `200` status code.

## Modifications

By default, *botbuilder-result-storage* by default supports the maximum of `64` columns to be used due to performance optimization. If desired, it can easily be extended by adding a new environment variable to the `.env` file:

```
ResultStorageMaximumColumns=128
```

# Performance

The services run asynchronously, based on a *promise chain*, and is intended to support *Azure Table Queue* services in the future to assure safe data storage. 3rd party adapters include: `Office 365 Excel`, `GoogleSpreadsheet`(unfinished) and other adapters could be added easily.

### Issues

The biggest part of the performance suffers from 3rd party service. Occasional `UnknownError` exceptions and slowed performance around noon, damage process performance dramatically. This package is designed to withstand some random internal server failures while going through it's chain of promises.

Another server-side complication is brought by `ItemNotFound` exception during the `init` method, precisely while performing a **get** request during the first initialization of the table: The error is thrown temporarily, in a period of approximately 20 seconds. It is solved with a dirty solution - looping through the same promise continuously until the error eventually is no longer caught, then the process finishes executing successfully.

>Because of that some unintended behaviour is solved with resending same requests repeatedly

# Roadmap

- [x] ~~use typescipt app starter~~
- [x] ~~support for mutiple config providers~~
- [x] ~~basic Office 365 support using hardcoded list of keys~~
- [ ] Office 365 login helper
- [x] ~~support for adding of new columns in runtime~~
- [ ] support for running as Azure Function
- [ ] Azure Table Queue support for `store` method