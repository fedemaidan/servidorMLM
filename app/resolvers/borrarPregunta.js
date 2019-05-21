var Pregunta    = require('../models/pregunta');
var UserML      = require('../models/userML'); 
var meli = require('mercadolibre');
var client      = require('../../config/mlClient'); 
var client_id = client.id;
var client_secret = client.secret;
var meliObject = new meli.Meli(client_id, client_secret);


module.exports = async (username, question_id, resOriginal) => {
    var pregunta = await Pregunta.findOne({ question_id: question_id, username: username })
    var cuenta = await UserML.findOne({id_ml: pregunta.seller_id, username: username })
    meliObject.delete('questions/'+question_id+'?access_token='+cuenta.token,async (req, res) => {
      console.log(res)
      console.log(req)
      if (res[0] == "Question deleted.") {
        await Pregunta.remove({_id: pregunta._id})
        resOriginal.json({success: true, msg: "Pregunta eliminada"})    
      } else {
        resOriginal.json({success: true, msg: "Error borrando pregunta"})
      }
    })
}