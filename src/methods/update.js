const { assert, isPlainObject, marshall, unmarshall } = require('../utils');
const { assertRequiredUpdateProps, formatUpdateData, stringifyUpdateStatement } = require('../helpers/update');
const { formatReadData } = require('../helpers/read');
const { validateData } = require('../helpers/validate');

module.exports = async function updateDocument(update, where) {
  const { client, tableName, keySchema, properties, log } = this;
  assert(client && typeof client.updateItem === 'function', new TypeError('Expected client to be a DynamoDB client'));
  assert(typeof tableName === 'string', new TypeError('Invalid tableName to be a string'));
  assert(isPlainObject(keySchema), new TypeError('Expected keySchema to be a plain object'));
  assert(isPlainObject(properties), new TypeError('Expected properties to be a plain object'));

  assert(isPlainObject(update), new TypeError('Expected update to be a plain object'));
  assert(isPlainObject(where), new TypeError('Expected where to be a plain object'));

  const { hash, range } = keySchema;
  assert(where.hasOwnProperty(hash), new Error(`Missing ${hash} hash property from where`));
  assert(!range || where.hasOwnProperty(range), new Error(`Missing ${range} range property from where`));

  await assertRequiredUpdateProps.call(this, update);
  await validateData.call(this, properties, update);
  await formatUpdateData.call(this, properties, update);

  const { expression, names, values } = stringifyUpdateStatement.call(this, update) || {};
  assert(typeof expression === 'string', new TypeError('Expected update expression to be a string'));
  assert(isPlainObject(names), new TypeError('Expected update names to be a plain object'));
  assert(isPlainObject(values), new TypeError('Expected update values to be a plain object'));

  const params = {
    TableName: tableName,
    Key: marshall(where),
    UpdateExpression: expression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: marshall(values),
    ReturnValues: 'ALL_NEW', // Return all the attributes
  };

  log.debug({ updateItem: params });
  const result = await client.updateItem(params).promise();
  log.debug({ updateItem: result });

  const item = result && isPlainObject(result.Attributes) ? unmarshall(result.Attributes) : null;

  assert(item, new Error('Document not found'), {
    code: 'DOCUMENT_NOT_FOUND',
    key: JSON.stringify(where),
  });

  formatReadData(properties, item);

  return item;
};
