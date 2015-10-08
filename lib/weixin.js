/**
 * @fileOverview
 * @name weixin.js
 * @author Ganioc Yang: <ganioc.yang@gamil.com>
 * @license MIT
 For weixin server communications

 */
var config = require('./config');
var https = require('https');
var store = require('./store');
var db = store.db;
var CallbackUpdate = store.callbackUpdate; // db update callback function template
var CallbackFindOne = store.callbackFindOne;
// crypto is for secret generation algorithms
var crypto = require('crypto');

/*
https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=APPID&secret=APPSECRET
https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=ACCESS_TOKEN&type=jsapi
*/

function validate(req, res){
  console.log('into validation');
  if(req.query.echostr){
    res.send(req.query.echostr);
  }
}

/**
 * 
 * @param {} AccessCode
 * @throws {} 
 This object is used for access code fetch , JSAPI ticket fetch.
 

 */
var access = (function AccessCode(){
  //还是把它存在数据库里面比较好
  var timeStamp = -1;
  var MAX_TIME_DELTA = 7200;
  var ACCESS_URL = 'https://api.weixin.qq.com/cgi-bin/token?';
  var JSAPI_URL = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket?';

  function save_access_code(code, expires,callback){
    console.log('into save access code');

    db.codes.update(
      {},
      {$set:{access_code:code, expires_in:expires, date:new Date()}
      },
      {upsert:true},
      CallbackUpdate(function(doc){
	callback();
      })

    );
  }
  function save_jsapi_ticket(ticket, expires, callback){
    db.codes.update(
      {},
      {$set:{jsapi_ticket:ticket, jsapi_date: new Date()}
      },
      {upsert:true},
      CallbackUpdate(function(doc){
	// I can print doc here, very convenient
	callback();
      })

      );
  }
  function fetch_access_code(callback){
    fetch_access_code_jsapi(function(doc){
      callback(doc.access_code);
    });
  }
  function fetch_jsapi_ticket(callback){
    fetch_access_code_jsapi(function(doc){
      callback(doc.jsapi_ticket);
    });
  }
  function fetch_access_code_jsapi(callback){
    db.codes.findOne(
      {},
      CallbackFindOne(function(doc){
	callback(doc);
      })
    );
  }
  // to get jsapi ticket
  function jsapi_ticket(access_code, callback){
    var url = JSAPI_URL;
    url += ('access_token=' + access_code);
    url += '&type=jsapi';

    https.get(url,function(res){
      res.on('data',function(d){
	var fb = JSON.parse(d.toString());
	if(fb.errcode === 0){
	  var code = fb.ticket;
	  var expire = fb.expires_in;
	  console.log('jsapi_ticket;');
	  console.log(code);
	  save_jsapi_ticket(code, expire,function(){
	    callback();
	  });
	}
	else{
	  console.log('cant get jsapi ticket');	  
	}
      });
    });
  }
  /**
   * 在调试时，每次重启服务器，不会每次都去查询微信服务器，
   只有时间够长，才回去查一次。
   */
  function access_code(){
    console.log('Time to get access code');
    db.codes.findOne(
      {},
      CallbackFindOne(
	// find a valid access code
	function(doc){
	  var oldDate = doc.date.getTime();
	  var curDate = new Date();
	  curDate = curDate.getTime();
	  console.log('oldDate is:' + oldDate);
	  console.log('curDate is:' + curDate);
	  // if it's long enough since last time
	  if( (curDate - oldDate) > (7200 -60)*1000){
	    get_new_access_code();
	  }// if it's not that long time
	  else{
	    console.log('there is a lot of time');
	    setTimeout(access_code, (7200 - 60) * 1000 - (curDate - oldDate));
	    return;
	  }
	},
	function(){
	  get_new_access_code();
	})
    );
  }
  // To get weixin access_code , update it every 2 hours
  function  get_new_access_code(){

    var url = ACCESS_URL + 'grant_type=client_credential';
    url += ('&appid=' + config.TEST_APPID);
    url += ('&secret=' + config.TEST_SECRET);
    
    console.log('Get access Code timer:' + new Date());

    https.get(url, function(res){
      res.on('data',function(d){
	var fb = JSON.parse(d.toString());
	console.log('get access token:');
	console.log(fb);

	if('errcode' in fb){
	  console.log('Can\"t get access code!');
	  console.log('无法获取access code');
	  //setTimeout(access_code, 5000);
	}
	else{
	  var code = fb.access_token;
	  var expire = fb.expires_in; // in seconds

	  // save it into db
	  save_access_code(code,expire,function(){
	    // get jsapi_ticket
	    jsapi_ticket(code,function(){
	      console.log('end of jsapi_ticket');
	    });
	  });
	  console.log('timeout is:');
	  //var timeout = (parseInt(expire) - 30) * 1000;
	  //console.log(timeout);
	  // run get access code after some time
	  // 真的会被运行嘛？
	  setTimeout(access_code, (parseInt(expire) - 30) * 1000);
	  
	}
      });
    });
  }
  function query_user_info( req1, res1, d, uri){
    console.log('into query user info');
    console.log('uri is:' + uri);

    var url = 'https://api.weixin.qq.com/sns/userinfo?';
    url += 'access_token=' + d.access_token;
    url += '&openid=' + d.openid;
    url += '&lang=zh_CN';
    
    https.get(url, function(res){
      res.on('data', function(d) {
	console.log('into user info https get');
	var fb = JSON.parse(d.toString());
	console.log('User info:');
	console.log(fb);

	process.nextTick(function(){
	  if(!('errcode' in fb)){
	    console.log('query user info');
	    req1.session.user = fb;

	    db.users.findOne(
	      { openid: fb.openid},
	      CallbackFindOne(
		function(doc){
		  res1.redirect(uri);
		},
		function(){
		  // initialization for first time logged in user
		  fb.games = [];
		  fb.apps = [];
		  console.log(fb);

		  db.users.update(
		    { openid: fb.openid},
		    { $set:fb },
		    { upsert:true},
		    CallbackUpdate(
		      function(doc){
			console.log(doc);
			res1.redirect(uri);		    
		      },
		      function(){
			res1.redirect('/');
		      }
		    ));
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
  function query_access_code(req1,res1,code,uri){
    console.log('into query access code');
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
      	    query_user_info(req1, res1,fb, uri );
      	  }
	});
      });
    });

  }

  return{
    get_access_code:  access_code,
    get_jsapi_ticket: fetch_jsapi_ticket,

    // fallback uri of 
    login_user: function(req,res, uri){
      if(req.query.code){
	//res.send('ok' + req.query.code);
	query_access_code(req,res,req.query.code, uri);
	
      }else{
	res.send('nok');
      }
      
    }
  };
})();

/*

即signature=sha1(string1)。 示例：

noncestr=Wm3WZYTPz0wzccnW
jsapi_ticket=sM4AOVdWfPE4DxkXGEs8VMCPGGVi4C3VM0P37wVUCFvkVAy_90u5h9nbSlYy3-Sl-HhTdfl2fzFy1AOcHKP7qg
timestamp=1414587457
url=http://mp.weixin.qq.com?params=value

*/
module.exports= {

  init:function(app){
    app.get('/message', function(req, res){
      console.log(req.query);
      //res.send(req.query.echostr);
      validate(req, res);
    });

    app.post('/message', function(req, res){
      console.log(req.body);
      res.send('');
    });

    // 记录用户数据，然后把用户重新返回uriBack
    // 如何将参数传进来呢？
    app.get('/message/auth/:name/:subname',function(req,res){
      console.log('into user auth, print query,uri:');
      console.log(req.query);
      var uriBack = '/' + req.params.name + '/' + req.params.subname;
      console.log(uriBack);
      access.login_user(req,res,uriBack);
    });

    // this is for js sdk config, in ajax
    app.post('/message/signature',function(req,res){
      console.log('in message signature');

      var data = req.body;
      console.log('show data:');
      console.log(data);
      var nonceStr = data.nonceStr;
      var appId = config.TEST_APPID;
      var timestamp = data.timestamp;
      var url = data.url;
      
      access.get_jsapi_ticket(function(ticket){
	console.log('jsapi ticket is:');
	console.log(ticket);

	var temp = 'jsapi_ticket=' + ticket;
	temp += ('&noncestr=' +  nonceStr);
	temp += ( '&timestamp=' + timestamp);
	temp += ( '&url=' + url);

	console.log('before signature');
	console.log(temp);

	var signature = crypto.createHash('sha1').update(temp,'ascii').digest('hex');
	var result = {};
	result.appId = appId;
	result.signature = signature;
	console.log('result:');
	console.log(result);
	
	res.json(result);
      });
    });
  },
  //get access token after 7200 second
  update_token:function(){
    setTimeout(access.get_access_code,1000);
  },

  form_template:function (opt){
    var obj = {};
    obj.title = config.WEBSITE_NAME;
    obj.path = config.PUBLIC_PATH;
    
    for(var key in opt){
      obj[key] = opt[key];
    }
    
    return obj;
  },
  
  oauth2_login:function( req, res, urlFallback){
    console.log('into get oauth2 login');
    console.log(urlFallback);

    // 这里要访问https的网站，所以我在家里总是有问题,更换了家里的光网网关后，问题消失了
    // 另一方面，我每次都要去验证吗？
    // 原来的验证session好像不起作用
    var url = 'https://open.weixin.qq.com/connect/oauth2/authorize?';
    url += 'appid=' + config.TEST_APPID;
    url += '&redirect_uri=' + config.ROOT_URI + urlFallback;
    //encodeURIComponent(config.TEST_URI);
    url += '&response_type=code';
    url += '&scope=' + 'snsapi_userinfo';
    url += '&state=STATE';
    url += '#wechat_redirect';
    
    res.redirect(url);
  }


};

