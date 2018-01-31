"use strict";

import * as async from "async";
import * as request from "request";
import { Response, Request, NextFunction } from "express";

/**
 * GET /api
 * List of API examples.
 */
export let getApi = (req: Request, res: Response) => {
  res.end("dasds");
};

/**
 * GET /api/facebook
 * Facebook API example.
 */
export let getFacebook = (req: Request, res: Response, next: NextFunction) => {
  // TODO
};
