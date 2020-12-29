const assert = require('http-assert');
const dynazord = require('dynazord');
const isEmail = require('validator/lib/isEmail');

const users = dynazord.createModel({
  tableName: 'dynazord-test-users',
  keySchema: {
    hash: 'email',
  },
  properties: {
    email: {
      type: String,
      required: true,
      validate: {
        notNull: true,
        isEmail(value) {
          assert(isEmail(value), 400, new Error('Expected value to be an email address'), { value });
        },
      },
    },
    name: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      required: true,
      validate: {
        isValidContent(value) {
          const isValid = `${value}`.startsWith('https://') ||
            `${value}`.startsWith('data:image/jpg;base64,') || `${value}`.startsWith('data:image/jpeg;base64,') ||
              `${value}`.startsWith('data:image/png;base64,');
          assert(isValid, 400, new Error('Expected value to be a base64-string or URL'));
        },
      },
    },
    role: {
      type: String,
      enum: [ 'ADMIN', 'MODERATOR', 'EDITOR', 'USER' ],
    },
  },
  options: {
    createdAtTimestamp: true,
    updatedAtTimestamp: true,
  },
});

module.exports = users;
