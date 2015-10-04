/**
 * @fileOverview
 * @name account.js
 * @author Ganioc Yang: <ganioc.yang@gamil.com>
 * @license MIT
 This is for account management and routeing
 */

// account, user must log in to see it
// account/user
// account/business
// account/pusher

/*
https://open.weixin.qq.com/connect/oauth2/authorize?appid=APPID
&redirect_uri=REDIRECT_URI&response_type=code&scope=SCOPE&state=STATE#wechat_redirect

get access_code
https://api.weixin.qq.com/sns/oauth2/access_token?appid=APPID&secret=SECRET&code=CODE&grant_type=authorization_code

https://api.weixin.qq.com/sns/userinfo?access_token=ACCESS_TOKEN&openid=OPENID&lang=zh_CN

*/
var config= require('./config');
var https = require('https');
var store = require('./store');
var db = store.db;
var CallbackFindOne = store.callbackFindOne;
var CallbackFind = store.callbackFind;
var CallbackUpdate = store.CallbackUpdate;

// get user games info
function get_user_games(req,res, callback){
  db.users.findOne(
    {openid:req.session.user.openid},
    { 'games.name':1},
    CallbackFindOne(function(doc){
      console.log('user games:');
      console.log(doc);
      var result = [];
      for(var i in doc.games){
	if(!( doc.games[i].name in result)){
	  result.push( doc.games[i].name );
	}
      }
      callback(result);
    })
  );
}
/**
 * fetch all games the user could have 
 * @param {} req
 * @param {} res
 * @throws {} 
 */
function get_games(req,res){

  get_user_games(req, res, function(userGames){
    console.log('usergames are:');
    console.log(userGames);

    //var games1 = userGames;//用户所拥有的游戏列表,游戏名称列表

    db.games.find(
      {},
      CallbackFind(function(doc){
	res.render(
      	  'account-user',
      	  {
      	    title: config.WEBSITE_NAME,
      	    path: config.PUBLIC_PATH,
      	    user:req.session.user,
      	    games:doc,
      	    user_games: userGames
      	  }
      	);
      })

    );
  });

}

/**
 * 读取用户信息
 * @param {} req1
 * @param {} res1
 * @param {} d, data
 * @throws {} 
 */
function get_user_info(req1,res1, d){
  console.log('into get user info');
  console.log(typeof d);
  var url = 'https://api.weixin.qq.com/sns/userinfo?';
  url += 'access_token=' + d.access_token;
  url += '&openid=' + d.openid;
  url += '&lang=zh_CN';
  
  https.get(url, function(res){
    res.on('data', function(d) {
      console.log('into guinfo https get');
      var fb = JSON.parse(d.toString());

      process.nextTick(function(){
	if(!('errcode' in fb)){
	  console.log('get user info');
	  req1.session.user = fb;

	  db.users.findOne(
	    { openid: fb.openid},
	    CallbackFindOne(
	      function(doc){
		res1.redirect('/account/user');
	      },
	      function(){
		// initialization for first time logged in user
		fb.games = [];
		fb.apps = [];

		db.users.update(
		  { openid: fb.openid},
		  { $set:fb },
		  { upsert:true},
		  CallbackUpdate(function(doc){
		    res1.redirect('/account/user');		    
		  }));
	      }
	    ));
	}// else tell user something is wrong
	else{
	  res1.send('nok user info');
	}
      });//process.nextTick
    });// res.on
  });// https
}

/**
 * 
 * @param {} req1
 * @param {} res1
 * @param {} code
 */
function get_access_code(req1,res1,code){
  console.log('into get access code');
  var url = 'https://api.weixin.qq.com/sns/oauth2/access_token?';
  url += 'appid=' + config.TEST_APPID;
  url += '&secret=' + config.TEST_SECRET;
  url += '&code=' + code;
  url += '&grant_type=authorization_code';

  https.get(url, function(res){
    res.on('data', function(d) {
      var fb = d.toString();
      console.log('Get access code:');
      console.log(fb);
      console.log(typeof fb);
      fb = JSON.parse(fb);
      console.log(typeof fb);

      process.nextTick(function(){
      	if('errcode' in fb){
      	  res1.send('nok access code:' + fb.errcode);
      	}// else tell user something is wrong
      	else{
      	  get_user_info(req1, res1,fb);
      	}
      });
    });
  });
}

/**
 * 
 * @param {} req
 * @param {} res
 */
function get_code(req,res){
  console.log('into get code');
  // 这里要访问https的网站，所以我在家里总是有问题
  // 另一方面，我每次都要去验证吗？
  // 原来的验证session好像不起作用
  var url = 'https://open.weixin.qq.com/connect/oauth2/authorize?';
  url += 'appid=' + config.TEST_APPID;
  url += '&redirect_uri=' + config.AUTH_URI;
  //encodeURIComponent(config.TEST_URI);
  url += '&response_type=code';
  url += '&scope=' + 'snsapi_userinfo';
  url += '&state=STATE';
  url += '#wechat_redirect';

  res.redirect(url);

}

module.exports = function(app){

  app.get('/auth',function(req,res){
    console.log('into /auth');
    console.log(req.query);

    if(req.query.code){
      //res.send('ok' + req.query.code);
      get_access_code(req,res,req.query.code);

    }else{
      res.send('nok');
    }
  });

  app.get('/account/user',function(req,res){
    // the user should be logged in
    console.log('into /account/user');

    if(!req.session.user){
      console.log('user dont have session:');
      console.log(req.session);
      get_code(req,res);
    }
    // 验证用户,生成本地用户信息记录,支持session
    else{
      console.log('into get_games()');
      get_games(req, res);
    }
  });

  app.get('/account/business',function(req,res){

    res.send('business account');
  });

  app.get('/account/pusher',function(req,res){

    res.send('pusher account');
  });

};
