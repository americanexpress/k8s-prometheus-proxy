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

const fs = require('fs');
const events = require('events');
const { EventEmitter } = require('events');
const http = require('http');

const chai = require('chai');
const sinon = require('sinon');
const httpMocks = require('node-mocks-http');
const nock = require('nock');
const winston = require('winston');

const { logConfig } = require('../../../config/app-settings').winston;

const logger = winston.createLogger(logConfig);

delete require.cache[require.resolve('../../../metrics/whitelistUtil')];
process.env.CIDR_WHITELIST = '10.0.0.0/8';
process.env.METRICS_PATH_WHITELIST = '/metrics';
const metrics = require('../../../metrics/podmetrics');
const pods = require('../../../k8s/pods');

describe('pod metrics tests with no data:', function () {
  let request;
  let response;

  beforeEach(function () {
    request = httpMocks.createRequest({
      method: 'GET',
      url: '/mproxy/project1/myapp-/metrics',
      params: {
        upstreamNamespace: 'project1',
        upstreamService: 'myapp-',
        upstreamURI: '/metrics',
      },
    });

    response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });
  });

  afterEach(function () {
    nock.cleanAll();
  });

  it('test podsDataPromise promise error', function (done) {
    const podStub = sinon.stub(pods, 'podData')
      .returns(Promise.reject(new Error('testing error')));
    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData)
        .to
        .equal('Error processing request. could not get pods data');
      podStub.restore();
      done();
    });
  });

  it('test podsDataPromise no pods', function (done) {
    const podStub = sinon.stub(pods, 'podData')
      .returns(Promise.resolve(new Map()));
    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData)
        .to
        .equal('#Unable to collect data.');
      podStub.restore();
      done();
    });
  });
});

describe('pod request headers tests', function () {
  it('test request headers', function (done) {
    nock(`https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`)
      .get('/api/v1/namespaces/project1/pods')
      .reply(200, fs.readFileSync('test/mockResponses/podsResponse.txt').toString());

    nock('http://10.0.0.1:3005', {
      reqheaders: {
        authorization: 'bearer test',
      },
    }).get('/metrics').reply(200, fs.readFileSync('test/mockResponses/10.0.0.1.metrics.txt').toString());

    nock('http://10.1.1.2:3005', {
      reqheaders: {
        authorization: 'bearer test',
      },
    }).get('/metrics').reply(200, fs.readFileSync('test/mockResponses/10.1.1.2.metrics.txt').toString());

    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/myapp/project1/myapp-/metrics',
      params: {
        upstreamNamespace: 'project1',
        upstreamService: 'myapp-',
        upstreamURI: '/metrics',
      },
      query: {
        upstreamPort: 3005,
      },
      headers: {
        authorization: 'bearer test',
        host: 'localhost:30020',
      },
    });
    const response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });
    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(200, response.statusCode);
      const rsp1 = fs.readFileSync('test/expectedResponses/10.0.0.1.withPodLabels.txt')
        .toString();
      logger.debug(rsp1);
      const rsp2 = fs.readFileSync('test/expectedResponses/10.1.1.2.withPodLabels.txt')
        .toString();
      chai.expect(rspData)
        .to
        .equal(rsp1 + rsp2);
      done();
    });
  });
});

