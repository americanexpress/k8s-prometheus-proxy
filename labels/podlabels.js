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

function metricsWithPodLabels(metricsArray, labelStr) {
  let metricsResponseString = "";
  let counter = 0;
  if (metricsArray.length > 0) {
    metricsArray.forEach((str) => {
      counter += 1;
      let strToPush = str;
      if (!str.startsWith('#')) {
        let idx = str.indexOf('{');
        if (idx > 0) {
          strToPush = `${str.slice(0, idx + 1)}${labelStr},${str.slice(idx + 1)}`;
        } else {
          idx = str.indexOf(' ');
          if (idx > 0) {
            strToPush = `${str.slice(0, idx)}{${labelStr}}${str.slice(idx)}`;
          }
        }
      }
      if (counter === metricsArray.length) {
        metricsResponseString = `${metricsResponseString}${strToPush}`;
      } else {
        metricsResponseString = `${metricsResponseString}${strToPush}\n`;
      }
    });
  }
  return metricsResponseString;
}

module.exports = {
  metricsWithPodLabels,
};
