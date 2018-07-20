# BotBuilder result storage
This library could be used for saving key-value based results (for example answers to the most important questions) of Bot Framework based chabot conversation into some 3rd party service such as Office 365 Excel sheet.

This repo is based on [TypeScript-Node-Starter](https://github.com/Microsoft/TypeScript-Node-Starter).

# How it works
The main goal of this library is to abstract various data storage services so chatbot won't need to know which of them is currently used. This abstraction consists of two parts:
  * `INIT` method should be called during startup of chatbot and it accepts list of all keys which are expected to be stored by bot. This method could be triggered only using REST call from bot to `botbuilder-result-storage` instance
  * `STORE` method is called whenever new value or values are needed to be stored by bot and it accepts array of key-value pairs. This method could be triggered both using REST call from bot or using Azure Storage Queue.

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
- Build and run the project
```
npm run build
npm start
```

# Roadmap
- [x] ~~use typescipt app starter~~
- [x] ~~support for mutiple config providers~~
- [x] ~~basic Office 365 support using hardcoded list of keys~~
- [ ] Office 365 login helper
- [ ] support for adding of new columns in runtime
- [ ] support for running as Azure Function
- [ ] Azure Table Queue support for `store` method
