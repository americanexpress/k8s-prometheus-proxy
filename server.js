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

const os = require('os');
const https = require('https');
const http = require('http');
const fs = require('fs');
const express = require('express');
const apiMetrics = require('prometheus-api-metrics');
const winston = require('winston');
const { logConfig } = require('./config/app-settings').winston;

const logger = winston.createLogger(logConfig);

const app = express();
const router = express.Router();

const metricsApp = express();
metricsApp.use(apiMetrics());

const packageJson = require('./package.json');
const podMetrics = require('./metrics/podmetrics');
const kubesdMetrics = require('./metrics/kubesdmetrics');
const tokenUtil = require('./k8s/tokenUtil');
const errorHandler = require('./error-handler/errorHandler');

const k8sTokenFile = process.env.TOKEN_FILE || '/var/run/secrets/kubernetes.io/serviceaccount/token';
const k8sCACertFile = process.env.K8S_CACERT || '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
const k8sToken = process.env.K8S_GLOBAL_TOKEN || tokenUtil.deriveToken(k8sTokenFile);
const k8sCACert = fs.readFileSync(k8sCACertFile);

const httpPort = process.env.K8S_NODEJS_PORT || process.env.HTTP_PORT || 5050;
const httpsPort = process.env.K8S_NODEJS_PORT || process.env.HTTPS_PORT || 5053;
const metricsHttpPort = process.env.METRICS_HTTP_PORT || 5055;

let k8sProxyServer;
let appUrlPrefix = process.env.APP_URL_PREFIX;

const defaultRouteHandler = function (req, res) {
  logger.debug(`Landing url...${process.env.name} ${packageJson.version} is running on ${os.hostname()} on http port (${httpPort})`);
  res.json({ message: 'kubernetes prometheus proxy' });
};

if (appUrlPrefix === undefined || appUrlPrefix === null) {
  app.use('/', router);
} else {
  appUrlPrefix = appUrlPrefix.trim();
  app.use(`/${appUrlPrefix}`, router);
  const defaultRouter = express.Router();
  defaultRouter.get('/', defaultRouteHandler);
  app.use('/', defaultRouter);
}

app.use(errorHandler);

router.get('/', defaultRouteHandler);

router.get('/mproxy/:upstreamNamespace/:upstreamService/*', (req, res) => {
  logger.debug(`retrieving metrics from ${req.params.upstreamNamespace} and service ${req.params.upstreamService}`);
  podMetrics.handleMetricsRoute(req, res, k8sCACert, k8sToken);
});

router.get('/kubesd/*', (req, res) => {
  console.log(`from server.js req url ${req.url}`);
  kubesdMetrics.handleMetricsRoute(req, res);
});

const certkeyFile = process.env.CERT_KEY_FILE;
const certFile = process.env.CERT_FILE;
const certCAFile = process.env.CERT_CA_FILE;
const certKeyPasswdFile = process.env.CERT_KEY_PASSWD_FILE;
logger.debug(certkeyFile);
logger.debug(certFile);
logger.debug(certCAFile);
logger.debug(certKeyPasswdFile);

if (certkeyFile === undefined || certkeyFile === null) {
  logger.debug('creating http server');
  k8sProxyServer = http.createServer(app);
  k8sProxyServer.listen(httpPort, () => {
    logger.debug(`http server is listening on ${httpPort}`);
  });
  logger.debug(`${process.env.name} ${packageJson.version} is running on ${os.hostname()} on http port ${httpPort}`);
} else {
  logger.debug('creating https server');
  const privateKey = fs.readFileSync(certkeyFile);
  const certificate = fs.readFileSync(certFile);
  const ca = fs.readFileSync(certCAFile);
  let pass;
  if (certKeyPasswdFile !== undefined && certKeyPasswdFile !== null) {
    pass = fs.readFileSync(certKeyPasswdFile, 'ascii');
  }

  const options = {
    key: privateKey,
    cert: certificate + ca,
    passphrase: pass,
  };

  k8sProxyServer = https.createServer(options, app);
  k8sProxyServer.listen(httpsPort, '0.0.0.0', () => {
    logger.debug(`https server is listening on  ${httpsPort}`);
  });
  logger.debug(`${process.env.name} ${packageJson.version} is running on ${os.hostname()} https port ( ${httpPort} )`);
}

const metricsHttpServer = http.createServer(metricsApp);
metricsHttpServer.listen(metricsHttpPort, () => {
  logger.debug(`metrics http server is listening on ${metricsHttpPort}`);
});

module.exports = {
  k8sProxyServer,
  metricsHttpServer,
};
