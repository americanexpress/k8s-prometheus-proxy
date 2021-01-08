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

const url = require('url');
const querystring = require('querystring');
const httpProxy = require('http-proxy');

const apiProxy = httpProxy.createProxyServer({secure: false, ignorePath: true});


function handleMetricsRoute(req, res, appUrlPrefix) {
  const pod = req.query.pod;
  const targetPort = req.query.target_port;
  let scheme = 'http';
  if (req.query.target_scheme != null) {
    scheme = req.query.target_scheme;
  }
  const parsedUrl = url.parse(req.url);
  let queryObj = querystring.parse(parsedUrl.query);
  delete queryObj.pod;
  delete queryObj.target_scheme;
  delete queryObj.target_port;
  let targetPath;
  if(appUrlPrefix === null || appUrlPrefix === undefined || appUrlPrefix.trim() === '') {
    targetPath = parsedUrl.pathname.slice(7);
  } else {
    let p = parsedUrl.pathname;
    targetPath = p.substring(p.indexOf(appUrlPrefix.trim()) + appUrlPrefix.trim().length).slice(7);
  }

  logger.debug(`using target path ${targetPath}`);

  const targetUrl = url.format({
    protocol: scheme,
    port: targetPort,
    hostname: pod,
    pathname: targetPath,
    query: queryObj
  });

  apiProxy.web(req, res, {target: targetUrl}, (err) => {
    logger.error(err);
    logger.debug(`error in processing request ${req.get('Host')}${req.url}`);
    res.writeHead(500, {
      'Content-Type': 'text/plain'
    });
    res.end('#Unable to collect metrics');
  });
}

module.exports = {
  handleMetricsRoute,
};
