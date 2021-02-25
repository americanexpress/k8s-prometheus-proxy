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
const { logConfig } = require('../../../config/app-settings').winston;
const logger = winston.createLogger(logConfig);

const proxyquire =  require('proxyquire');
const url = require('url');
const chai = require('chai');
const fs = require('fs');
const httpMocks = require('node-mocks-http');
const nock = require('nock');
const events = require('events');

describe('kubesd metrics tests:', () => {

  beforeEach(() => {
    delete require.cache[require.resolve('../../../metrics/whitelistUtil')];
    process.env.CIDR_WHITELIST="10.0.0.1/24";
    process.env.METRICS_PATH_WHITELIST="/metrics";
  })

  afterEach(() => {
    nock.cleanAll();
  });

  it('test pod metrics success', (done) => {
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/metrics',
      query: {
        pod: "10.0.0.1",
        target_port: "3005",
        target_scheme: "https"
      },
    });

    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    apiProxyStub.web = function(req, res, targetObj, errorCallback) {
      logger.debug(targetObj);
      const parsedUrl = url.parse(targetObj.target)
      chai.expect(parsedUrl.hostname).to.equal("10.0.0.1");
      chai.expect(parsedUrl.protocol).to.equal("https:");
      chai.expect(parsedUrl.port).to.equal("3005");
      chai.expect(parsedUrl.pathname).to.equal("/metrics");
      done();
      return;
    }
    httpProxyStub.createProxyServer = function(obj) {
      return apiProxyStub;
    }

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', {'http-proxy': httpProxyStub});
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');

  });

  it('test pod metrics success with no appurl prefix', (done) => {
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/kubesd/metrics',
      query: {
        pod: "10.0.0.1",
        target_port: "3005",
        target_scheme: "https"
      },
    });

    var response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    let reqCompleted = 0;
    apiProxyStub.web = function(req, res, targetObj, errorCallback) {
      logger.debug(targetObj);
      const parsedUrl = url.parse(targetObj.target)
      chai.expect(parsedUrl.hostname).to.equal("10.0.0.1");
      chai.expect(parsedUrl.protocol).to.equal("https:");
      chai.expect(parsedUrl.port).to.equal("3005");
      chai.expect(parsedUrl.pathname).to.equal("/metrics");
      reqCompleted = reqCompleted + 1;
      if(reqCompleted === 4) {
        done();
      }
      return;
    }
    httpProxyStub.createProxyServer = function(obj) {
      return apiProxyStub;
    }

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', {'http-proxy': httpProxyStub});
    kubesdmetrics.handleMetricsRoute(request, response, null);
    response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });
    kubesdmetrics.handleMetricsRoute(request, response, undefined);
    response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });
    kubesdmetrics.handleMetricsRoute(request, response, '');
    response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });
    kubesdmetrics.handleMetricsRoute(request, response, '  ');

  });

  it('test pod metrics default target_scheme', (done) => {
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/metrics',
      query: {
        pod: "10.0.0.1",
        target_port: "3005"
      },
    });

    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    apiProxyStub.web = function(req, res, targetObj, errorCallback) {
      logger.debug(targetObj);
      const parsedUrl = url.parse(targetObj.target)
      chai.expect(parsedUrl.hostname).to.equal("10.0.0.1");
      chai.expect(parsedUrl.protocol).to.equal("http:");
      chai.expect(parsedUrl.port).to.equal("3005");
      chai.expect(parsedUrl.pathname).to.equal("/metrics");
      done();
      return;
    }
    httpProxyStub.createProxyServer = function(obj) {
      return apiProxyStub;
    }

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', {'http-proxy': httpProxyStub});
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');

  });

  it('test pod metrics error', (done) => {
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/metrics',
      query: {
        pod: "10.0.0.1",
        target_port: "3005",
        target_scheme: "https"
      },
    });

    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    apiProxyStub.web = function(req, res, targetObj, errorCallback) {
      logger.debug(targetObj);
      const parsedUrl = url.parse(targetObj.target)
      chai.expect(parsedUrl.hostname).to.equal("10.0.0.1");
      chai.expect(parsedUrl.protocol).to.equal("https:");
      chai.expect(parsedUrl.port).to.equal("3005");
      chai.expect(parsedUrl.pathname).to.equal("/metrics");
      errorCallback(new Error("socket error"));
    }
    httpProxyStub.createProxyServer = function(obj) {
      return apiProxyStub;
    }
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect metrics');
      done();
    });

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', {'http-proxy': httpProxyStub});
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');
  });
});

