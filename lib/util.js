module.exports = {
  timezone_offset: function(d){
    return Date(d.getTime() + 8*3600*1000);

  }


};
