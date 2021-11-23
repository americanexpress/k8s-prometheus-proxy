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
const sinon = require('sinon');

const errorHandler = require('../../error-handler/errorHandler');

describe('error-handler/errorHandler', function () {
  let req;
  let res;
  let next;

  beforeEach(function () {
    req = {
      params: {},
      body: {},
    };

    res = {
      data: null,
      code: null,
      status(status) {
        this.code = status;
        return this;
      },
      send(payload) {
        this.data = payload;
      },
      headersSent: false,
    };

    next = sinon.stub();
  });

  afterEach(function () {
    next.reset();
  });

  it('test error handler', function (done) {
    errorHandler(new Error(), req, res, next);
    chai.expect(res.code).to.equal(500);
    chai.expect(res.data).to.equal('Error in processing request');
    done();
  });

  it('test headers sent', function (done) {
    res.headersSent = true;
    errorHandler(new Error(), req, res, next);
    chai.expect(next.called).to.be.true;
    done();
  });
});
