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

const http = require('http');
const https = require('https');
const fs = require('fs');

const chai = require('chai');
const sinon = require('sinon');
const winston = require('winston');

const podMetrics = require('../metrics/podmetrics');
const kubesdMetrics = require('../metrics/kubesdmetrics');
const { logConfig } = require('../config/app-settings').winston;

const logger = winston.createLogger(logConfig);

describe('test http server', function () {
  let server;
  beforeEach(function () {
    delete require.cache[require.resolve('../server')];
  });

  afterEach(function () {
    server.k8sProxyServer.close();
    server.metricsHttpServer.close();
    sinon.restore();
  });

  it('test http server starts', function (done) {
    server = require('../server');
    const options = {
      hostname: 'localhost',
      port: 5050,
      path: '/',
      method: 'GET',
      timeout: 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (response) => {
      let respBody = '';
      response.on('data', (data) => {
        respBody += data;
      });
      response.on('end', () => {
        logger.debug('response received ', respBody);
        chai.expect(response.statusCode).to.equal(200);
        done();
      });
    }).on('error', (err) => {
      done(new Error(`should not succeed ${err}`));
    });
    req.setTimeout(2000);
    req.on('timeout', () => {
      done(new Error('should not succeed'));
    });
    req.end();
  });

  it('test mproxy endpoint', function (done) {
    server = require('../server');
    const options = {
      hostname: 'localhost',
      port: 5050,
      path: '/mproxy/project1/pod1/metrics',
      method: 'GET',
      timeout: 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const podMetricsStub = sinon.stub(podMetrics, 'handleMetricsRoute');
    http.request(options, (response) => {
      response.on('end', () => {
        logger.debug('end event received for response');
        chai.expect(podMetricsStub.called).to.be.true;
        done();
      });
      response.on('data', () => {
        logger.debug('data event received for response');
      });
    }).end();
    podMetricsStub.callsFake(({ response }) => {
      logger.debug('pod metrics stub called');
      response.end();
    });
  });

  it('test kubesd endpoint', function (done) {
    server = require('../server');
    const options = {
      hostname: 'localhost',
      port: 5050,
      path: '/kubesd/metrics',
      method: 'GET',
      timeout: 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const podMetricsStub = sinon.stub(kubesdMetrics, 'handleMetricsRoute');
    http.request(options, (response) => {
      response.on('end', () => {
        logger.debug('end event received for response');
        chai.expect(podMetricsStub.called).to.be.true;
        done();
      });
      response.on('data', () => {
        logger.debug('data event received for response');
      });
    }).end();
    podMetricsStub.callsFake(({ response }) => {
      logger.debug('pod metrics stub called');
      response.end();
    });
  });
});

describe('test with app url prefix', function () {
  let server;
  beforeEach(function () {
    delete require.cache[require.resolve('../server')];
    process.env.APP_URL_PREFIX = 'v1';
  });

  afterEach(function () {
    delete process.env.APP_URL_PREFIX;
    server.k8sProxyServer.close();
    server.metricsHttpServer.close();
    sinon.restore();
  });

  it('test http server starts', function (done) {
    server = require('../server');
    const options = {
      hostname: 'localhost',
      port: 5050,
      path: '/',
      method: 'GET',
      timeout: 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (response) => {
      let respBody = '';
      response.on('data', (data) => {
        respBody += data;
      });
      response.on('end', () => {
        logger.debug('response received ', respBody);
        chai.expect(response.statusCode).to.equal(200);
        done();
      });
    }).on('error', (err) => {
      done(new Error(`should not succeed ${err}`));
    });
    req.setTimeout(2000);
    req.on('timeout', () => {
      done(new Error('should not succeed'));
    });
    req.end();
  });

  it('test mproxy endpoint', function (done) {
    server = require('../server');
    const options = {
      hostname: 'localhost',
      port: 5050,
      path: '/v1/mproxy/project1/pod1/metrics',
      method: 'GET',
      timeout: 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const podMetricsStub = sinon.stub(podMetrics, 'handleMetricsRoute');
    http.request(options, (response) => {
      response.on('end', () => {
        logger.debug('end event received for response');
        chai.expect(podMetricsStub.called).to.be.true;
        done();
      });
      response.on('data', () => {
        logger.debug('data event received for response');
      });
    }).end();
    podMetricsStub.callsFake(({ response }) => {
      logger.debug('pod metrics stub called');
      response.end();
    });
  });

  it('test kubesd endpoint', function (done) {
    server = require('../server');
    const options = {
      hostname: 'localhost',
      port: 5050,
      path: '/v1/kubesd/metrics',
      method: 'GET',
      timeout: 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const podMetricsStub = sinon.stub(kubesdMetrics, 'handleMetricsRoute');
    http.request(options, (response) => {
      response.on('end', () => {
        logger.debug('end event received for response');
        chai.expect(podMetricsStub.called).to.be.true;
        done();
      });
      response.on('data', () => {
        logger.debug('data event received for response');
      });
    }).end();
    podMetricsStub.callsFake(({ response }) => {
      logger.debug('pod metrics stub called');
      response.end();
    });
  });
});

describe('test https server', function () {
  let server;
  beforeEach(function () {
    delete require.cache[require.resolve('../server')];
  });

  afterEach(function () {
    server.k8sProxyServer.close();
    server.metricsHttpServer.close();
    sinon.restore();
  });

  beforeEach(function () {
  });

  afterEach(function () {
    delete process.env.CERT_KEY_FILE;
    delete process.env.CERT_KEY_PASSWD_FILE;
    delete process.env.CERT_FILE;
    delete process.env.CERT_CA_FILE;
    sinon.restore();
  });

  it('test https server starts', function (done) {
    process.env.CERT_KEY_FILE = 'test/certs/testserver.key';
    process.env.CERT_FILE = 'test/certs/testserver.pem';
    process.env.CERT_CA_FILE = 'test/certs/myCA.pem';

    server = require('../server');
    const options = {
      hostname: 'localhost',
      port: 5053,
      path: '/',
      method: 'GET',
      timeout: 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (response) => {
      let respBody = '';
      response.on('data', (data) => {
        respBody += data;
      });
      response.on('end', () => {
        logger.debug('response received ', respBody);
        chai.expect(response.statusCode).to.equal(200);
      });
    }).on('error', (err) => {
      logger.debug(err.message);
      if (err.message === 'self signed certificate') {
        done();
      } else {
        done(new Error(`should not succeed ${err}`));
      }
    });
    req.setTimeout(2000);
    req.on('timeout', () => {
      done(new Error('should not succeed'));
    });
    req.end();
  });

  it('test https server starts with encrypted key', function (done) {
    process.env.CERT_KEY_FILE = 'test/certs/testserver_encrypted.key';
    process.env.CERT_KEY_PASSWD_FILE = 'test/certs/testserver_encrypted.passwd';
    process.env.CERT_FILE = 'test/certs/testserver.pem';
    process.env.CERT_CA_FILE = 'test/certs/myCA.pem';

    server = require('../server');
    const options = {
      hostname: 'localhost',
      port: 5053,
      path: '/',
      method: 'GET',
      timeout: 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (response) => {
      let respBody = '';
      response.on('data', (data) => {
        respBody += data;
      });
      response.on('end', () => {
        logger.debug('response received ', respBody);
        chai.expect(response.statusCode).to.equal(200);
      });
    }).on('error', (err) => {
      if (err.message === 'self signed certificate') {
        done();
      } else {
        done(new Error(`should not succeed ${err}`));
      }
    });
    req.setTimeout(2000);
    req.on('timeout', () => {
      done(new Error('should not succeed'));
    });
    req.end();
  });
});

describe('test for k8 token env variables', function () {
  let server;
  beforeEach(function () {
    delete require.cache[require.resolve('../server')];
  });

  afterEach(function () {
    server.k8sProxyServer.close();
    server.metricsHttpServer.close();
    sinon.restore();
  });

  it('test mproxy endpoint', function (done) {
    delete process.env.TOKEN_FILE;
    delete process.env.K8S_CACERT;
    const podMetricsStub = sinon.stub(podMetrics, 'handleMetricsRoute');
    podMetricsStub.callsFake(({ response }) => {
      logger.debug('pod metrics stub called');
      response.end();
    });

    sinon.stub(fs, 'readFileSync')
      .withArgs('/var/run/secrets/kubernetes.io/serviceaccount/token')
      .callsFake(() => Buffer.from('K8S_GLOBAL_TOKEN=mytoken11'))
      .withArgs('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt')
      .callsFake(() => Buffer.from('cacert'));
    fs.readFileSync.callThrough();

    server = require('../server');
    const options = {
      hostname: 'localhost',
      port: 5050,
      path: '/mproxy/project1/pod1/metrics',
      method: 'GET',
      timeout: 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    http.request(options, (response) => {
      response.on('end', () => {
        logger.debug('end event received for response');
        chai.expect(podMetricsStub.called).to.be.true;
        sinon.restore();
        done();
      });
      response.on('data', (data) => {
        logger.debug(`data event received for response ${data}`);
      });
    }).end();
  });
});
