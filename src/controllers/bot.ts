"use strict";

import * as async from "async";
import * as request from "request";
import { Response, Request, NextFunction } from "express";

import FilesystemBotService from "../services/bot/filesystem";
import Bot from "../models/bot";
const botService = new FilesystemBotService();

/**
 * GET /api/bots
 * Get list of all bots
 */
export let getBots = (req: Request, res: Response) => {
  res.end(JSON.stringify(botService.getBots()));
};

/**
 * GET /api/bots/:bot_id
 * Get list of all bots
 */
export let getBot = (req: Request, res: Response) => {
  if (!req.params.bot_id) {
    throw new Error("Parameter bot_id not found in URL.");
  }
  res.end(JSON.stringify(botService.getBotById(req.params.bot_id)));
};

/**
 * POST /api/bots/:bot_id/row
 * Updates/inserts (based on keys) row into all storages of given bot.
 */
export let storeRow = (req: Request, res: Response) => {
  if (!req.body || !req.body.data) {
    throw new Error('Cannot find "data" object in request body.');
  }

  if (!req.params.bot_id) {
    throw new Error("Parameter bot_id not found in URL.");
  }

  const bot = botService.getBotById(req.params.bot_id);
  if (bot) {
    const { data, keys, userData } = req.body;
    bot
      .storeRow(data, keys, userData)
      .then(results => res.end(JSON.stringify(results)))
      .catch(err => {
        console.log(err);
        res.statusCode = 500;
        res.end();
      });
  } else {
    throw new Error("Bot wasn't found.");
  }
};

/**
 * POST /api/bots/:bot_id/init
 * Updates/inserts (based on keys) row into all storages of given bot.
 */
export let initDocuments = (req: Request, res: Response) => {
  if (!req.params.bot_id) {
    throw new Error("Parameter bot_id not found in URL.");
  }

  if (!req.body || !req.body.header) {
    throw new Error('Cannot find "header" array in request body.');
  }

  const bot = botService.getBotById(req.params.bot_id);
  if (bot) {
    bot
      .initDocument(req.body.header)
      .then(results => res.end(JSON.stringify(results)))
      .catch(err => {
        console.log(err);
        res.statusCode = 500;
        res.end(JSON.stringify(err));
      });
  } else {
    throw new Error("Bot wasn't found.");
  }
};

/**
 * POST /api/bots/:bot_id/storages
 */
export let addStorage = (req: Request, res: Response) => {
  if (!req.body) {
    throw new Error("Cannot find storage object in request body.");
  }

  if (!req.params.bot_id) {
    throw new Error("Parameter bot_id not found in URL.");
  }

  botService.addStorage(req.params.bot_id, req.body);
  res.end();
};

/**
 * PUT /api/bots
 * Inserts new bot
 */
export let addBot = (req: Request, res: Response) => {
  if (!req.body) {
    throw new Error("Cannot find bot data in request body.");
  }

  const bot = botService.addBot(req.body as Bot);
  res.end(JSON.stringify(bot));
};
