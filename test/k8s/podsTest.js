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
const { logConfig } = require('../../config/app-settings').winston;
const logger = winston.createLogger(logConfig);

const pods = require('../../k8s/pods.js');
const chai = require('chai');
const fs = require('fs');
const nock = require('nock');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const https = require('https');

describe('k8s pods api tests:', () => {
  beforeEach(() => {
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('test get pods', (done) => {
    nock(`https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`)
      .get(`/api/v1/namespaces/project1/pods`)
      .reply(200, fs.readFileSync('test/mockResponses/podsResponse.txt').toString());

    const podsPromise = pods.podData('project1', 'myapp-', process.env.OPENSHIFT_CACERT, 'SOMETOKEN');
    podsPromise.then((podsIPMap) => {
      logger.debug(podsIPMap);
      chai.expect(podsIPMap.size).to.equal(2);
      chai.expect(podsIPMap.get('10.1.1.2')).to.include({ podName: 'myapp-deployment-1-slgzc', podIP: '10.1.1.2', uid: '8cc04104-479b-11e8-9b0c-fa163ef60be1' });
      chai.expect(podsIPMap.get('10.0.0.1')).to.include({ podName: 'myapp-deployment-1-r70ts', podIP: '10.0.0.1', uid: '58a9acb7-479d-11e8-9b0c-fa163ef60be1' });
      done();
    }, (error) => {
      logger.debug(`error received on promise ${error}`);
      done(new Error(`error received from promise ${error}`));
    });
  });

  it('test get no pod', (done) => {
    nock(`https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`)
      .get(`/api/v1/namespaces/project1/pods`)
      .reply(200, fs.readFileSync('test/mockResponses/podsResponse.txt').toString());

    const podsPromise = pods.podData('project1','randomname', process.env.OPENSHIFT_CACERT, 'SOMETOKEN');
    podsPromise.then((podsIPMap) => {
      logger.debug(podsIPMap);
      chai.expect(podsIPMap.size).to.equal(0);
      done();
    }, (error) => {
      done(new Error(`error received from promise ${error}`));
    });
  });

  it('test empty response', (done) => {
    nock(`https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`)
      .get(`/api/v1/namespaces/project1/pods`)
      .reply(200, '{}');

    const podsPromise = pods.podData('project1','randomname', process.env.OPENSHIFT_CACERT, 'SOMETOKEN');
    podsPromise.then((podsIPMap) => {
      done(new Error('should not succeed'));
    }, (error) => {
      done();
    });
  });


  it('test kubemaster unauthorized', (done) => {
    nock(`https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`)
      .get(`/api/v1/namespaces/project1/pods`)
      .reply(401, 'Unauthorized');

    const podsPromise = pods.podData('project1','randomname', process.env.OPENSHIFT_CACERT, 'SOMETOKEN');
    podsPromise.then(() => {
      done(new Error('should not succeed'));
    }, () => {
      done();
    });
  });

  it('test kubemaster connection error', (done) => {
    nock(`https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`)
      .get(`/api/v1/namespaces/project1/pods`)
      .delayConnection(10000)
      .reply(500, 'Internal Server Error');

    const podsPromise = pods.podData('project1','randomname', process.env.OPENSHIFT_CACERT, 'SOMETOKEN');
    podsPromise.then(() => {
      done(new Error('should not succeed'));
    }, () => {
      done();
    });
  });

  it('test error event', (done) => {
    nock(`https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`)
      .get(`/api/v1/namespaces/project1/pods`)
      .replyWithError({
        message: 'something awful happened',
        code: 'AWFUL_ERROR'
      });

    const podsPromise = pods.podData('project1','randomname', process.env.OPENSHIFT_CACERT, 'SOMETOKEN');
    podsPromise.then(() => {
      done(new Error('should not succeed'));
    }, () => {
      done();
    });
  });

  it('test error event on request  ', (done) => {
    EventEmitter.prototype.setTimeout =  function(timeo){};
    EventEmitter.prototype.end =  function() {};
    EventEmitter.prototype.destroy =  function() {};
    const emitter = new EventEmitter();
    const httpsRequestMock = sinon.stub(https, 'request').returns(emitter);

    const podsPromise = pods.podData('project1','randomname', process.env.OPENSHIFT_CACERT, 'SOMETOKEN');
    emitter.emit('error');
    podsPromise.then(() => {
      httpsRequestMock.restore();
      done(new Error('should not succeed'));
    }, () => {
      httpsRequestMock.restore();
      done();
    });
  });

  it('test timeout event on request  ', (done) => {
    EventEmitter.prototype.setTimeout =  function(timeo){};
    EventEmitter.prototype.end =  function() {};
    EventEmitter.prototype.destroy =  function() {};
    const emitter = new EventEmitter();
    const httpsRequestMock = sinon.stub(https, 'request').returns(emitter);
    const podsPromise = pods.podData('project1','randomname', process.env.OPENSHIFT_CACERT, 'SOMETOKEN');
    emitter.emit('timeout');

    podsPromise.then(() => {
      httpsRequestMock.restore();
      done(new Error('should not succeed'));
    }, () => {
      httpsRequestMock.restore();
      done();
    });
  });

  it('test error event on response  ', (done) => {
    EventEmitter.prototype.setTimeout =  function(timeo){};
    EventEmitter.prototype.end =  function() {};
    EventEmitter.prototype.destroy =  function() {};
    emitterReq = new EventEmitter();
    emitterResp = new EventEmitter();
    const httpsRequestMock = sinon.stub(https, 'request').returns(emitterReq);
    const podsPromise = pods.podData('project1','randomname', process.env.OPENSHIFT_CACERT, 'SOMETOKEN');
    httpsRequestMock.callArgWith(1, emitterResp);
    emitterResp.emit('error');
    podsPromise.then(() => {
      httpsRequestMock.restore();
      done(new Error('should not succeed'));
    }, () => {
      httpsRequestMock.restore();
      done();
    });
  });
});
