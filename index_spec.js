var fs = require('fs');
var frisby = require('frisby');
var request = require('sync-request');

// sd = Swagger Definition
var sd = JSON.parse(fs.readFileSync('petstore.json', 'UTF-8'));

// get attributes from swagger defintion
var	paths = sd.paths;
var host = sd.host;
var basePath = sd.basePath;
var tags = sd.tags;
var schemes = sd.schemes;
var title = sd.info.title;
if (title == undefined) title = "unknown";


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
	for (var path in paths){
		var pathObj = paths[path];
		for (var method in pathObj){
			var methodObj = pathObj[method];
			var url = schemes + '://' + host + basePath + path;
			var responses = methodObj['responses'];
			
			var definition = findDefinition(responses);
			if (definition != undefined) console.log(definition);
			
			if (method == 'get'){
					frisby.create(methodObj['summary'])
			        .get(url)
			        .expectStatus(200)
			        .toss();
			} else if (method == 'post'){
				frisby.create(methodObj['summary'])
			        .post(url)
			        .expectStatus(200)
			        .toss();
			} else if (method == 'delete'){
				frisby.create(methodObj['summary'])
			        .delete(url)
			        .expectStatus(200)
			        .toss();
			} else if (method == 'put'){
				frisby.create(methodObj['summary'])
			        .put(url)
			        .expectStatus(200)
			        .toss();
			} 
		}


	} 
});

// find detailed object in definition
function findDefinition(responses){
	var definition;

	if (responses['200'] == undefined) return;
	
	if (responses['200']['type'] == 'array'){
		definition = responses['200']['schema']['items']['$ref'];
	} else {
		definition = responses['200']['schema']['$ref'];
	}
	return definition;
}

// get definition name success!!!