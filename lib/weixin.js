var config = require('./config');
var https = require('https');
var db = require('./store').db;
var crypto = require('crypto');
//var shasum = crypto.createHash('sha1');

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
      function(err,doc){
	if(err) throw err;
	console.log(doc);

	if(doc.nModified !== 0){
	  console.log('access code saved');
	  callback();
	}
	else{
	  console.log('Cant save access code');
	}
      });
  }
  function save_jsapi_ticket(ticket, expires, callback){
    db.codes.update(
      {},
      {$set:{jsapi_ticket:ticket, jsapi_expires_in:expires}},

      function(err,doc){
	if(err) throw err;
	console.log('save jsapi feedback');
	console.log(doc);
	
	console.log('the jsapi ticket won change a lot. so.');
	callback();
	// if(doc.nModified !== 0){
	//   callback();
	// }
	// else{
	//   console.log('Cant save jsapi ticket');
	// }
      });
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
      function(err,doc){
	if(err) throw err;
	if(doc){
	  console.log('read access code, jsapi:');
	  console.log(doc);
	  callback(doc);
	}
	else{
	  console.log('cant reade access code, jsapi ticket');
	}
      }
    );
  }
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
  function  access_code(){
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
	    setTimeout(access_code, 5000);
	  }
	  else{
	    var code = fb.access_token;
	    var expire = fb.expires_in; // in seconds
	    
	    //console.log(code);
	    //console.log(expire);

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
	    setTimeout(access_code, (parseInt(expire) - 30) * 1000);

	  }
	});


      });
  }

  return{
    get_access_code: access_code,
    get_jsapi_ticket: fetch_jsapi_ticket
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
  }
  
};

