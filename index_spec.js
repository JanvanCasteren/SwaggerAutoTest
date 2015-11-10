var fs = require('fs');
var frisby = require('frisby');
var request = require('sync-request');
var urlencode = require('urlencode');

// sd = Swagger Definition
// var sd = JSON.parse(fs.readFileSync('lite.json', 'UTF-8'));
var sd = JSON.parse(fs.readFileSync('MessageAPI.json', 'UTF-8'));
var config = JSON.parse(fs.readFileSync('config.js', 'UTF-8'));

// get attributes from swagger defintion
var paths = sd['paths'];
var host = sd['host'];
var basePath = sd['basePath'];
var tags = sd['tags'];
var schemes = sd['schemes'];
var title = sd['info']['title'];
if (title == undefined) title = "unknown";
var definitions = sd['definitions'];

// get definition from '$ref'
String.prototype.getDefinition = function(){
    return this.replace('#/definitions/', '');
}

// replace types to conform to frisbyjs format.
String.prototype.replaceTypes = function(){
    return this.replace(/integer/g, 'Number').replace(/(undefined|string)/g, 'String').replace(/array/g, 'Array').replace(/boolean/g, 'Boolean').replace(/[,]$/, '');
}

// login to get ticket
var username = config['username'];
var password = config['password'];
var url = "http://123.56.40.165/service/api/v2/login?x-tenant-id=2";
var auth = "Basic " + new Buffer(username + ":" + password).toString("base64");

var res = request('POST', url, {
    'headers': {
        'Authorization': auth
    }
});

var ticket = JSON.parse(res.getBody()).ticket;

// global setup
frisby.globalSetup({
    request: {
        headers: {
            'x-ticket': ticket,
            'x-tenant-id': 2
        }
    },
    timeout: 10000
});


var expectJSONTypes;

describe(title, function(){
	for (path in paths){
		var pathObj = paths[path];
		for (method in pathObj){
			var methodObj = pathObj[method];
			var url = schemes + '://' + host + basePath + path;
			var responses = methodObj['responses'];
			var parameters = methodObj['parameters'];
			expectJSONTypes = '';
			handleResponses(responses);
			var requestUrl = getRequestUrl(url, parameters);

			var frisbyExec = 'frisby.create("' + methodObj['summary'] + '").' + 
			        method + '("' + requestUrl + '")' + 
			        '.expectStatus(200)' + 
			        expectJSONTypes + 
			        // '.inspectJSON()' +  
			        '.toss()';

            console.log(frisbyExec);
			eval(frisbyExec);
		}
	} 
});

// handle different situations of responses
function handleResponses(responses){

	var definition;
    // todo
	if (responses['200']['schema']['type'] == 'array'){
		definition = responses['200']['schema']['items']['$ref'];
	} else {
		definition = responses['200']['schema']['$ref'].replace('#/definitions/', '');
		return handleProperties(definitions[definition]['properties'], 'responses');
	}
}   

// handle different situations of properties
function handleProperties(properties, type, name){
    var JSONTypes = getJSONTypes(properties);

    if (type == 'responses'){
        expectJSONTypes += '.expectJSONTypes({' + JSONTypes + '})';
    } else if (type == 'array'){
        expectJSONTypes += '.expectJSONTypes("' + name +'.*", {' + JSONTypes + '})';
    } else if (type == 'object'){
        console.log(getJSONTypes(properties));
        expectJSONTypes = expectJSONTypes.replace(new RegExp(name + ':Object', 'g'), name + ':{' + getJSONTypes(properties) + '}');
    }

    for (i in properties){
        if (properties[i]['type'] == 'array'){
            var definition = properties[i]['items']['$ref'].getDefinition();
            handleProperties(definitions[definition]['properties'], 'array', i);
        } else if (properties[i]['$ref']){
            var definition = properties[i]['$ref'].getDefinition();
            handleProperties(definitions[definition]['properties'], 'object', i);
        }
    }
}


// traverse properties to get JOSNTypes
function getJSONTypes(properties){
    var JSONTypes = '';
    for (i in properties){
        JSONTypes += i + ':';
        if (properties[i]['$ref']){
            JSONTypes += 'Object' + ',';
        } else {
            JSONTypes += properties[i]['type'] + ',';
        }
    }
    JSONTypes = JSONTypes.replaceTypes();
    return JSONTypes;
}


// get request url with parameters
function getRequestUrl(url, parameters){

    // handle parameters in path
    // get variable array in path
    var placeholders = url.match(/\{.*?\}/g, '');

    if (placeholders != null){
        // replace variable in url by value from config.json
        for (var i = 0; i < placeholders.length; i++) {
            var placeholder = placeholders[i].replace(/[\{\}]/g, '');
            url = url.replace(placeholders[i], config[placeholder]);
        }
    }

    // handle parameters in query
    var paraStr = '';
    for (var i = 0; i < parameters.length; i++) {
        var name = parameters[i]['name'];
        var paraType = parameters[i]['in'];
        var required = parameters[i]['required'];

        // ignore parameters which have been handled
        if (name == 'x-ticket' || name == 'x-tenant-id' || paraType == 'path') continue;
        // ignore parameters not required and not in config.js
        if (!required && !config['name']) continue;

        // urlencode query parameters. eg ids=222,225 must be transformed to ids=222%2C225
        if (name == 'ids' || name == 'occupantIds') config[name] = urlencode(config[name]);
        paraStr += name + '=' + config[name] + '&';
        config[name] = urlencode.decode(config[name]);
    }

    if (paraStr != ''){
        url = url + '?' + paraStr.replace(/[&]$/, '');
    }

    return url;
}
