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

const proxyquire = require('proxyquire');
const url = require('url');
const chai = require('chai');
const fs = require('fs');
const httpMocks = require('node-mocks-http');
const nock = require('nock');
const events = require('events');

describe('kubesd metrics test whitelisting metrics path', () => {
  beforeEach(() => {
    delete require.cache[require.resolve('../../../metrics/whitelistUtil')];
  });
  afterEach(() => {
    nock.cleanAll();
  });

  it('test whitelisting path', (done) => {
    process.env.CIDR_WHITELIST = '10.0.0.1/24';
    process.env.METRICS_PATH_WHITELIST = '.*metrics.*';
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/metrics',
      query: {
        pod: '10.0.0.5',
        target_port: '3005',
        target_scheme: 'https',
      },
    });

    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    apiProxyStub.web = function (req, res, targetObj, errorCallback) {
      logger.debug(req.url);
      chai.expect(req.method).to.equal('GET');
      chai.expect(req.url).to.equal('/v1/kubesd/metrics');
      const expectedTarget = url.format({
        protocol: 'https',
        port: '3005',
        hostname: '10.0.0.5',
        pathname: '/metrics',
        query: {},
      });
      logger.debug(expectedTarget);
      logger.debug(targetObj.target);
      chai.expect(expectedTarget).to.equal(targetObj.target);
      done();
    };
    httpProxyStub.createProxyServer = function (obj) {
      return apiProxyStub;
    };
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
    });

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', { 'http-proxy': httpProxyStub });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');
  });

  it('test whitelisting no env variable', (done) => {
    process.env.CIDR_WHITELIST = '10.0.0.1/24';
    delete process.env.METRICS_PATH_WHITELIST;
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/metrics',
      query: {
        pod: '10.0.0.5',
        target_port: '3005',
        target_scheme: 'https',
      },
    });

    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    apiProxyStub.web = function (req, res, targetObj, errorCallback) {
      logger.debug(targetObj);
      done(new Error('should not be called'));
    };
    httpProxyStub.createProxyServer = function (obj) {
      return apiProxyStub;
    };
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect metrics');
      done();
    });

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', { 'http-proxy': httpProxyStub });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');
  });

  it('test whitelisting path not part of multiple paths', (done) => {
    process.env.CIDR_WHITELIST = '10.0.0.1/24';
    process.env.METRICS_PATH_WHITELIST = '.*testmetrics$,\/test\/another\/path$,.*\/metrics1$';
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/metrics',
      query: {
        pod: '10.0.0.5',
        target_port: '3005',
        target_scheme: 'https',
      },
    });

    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    apiProxyStub.web = function (req, res, targetObj, errorCallback) {
      logger.debug(targetObj);
      done(new Error('should not be called'));
    };
    httpProxyStub.createProxyServer = function (obj) {
      return apiProxyStub;
    };
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(500).to.equal(response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect metrics');
      done();
    });

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', { 'http-proxy': httpProxyStub });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');
  });

  it('test whitelisting multiple paths', (done) => {
    process.env.CIDR_WHITELIST = '10.0.0.1/24,10.1.1.0/26';
    process.env.METRICS_PATH_WHITELIST = '(?:\/)metrics$,(?:\/)somepath\/prom$,(?:\/)another\/path\/readmetrics$';
    let request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/another/prom/metrics',
      query: {
        pod: '10.0.0.5',
        target_port: '3005',
        target_scheme: 'https',
      },
    });

    let response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    let numOfRequests = 0;
    apiProxyStub.web = function (req, res, targetObj, errorCallback) {
      logger.debug(targetObj.target);
      chai.expect(targetObj.target.includes('https://10.0.0.5:3005/')).to.be.true;
      chai.expect(['https://10.0.0.5:3005/another/prom/metrics', 'https://10.0.0.5:3005/myctxt/another/path/readmetrics', 'https://10.0.0.5:3005/somepath/prom'])
        .to.include(targetObj.target);
      numOfRequests += 1;
      if (numOfRequests === 3) {
        done();
      }
    };
    httpProxyStub.createProxyServer = function (obj) {
      return apiProxyStub;
    };
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
    });

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', { 'http-proxy': httpProxyStub });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');

    request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/myctxt/another/path/readmetrics',
      query: {
        pod: '10.0.0.5',
        target_port: '3005',
        target_scheme: 'https',
      },
    });
    response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');

    request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/somepath/prom',
      query: {
        pod: '10.0.0.5',
        target_port: '3005',
        target_scheme: 'https',
      },
    });
    response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');
  });
});

