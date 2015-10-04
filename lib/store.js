/**
 * @fileOverview
 * @name store.js
 * @author Ganioc Yang: <ganioc.yang@gamil.com>
 * @license MIT
 This is the file for database(mongodb) initialization.

 */
var DB_NAME = 'weixin2015';
var SESSION_SECRET = 'foo123456789';
var mongojs = require('mongojs');


// You must add all below collections manually, otherwise it can't be visited
var collections = ['users','games','codes'];

var db = mongojs(DB_NAME, collections);

// for session
var expressSession = require('express-session');

// only for session storage
var MongoStore = require('connect-mongo')(expressSession);

var optionsMongo = {
  db: DB_NAME,
  host: '127.0.0.1',
  port: 27017,
  ttl: 7 * 24 * 60 * 60// 1 day time expire
};

db.on('error', function (err) {
    console.log(DB_NAME + 'database error', err);
});

db.on('ready', function () {
    console.log(DB_NAME+ ' database connected');
});



module.exports= {

  /**
   * 
   * @param {} app
   
   */
  init: function(app)
  {
    app.use( expressSession(
      {
	secret: SESSION_SECRET,
	store: new MongoStore(optionsMongo),
	proxy: true,
	resave: true,
	saveUninitialized: true
      }
    ));
  },
  // db is the handler for database read/write
  db:db,

  callbackUpdate:function(callback){
    
    return function(err, doc){
      if(err){
	console.log('db update failure, serious!');
	throw err;
      }
      if(doc.nModified !== 0){
	console.log('db update succeed');
	callback(doc);
      }
      else{
	console.log('db update fail, nothing updated.');
      }
    };
  },
  callbackFindOne:function(callback,callbackFail){
    return function(err,doc){
      if(err){
	console.log('db FindOne failed, serious err!');
	throw err;
      }
      if(doc){
	callback(doc);
      }else{
	console.log('Cant findone doc!');
	callbackFail();
      }
    };
  },
  callbackFind: function(callback){
    return function(err,doc){
      if(err){
	console.log('db Find failed, serious err!');
	throw err;
      }
      if(doc){
	callback(doc);
      }else{
	console.log('Cant find doc!');
      }
    };

  }
 };
