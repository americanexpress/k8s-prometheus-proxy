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

const chai = require('chai');
const http = require('http');
const podmetricsUtils = require('../../../metrics/podmetricsUtil.js');

describe('upstream uri test', () => {
  it('test path', (done) => {
    chai.expect(podmetricsUtils.deriveUpstreamURI('/v1/mproxy/prj/serv/metrics', '/mproxy')).to.be.equal('/metrics');
    chai.expect(podmetricsUtils.deriveUpstreamURI('/mproxy/prj/serv/metrics', '/mproxy')).to.be.equal('/metrics');
    chai.expect(podmetricsUtils.deriveUpstreamURI('/mproxy/prj/serv/metrics?some=thing&ssl=true', '/mproxy')).to.be.equal('/metrics');
    chai.expect(podmetricsUtils.deriveUpstreamURI('/mproxy/prj/serv/my/ctxt/metrics', '/mproxy')).to.be.equal('/my/ctxt/metrics');
    chai.expect(podmetricsUtils.deriveUpstreamURI('/kubesd/my/ctxt/metrics', '/kubesd')).to.be.equal('/my/ctxt/metrics');
    done();
  });
});

describe('derive response host test', () => {
  const Request = {
    host: null,
    init(remoteAddress, host) {
      this.socket.remoteAddress = remoteAddress;
      this.host = host;
      return this;
    },
    socket: {
      remoteAddress: '',
    },
    getHeader(h) {
      return this.host;
    },
  };
  it('test resp host', (done) => {
    chai.expect(podmetricsUtils.deriveRespHost(Object.create(Request).init('10.1.1.1', 'host'))).to.be.equal('10.1.1.1');
    chai.expect(podmetricsUtils.deriveRespHost(Object.create(Request).init(undefined, '10.1.1.2'))).to.be.equal('10.1.1.2');
    chai.expect(podmetricsUtils.deriveRespHost(Object.create(Request).init('10.1.1.1:443', 'host'))).to.be.equal('10.1.1.1');
    done();
  });
});
