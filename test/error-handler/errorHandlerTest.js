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

const errorHandler = require('../../error-handler/errorHandler');

const winston = require('winston');
const { logConfig } = require('../../config/app-settings').winston;
const logger = winston.createLogger(logConfig);


const chai = require('chai');
const http = require('http');
const https = require('https');
const sinon = require('sinon');

describe('test error handler', () => {
  let req;
  let res;
  const next = sinon.stub();

  beforeEach(() => {
    req = {
      params: {},
      body: {}
    };

    res = {
      data: null,
      code: null,
      status (status) {
        this.code = status;
        return this;
      },
      send (payload) {
        this.data = payload;
      },
      headersSent: false
    };
  });

  afterEach(() => {
    next.reset();
  });

  it('test error handler', (done) => {
    errorHandler(new Error(), req, res, next);
    chai.expect(res.code).to.equal(500);
    chai.expect(res.data).to.equal('Error in processing request');
    done();
  });

  it('test headers sent', (done) => {
    res.headersSent = true;
    errorHandler(new Error(), req, res, next);
    chai.expect(next.called).to.be.true;
    done();
  });
})
