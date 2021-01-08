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

const k8sPods = require('../k8s/pods');
const https = require('https');
const http = require('http');
const os = require('os');
const url = require('url');
const podLabels = require('../labels/podlabels.js');
const podmetricsUtils = require('./podmetricsUtil.js');

function finishWithError(res) {
  res.writeHead(500, {'Content-Type': 'text/plain'});
  res.write('#Unable to collect data.');
  res.end();
}

function finishWithSuccess(res) {
  res.end();
}


function finishProcessing(noOfPods, completedRequests, successCount, errorCount, res) {
  logger.debug(`noOfPods ${noOfPods}, completedRequests ${completedRequests}, successCount ${successCount}, errorCount ${errorCount}`)
  if(completedRequests == noOfPods) {
    if(successCount > 0 && successCount <= completedRequests) {
      finishWithSuccess(res);
    } else {
      finishWithError(res);
    }
  } else {
    finishWithError(res);
  }
}

function retrieveMetrics(podIPMap, req, res) {
  const metricsResponses = [];
  let completedRequests = 0;
  let errorCount = 0;
  let successCount = 0;

  logger.debug('pod ip map : ', podIPMap);
  logger.debug('request params :', req.params);


  if (podIPMap.size > 0) {
    logger.debug("url " + req.url)
    const parsedUrl = url.parse(req.url);
    logger.debug(parsedUrl);
    const upstreamURI = podmetricsUtils.deriveUpstreamURI(parsedUrl.pathname)
    logger.debug(`upstreamURI : ${upstreamURI}`)
    const podReqHeaders = {};
    for(headerKey in req.headers) {
      if(headerKey.toUpperCase() === 'AUTHORIZATION') {
        podReqHeaders[headerKey] = req.headers[headerKey];
      }
    }
    delete podReqHeaders.host;
    podIPMap.forEach((value, key, map) => {
      const options = {
        hostname: value.podIP,
        port: req.query.upstreamPort,
        path: upstreamURI,
        method: 'GET',
        timeout: 15000,
        headers : podReqHeaders,
      };
      logger.debug('http options used for request ', options);
      logger.debug(options);
      if (req.query.ssl === 'true') {
        options.insecure = true;
      }

      const queryObj = (req.query.ssl === 'true') ? https : http;

      const podMetricsRequest = queryObj.request(options, (response) => {
        let metricsBody = '';

        response.on('data', (data) => {
            metricsBody += data;
        });

        response.on('end', () => {
          logger.debug(`key :${key} value :${value} map :${map}`);
          let respHost = podmetricsUtils.deriveRespHost(podMetricsRequest);
          logger.debug(`hostname on the response received from pod :${respHost}`);
          const pod = podIPMap.get(respHost);
          if(response.statusCode === 200 && pod != null) {
            const labelStr = `podname="${pod.podName}",podip="${pod.podIP}"`;
            const metricsArray = metricsBody.toString().split(os.EOL);
            let responseString = podLabels.metricsWithPodLabels(metricsArray,labelStr);
            res.write(responseString);
            successCount += 1;
          } else {
            errorCount += 1;
          }
          completedRequests += 1;
          if (completedRequests === podIPMap.size) {
            finishProcessing(podIPMap.size, completedRequests, successCount, errorCount, res);
          }
        });

        response.on('error', (err) => {
          logger.debug(`Error retrieving metrics from pod ${err}`);
          completedRequests += 1;
          errorCount += 1;
          if (completedRequests === podIPMap.size) {
            finishProcessing(podIPMap.size, completedRequests, successCount, errorCount, res);
          }
        });
      }).on('timeout', () => {
        logger.debug(`timeout occured while getting metrics from pod name ${value.podName} pod ip ${value.podIP}`);
        podMetricsRequest.destroy();
        completedRequests += 1;
        errorCount += 1;
        if (completedRequests === podIPMap.size) {
          finishProcessing(podIPMap.size, completedRequests, successCount, errorCount, res);
        }
      }).on('error', (err) => {
        logger.debug(`Error event occured ${err}`, err);
        completedRequests += 1;
        errorCount += 1;
        podMetricsRequest.end();
        if (completedRequests === podIPMap.size) {
          logger.debug('Sending error response');
          finishProcessing(podIPMap.size, completedRequests, successCount, errorCount, res);
        }
      });
      podMetricsRequest.setTimeout(15000);
      podMetricsRequest.end();
    });
  } else {
    finishProcessing(podIPMap.size, completedRequests, successCount, errorCount, res);
  }
}

function handleMetricsRoute(req, resp, k8sCACert, k8sToken) {
  logger.debug(`upstream port ${req.query.upstreamPort}`);
  logger.debug(`upstream uri '${req.params.upstreamURI}`);

  const podsDataPromise = k8sPods.podData(req.params.upstreamNamespace, req.params.upstreamService,
    k8sCACert, k8sToken);
  podsDataPromise.then((podsIPMap) => {
    retrieveMetrics(podsIPMap, req, resp);
  }, (error) => {
    console.error(`error received from podsDataPromise ${error}`);
    resp.writeHead(500, { 'Content-Type': 'text/plain' });
    resp.write('Error processing request. could not get pods data');
    resp.end();
  });
}

module.exports = {
  handleMetricsRoute,
  finishProcessing,
};
