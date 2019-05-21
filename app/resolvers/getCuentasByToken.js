var config      = require('../../config/database'); 
var UserML      = require('../models/userML'); 
var jwt         = require('jwt-simple');

module.exports = async (token) => {
	var decoded = jwt.decode(token, config.secret);
    return await UserML.find( {username: decoded.name})
};