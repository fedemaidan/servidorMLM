var config      = require('../../config/database'); 
var UserML      = require('../models/userML'); // get the mongoose model
var jwt         = require('jwt-simple');

module.exports = async (token) => {
	var decoded = jwt.decode(token, config.secret);
    return await User.findOne( {username: decoded.name})
};