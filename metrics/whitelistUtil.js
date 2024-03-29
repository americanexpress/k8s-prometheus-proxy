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

const ipRangeCheck = require('ip-range-check');
const winston = require('winston');
const { logConfig } = require('../config/app-settings').winston;
const logger = winston.createLogger(logConfig);
const metricsPathWhiteList = createRegexArray(process.env.METRICS_PATH_WHITELIST);
const cidrWhitelist = createWhiteListArray(process.env.CIDR_WHITELIST);
const validNamespaceRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

function isWhitelistedPath(targetPath) {
  let whiteListMatchFound = false;
  for(let i=0; i<metricsPathWhiteList.length; i++) {
    if(targetPath.match(metricsPathWhiteList[i])) {
      logger.debug(`matched with regex ${metricsPathWhiteList[i]}`);
      whiteListMatchFound = true;
      break;
    }
  }
  if(!whiteListMatchFound) {
    logger.error(`target path is not part of whitelisted path ${metricsPathWhiteList}`);
  }
  return whiteListMatchFound;
}

function isWhiteListedIP(podIP) {
  const isWhiteListed = ipRangeCheck(podIP,cidrWhitelist);
  if(!isWhiteListed) {
    logger.error(`ip ${podIP} is not part of whitelisted CIDR ${cidrWhitelist}`);
  }
  return isWhiteListed;
}

function isValidNamespaceName(projectName) {
  return projectName.length <= 63 && validNamespaceRegex.test(projectName);
}

function createWhiteListArray(csvStr) {
  if(csvStr)
    return csvStr.split(',');
  return [];
}

function createRegexArray(csvStr) {
  const re = [];
  createWhiteListArray(csvStr).forEach((s) => { re.push(new RegExp(s)); });
  return re;
}

module.exports = {
  isWhitelistedPath,
  isWhiteListedIP,
  isValidNamespaceName,
};
