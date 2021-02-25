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
const https = require('https');
const winston = require('winston');
const { logConfig } = require('../config/app-settings').winston;
const logger = winston.createLogger(logConfig);

const whitelistUtil = require('../metrics/whitelistUtil');

function getPodIPMap(upstreamNamespace, upstreamService, k8sCACert, k8sToken) {
  const options = {
    hostname: process.env.KUBERNETES_SERVICE_HOST,
    port: process.env.KUBERNETES_SERVICE_PORT,
    path: `/api/v1/namespaces/${upstreamNamespace}/pods`,
    method: 'GET',
    ca: k8sCACert,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${k8sToken.toString().trim()}`,
    },
  };

  return new Promise(((resolve, reject) => {
    const podIPReq = https.request(options, (response) => {
      const podIPMap = new Map();
      let podIPBody = '';
      response.on('data', (data) => {
        podIPBody += data;
      });

      response.on('end', () => {
        if (response.statusCode === 200) {
          const podIPRespJson = JSON.parse(podIPBody);
          // logger.debug(`response from k8s master ${podIPBody}`);
          const list = podIPRespJson.items;
          if (list !== null && list !== undefined && list.length > 0) {
            list.forEach((entry) => {
              const podName = entry.metadata.name;
              const podState = entry.status.phase;
              const podIPMapKey = entry.status.podIP;
              const podIPAddr = entry.status.podIP;
              const podUid = entry.metadata.uid;
              if(whitelistUtil.isWhiteListedIP(podIPAddr)) {
                if (podName.startsWith(upstreamService) && podState === 'Running') {
                  podIPMap.set(podIPMapKey, { podName, podIP: podIPAddr, uid: podUid });
                }
              }
            });
            resolve(podIPMap);
          } else {
            logger.debug(`No pods are running for ${upstreamNamespace}`);
            reject(new Error(`No pods are running for ${upstreamNamespace}`));
          }
        } else {
          logger.debug(`response from kubernetes master: ${response.statusCode}`);
          reject(new Error(`failed to get repseponse from kubernetes master ${response.statusCode}`));
        }
      });
      response.on('error', () => {
        console.error('failed to get pods IPs');
        reject(new Error(`error occured while getting pod IPs for ${upstreamNamespace}`));
      });
    }).on('error', (err) => {
      logger.debug(`Error in request to k8s master for retrieving pod IPs ${err}`);
      reject(new Error('Error in request to k8s master for retrieving pod IPs'));
    }).on('timeout', () => {
      logger.debug('timeout occured to k8s master for retrieving pod IPs');
      podIPReq.destroy();
      reject(new Error(`timeout occured while getting pod IPs for ${upstreamNamespace}`));
    });
    podIPReq.setTimeout(5000);
    podIPReq.end();
  }));
}


module.exports = {
  podData: getPodIPMap,
};
