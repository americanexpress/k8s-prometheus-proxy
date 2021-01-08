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

const app = require('../../labels/podlabels.js');
const chai = require('chai');
const os = require('os');

describe('test labels', () => {
  beforeEach(() => {

  });

  afterEach(() => {

  });

  it('test label addition', () => {
    const metricsArray = [
      'nginx_http_connections{state="reading"} 0',
      'nginx_http_connections{state="waiting"} 21',
      'nginx_metric_errors_total 0',
    ];
    const metricsResponseStr = app.metricsWithPodLabels(metricsArray, 'podname="mypod1",podip="1.1.1.1"');
    const metricsResponse = metricsResponseStr.split(os.EOL);
    logger.debug(metricsResponse);
    chai.expect(metricsResponse[0]).to.equal('nginx_http_connections{podname="mypod1",podip="1.1.1.1",state="reading"} 0');
    chai.expect(metricsResponse[1]).to.equal('nginx_http_connections{podname="mypod1",podip="1.1.1.1",state="waiting"} 21');
    chai.expect(metricsResponse[2]).to.equal('nginx_metric_errors_total{podname="mypod1",podip="1.1.1.1"} 0');
  });

  it('test empty array for label addition', () => {
    const metricsArray = [];
    const metricsResponseStr = app.metricsWithPodLabels(metricsArray, 'podname="mypod1",podip="1.1.1.1"');
    logger.debug(metricsResponseStr);
    chai.expect(metricsResponseStr).to.equal('');
  });

  it('test single metric', () => {
    const metricsArray = [
      'nginx_http_connections{state="reading"} 0',
    ];
    const metricsResponseStr = app.metricsWithPodLabels(metricsArray, 'podname="mypod1",podip="1.1.1.1"');
    const metricsResponse = metricsResponseStr.split(os.EOL);
    logger.debug(metricsResponse);
    chai.expect(metricsResponse[0]).to.equal('nginx_http_connections{podname="mypod1",podip="1.1.1.1",state="reading"} 0');
  });

  it('test only comment', () => {
    const metricsArray = [
      '# my comment',
    ];
    const metricsResponseStr = app.metricsWithPodLabels(metricsArray, 'podname="mypod1",podip="1.1.1.1"');
    const metricsResponse = metricsResponseStr.split(os.EOL);
    logger.debug(metricsResponse);
    chai.expect(metricsResponse[0]).to.equal('# my comment');
  });


  it('test comment and metric', () => {
    const metricsArray = [
      '# my comment',
      'nginx_http_connections{state="reading"} 0',
      'nginx_http_connections{state="waiting"} 21',
      'nginx_metric_errors_total 0',
    ];
    const metricsResponseStr = app.metricsWithPodLabels(metricsArray, 'podname="mypod1",podip="1.1.1.1"');
    const metricsResponse = metricsResponseStr.split(os.EOL);
    logger.debug(metricsResponse);
    chai.expect(metricsResponse[0]).to.equal('# my comment');
    chai.expect(metricsResponse[1]).to.equal('nginx_http_connections{podname="mypod1",podip="1.1.1.1",state="reading"} 0');
    chai.expect(metricsResponse[2]).to.equal('nginx_http_connections{podname="mypod1",podip="1.1.1.1",state="waiting"} 21');
    chai.expect(metricsResponse[3]).to.equal('nginx_metric_errors_total{podname="mypod1",podip="1.1.1.1"} 0');
  });


  it('test comment in between metrics', () => {
    const metricsArray = [
      '# my comment',
      'nginx_http_connections{state="reading"} 0',
      'nginx_http_connections{state="waiting"} 21',
      'nginx_metric_errors_total 0',
      '# another comment',
      'nginx_http_response_2xx_count 21',
      'nginx_metric_response_5xx_count 0',
    ];
    const metricsResponseStr = app.metricsWithPodLabels(metricsArray, 'podname="mypod1",podip="1.1.1.1"');
    const metricsResponse = metricsResponseStr.split(os.EOL);
    logger.debug(metricsResponse);
    chai.expect(metricsResponse[0]).to.equal('# my comment');
    chai.expect(metricsResponse[1]).to.equal('nginx_http_connections{podname="mypod1",podip="1.1.1.1",state="reading"} 0');
    chai.expect(metricsResponse[2]).to.equal('nginx_http_connections{podname="mypod1",podip="1.1.1.1",state="waiting"} 21');
    chai.expect(metricsResponse[3]).to.equal('nginx_metric_errors_total{podname="mypod1",podip="1.1.1.1"} 0');
    chai.expect(metricsResponse[4]).to.equal('# another comment');
    chai.expect(metricsResponse[5]).to.equal('nginx_http_response_2xx_count{podname="mypod1",podip="1.1.1.1"} 21');
    chai.expect(metricsResponse[6]).to.equal('nginx_metric_response_5xx_count{podname="mypod1",podip="1.1.1.1"} 0');
  });


  it('test metrics with timestamp', () => {
    const metricsArray = [
      '# my comment',
      'http_requests_total{method="post",code="200"} 1027 1395066363010',
      'nginx_http_connections{state="waiting"} 21 1395066363010',
      'nginx_metric_errors_total 0',
      '# another comment',
      'nginx_http_response_2xx_count 21',
      'nginx_metric_response_5xx_count 0 1395066363010',
    ];
    const metricsResponseStr = app.metricsWithPodLabels(metricsArray, 'podname="mypod1",podip="1.1.1.1"');
    const metricsResponse = metricsResponseStr.split(os.EOL);
    logger.debug(metricsResponse);
    chai.expect(metricsResponse[0]).to.equal('# my comment');
    chai.expect(metricsResponse[1]).to.equal('http_requests_total{podname="mypod1",podip="1.1.1.1",method="post",code="200"} 1027 1395066363010');
    chai.expect(metricsResponse[2]).to.equal('nginx_http_connections{podname="mypod1",podip="1.1.1.1",state="waiting"} 21 1395066363010');
    chai.expect(metricsResponse[3]).to.equal('nginx_metric_errors_total{podname="mypod1",podip="1.1.1.1"} 0');
    chai.expect(metricsResponse[4]).to.equal('# another comment');
    chai.expect(metricsResponse[5]).to.equal('nginx_http_response_2xx_count{podname="mypod1",podip="1.1.1.1"} 21');
    chai.expect(metricsResponse[6]).to.equal('nginx_metric_response_5xx_count{podname="mypod1",podip="1.1.1.1"} 0 1395066363010');
  });
});
