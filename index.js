/*
 * Copyright (c) 2024, Rajdeep Malakar
 * All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import edn from "jsedn";
import { readFile, access, constants } from "node:fs/promises";

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true; // File or directory exists
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false; // File or directory does not exist
    } else {
      throw err; // Other error (permission denied, etc.)
    }
  }
}

function formatRecursive(key, isKey = true) {
  if (typeof key === 'string' && isKey) {
    return key.replace(":", "");
  } else if (Array.isArray(key)) {
    return key.map(item => formatRecursive(item, isKey));
  } else if (typeof key === 'object' && key !== null) {
    const newObj = {};
    Object.keys(key).forEach(k => {
      const formattedKey = formatRecursive(k, true);
      const formattedValue = formatRecursive(key[k], false); // Pass false for values
      newObj[formattedKey] = formattedValue;
    });
    return newObj;
  }
  return key;
}

export class Config {
  constructor(path) {
    this.path = path;
    this.config = null;
    this.env = {};
  }

  async load() {
    if (await exists(this.path)) {
      const fileContent = await readFile(this.path, 'utf8');
      this.config = edn.toJS(edn.parse(fileContent));
      this.formatKeys(this.config);
      this.setEnvVars(this.config);
    } else {
      throw new Error(`Config file ${this.path} does not exist.`);
    }
  }

  formatKeys(obj) {
    this.config = formatRecursive(obj);
  }

  setEnvVars(configObject, prefix = "") {
    for (const key in configObject) {
      const formattedKey = (prefix + key).toUpperCase();
      const value = configObject[key];

      if (typeof value === 'object' && !Array.isArray(value)) {
        this.setEnvVars(value, `${formattedKey}_`);
      } else {
        const formattedValue = Array.isArray(value) ? value.join(",") : (typeof value === 'boolean' ? (value ? 1 : 0) : value);
        this.env[formattedKey] = formattedValue;
      }
    }
  }

  injectEnv() {
    for (const key in this.env) {
      process.env[key] = this.env[key];
    }
  }

  asObject() {
    return this.config;
  }
}
