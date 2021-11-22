/*
 * Copyright 2020 American Express Travel Related Services Company, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

const winston = require('winston');
const { logConfig } = require('../config/app-settings').winston;

const logger = winston.createLogger(logConfig);

/* eslint-disable-next-line max-params -- express error handling function signature */
module.exports = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  logger.debug(`error in processing request ${req}`);
  logger.error(err.stack);
  return res.status(500).send('Error in processing request');
};