describe('pod metrics tests:', function () {
  let request;
  let response;

  beforeEach(function () {
    nock(`https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`)
      .get('/api/v1/namespaces/project1/pods')
      .reply(200, fs.readFileSync('test/mockResponses/podsResponse.txt').toString());

    request = httpMocks.createRequest({
      method: 'GET',
      url: '/mproxy/project1/myapp-/metrics',
      params: {
        upstreamNamespace: 'project1',
        upstreamService: 'myapp-',
        upstreamURI: '/metrics',
      },
      query: {
        upstreamPort: 3005,
      },
    });

    response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });
  });

  afterEach(function () {
    nock.cleanAll();
  });

  it('test pod metrics success', function (done) {
    nock('http://10.0.0.1:3005')
      .get('/metrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.0.0.1.metrics.txt').toString());
    nock('http://10.1.1.2:3005')
      .get('/metrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.1.1.2.metrics.txt').toString());

    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(200, response.statusCode);
      const rsp1 = fs.readFileSync('test/expectedResponses/10.0.0.1.withPodLabels.txt').toString();
      logger.debug(rsp1);
      const rsp2 = fs.readFileSync('test/expectedResponses/10.1.1.2.withPodLabels.txt').toString();
      chai.expect(rspData).to.equal(rsp1 + rsp2);
      done();
    });
  });

  it('test pod metrics ssl', function (done) {
    request.query.ssl = 'true';
    nock('https://10.0.0.1:3005')
      .get('/metrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.0.0.1.metrics.txt').toString());
    nock('https://10.1.1.2:3005')
      .get('/metrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.1.1.2.metrics.txt').toString());

    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(200, response.statusCode);
      const rsp1 = fs.readFileSync('test/expectedResponses/10.0.0.1.withPodLabels.txt').toString();
      logger.debug(rsp1);
      const rsp2 = fs.readFileSync('test/expectedResponses/10.1.1.2.withPodLabels.txt').toString();
      chai.expect(rspData).to.equal(rsp1 + rsp2);
      done();
    });
  });

  it('test pod metrics one pod timeout', function (done) {
    nock('http://10.0.0.1:3005')
      .get('/metrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.0.0.1.metrics.txt').toString());
    nock('http://10.1.1.2:3005')
      .get('/metrics')
      .delayConnection(20000)
      .reply(500, 'Internal Server Error');

    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(200, response.statusCode);
      const rsp1 = fs.readFileSync('test/expectedResponses/10.0.0.1.withPodLabels.txt').toString();
      chai.expect(rspData).to.equal(rsp1);
      done();
    });
  });

  it('test pod metrics one pod error', function (done) {
    nock('http://10.0.0.1:3005')
      .get('/metrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.0.0.1.metrics.txt').toString());
    nock('http://10.1.1.2:3005')
      .get('/metrics')
      .reply(404);

    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received${rspData}`);
      chai.expect(200, response.statusCode);
      const rsp1 = fs.readFileSync('test/expectedResponses/10.0.0.1.withPodLabels.txt').toString();
      chai.expect(rspData).to.equal(rsp1);
      done();
    });
  });

  it('test pod metrics all pod error', function (done) {
    nock('http://10.0.0.1:3005')
      .get('/metrics')
      .reply(404);
    nock('http://10.1.1.2:3005')
      .get('/metrics')
      .reply(404);

    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect data.');
      done();
    });
  });

  it('test all pod timeout', function (done) {
    nock('http://10.0.0.1:3005')
      .get('/metrics')
      .delayConnection(20000)
      .reply(500, 'Internal Server Error');
    nock('http://10.1.1.2:3005')
      .get('/metrics')
      .delayConnection(20000)
      .reply(500, 'Internal Server Error');

    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect data.');
      done();
    });
  });

  it('test error event on response  ', function (done) {
    const emitterReq = Object.assign(new EventEmitter(), {
      setTimeout: function mockSetTimeout() { return this; },
      end: () => {},
      destroy: () => {},
    });
    const emitterResp = Object.assign(new EventEmitter(), {
      setTimeout: function mockSetTimeout() { return this; },
      end: () => {},
      destroy: () => {},
    });
    const podIPMap = new Map();
    podIPMap.set('10.0.0.1', { podName: 'mypod', podIP: '10.0.0.1', uid: 'podUid' });
    podIPMap.set('10.0.0.2', { podName: 'mypod', podIP: '10.0.0.2', uid: 'podUid' });
    const podStub = sinon.stub(pods, 'podData').returns(Promise.resolve(podIPMap));
    const httpsRequestMock = sinon.stub(http, 'request').returns(emitterReq);
    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    setTimeout(() => {
      httpsRequestMock.callArgWith(1, emitterResp);
      emitterResp.emit('error');
    }, 500);

    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect data.');
      httpsRequestMock.restore();
      podStub.restore();
      done();
    });
  });

  it('test error event on request  ', function (done) {
    const emitterReq = Object.assign(new EventEmitter(), {
      setTimeout: function mockSetTimeout() { return this; },
      end: () => {},
      destroy: () => {},
    });

    const podIPMap = new Map();
    podIPMap.set('10.0.0.1', { podName: 'mypod', podIP: '10.0.0.1', uid: 'podUid' });
    podIPMap.set('10.0.0.2', { podName: 'mypod', podIP: '10.0.0.2', uid: 'podUid' });
    const podStub = sinon.stub(pods, 'podData').returns(Promise.resolve(podIPMap));
    const httpsRequestMock = sinon.stub(http, 'request').returns(emitterReq);
    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    setTimeout(() => {
      emitterReq.emit('error');
    }, 500);

    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect data.');
      httpsRequestMock.restore();
      podStub.restore();
      done();
    });
  });

  it('test timeout event on request  ', function (done) {
    const emitterReq = Object.assign(new EventEmitter(), {
      setTimeout: function mockSetTimeout() { return this; },
      end: () => {},
      destroy: () => {},
    });

    const podIPMap = new Map();
    podIPMap.set('10.0.0.1', { podName: 'mypod', podIP: '10.0.0.1', uid: 'podUid' });
    podIPMap.set('10.0.0.2', { podName: 'mypod', podIP: '10.0.0.2', uid: 'podUid' });
    const podStub = sinon.stub(pods, 'podData').returns(Promise.resolve(podIPMap));
    const httpsRequestMock = sinon.stub(http, 'request').returns(emitterReq);
    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    setTimeout(() => {
      emitterReq.emit('timeout');
    }, 500);

    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect data.');
      httpsRequestMock.restore();
      podStub.restore();
      done();
    });
  });
});

describe('pod multilevel context tests:', function () {
  let response;
  beforeEach(function () {
    nock(`https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`)
      .get('/api/v1/namespaces/project1/pods')
      .reply(200, fs.readFileSync('test/mockResponses/podsResponse.txt').toString());

    response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });

    nock('http://10.0.0.1:3005')
      .get('/ctxt/subctxt/metrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.0.0.1.metrics.txt').toString());
    nock('http://10.1.1.2:3005')
      .get('/ctxt/subctxt/metrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.1.1.2.metrics.txt').toString());
  });

  afterEach(function () {
    nock.cleanAll();
  });

  it('test multilevel context metrics success', function (done) {
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/mproxy/project1/myapp-/ctxt/subctxt/metrics',
      params: {
        upstreamNamespace: 'project1',
        upstreamService: 'myapp-',
        upstreamURI: '/metrics',
      },
      query: {
        upstreamPort: 3005,
      },
    });

    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(200, response.statusCode);
      const rsp1 = fs.readFileSync('test/expectedResponses/10.0.0.1.withPodLabels.txt').toString();
      logger.debug(rsp1);
      const rsp2 = fs.readFileSync('test/expectedResponses/10.1.1.2.withPodLabels.txt').toString();
      chai.expect(rspData).to.equal(rsp1 + rsp2);
      done();
    });
  });

  it('test multilevel context metrics with query params', function (done) {
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/v1/mproxy/project1/myapp-/ctxt/subctxt/metrics?upstreamPort=3004&sni=something',
      params: {
        upstreamNamespace: 'project1',
        upstreamService: 'myapp-',
        upstreamURI: '/metrics',
      },
      query: {
        upstreamPort: 3005,
      },
    });

    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received ${rspData}`);
      chai.expect(200, response.statusCode);
      const rsp1 = fs.readFileSync('test/expectedResponses/10.0.0.1.withPodLabels.txt').toString();
      logger.debug(rsp1);
      const rsp2 = fs.readFileSync('test/expectedResponses/10.1.1.2.withPodLabels.txt').toString();
      chai.expect(rspData).to.equal(rsp1 + rsp2);
      done();
    });
  });
});