describe('kubesd metrics test whitelisting IPs', () => {
  beforeEach(() => {
    delete require.cache[require.resolve('../../../metrics/whitelistUtil')];
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('test whitelisting', (done) => {
    process.env.CIDR_WHITELIST = '10.0.0.1/24';
    process.env.METRICS_PATH_WHITELIST = '(?:\/)metrics$';
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/metrics',
      query: {
        pod: '10.0.0.4',
        target_port: '2020',
        target_scheme: 'https',
      },
    });

    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    apiProxyStub.web = function (req, res, targetObj, errorCallback) {
      logger.debug(req.url);
      chai.expect(req.method).to.equal('GET');
      chai.expect(req.url).to.equal('/v1/kubesd/metrics');
      const expectedTarget = url.format({
        protocol: 'https',
        port: '2020',
        hostname: '10.0.0.4',
        pathname: '/metrics',
        query: {},
      });
      logger.debug(expectedTarget);
      logger.debug(targetObj.target);
      chai.expect(expectedTarget).to.equal(targetObj.target);
      done();
    };
    httpProxyStub.createProxyServer = function (obj) {
      return apiProxyStub;
    };
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect metrics');
      done();
    });

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', { 'http-proxy': httpProxyStub });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');
  });

  it('test whitelisting no env variable', (done) => {
    delete process.env.CIDR_WHITELIST;
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/metrics',
      query: {
        pod: '10.0.0.5',
        target_port: '3005',
        target_scheme: 'https',
      },
    });

    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    apiProxyStub.web = function (req, res, targetObj, errorCallback) {
      logger.debug(targetObj);
      done(new Error('should not be called'));
    };
    httpProxyStub.createProxyServer = function (obj) {
      return apiProxyStub;
    };
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect metrics');
      done();
    });

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', { 'http-proxy': httpProxyStub });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');
  });

  it('test whitelisting multiple ips', (done) => {
    process.env.CIDR_WHITELIST = '10.0.0.1/24,10.1.1.0/26';
    process.env.METRICS_PATH_WHITELIST = '(?:\/)metrics$,\/some\/metrics$,\/other\/metricspath$';
    let request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/metrics',
      query: {
        pod: '10.1.1.60',
        target_port: '3005',
        target_scheme: 'https',
      },
    });

    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    let numOfRequests = 0;
    apiProxyStub.web = function (req, res, targetObj, errorCallback) {
      logger.debug(targetObj);
      logger.debug(targetObj.target);
      chai.expect(['https://10.1.1.60:3005/metrics', 'https://10.1.1.58:3005/some/metrics', 'https://10.0.0.5:3005/other/metricspath'])
        .to.include(targetObj.target);
      numOfRequests += 1;
      if (numOfRequests === 3) {
        done();
      }
    };
    httpProxyStub.createProxyServer = function (obj) {
      return apiProxyStub;
    };
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
    });

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', { 'http-proxy': httpProxyStub });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');

    request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/some/metrics',
      query: {
        pod: '10.1.1.58',
        target_port: '3005',
        target_scheme: 'https',
      },
    });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');

    request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/other/metricspath',
      query: {
        pod: '10.0.0.5',
        target_port: '3005',
        target_scheme: 'https',
      },
    });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');
  });

  it('test whitelisting ip not part of multiple ips', (done) => {
    process.env.CIDR_WHITELIST = '10.0.0.1/24,10.1.1.0/26';
    process.env.METRICS_PATH_WHITELIST = 'metrics$';
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/metrics',
      query: {
        pod: '10.1.1.65',
        target_port: '3005',
        target_scheme: 'https',
      },
    });

    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    apiProxyStub.web = function (req, res, targetObj, errorCallback) {
      logger.debug(targetObj);
      done(new Error('should not be called'));
    };
    httpProxyStub.createProxyServer = function (obj) {
      return apiProxyStub;
    };
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect metrics');
      done();
    });

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', { 'http-proxy': httpProxyStub });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');
  });

  it('test whitelisting multiple ip incorrect whitelist', (done) => {
    process.env.CIDR_WHITELIST = 'sometest,ourtest.nonexisting.domain';
    process.env.METRICS_PATH_WHITELIST = '\/metrics$';
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/kubesd/metrics',
      query: {
        pod: '10.1.1.65',
        target_port: '3005',
        target_scheme: 'https',
      },
    });

    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    const httpProxyStub = {};
    const apiProxyStub = {};
    apiProxyStub.web = function (req, res, targetObj, errorCallback) {
      logger.debug(targetObj);
      done(new Error('should not be called'));
    };
    httpProxyStub.createProxyServer = function (obj) {
      return apiProxyStub;
    };
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect metrics');
      done();
    });

    const kubesdmetrics = proxyquire('../../../metrics/kubesdmetrics', { 'http-proxy': httpProxyStub });
    kubesdmetrics.handleMetricsRoute(request, response, 'v1');
  });
});
