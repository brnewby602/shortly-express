var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');



var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  links: function() {
    return this.hasMany(Link);
  },
  initialize: function() {
    console.log('initializing users table');
    /* use bcrypt to generate password hash something like: */

    this.on('creating', function(model, attrs, options) {

      console.log('inside creating for user');

      var pass = model.get('password');

      var salt = bcrypt.genSaltSync(10);
      var hash = bcrypt.hashSync(pass, salt);

      model.set('password', hash);
      model.set('salt', salt);

      console.log('salt = ' + salt);
      console.log('hash = ' + hash);
    });

    
  }
});

module.exports = User;