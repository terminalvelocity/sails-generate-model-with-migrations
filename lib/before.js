/**
 * Module dependencies
 */

var util = require('util'),
  _ = require('lodash'),
  fs = require('fs'),
  path = require('path');

// Make _.defaults recursive
_.defaults = require('merge-defaults');
_.str = require('underscore.string');


// Fetch stub attribute template on initial load.
var ATTRIBUTE_TEMPLATE = path.resolve(__dirname, '../templates/attribute.template');
ATTRIBUTE_TEMPLATE = fs.readFileSync(ATTRIBUTE_TEMPLATE, 'utf8');

var SCHEMA_TEMPLATE = path.resolve(__dirname, '../templates/schema.template');
SCHEMA_TEMPLATE = fs.readFileSync(SCHEMA_TEMPLATE, 'utf8');

var padDate = function(segment) {
  segment = segment.toString();
  return segment[1] ? segment : '0' + segment;
};

// Get a date object in the correct format, without requiring
// a full out library like "moment.js".
var yyyymmddhhmmss = function() {
  var d = new Date();
  return d.getFullYear().toString() +
      padDate(d.getMonth() + 1) +
      padDate(d.getDate()) +
      padDate(d.getHours()) +
      padDate(d.getMinutes()) +
      padDate(d.getSeconds());
};


/**
 * This `before` function is run before generating targets.
 * Validate, configure defaults, get extra dependencies, etc.
 *
 * @param  {Object} scope
 * @param  {Function} cb    [callback]
 */

module.exports = function(scope, cb) {

  // Make sure we're in the root of a Sails project.
  var pathToPackageJSON = path.resolve(scope.rootPath, 'package.json');
  var package, invalidPackageJSON;
  try {
    package = require(pathToPackageJSON);
  } catch (e) {
    invalidPackageJSON = true;
  }

  if (invalidPackageJSON) {
    return cb.invalid('Sorry, this command can only be used in the root directory of a Sails project.');
  }

  // scope.args are the raw command line arguments.
  //
  // e.g. if you run:
  // sails generate controlller user find create update
  // then:
  // scope.args = ['user', 'find', 'create', 'update']
  //
  _.defaults(scope, {
    id: _.str.capitalize(scope.args[0]),
    tableName: scope.args[0],
    migrationFilename: yyyymmddhhmmss() + "_" + scope.args[0] + ".js",
    attributes: scope.args.slice(1)
  });

  if (!scope.rootPath) {
    return cb.invalid('Usage: sails generate model <modelname> [attribute|attribute:type ...]');
  }
  if (!scope.id) {
    return cb.invalid('Usage: sails generate model <modelname> [attribute|attribute:type ...]');
  }


  // Validate optional attribute arguments
  var attributes = scope.attributes;
  var invalidAttributes = [];
  attributes = _.map(attributes, function(attribute, i) {

    var parts = attribute.split(':');

    if (parts[1] === undefined) parts[1] = 'string';

    // Handle invalidAttributes
    if (!parts[1] || !parts[0]) {
      invalidAttributes.push(
        'Invalid attribute notation:   "' + attribute + '"');
      return;
    }
    return {
      name: parts[0],
      type: parts[1]
    };

  });

  // Handle invalid action arguments
  // Send back invalidActions
  if (invalidAttributes.length) {
    return cb.invalid(invalidAttributes);
  }

  // Make sure there aren't duplicates
  if (_.uniq(_.pluck(attributes, 'name')).length !== attributes.length) {
    return cb.invalid('Duplicate attributes not allowed!');
  }

  //
  // Determine default values based on the
  // available scope.
  //
  _.defaults(scope, {
    globalID: _.str.capitalize(scope.id),
    ext: (scope.coffee) ? '.coffee' : '.js',
    attributes: []
  });

  // Take another pass to take advantage of
  // the defaults absorbed in previous passes.
  _.defaults(scope, {
    rootPath: scope.rootPath,
    filename: scope.globalID + scope.ext,
    lang: scope.coffee ? 'coffee' : 'js',
    destDir: 'api/models/'
  });



  //
  // Transforms
  //

  // Due to changes in lodash this should be updated aswell
  var compiledTemplate = _.template(ATTRIBUTE_TEMPLATE);
  var compiledSchemaTemplate = _.template(SCHEMA_TEMPLATE);

  // Render some stringified code from the action template
  // and make it available in our scope for use later on.
  scope.attributes = _.map(attributes, function(attribute) {

    return _.str.rtrim(
      _.unescape(
        compiledTemplate({
          name: attribute.name,
          type: attribute.type,
          lang: scope.coffee ? 'coffee' : 'js'
        })
      )
    );
  }).join((scope.coffee) ? '\n' : ',\n');

  scope.schema = _.map(attributes, function(attribute) {

    return _.str.rtrim(
      _.unescape(
        compiledSchemaTemplate({
          name: attribute.name,
          type: attribute.type,
          lang: scope.coffee ? 'coffee' : 'js'
        })
      )
    );
  }).join('\n');


  // Trigger callback with no error to proceed.
  return cb.success();
};
