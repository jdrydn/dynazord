const AWS = require('aws-sdk');
const { assert, createLogger, isPlainObject } = require('./utils');
const { assertValidProperties } = require('./helpers/validate');
const { createHooks } = require('./hooks');
const { keys: typeKeys } = require('./types');
const { methods, bulkMethods } = require('./methods');
const { operators } = require('./helpers/where');

const { name: PACKAGE_NAME } = require('../package.json');

const defaultOptions = {
  createdAtTimestamp: false,
  updatedAtTimestamp: false,
};

let overwriteDynamoDB = null;
let overwriteOptions = {};

function createModel(opts) {
  assert(isPlainObject(opts), new TypeError('Expected opts to be a plain object'));

  // Required
  const { tableName, keySchema, properties } = opts;
  assert(typeof tableName === 'string', new TypeError('Expected { tableName } to be a string'));
  assert(isPlainObject(properties), new TypeError('Expected { properties } to be a plain object'));
  assert(Object.keys(properties).length, new TypeError('Expected { properties } to have properties'));
  // Optional
  assert(!keySchema || isPlainObject(keySchema) || typeof keySchema === 'string',
    new TypeError('Expected { keySchema } to be a string or a plain object'));
  assert(!opts.hooks || isPlainObject(opts.hooks), new TypeError('Expected { hooks } to be a plain object'));
  assert(!opts.options || isPlainObject(opts.options), new TypeError('Expected { options } to be a plain object'));

  const options = {
    ...defaultOptions,
    ...overwriteOptions,
    ...opts.options,
  };

  try {
    const pickTimestampProps = ({ format }) => ({ format });

    if (options.createdAtTimestamp === true) {
      properties.createdAt = {
        type: Date,
        required: true,
        default: () => new Date(),
        onCreate: value => value || new Date(),
        ...pickTimestampProps(isPlainObject(properties.createdAt) ? properties.createdAt : {}),
      };
    }

    if (options.updatedAtTimestamp === true) {
      properties.updatedAt = {
        type: Date,
        required: true,
        default: () => new Date(),
        onCreate: value => value || new Date(),
        onUpdate: value => value || new Date(),
        onUpsert: value => value || new Date(),
        ...pickTimestampProps(isPlainObject(properties.updatedAt) ? properties.updatedAt : {}),
      };
    }

    assertValidProperties(properties);
  } catch (err) {
    err.message = `[${tableName}] ${err.message}`;
    throw err;
  }

  const { hash, range, ...keySchemaOpts } = isPlainObject(keySchema)
    ? (({ hash: h, range: r }) => ({ hash: h, range: r }))(keySchema)
    : { hash: (keySchema && typeof keySchema === 'string') ? keySchema : Object.keys(properties).shift() };
  assert(typeof hash === 'string', new TypeError('Expected keySchema hash property to be a string'));
  assert(properties[hash], new TypeError(`Expected ${hash} to be a property`));
  assert(properties[hash].required === true, new TypeError(`Expected ${hash} property to be required`));
  assert(!range || typeof range === 'string', new TypeError('Expected keySchema range property to be a string'));
  assert(!range || properties[range], new TypeError(`Expected ${range} to be a property`));
  assert(!range || properties[range].required === true, new TypeError(`Expected ${range} property to be required`));

  const hooks = createHooks(opts.hooks || {});

  return Object.create({ ...methods, ...bulkMethods }, {
    tableName: { enumerable: true, value: tableName },
    keySchema: { enumerable: true, value: Object.freeze({ hash, range, ...keySchemaOpts }) },
    properties: { enumerable: true, value: Object.freeze(opts.properties) },
    client: { value: validateDynamoDB(opts.dynamodb) || overwriteDynamoDB || new AWS.DynamoDB() },
    hooks: { enumerable: true, value: Object.freeze(hooks) },
    log: { value: opts.log || createLogger(opts.logLevel) },
    options: { enumerable: true, value: Object.freeze(options) },
  });
}

function validateDynamoDB(client) {
  if (isPlainObject(client)) {
    return new AWS.DynamoDB({ ...client });
  } else if (client) {
    assert(!(client instanceof AWS.DynamoDB.DocumentClient),
      new TypeError(`Sorry, ${PACKAGE_NAME} doesn't support AWS.DynamoDB.DocumentClient`));
    assert(client instanceof AWS.DynamoDB,
      new TypeError('Expected { dynamodb } to be an instance of AWS.DynamoDB'));
    return client;
  } else {
    return null;
  }
}

module.exports = {
  createModel,
  types: Object.freeze(typeKeys.reduce((r, t) => ({ ...r, [t]: t }), {})),
  operators: Object.freeze(operators),
  setDynamoDB: client => overwriteDynamoDB = validateDynamoDB(client),
  setOptions(overwrite) {
    assert(isPlainObject(overwrite), new TypeError('Expected argument to be a plain object'));
    overwriteOptions = overwrite;
  },
};
