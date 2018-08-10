const changeCase = require('change-case');
const operations = require('@steemit/steem-js/lib/broadcast/operations');
const cloneDeep = require('lodash/cloneDeep');
const get = require('lodash/get');
const has = require('lodash/has');
const hasIn = require('lodash/hasIn');
const set = require('lodash/set');
const operationAuthor = require('./operation-author.json');
const customOperations = require('./operations/custom-operations');
const helperOperations = require('./operations');

/** Parse error message from Steemd response */
const getErrorMessage = (error) => {
  let errorMessage = '';
  if (has(error, 'data.stack[0].format')) {
    errorMessage = error.data.stack[0].format;
    if (has(error, 'data.stack[0].data')) {
      const data = error.data.stack[0].data;
      Object.keys(data).forEach((d) => {
        errorMessage = errorMessage.split('${' + d + '}').join(data[d]); // eslint-disable-line prefer-template
      });
    }
  }
  return errorMessage;
};

const isOperationAuthor = (operation, query, username) => {
  if (Object.prototype.hasOwnProperty.call(operationAuthor, operation)) {
    const field = operationAuthor[operation];
    if (!field) { return false; }
    return get(query, field) === username;
  }
  return false;
};

const setDefaultAuthor = (operation, query, username) => {
  const cQuery = cloneDeep(query);
  if (Object.prototype.hasOwnProperty.call(operationAuthor, operation)) {
    const field = operationAuthor[operation];
    if (!field) { return cQuery; }
    if (!get(cQuery, field)) { set(cQuery, field, username); }
  }
  return cQuery;
};

const getOperation = (type) => {
  let ops = operations.find(op =>
    op.operation === changeCase.snakeCase(type)
  );
  if (ops) {
    return ops;
  }

  ops = customOperations.find(op =>
      op.operation === changeCase.snakeCase(type)
  );
  if (ops) {
    ops.roles = operations.find(op => op.operation === ops.type).roles;
    return ops;
  }

  return '';
};

const isValid = (op, params) => {
  let valid = false;
  if (op) {
    valid = true;
    op.params.forEach((param) => {
      if (params[param] === undefined) {
        valid = false;
      }
    });
  }
  return valid;
};

const parseQuery = (type, query, username) => {
  const snakeCaseType = changeCase.snakeCase(type);
  let cQuery = cloneDeep(query);
  cQuery = setDefaultAuthor(snakeCaseType, cQuery, username);

  if (hasIn(helperOperations, snakeCaseType)) {
    return helperOperations[snakeCaseType].parse(cQuery);
  }

  return cQuery;
};

const validateRequired = (type, query) => {
  const errors = [];
  let operation = operations.find(o => o.operation === type);
  if (!operation) {
    operation = customOperations.find(o => o.operation === type);
  }
  if (operation) {
    let authorField;
    let optionalFields = [];

    if (Object.prototype.hasOwnProperty.call(operationAuthor, type)) {
      authorField = operationAuthor[type];
    }

    if (hasIn(helperOperations, type) && helperOperations[type].optionalFields) {
      optionalFields = helperOperations[type].optionalFields;
    }

    operation.params.forEach((p) => {
      if (!optionalFields.includes(p) && !query[p] && (!authorField || p !== authorField)) {
        errors.push({ field: p, error: 'error_is_required', values: { field: p } });
      }
    });
  }

  return errors;
};

const validate = async (type, query) => {
  const snakeCaseType = changeCase.snakeCase(type);
  const errors = validateRequired(snakeCaseType, query);
  if (hasIn(helperOperations, snakeCaseType) && typeof helperOperations[snakeCaseType].validate === 'function') {
    await helperOperations[snakeCaseType].validate(query, errors);
  }
  return errors;
};

const normalize = async (type, query) => {
  const snakeCaseType = changeCase.snakeCase(type);
  if (hasIn(helperOperations, snakeCaseType) && typeof helperOperations[snakeCaseType].normalize === 'function') {
    return await helperOperations[snakeCaseType].normalize(query);
  }
  return query;
};

module.exports = {
  getErrorMessage,
  isOperationAuthor,
  setDefaultAuthor,
  getOperation,
  isValid,
  parseQuery,
  normalize,
  validate,
};
