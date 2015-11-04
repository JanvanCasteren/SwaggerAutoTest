var fs = require('fs');
var frisby = require('frisby');
var request = require('sync-request');

// sd = Swagger Definition
var sd = JSON.parse(fs.readFileSync('lite.json', 'UTF-8'));
var config = JSON.parse(fs.readFileSync('config.js', 'UTF-8'));

// get attributes from swagger defintion
var	paths = sd['paths'];
var host = sd['host'];
var basePath = sd['basePath'];
var tags = sd['tags'];
var schemes = sd['schemes'];
var title = sd['info']['title'];
if (title == undefined) title = "unknown";
var definitions = sd['definitions'];


// login to get ticket
var username = "anonymousxian@sina.com",
    password = "111111",
    url = "http://123.56.40.165/service/api/v2/login?x-tenant-id=2",
    auth = "Basic " + new Buffer(username + ":" + password).toString("base64");

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
    }
});

describe(title, function(){
	for (path in paths){
		var pathObj = paths[path];
		for (method in pathObj){
			var methodObj = pathObj[method];
			var url = schemes + '://' + host + basePath + path;
			console.log(basePath);
			var responses = methodObj['responses'];
			var parameters = methodObj['parameters'];
			
			var JSONTypes = findDefinition(responses);
			var requestUrl = getRequestUrl(url, parameters);

			var frisbyExec = 'frisby.create("' + methodObj['summary'] + '").' + 
			        method + '("' + requestUrl + '")' + 
			        '.expectStatus(200)' + 
			        '.expectJSONTypes({' + JSONTypes + '})' +
			        // '.inspectJSON()' +  
			        '.toss()';
			
			console.log(frisbyExec);


			eval(frisbyExec);
		}
	} 
});

// find detailed object in definition
function findDefinition(responses){

	var definition;

	if (responses['200'] == undefined) return;
	
	if (responses['200']['schema']['type'] == 'array'){
		definition = responses['200']['schema']['items']['$ref'];
	} else {
		definition = responses['200']['schema']['$ref'];
	}
	
	if (definition != undefined){
		definition = definition.replace('#/definitions/', '');
	}


	if (definitions[definition]['type'] == 'object'){
		var JSONTypes = getJSONTypes(definitions[definition]['properties']);
	}

	return JSONTypes;
}

// get expectJSONTypes
function getJSONTypes(properties){
	var JSONTypes = '';
	// concatenate string which matches format of JSONTypes in Frisby
	for (i in properties){
		JSONTypes += i + ':';
		JSONTypes += properties[i]['type'] + ',';
	}

	JSONTypes = JSONTypes.replace(/integer/g, 'Number').replace(/string/g, 'String').replace(/array/g, 'Array').replace(/boolean/g, 'Boolean').replace(/[,]$/, '');

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

        // ignore parameters which have been handled
        if (name == 'x-ticket' || name == 'x-tenant-id' || paraType == 'path') continue;

        paraStr += name + '=' + config[name] + '&';
    }

    if (paraStr != ''){
        url = url + '?' + paraStr.replace(/[&]$/, '');
    }

    return url;
}
