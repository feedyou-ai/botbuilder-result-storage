'use strict'

import * as async from 'async'
import * as request from 'request'
import { Response, Request, NextFunction } from 'express'

// TODO inject somehow from app
import EnvConfigService from '../services/config/env'
const configService = new EnvConfigService()

/**
 * GET /api/storages
 * Get list of all storages
 */
export let get = (req: Request, res: Response) => {
  configService.get().then(config => res.end(JSON.stringify(config.adapters)))
}

/**
 * POST /api/store
 * Updates/inserts (based on keys) row into all registred storages.
 */
export let store = (req: Request, res: Response) => {
  if (!req.body || !req.body.data) {
    throw new Error('Cannot find "data" object in request body.')
  }

  const { data, keys } = req.body
  const documentId = process.env.StorageDocumentId
  configService
    .get()
    .then(config => {
      Promise.all(config.adapters.map(adapter => adapter.store(data, keys, documentId)))
        .then(results => res.end(JSON.stringify(results)))
        .catch(err => returnErrorAsJson(err, res))
    })
    .catch(err => returnErrorAsJson(err, res))
}

/**
 * POST /api/init
 * Updates/inserts (based on keys) row into all registred storages.
 */
export let init = (req: Request, res: Response) => {
  if (!req.body || !req.body.header) {
    throw new Error('Cannot find "header" array in request body.')
  }

  configService
    .get()
    .then(config => {
      Promise.all(config.adapters.map(adapter => adapter.init(req.body.header)))
        .then(() => res.end())
        .catch(err => returnErrorAsJson(err, res))
    })
    .catch(err => returnErrorAsJson(err, res))
}

function returnErrorAsJson(err: Error, res: Response) {
  console.log(err)
  res.statusCode = 500
  res.end(JSON.stringify(err))
}
