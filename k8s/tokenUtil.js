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
const propertiesReader = require('properties-reader');
function deriveToken(tokenFile) {
  const fs = require('fs');
  const data = fs.readFileSync(tokenFile);
  if(data !== null) {
    if(!data.toString().startsWith("K8S_GLOBAL_TOKEN")) {
      return data.toString();
    }
    const properties = propertiesReader(tokenFile);
    return properties.get('K8S_GLOBAL_TOKEN');
  } else {
    return "";
  }


}

module.exports = {
  deriveToken,
};
