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
const whitelistUtil = require('../../../metrics/whitelistUtil');

describe('whitelist tests', function () {
  it('test namespace', function () {
    chai.expect(whitelistUtil.isValidNamespaceName('01010')).to.be.true;
    chai.expect(whitelistUtil.isValidNamespaceName('abc')).to.be.true;
    chai.expect(whitelistUtil.isValidNamespaceName('ABC')).to.be.false;
    chai.expect(whitelistUtil.isValidNamespaceName('-abc')).to.be.false;
    chai.expect(whitelistUtil.isValidNamespaceName('abc-')).to.be.false;
    chai.expect(whitelistUtil.isValidNamespaceName('-abc-')).to.be.false;
    chai.expect(whitelistUtil.isValidNamespaceName('../../../api/v1/')).to.be.false;
    chai.expect(whitelistUtil.isValidNamespaceName('abc-aa')).to.be.true;
    chai.expect(whitelistUtil.isValidNamespaceName('abcdefghijklmnopqrstuvwxyz1234567890-abcdefghijklmnopqrstuvwxyz')).to.be.true;
    chai.expect(whitelistUtil.isValidNamespaceName('abcdefghijklmnopqrstuvwxyz1234567890-abcdefghijklmnopqrstuvwxyz-aa')).to.be.false;
  });
});
