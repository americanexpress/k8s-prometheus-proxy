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

function deriveRespHost(podMetricsRequest) {
  let respHost = podMetricsRequest.socket.remoteAddress;
  if (typeof podMetricsRequest.socket.remoteAddress === 'undefined') {
    logger.debug('could not get remote address from socket. using http host header');
    respHost = podMetricsRequest.getHeader('host');
  } else {
    respHost = podMetricsRequest.socket.remoteAddress;
  }
  const portIndex = respHost.indexOf(':');
  if (portIndex > 0) {
    respHost = respHost.slice(0, portIndex);
  }
  return respHost;
}

function deriveUpstreamURI(pathname, ctxt) {
  logger.debug(`pathname to derive upstream URI : ${pathname}`);
  let upstreamURI = '/';
  const txtArr = pathname.split('/');
  let i = 4;
  if (ctxt === '/kubesd') {
    i = 2;
  }
  if (!pathname.startsWith(ctxt)) {
    i += 1;
  }
  for (; i < txtArr.length; i += 1) {
    let txtToAppend = txtArr[i];
    if (i === txtArr.length - 1) {
      if (txtToAppend.lastIndexOf('?') > 0) {
        txtToAppend = txtArr[i].slice(0, txtArr[i].indexOf('?'));
      }
      upstreamURI += txtToAppend;
    } else {
      upstreamURI = `${upstreamURI + txtToAppend}/`;
    }
  }
  return upstreamURI;
}

module.exports = {
  deriveRespHost,
  deriveUpstreamURI,
};
