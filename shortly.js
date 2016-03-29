var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var genuuid = require('./app/genuuid');
var FileStore = require('session-file-store')(session);

// Move out once we modularize 
var bcrypt = require('bcrypt-nodejs');


var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


//adding cookies and sessions for authentication
app.use(cookieParser('shhhh, very secret'));

app.use(session({
  genid: function(req) {
    return genuuid(); // use UUIDs for session IDs
  },
  resave: false,
  saveUninitialized: true,
  secret: 'tacocat',
  store: new FileStore(),
  cookie: { maxAge: (1000 * 60) }
}));


/* Debugging to check the session value */
app.use(function printSession(req, res, next) {
  console.log('req.session = ', req.session);
  return next();
});
 
 
var checkuser = function (req, res, next) {

  // TODO: do we need to read in cookie and verify it hasn't expired
  // or look at using session-cookie instead of using store
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
};
//end cookies and session

app.get('/login', 
function(req, res) {
  res.render('login');
});


app.post('/login', 
function(req, res) {

  var username = req.body.username;
  var password = req.body.password;

  // retrieve user name
  db.knex('users')
      .where('username', '=', username)
      .then(function(users) {
        if (users.length === 0) {
          // user does not exist, redirect to login again
          // TODO: error return for incorrect user name
          res.redirect('/login');
        } else {     // if the user exists
          // retrieve the salt and the hashed password
          var hashword = users[0]['password'];
          var salt = users[0]['salt'];

          // hash the passed in password/salt combo
          var hash = bcrypt.hashSync(password, salt);
      
          // compare the resulting hash with the hashed password
          if (hash === hashword) { // if they are equal
            // create new session id
            // redirect to home page
            req.session.regenerate(function() {
              req.session.user = username;
              res.redirect('/');
            });


          } else { // if not equal
            res.redirect('/login');
            // redirect to login page  (TODO: add error)
          }

        }
      });

});

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.post('/signup', 
function(req, res) {
  // get login and user
  var username = req.body.username;
  var password = req.body.password;  

  // check if this user is already in the database
  db.knex('users')
      .where('username', '=', username)
      .then(function(user) {
        // if it is, it fails (TODO: add error)
        if (user.length > 0) {
          res.redirect('signup');
        } else {
          // user does not exist, create them
          new User({
            'username': username,
            'password': password
          }).save()
          .then(function() {
            req.session.regenerate(function() {
              req.session.user = username;
              res.redirect('/');
            });
          });
        }
      }).
      catch(function(err) {
        console.log('inside ERROR for get user: ' + err);

      });
});

app.get('/', checkuser, 
function(req, res) {
  res.render('index');
});

app.get('/create', checkuser, 
function(req, res) {
  res.render('index');
});

app.get('/links', checkuser, 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', checkuser, 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

 
app.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/');
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