describe('finishProcessing test', function () {
  let response;
  beforeEach(function () {
    response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });
  });

  afterEach(function () {
    nock.cleanAll();
  });

  it('test error', function (done) {
    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect data.');
      done();
    });
    metrics.finishProcessing({
      noOfPods: 2,
      completedRequests: 1,
      successCount: 1,
      errorCount: 0,
      res: response,
    });
  });
});

describe('pod metrics namespace name validation', function () {
  let request;
  let response;

  beforeEach(function () {
    nock(`https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`)
      .get('/api/v1/namespaces/-project1/pods')
      .reply(200, fs.readFileSync('test/mockResponses/podsResponse.txt').toString());

    request = httpMocks.createRequest({
      method: 'GET',
      url: '/mproxy/-project1/myapp-/metrics',
      params: {
        upstreamNamespace: '-project1',
        upstreamService: 'myapp-',
        upstreamURI: '/metrics',
      },
      query: {
        upstreamPort: 3005,
      },
    });

    response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });
  });

  afterEach(function () {
    nock.cleanAll();
  });

  it('test invalid namespace', function (done) {
    nock('http://10.0.0.1:3005')
      .get('/metrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.0.0.1.metrics.txt').toString());
    nock('http://10.1.1.2:3005')
      .get('/metrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.1.1.2.metrics.txt').toString());

    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect data.');
      done();
    });
    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
  });
});

describe('pod metrics upstream path name validation', function () {
  let request;
  let response;

  beforeEach(function () {
    nock(`https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`)
      .get('/api/v1/namespaces/project1/pods')
      .reply(200, fs.readFileSync('test/mockResponses/podsResponse.txt').toString());

    request = httpMocks.createRequest({
      method: 'GET',
      url: '/mproxy/project1/myapp-/somemetrics',
      params: {
        upstreamNamespace: 'project1',
        upstreamService: 'myapp-',
      },
      query: {
        upstreamPort: 3005,
      },
    });

    response = httpMocks.createResponse({
      eventEmitter: events.EventEmitter,
    });
  });

  afterEach(function () {
    nock.cleanAll();
  });

  it('test invalid metrics path', function (done) {
    nock('http://10.0.0.1:3005')
      .get('/somemetrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.0.0.1.metrics.txt').toString());
    nock('http://10.1.1.2:3005')
      .get('/somemetrics')
      .reply(200, fs.readFileSync('test/mockResponses/10.1.1.2.metrics.txt').toString());

    response.on('end', () => {
      const rspData = response._getData();
      logger.debug(`response received${rspData}`);
      chai.expect(500, response.statusCode);
      chai.expect(rspData).to.equal('#Unable to collect data.');
      done();
    });
    metrics.handleMetricsRoute({
      request,
      response,
      k8sCACert: process.env.K8S_CACERT,
      k8sToken: 'SOMETOKEN',
    });
  });
});
