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

const chai = require('chai');
const sinon = require('sinon');
const winston = require('winston');

const { logConfig } = require('../../config/app-settings').winston;
const tokenUtil = require('../../k8s/tokenUtil');

const logger = winston.createLogger(logConfig);

describe('k8s/tokenUtil', function () {
  it('test get token from properties', function () {
    const readFileStub = sinon.stub(fs, 'readFileSync').returns(Buffer.from('K8S_GLOBAL_TOKEN=mytoken11'));
    logger.debug('token utils testing calling deriveToken');
    const token = tokenUtil.deriveToken('path/to/token');
    logger.debug(`token utils testing got token ${token}`);
    chai.expect(token).to.equal('mytoken11');
    readFileStub.restore();
  });

  it('test get token raw', function () {
    const readFileStub = sinon.stub(fs, 'readFileSync').returns(Buffer.from('mytoken'));
    const token = tokenUtil.deriveToken('path/to/token');
    chai.expect(token).to.equal('mytoken');
    readFileStub.restore();
  });

  it('test null token', function () {
    const readFileStub = sinon.stub(fs, 'readFileSync').returns(null);
    const token = tokenUtil.deriveToken('path/to/token');
    chai.expect(token).to.be.empty;
    readFileStub.restore();
  });
});
